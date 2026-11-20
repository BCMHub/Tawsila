-- TAW-29 T3: server-only writes, redacted readers, and weekday maintenance.
-- Configuration rows arrive in the following migration; none are needed here.

create function public.is_phone_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.accounts a
    where a.user_id = auth.uid() and a.phone_verified);
$$;

create function public.require_phone_verified() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_phone_verified() then raise exception 'phone_unverified'; end if;
end;
$$;

create function public.can_publish() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not public.is_phone_verified() then 'phone_unverified'
    when not public.can_post_rides() then 'car_not_approved'
    when not public.can_request_rides() then 'profile_incomplete'
    else 'ok'
  end;
$$;

create function public.taw29_post_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- Keep the role/review predicate identical to TAW-4 can_post_rides().
  -- Profile completion is a reader gate, not part of that predicate.
  select exists (
    select 1 from public.accounts a
    join public.profiles p on p.user_id = a.user_id
    join public.verification_items i on i.user_id = p.user_id
    where a.user_id = p_user and a.phone_verified
      and p.role in ('car_owner', 'both') and i.kind = 'car_owner'
      and i.status = 'approved' and i.reviewed_revision = i.revision
  );
$$;

create function public.taw29_ride_offerable(p_user uuid, p_seats int) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.taw29_post_eligible(p_user) and exists (
    select 1 from public.vehicles v join public.car_types t on t.id = v.type_id
    where v.user_id = p_user and p_seats between 1 and t.passenger_seats
  );
$$;

create function public.taw29_has_contact(p_text text) returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare
  v_base text := pg_catalog.translate(
    pg_catalog.lower(pg_catalog.normalize(p_text, 'NFKC')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
begin
  -- Retain punctuation for addresses/links; compact a separate digit copy.
  return coalesce(
    v_base ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
    or v_base ~ 'https?://|www\.|wa\.me/|t\.me/'
    or pg_catalog.regexp_replace(v_base, '[[:space:]./()+ـ-]', '', 'g') ~ '[0-9]{7}',
    false);
end;
$$;

create function public.ride_window_days() returns int
language sql immutable security definer set search_path = '' as $$
  select 14;
$$;

create function public.ride_limits() returns jsonb
language sql immutable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('max_series_per_24h', 10,
    'max_active_weekday_series', 3, 'duplicate_window_minutes', 60);
$$;

create function public.taw29_new_share_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_bytes bytea;
  v_code text;
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
begin
  for v_attempt in 1..5 loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for v_i in 0..7 loop
      -- 256 is divisible by 32: each character has five unbiased random bits.
      v_code := v_code || pg_catalog.substr(v_alphabet,
        (pg_catalog.get_byte(v_bytes, v_i) % 32) + 1, 1);
    end loop;
    if not exists (select 1 from public.rides r where r.share_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'share_code_unavailable';
end;
$$;

create function public.taw29_log_view(
  p_viewer uuid, p_ride uuid, p_source text, p_state text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.pilot_events
      (event_type, user_id, series_id, ride_id, source, ride_state, event_day, occurred_at)
    select 'ride_viewed', p_viewer, r.series_id, r.id, p_source, p_state,
      (pg_catalog.now() at time zone 'Africa/Cairo')::date, pg_catalog.now()
    from public.rides r where r.id = p_ride and r.owner_id <> p_viewer
    on conflict do nothing;
  exception when others then
    -- Never include payloads or exception messages in this warning.
    raise warning 'taw29_view_log_failed: %', sqlstate;
  end;
end;
$$;

create function public.publish_ride(
  p_request_id uuid, p_route_id uuid, p_direction text, p_date date, p_time time,
  p_flex_minutes int, p_seats int, p_pickup_note text, p_notes text, p_repeat text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_series public.ride_series%rowtype;
  v_pickup text;
  v_notes text;
  v_capacity int;
  v_today date := (pg_catalog.now() at time zone 'Africa/Cairo')::date;
  v_last date := v_today + public.ride_window_days() - 1;
  v_departure timestamptz;
  v_dates date[];
  v_date date;
  v_limits jsonb := public.ride_limits();
  v_duplicate_minutes int := (v_limits->>'duplicate_window_minutes')::int;
  v_series_id uuid;
  v_first_id uuid;
  v_ride_id uuid;
  v_code text;
  v_first_code text;
  v_constraint text;
  v_table text;
  v_schema text;
begin
  -- 1-2. Caller and required arguments precede all account information.
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or p_route_id is null or p_direction is null
    or p_date is null or p_time is null or p_flex_minutes is null
    or p_seats is null or p_repeat is null then
    raise exception 'missing_argument';
  end if;

  -- 3. Shared writer order: account -> car review -> series -> rides.
  perform 1 from public.accounts a where a.user_id = v_user for update;
  if not found then raise exception 'account_missing'; end if;
  perform 1 from public.verification_items i
    where i.user_id = v_user and i.kind = 'car_owner' for share;

  -- 4. Replay compares normalized inputs before rechecking eligibility.
  v_pickup := nullif(pg_catalog.btrim(p_pickup_note), '');
  v_notes := nullif(pg_catalog.btrim(p_notes), '');
  select s.* into v_series from public.ride_series s
    where s.owner_id = v_user and s.request_id = p_request_id;
  if found then
    if (v_series.route_id, v_series.direction, v_series.first_date,
        v_series.departure_time, v_series.flex_minutes, v_series.seats_offered,
        v_series.pickup_note, v_series.notes, v_series.repeat)
      is distinct from (p_route_id, p_direction, p_date, p_time,
        p_flex_minutes, p_seats, v_pickup, v_notes, p_repeat) then
      raise exception 'request_conflict';
    end if;
    select r.share_code into v_first_code from public.rides r
      where r.id = v_series.published_ride_id;
    return pg_catalog.jsonb_build_object('series_id', v_series.id,
      'ride_id', v_series.published_ride_id, 'share_code', v_first_code,
      'ride_count', v_series.published_ride_count, 'replayed', true);
  end if;

  -- 5-6. Authorisation point, protected by both row locks.
  perform public.require_phone_verified();
  if not public.can_post_rides() then raise exception 'car_not_approved'; end if;

  -- 7. Route and direction.
  if not exists (
    select 1 from public.routes r
    join public.places a on a.id = r.place_a_id
    join public.places b on b.id = r.place_b_id
    where r.id = p_route_id and r.active and a.active and b.active
  ) then raise exception 'invalid_route'; end if;
  if p_direction not in ('a_to_b', 'b_to_a') then raise exception 'invalid_direction'; end if;

  -- 8. Repeat, flexibility, then whole-minute time below 24:00.
  if p_repeat not in ('once', 'weekdays') then raise exception 'invalid_repeat'; end if;
  if p_flex_minutes not in (0, 5, 10, 15, 30) then raise exception 'invalid_flexibility'; end if;
  if p_time < time '00:00' or p_time >= time '24:00'
    or extract(second from p_time) <> 0 then raise exception 'invalid_time'; end if;

  -- 9. Current approved car capacity.
  select t.passenger_seats into v_capacity from public.vehicles v
    join public.car_types t on t.id = v.type_id where v.user_id = v_user;
  if not coalesce(p_seats between 1 and v_capacity, false) then
    raise exception 'invalid_seats';
  end if;

  -- 10. Length checks precede the two-copy contact filter.
  if pg_catalog.char_length(v_pickup) > 80 then raise exception 'invalid_pickup_note'; end if;
  if pg_catalog.char_length(v_notes) > 200 then raise exception 'invalid_notes'; end if;
  if public.taw29_has_contact(v_pickup) or public.taw29_has_contact(v_notes) then
    raise exception 'contact_details_not_allowed';
  end if;

  -- 11. Cairo dates/instants and the inclusive fourteen-date window.
  v_departure := (p_date + p_time) at time zone 'Africa/Cairo';
  if p_date < v_today or v_departure <= pg_catalog.now() then raise exception 'in_past'; end if;
  if p_date > v_last then raise exception 'beyond_window'; end if;
  if p_repeat = 'weekdays' and extract(dow from p_date) not in (0, 1, 2, 3, 4) then
    raise exception 'invalid_weekday';
  end if;

  -- 12. Replays and extension never consume these publish limits.
  if (select pg_catalog.count(*) from public.ride_series s where s.owner_id = v_user
      and s.created_at >= pg_catalog.now() - interval '24 hours')
    >= (v_limits->>'max_series_per_24h')::int then raise exception 'rate_limited'; end if;
  if p_repeat = 'weekdays' and
    (select pg_catalog.count(*) from public.ride_series s where s.owner_id = v_user
      and s.repeat = 'weekdays' and s.status = 'active')
    >= (v_limits->>'max_active_weekday_series')::int then raise exception 'too_many_series'; end if;

  -- 13. Materialize the complete date set and check all dates before any write.
  select pg_catalog.array_agg(p_date + g.n order by g.n) into v_dates
  from pg_catalog.generate_series(0, case when p_repeat = 'once' then 0 else v_last - p_date end) g(n)
  where (p_repeat = 'once' or extract(dow from p_date + g.n) in (0, 1, 2, 3, 4))
    and ((p_date + g.n + p_time) at time zone 'Africa/Cairo') > pg_catalog.now();
  if exists (
    select 1 from public.rides r cross join pg_catalog.unnest(v_dates) d(ride_date)
    where r.owner_id = v_user and r.route_id = p_route_id and r.direction = p_direction
      and r.status = 'scheduled'
      and r.departs_at between
        ((d.ride_date + p_time) at time zone 'Africa/Cairo') - v_duplicate_minutes * interval '1 minute'
        and ((d.ride_date + p_time) at time zone 'Africa/Cairo') + v_duplicate_minutes * interval '1 minute'
  ) then raise exception 'duplicate_ride'; end if;

  -- 14. Store immutable replay values at insertion, never reconstruct them later.
  v_series_id := pg_catalog.gen_random_uuid();
  v_first_id := pg_catalog.gen_random_uuid();
  -- Callers may have issued SET CONSTRAINTS ALL IMMEDIATE earlier in their tx.
  set constraints public.ride_series_published_ride_id_fkey deferred;
  insert into public.ride_series (id, owner_id, request_id, route_id, direction,
    first_date, departure_time, flex_minutes, seats_offered, pickup_note, notes,
    repeat, published_ride_id, published_ride_count)
  values (v_series_id, v_user, p_request_id, p_route_id, p_direction, p_date, p_time,
    p_flex_minutes, p_seats, v_pickup, v_notes, p_repeat, v_first_id, pg_catalog.cardinality(v_dates));
  foreach v_date in array v_dates loop
    v_ride_id := case when v_date = p_date then v_first_id else pg_catalog.gen_random_uuid() end;
    for v_attempt in 1..5 loop
      v_code := public.taw29_new_share_code();
      begin
        insert into public.rides (id, series_id, owner_id, route_id, direction,
          ride_date, departs_at, seats_offered, share_code)
        select v_ride_id, s.id, s.owner_id, s.route_id, s.direction, v_date,
          (v_date + s.departure_time) at time zone 'Africa/Cairo', s.seats_offered, v_code
        from public.ride_series s where s.id = v_series_id
        returning share_code into v_code;
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name,
          v_table = table_name, v_schema = schema_name;
        if v_constraint is distinct from 'rides_share_code_key'
          or v_table is distinct from 'rides' or v_schema is distinct from 'public' then
          raise;
        end if;
        if v_attempt = 5 then raise exception 'share_code_unavailable'; end if;
      end;
    end loop;
    if v_date = p_date then v_first_code := v_code; end if;
  end loop;

  -- 15. A posted-event failure aborts the entire publish (no exception handler).
  insert into public.pilot_events
    (event_type, user_id, series_id, ride_id, repeat, ride_count, event_day, occurred_at)
  values ('ride_posted', v_user, v_series_id, v_first_id, p_repeat,
    pg_catalog.cardinality(v_dates), v_today, pg_catalog.now());

  -- 16. First ride and original count are the immutable publish result.
  return pg_catalog.jsonb_build_object('series_id', v_series_id, 'ride_id', v_first_id,
    'share_code', v_first_code, 'ride_count', pg_catalog.cardinality(v_dates), 'replayed', false);
end;
$$;

create function public.extend_weekday_series() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_candidate record;
  v_series public.ride_series%rowtype;
  v_today date := (pg_catalog.now() at time zone 'Africa/Cairo')::date;
  v_last date := v_today + public.ride_window_days() - 1;
  v_date date;
  v_departure timestamptz;
  v_code text;
  v_constraint text;
  v_table text;
  v_schema text;
  v_inserted int;
  v_total int := 0;
  v_duplicate_minutes int := (public.ride_limits()->>'duplicate_window_minutes')::int;
begin
  -- Spec 8.1: overlapping runs return immediately, without interleaving.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtext('taw29-extend-weekday-series')::bigint) then return 0; end if;

  for v_candidate in select s.id, s.owner_id from public.ride_series s
    where s.status = 'active' and s.repeat = 'weekdays' order by s.id
  loop
    -- Candidate scan is unlocked. Acquire locks 1, 2, 3 in that order, then
    -- re-read state and eligibility using fresh statements under those locks.
    perform 1 from public.accounts a where a.user_id = v_candidate.owner_id for update;
    if not found then continue; end if;
    perform 1 from public.verification_items i
      where i.user_id = v_candidate.owner_id and i.kind = 'car_owner' for share;
    select s.* into v_series from public.ride_series s where s.id = v_candidate.id for update;
    if not found then continue; end if;
    if v_series.status <> 'active' or v_series.repeat <> 'weekdays' then continue; end if;
    -- Authorisation point: never use auth.uid() gates from the cron context.
    if not public.taw29_ride_offerable(v_series.owner_id, v_series.seats_offered) then continue; end if;

    for v_date in select v_today + g.n from pg_catalog.generate_series(0, v_last - v_today) g(n)
      where v_today + g.n >= v_series.first_date
        and extract(dow from v_today + g.n) in (0, 1, 2, 3, 4) order by g.n
    loop
      v_departure := (v_date + v_series.departure_time) at time zone 'Africa/Cairo';
      if v_departure <= pg_catalog.now() then continue; end if;
      -- A cancelled day remains present and must never be regenerated.
      if exists (select 1 from public.rides r
        where r.series_id = v_series.id and r.ride_date = v_date) then continue; end if;
      if exists (select 1 from public.rides r
        where r.owner_id = v_series.owner_id and r.route_id = v_series.route_id
          and r.direction = v_series.direction and r.status = 'scheduled'
          and r.departs_at between v_departure - v_duplicate_minutes * interval '1 minute'
            and v_departure + v_duplicate_minutes * interval '1 minute') then continue; end if;

      for v_attempt in 1..5 loop
        v_code := public.taw29_new_share_code();
        begin
          insert into public.rides (series_id, owner_id, route_id, direction,
            ride_date, departs_at, seats_offered, share_code)
          values (v_series.id, v_series.owner_id, v_series.route_id, v_series.direction,
            v_date, v_departure, v_series.seats_offered, v_code)
          on conflict (series_id, ride_date) do nothing;
          get diagnostics v_inserted = row_count;
          v_total := v_total + v_inserted;
          exit;
        exception when unique_violation then
          get stacked diagnostics v_constraint = constraint_name,
            v_table = table_name, v_schema = schema_name;
          if v_constraint is distinct from 'rides_share_code_key'
            or v_table is distinct from 'rides' or v_schema is distinct from 'public' then
            raise;
          end if;
          if v_attempt = 5 then raise exception 'share_code_unavailable'; end if;
        end;
      end loop;
    end loop;
  end loop;
  return v_total;
end;
$$;

-- The three readers deliberately expose the same explicit 26-key projection.
-- Redaction uses eligibility independently of the displayed state's precedence.
-- No vehicle free text, account id, phone, plate, or full surname is projected.
create function public.list_rides(
  p_route_id uuid, p_direction text, p_day date default null,
  p_after_departs_at timestamptz default null, p_after_id uuid default null,
  p_limit int default 30
) returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'Africa/Cairo')::date;
  v_last date := v_today + public.ride_window_days() - 1;
  v_limit int := coalesce(p_limit, 30);
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.can_request_rides() then raise exception 'profile_incomplete'; end if;
  if p_route_id is null or p_direction is null then raise exception 'missing_argument'; end if;
  if (p_after_departs_at is null) <> (p_after_id is null) then raise exception 'invalid_cursor'; end if;
  if v_limit not between 1 and 50 then raise exception 'invalid_limit'; end if;
  if p_day is not null and (p_day < v_today or p_day > v_last) then raise exception 'invalid_day'; end if;
  if not exists (
    select 1 from public.routes rt
    join public.places a on a.id = rt.place_a_id
    join public.places b on b.id = rt.place_b_id
    where rt.id = p_route_id and rt.active and a.active and b.active
  ) then raise exception 'invalid_route'; end if;
  if p_direction not in ('a_to_b', 'b_to_a') then raise exception 'invalid_direction'; end if;

  return query select pg_catalog.jsonb_build_object(
    'ride_id', r.id, 'share_code', r.share_code, 'route_id', r.route_id,
    'direction', r.direction,
    'from_name', case when r.direction = 'a_to_b' then a.name else b.name end,
    'from_area', case when r.direction = 'a_to_b' then a.area_label else b.area_label end,
    'to_name', case when r.direction = 'a_to_b' then b.name else a.name end,
    'to_area', case when r.direction = 'a_to_b' then b.area_label else a.area_label end,
    'duration_minutes', rt.duration_minutes,
    'ride_date', r.ride_date,
    'departure_time', (r.departs_at at time zone 'Africa/Cairo')::time,
    'departs_at', r.departs_at, 'flex_minutes', s.flex_minutes,
    'seats_offered', r.seats_offered, 'seats_left', r.seats_offered - r.seats_taken,
    'repeat', s.repeat, 'pickup_note', s.pickup_note, 'notes', s.notes,
    'created_at', r.created_at,
    'state', case
      when r.status = 'cancelled' or s.status = 'cancelled' then 'cancelled'
      when not public.taw29_ride_offerable(r.owner_id, r.seats_offered) then 'withdrawn'
      when r.departs_at <= pg_catalog.now() then 'departed'
      when r.seats_taken >= r.seats_offered then 'full'
      else 'available' end,
    'is_own', r.owner_id = v_user,
    'owner_display', p.first_name || ' ' || pg_catalog.left(p.last_name, 1) || '.',
    'owner_initials', pg_catalog.upper(pg_catalog.left(p.first_name, 1) || pg_catalog.left(p.last_name, 1)),
    'owner_member_since', pg_catalog.to_char(ac.created_at at time zone 'Africa/Cairo', 'Mon YYYY'),
    'owner_phone_verified', public.taw29_post_eligible(r.owner_id),
    'car_label', case when not public.taw29_post_eligible(r.owner_id) then null
      when v.brand_id is null then ct.name
      when v.model_id is null then cb.name || ' · ' || ct.name
      else cb.name || ' ' || cm.name || ' · ' || ct.name end
  )
  from public.rides r
  join public.ride_series s on s.id = r.series_id
  join public.routes rt on rt.id = r.route_id
  join public.places a on a.id = rt.place_a_id
  join public.places b on b.id = rt.place_b_id
  join public.accounts ac on ac.user_id = r.owner_id
  join public.profiles p on p.user_id = r.owner_id
  left join public.vehicles v on v.user_id = r.owner_id
  left join public.car_types ct on ct.id = v.type_id
  left join public.car_brands cb on cb.id = v.brand_id
  left join public.car_models cm on cm.id = v.model_id and cm.brand_id = v.brand_id
  where r.route_id = p_route_id and r.direction = p_direction
    and rt.active and a.active and b.active
    and r.status = 'scheduled' and s.status = 'active'
    and r.departs_at > pg_catalog.now() and r.seats_taken < r.seats_offered
    and public.taw29_ride_offerable(r.owner_id, r.seats_offered)
    and r.ride_date between v_today and v_last
    and (p_day is null or r.ride_date = p_day)
    and (p_after_departs_at is null or (r.departs_at, r.id) > (p_after_departs_at, p_after_id))
  order by r.departs_at, r.id limit v_limit;
end;
$$;

create function public.get_ride(p_ride_id uuid, p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.can_request_rides() then raise exception 'profile_incomplete'; end if;
  if p_source is null or p_source not in ('list', 'published') then raise exception 'invalid_source'; end if;

  select pg_catalog.jsonb_build_object(
    'ride_id', r.id, 'share_code', r.share_code, 'route_id', r.route_id,
    'direction', r.direction,
    'from_name', case when r.direction = 'a_to_b' then a.name else b.name end,
    'from_area', case when r.direction = 'a_to_b' then a.area_label else b.area_label end,
    'to_name', case when r.direction = 'a_to_b' then b.name else a.name end,
    'to_area', case when r.direction = 'a_to_b' then b.area_label else a.area_label end,
    'duration_minutes', rt.duration_minutes,
    'ride_date', r.ride_date,
    'departure_time', (r.departs_at at time zone 'Africa/Cairo')::time,
    'departs_at', r.departs_at, 'flex_minutes', s.flex_minutes,
    'seats_offered', r.seats_offered, 'seats_left', r.seats_offered - r.seats_taken,
    'repeat', s.repeat, 'pickup_note', s.pickup_note, 'notes', s.notes,
    'created_at', r.created_at,
    'state', case
      when r.status = 'cancelled' or s.status = 'cancelled' then 'cancelled'
      when not public.taw29_ride_offerable(r.owner_id, r.seats_offered) then 'withdrawn'
      when r.departs_at <= pg_catalog.now() then 'departed'
      when r.seats_taken >= r.seats_offered then 'full'
      else 'available' end,
    'is_own', r.owner_id = v_user,
    'owner_display', p.first_name || ' ' || pg_catalog.left(p.last_name, 1) || '.',
    'owner_initials', pg_catalog.upper(pg_catalog.left(p.first_name, 1) || pg_catalog.left(p.last_name, 1)),
    'owner_member_since', pg_catalog.to_char(ac.created_at at time zone 'Africa/Cairo', 'Mon YYYY'),
    'owner_phone_verified', public.taw29_post_eligible(r.owner_id),
    'car_label', case when not public.taw29_post_eligible(r.owner_id) then null
      when v.brand_id is null then ct.name
      when v.model_id is null then cb.name || ' · ' || ct.name
      else cb.name || ' ' || cm.name || ' · ' || ct.name end
  ) into v_result
  from public.rides r
  join public.ride_series s on s.id = r.series_id
  join public.routes rt on rt.id = r.route_id
  join public.places a on a.id = rt.place_a_id
  join public.places b on b.id = rt.place_b_id
  join public.accounts ac on ac.user_id = r.owner_id
  join public.profiles p on p.user_id = r.owner_id
  left join public.vehicles v on v.user_id = r.owner_id
  left join public.car_types ct on ct.id = v.type_id
  left join public.car_brands cb on cb.id = v.brand_id
  left join public.car_models cm on cm.id = v.model_id and cm.brand_id = v.brand_id
  where r.id = p_ride_id;
  if not found then raise exception 'ride_not_found'; end if;

  perform public.taw29_log_view(v_user, p_ride_id, p_source, v_result->>'state');
  return v_result;
end;
$$;

create function public.resolve_shared_ride(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_result jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.can_request_rides() then raise exception 'profile_incomplete'; end if;
  v_code := pg_catalog.translate(pg_catalog.upper(pg_catalog.btrim(p_code)), 'OIL', '011');
  if not coalesce(v_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$', false) then
    return pg_catalog.jsonb_build_object('state', 'not_found');
  end if;

  select pg_catalog.jsonb_build_object(
    'ride_id', r.id, 'share_code', r.share_code, 'route_id', r.route_id,
    'direction', r.direction,
    'from_name', case when r.direction = 'a_to_b' then a.name else b.name end,
    'from_area', case when r.direction = 'a_to_b' then a.area_label else b.area_label end,
    'to_name', case when r.direction = 'a_to_b' then b.name else a.name end,
    'to_area', case when r.direction = 'a_to_b' then b.area_label else a.area_label end,
    'duration_minutes', rt.duration_minutes,
    'ride_date', r.ride_date,
    'departure_time', (r.departs_at at time zone 'Africa/Cairo')::time,
    'departs_at', r.departs_at, 'flex_minutes', s.flex_minutes,
    'seats_offered', r.seats_offered, 'seats_left', r.seats_offered - r.seats_taken,
    'repeat', s.repeat, 'pickup_note', s.pickup_note, 'notes', s.notes,
    'created_at', r.created_at,
    'state', case
      when r.status = 'cancelled' or s.status = 'cancelled' then 'cancelled'
      when not public.taw29_ride_offerable(r.owner_id, r.seats_offered) then 'withdrawn'
      when r.departs_at <= pg_catalog.now() then 'departed'
      when r.seats_taken >= r.seats_offered then 'full'
      else 'available' end,
    'is_own', r.owner_id = v_user,
    'owner_display', p.first_name || ' ' || pg_catalog.left(p.last_name, 1) || '.',
    'owner_initials', pg_catalog.upper(pg_catalog.left(p.first_name, 1) || pg_catalog.left(p.last_name, 1)),
    'owner_member_since', pg_catalog.to_char(ac.created_at at time zone 'Africa/Cairo', 'Mon YYYY'),
    'owner_phone_verified', public.taw29_post_eligible(r.owner_id),
    'car_label', case when not public.taw29_post_eligible(r.owner_id) then null
      when v.brand_id is null then ct.name
      when v.model_id is null then cb.name || ' · ' || ct.name
      else cb.name || ' ' || cm.name || ' · ' || ct.name end
  ) into v_result
  from public.rides r
  join public.ride_series s on s.id = r.series_id
  join public.routes rt on rt.id = r.route_id
  join public.places a on a.id = rt.place_a_id
  join public.places b on b.id = rt.place_b_id
  join public.accounts ac on ac.user_id = r.owner_id
  join public.profiles p on p.user_id = r.owner_id
  left join public.vehicles v on v.user_id = r.owner_id
  left join public.car_types ct on ct.id = v.type_id
  left join public.car_brands cb on cb.id = v.brand_id
  left join public.car_models cm on cm.id = v.model_id and cm.brand_id = v.brand_id
  where r.share_code = v_code;
  if not found then return pg_catalog.jsonb_build_object('state', 'not_found'); end if;

  perform public.taw29_log_view(v_user, (v_result->>'ride_id')::uuid, 'link', v_result->>'state');
  return pg_catalog.jsonb_build_object('state', v_result->>'state', 'ride', v_result);
end;
$$;

-- Default function EXECUTE privileges must never open an alternate API path.
revoke all on function
  public.is_phone_verified(), public.require_phone_verified(), public.can_publish(),
  public.publish_ride(uuid,uuid,text,date,time,integer,integer,text,text,text),
  public.list_rides(uuid,text,date,timestamptz,uuid,integer),
  public.get_ride(uuid,text), public.resolve_shared_ride(text),
  public.taw29_post_eligible(uuid), public.taw29_ride_offerable(uuid,integer),
  public.taw29_has_contact(text), public.taw29_log_view(uuid,uuid,text,text),
  public.taw29_new_share_code(), public.ride_window_days(), public.ride_limits(),
  public.extend_weekday_series()
from public, anon, authenticated, service_role;

grant execute on function
  public.is_phone_verified(), public.require_phone_verified(), public.can_publish(),
  public.publish_ride(uuid,uuid,text,date,time,integer,integer,text,text,text),
  public.list_rides(uuid,text,date,timestamptz,uuid,integer),
  public.get_ride(uuid,text), public.resolve_shared_ride(text)
to authenticated;

-- Explicitly replace only this job, so scheduling is safe to repeat.
create extension if not exists pg_cron;
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'taw29-extend-weekday-series';
select cron.schedule('taw29-extend-weekday-series', '7 * * * *', 'select public.extend_weekday_series()');
