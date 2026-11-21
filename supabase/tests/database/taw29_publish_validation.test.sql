begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set constraints all deferred;
-- 224 captured outcomes + 18 single-row assertions + 6 replay comparisons.
select plan(248);

-- State A must be red for missing schema; state B must finish with failed RPC
-- assertions. Never create replacement TAW-29 functions to make tests run.
select has_column('public', 'car_types', 'passenger_seats',
  'schema:validation:passenger-seats T2 capacity column exists');
select has_table('public', 'ride_series',
  'schema:validation:ride-series T2 series table exists');

-- Seed-independent TAW-4 fixtures, following taw4_review.test.sql:8-13.
insert into auth.users(id) values ('a29b1000-0000-4000-8000-000000000001');
insert into public.communities(id, name, active) values
  ('a29b1000-0000-4000-8000-000000000010', 'Validation community', true);
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents(kind, version, is_current) values
  ('terms', 'a29b-validation-v1', true), ('privacy', 'a29b-validation-v1', true);
insert into public.car_brands(id, name, active) values
  ('a29b1000-0000-4000-8000-000000000011', 'Validation brand', true);
insert into public.car_models(id, brand_id, name, active) values
  ('a29b1000-0000-4000-8000-000000000012',
   'a29b1000-0000-4000-8000-000000000011', 'Validation model', true);
insert into public.car_types(id, code, name, active) values
  ('a29b1000-0000-4000-8000-000000000013', 'a29b-validation', 'Validation type', true);
-- Keep the TAW-29 column separate from the base TAW-4 fixture insert.
update public.car_types set passenger_seats = 5
where id = 'a29b1000-0000-4000-8000-000000000013';
insert into public.places(id, name, active) values
  ('a29b1000-0000-4000-8000-000000000014', 'Validation origin', true),
  ('a29b1000-0000-4000-8000-000000000015', 'Validation destination', true);
insert into public.routes(id, place_a_id, place_b_id, duration_minutes, active) values
  ('a29b1000-0000-4000-8000-000000000016',
   'a29b1000-0000-4000-8000-000000000014',
   'a29b1000-0000-4000-8000-000000000015', 50, true);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29b1000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.complete_profile('Publish', 'Driver',
  'a29b1000-0000-4000-8000-000000000010', 'car_owner', true,
  'a29b-validation-v1', 'a29b-validation-v1');
select public.submit_car('a29b1000-0000-4000-8000-000000000101',
  'a29b1000-0000-4000-8000-000000000011', null,
  'a29b1000-0000-4000-8000-000000000012', null,
  'a29b1000-0000-4000-8000-000000000013', 2024, 'ب ١٢٣');
reset role;
set local role service_role;
select public.review_item('a29b1000-0000-4000-8000-000000000001', 'car_owner', 1, 'approved', null);
reset role;
update public.accounts set phone_e164 = '+201000029001', phone_verified = true
where user_id = 'a29b1000-0000-4000-8000-000000000001';

create function pg_temp.today() returns date language sql stable as $$
  select (now() at time zone 'Africa/Cairo')::date
$$;
create function pg_temp.weekday(p_offset int) returns date language sql stable as $$
  select min(pg_temp.today() + n) from generate_series(p_offset, 13) as g(n)
  where extract(dow from pg_temp.today() + n) in (0, 1, 2, 3, 4)
$$;
-- Stable, disjoint UUID namespaces for requests and owner-inserted fixtures.
create function pg_temp.request_id(p_name text) returns uuid language sql immutable as $$
  select ('a29b2000-' || substr(md5(p_name), 1, 4) || '-4000-8000-' || substr(md5(p_name), 5, 12))::uuid
$$;
-- Arguments are SQL expressions; explicit casts also disambiguate nulls while
-- the production function is absent. Named arguments avoid DEFAULT expressions
-- in a function call (which PostgreSQL does not support).
create function pg_temp.call_sql(
  p_name text,
  p_request text default null,
  p_route text default '''a29b1000-0000-4000-8000-000000000016''',
  p_dir text default '''a_to_b''', p_date text default 'pg_temp.weekday(1)',
  p_time text default '''07:00''', p_flex text default '0', p_seats text default '1',
  p_pickup text default 'null', p_notes text default 'null', p_repeat text default '''once'''
) returns text language sql as $$
  select format('select public.publish_ride((%s)::uuid,(%s)::uuid,(%s)::text,(%s)::date,(%s)::time,(%s)::int,(%s)::int,(%s)::text,(%s)::text,(%s)::text)',
    coalesce(p_request, quote_literal(pg_temp.request_id(p_name))), p_route,
    p_dir, p_date, p_time, p_flex, p_seats, p_pickup, p_notes, p_repeat)
$$;

create temporary table outcomes(
  id text primary key, expected_error text, expected_pickup text, expected_notes text,
  expected_replayed boolean not null, caller text not null,
  result jsonb, stored jsonb, error_state text, error_message text
);
grant select, insert on outcomes to authenticated;

-- This definer only inspects/cleans rows; it NEVER executes the publish RPC.
-- Raising on a missing result/series, no rides, or the wrong event count prevents
-- a NULL-returning or no-op publish from satisfying a successful probe.
create function pg_temp.inspect_and_cleanup(p_result jsonb, p_cleanup boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_series uuid;
  v_stored jsonb;
  v_rides bigint;
  v_events bigint;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object'
     or not (p_result ?& array['series_id','ride_id','share_code','ride_count','replayed']) then
    raise exception 'probe_missing_result';
  end if;
  v_series := (p_result->>'series_id')::uuid;
  if (p_result->>'ride_id')::uuid is null
     or coalesce((p_result->>'ride_count')::int, 0) < 1
     or not coalesce(p_result->>'share_code' ~ '^[0-9A-HJKMNP-TV-Z]{8}$', false) then
    raise exception 'probe_invalid_result';
  end if;
  select jsonb_build_object('pickup', s.pickup_note, 'notes', s.notes)
    into v_stored from public.ride_series s
    where s.id = v_series and s.owner_id = 'a29b1000-0000-4000-8000-000000000001';
  if v_stored is null then raise exception 'probe_missing_series'; end if;
  select count(*) into v_rides from public.rides where series_id = v_series;
  select count(*) into v_events from public.pilot_events where series_id = v_series;
  if v_rides < 1 or v_events <> 1 then
    raise exception 'probe_bad_counts: rides %, events %', v_rides, v_events;
  end if;
  if p_cleanup then
    delete from public.pilot_events where series_id = v_series;
    delete from public.ride_series where id = v_series;
  end if;
  return v_stored || jsonb_build_object('rides', v_rides, 'events', v_events);
end
$$;

-- Every TAW-29 call is dynamic and trapped here, including successful publishes
-- and replays. The invoker retains authenticated privileges, and records 42883
-- as a failing outcome in state B rather than aborting the file.
create function pg_temp.capture(
  p_id text, p_sql text, p_error text default null, p_cleanup boolean default true,
  p_pickup text default null, p_notes text default null, p_replayed boolean default false
) returns void language plpgsql security invoker as $$
declare
  v_result jsonb;
  v_stored jsonb;
  v_state text;
  v_message text;
begin
  begin
    execute p_sql into v_result;
    v_stored := pg_temp.inspect_and_cleanup(v_result, p_cleanup);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    v_result := null;
    v_stored := null;
  end;
  insert into pg_temp.outcomes values
    (p_id, p_error, p_pickup, p_notes, p_replayed, current_user,
     v_result, v_stored, v_state, v_message);
end
$$;

-- Steps 1-3: RESET ROLE does not clear the JWT setting.
set local role authenticated;
set local "request.jwt.claims" = '';
select pg_temp.capture('not_authenticated:no-claims',
  'select public.publish_ride(null::uuid,null::uuid,null::text,null::date,null::time,null::int,null::int,null::text,null::text,null::text)',
  'not_authenticated');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29b1000-0000-4000-8000-000000000099","role":"authenticated"}';
select pg_temp.capture('account_missing:no-row', pg_temp.call_sql('account-missing'), 'account_missing');
select pg_temp.capture('missing_argument:before-account-missing',
  pg_temp.call_sql('null-seats-missing-account', p_seats => 'null'), 'missing_argument');
set local "request.jwt.claims" = '{"sub":"a29b1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.capture('missing_argument:request-id', pg_temp.call_sql('null-request', p_request => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:route-id', pg_temp.call_sql('null-route', p_route => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:direction', pg_temp.call_sql('null-direction', p_dir => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:date', pg_temp.call_sql('null-date', p_date => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:time', pg_temp.call_sql('null-time', p_time => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:flex', pg_temp.call_sql('null-flex', p_flex => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:seats', pg_temp.call_sql('null-seats', p_seats => 'null'), 'missing_argument');
select pg_temp.capture('missing_argument:repeat', pg_temp.call_sql('null-repeat', p_repeat => 'null'), 'missing_argument');

reset role;
update public.accounts set phone_verified = false
where user_id = 'a29b1000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.capture('missing_argument:before-phone-gate',
  pg_temp.call_sql('null-unverified', p_seats => 'null'), 'missing_argument');
select pg_temp.capture('phone_unverified:order',
  pg_temp.call_sql('unverified', p_dir => '''bad''', p_seats => '0'), 'phone_unverified');
reset role;
update public.accounts set phone_verified = true
where user_id = 'a29b1000-0000-4000-8000-000000000001';
set local role service_role;
select public.review_item('a29b1000-0000-4000-8000-000000000001', 'car_owner', 1, 'rejected', null);
set local role authenticated;
select pg_temp.capture('car_not_approved:order',
  pg_temp.call_sql('unapproved', p_dir => '''bad''', p_seats => '0'), 'car_not_approved');
reset role;
set local role service_role;
select public.review_item('a29b1000-0000-4000-8000-000000000001', 'car_owner', 1, 'approved', null);
reset role;

-- Inactive route/endpoints are separate failures from a nonexistent route.
update public.routes set active = false where id = 'a29b1000-0000-4000-8000-000000000016';
set local role authenticated;
select pg_temp.capture('invalid_route:inactive', pg_temp.call_sql('inactive-route'), 'invalid_route');
reset role;
update public.routes set active = true where id = 'a29b1000-0000-4000-8000-000000000016';
update public.places set active = false where id = 'a29b1000-0000-4000-8000-000000000014';
set local role authenticated;
select pg_temp.capture('invalid_route:origin-inactive', pg_temp.call_sql('inactive-origin'), 'invalid_route');
reset role;
update public.places set active = true where id = 'a29b1000-0000-4000-8000-000000000014';
update public.places set active = false where id = 'a29b1000-0000-4000-8000-000000000015';
set local role authenticated;
select pg_temp.capture('invalid_route:destination-inactive', pg_temp.call_sql('inactive-destination'), 'invalid_route');
reset role;
update public.places set active = true where id = 'a29b1000-0000-4000-8000-000000000015';
set local role authenticated;
select pg_temp.capture('invalid_route:unknown',
  pg_temp.call_sql('unknown-route', p_route => '''a29b1000-0000-4000-8000-000000000999'''), 'invalid_route');
select pg_temp.capture('invalid_direction:outside-set', pg_temp.call_sql('direction', p_dir => '''sideways'''), 'invalid_direction');
-- Adjacent validation checks follow section 5.2's listed order (steps 7-10).
select pg_temp.capture('invalid_direction:before-repeat',
  pg_temp.call_sql('direction-repeat', p_dir => '''sideways''', p_repeat => '''weekly'''), 'invalid_direction');
select pg_temp.capture('invalid_repeat:outside-set', pg_temp.call_sql('repeat', p_repeat => '''weekly'''), 'invalid_repeat');
select pg_temp.capture('invalid_repeat:before-flexibility',
  pg_temp.call_sql('repeat-flex', p_repeat => '''weekly''', p_flex => '1'), 'invalid_repeat');
select pg_temp.capture('invalid_flexibility:outside-set', pg_temp.call_sql('flex', p_flex => '1'), 'invalid_flexibility');
select pg_temp.capture('invalid_flexibility:before-time',
  pg_temp.call_sql('flex-time', p_flex => '1', p_time => '''07:00:01'''), 'invalid_flexibility');
select pg_temp.capture('flexibility:allowed-' || n,
  pg_temp.call_sql('flex-' || n, p_flex => n::text)) from unnest(array[0,5,10,15,30]) as f(n);
select pg_temp.capture('invalid_time:seconds', pg_temp.call_sql('seconds', p_time => '''07:00:01'''), 'invalid_time');
select pg_temp.capture('invalid_time:before-seats',
  pg_temp.call_sql('time-seats', p_time => '''07:00:01''', p_seats => '0'), 'invalid_time');
select pg_temp.capture('invalid_time:24-00', pg_temp.call_sql('24-hour', p_time => '''24:00'''), 'invalid_time');
select pg_temp.capture('invalid_seats:zero', pg_temp.call_sql('zero-seats', p_seats => '0'), 'invalid_seats');
select pg_temp.capture('invalid_seats:before-pickup-length',
  pg_temp.call_sql('seats-pickup', p_seats => '0', p_pickup => 'repeat(''x'',81)'), 'invalid_seats');
select pg_temp.capture('invalid_seats:one', pg_temp.call_sql('one-seat', p_seats => '1'));
select pg_temp.capture('invalid_seats:capacity', pg_temp.call_sql('capacity', p_seats => '5'));
select pg_temp.capture('invalid_seats:capacity-plus-one', pg_temp.call_sql('over-capacity', p_seats => '6'), 'invalid_seats');
select pg_temp.capture('text-length:max',
  pg_temp.call_sql('max-text', p_pickup => 'repeat(''x'',80)', p_notes => 'repeat(''y'',200)'),
  p_pickup => repeat('x',80), p_notes => repeat('y',200));
select pg_temp.capture('invalid_pickup_note:81',
  pg_temp.call_sql('long-pickup', p_pickup => 'repeat(''x'',81)'), 'invalid_pickup_note');
select pg_temp.capture('invalid_notes:201',
  pg_temp.call_sql('long-notes', p_notes => 'repeat(''y'',201)'), 'invalid_notes');
select pg_temp.capture('notes:pickup-null', pg_temp.call_sql('pickup-null', p_pickup => 'null'));
select pg_temp.capture('notes:notes-null', pg_temp.call_sql('notes-null', p_notes => 'null'));
select pg_temp.capture('notes:pickup-empty', pg_temp.call_sql('pickup-empty', p_pickup => '''  '''));
select pg_temp.capture('notes:notes-empty', pg_temp.call_sql('notes-empty', p_notes => '''  '''));
select pg_temp.capture('notes:trimmed-text',
  pg_temp.call_sql('trimmed-text', p_pickup => '''  Gate A  ''', p_notes => '''  Quiet ride  '''),
  p_pickup => 'Gate A', p_notes => 'Quiet ride');

-- 4 scripts x 8 separators (including no separator) x 2 lengths + 10
-- email/link/benign cases = 74 cases, exercised in BOTH nullable text fields.
reset role;
create temporary table contact(id text primary key, value text not null, bad boolean not null);
with scripts(name, digits) as (values
  ('ascii','1234567'), ('arabic-indic','١٢٣٤٥٦٧'),
  ('extended-arabic-indic','۱۲۳۴۵۶۷'), ('fullwidth','１２３４５６７')),
separators(name, sep, wrap) as (values
  ('contiguous','',false), ('spaces',' ',false), ('dots','.',false),
  ('dashes','-',false), ('slashes','/',false), ('parentheses',')(',true),
  ('plus','+',false), ('tatweel','ـ',false)),
lengths(n, bad) as (values (6,false), (7,true))
insert into contact
select scripts.name || '-' || lengths.n || '-' || separators.name,
  case when separators.wrap then '(' else '' end ||
  string_agg(substr(scripts.digits, g.i, 1), separators.sep order by g.i) ||
  case when separators.wrap then ')' else '' end, lengths.bad
from scripts cross join separators cross join lengths
cross join lateral generate_series(1, lengths.n) as g(i)
group by scripts.name, scripts.digits, separators.name, separators.sep,
  separators.wrap, lengths.n, lengths.bad;
insert into contact values
  ('email-basic','a@example.com',true), ('email-case','A.B@Example.co.uk',true),
  ('email-fullwidth-at','a＠example.com',true), ('https','https://example.com',true),
  ('http-case','HTTP://x.y',true), ('www','www.example.com',true),
  ('whatsapp','wa.me/123',true), ('telegram','t.me/x',true),
  ('benign-zone','Main gate, Industrial Zone 1',false), ('benign-time','Leaves 7:30, gate 2.',false);
grant select on contact to authenticated;
set local role authenticated;
select pg_temp.capture('contact:pickup:' || c.id,
  pg_temp.call_sql('pickup-' || c.id, p_pickup => quote_literal(c.value)),
  p_error => case when c.bad then 'contact_details_not_allowed' end,
  p_pickup => c.value) from contact c order by c.id;
select pg_temp.capture('contact:notes:' || c.id,
  pg_temp.call_sql('notes-' || c.id, p_notes => quote_literal(c.value)),
  p_error => case when c.bad then 'contact_details_not_allowed' end,
  p_notes => c.value) from contact c order by c.id;

-- Future date cases never depend on today's weekday/hour. Midnight today has
-- departed even on Cairo's spring-forward day (00:00 maps to 01:00 that day).
select pg_temp.capture('contact_details_not_allowed:before-past',
  pg_temp.call_sql('contact-past', p_notes => '''a@example.com''', p_date => 'pg_temp.today()-1'),
  'contact_details_not_allowed');
-- A past weekend supplies both date faults regardless of today's weekday.
select pg_temp.capture('in_past:before-weekday',
  pg_temp.call_sql('past-weekend', p_date => '(select max(pg_temp.today()-n) from generate_series(1,7) g(n) where extract(dow from pg_temp.today()-n) in (5,6))',
    p_repeat => '''weekdays'''), 'in_past');
select pg_temp.capture('in_past:yesterday', pg_temp.call_sql('yesterday', p_date => 'pg_temp.today()-1'), 'in_past');
select pg_temp.capture('in_past:far-past',
  pg_temp.call_sql('far-past', p_date => 'date ''1900-01-01'''), 'in_past');
select pg_temp.capture('in_past:same-day',
  pg_temp.call_sql('midnight', p_date => 'pg_temp.today()', p_time => '''00:00'''), 'in_past');
select pg_temp.capture('beyond_window:day-13',
  pg_temp.call_sql('day-13', p_date => 'pg_temp.today()+13', p_time => '''23:59'''));
select pg_temp.capture('beyond_window:day-14',
  pg_temp.call_sql('day-14', p_date => 'pg_temp.today()+14'), 'beyond_window');
select pg_temp.capture('beyond_window:far-future',
  pg_temp.call_sql('far-future', p_date => 'date ''200000-01-01'''), 'beyond_window');
select pg_temp.capture('beyond_window:max-date',
  pg_temp.call_sql('max-date', p_date => 'date ''5874897-12-31'''), 'beyond_window');
select pg_temp.capture('invalid_weekday:weekend',
  pg_temp.call_sql('weekend', p_date => '(select min(pg_temp.today()+n) from generate_series(1,13) g(n) where extract(dow from pg_temp.today()+n) in (5,6))',
    p_repeat => '''weekdays'''), 'invalid_weekday');

-- Retain the FIRST returned JSON; later comparisons never reconstruct it from
-- stored published_* columns. The capture table remains readable by the caller.
select pg_temp.capture('publish-result:first',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false);
select pg_temp.capture('replay:initial',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false, p_replayed => true);
select pg_temp.capture('replay:whitespace-notes',
  pg_temp.call_sql('replay-key', p_pickup => '''  ''', p_notes => '''  ''', p_repeat => '''weekdays'''),
  p_cleanup => false, p_replayed => true);
select pg_temp.capture('request_conflict:null-to-text',
  pg_temp.call_sql('replay-key', p_notes => '''changed''', p_repeat => '''weekdays'''), 'request_conflict');
select pg_temp.capture('request_conflict:changed-input',
  pg_temp.call_sql('replay-key', p_dir => '''b_to_a''', p_repeat => '''weekdays'''), 'request_conflict');
reset role;
update public.accounts set phone_verified = false
where user_id = 'a29b1000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.capture('replay:while-unverified',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false, p_replayed => true);
select pg_temp.capture('request_conflict:while-unverified',
  pg_temp.call_sql('replay-key', p_notes => '''changed''', p_repeat => '''weekdays'''), 'request_conflict');
reset role;
update public.accounts set phone_verified = true
where user_id = 'a29b1000-0000-4000-8000-000000000001';
select ok(o.result is not null and o.result->>'ride_id' is not null
  and o.result->>'series_id' is not null
  and o.result->>'share_code' ~ '^[0-9A-HJKMNP-TV-Z]{8}$'
  and (select count(*) from jsonb_object_keys(o.result)) = 5
  and (o.result->>'ride_count')::int >= 1,
  'validation:publish-result:shape first result has exactly five nonnull fields')
from outcomes o where o.id = 'publish-result:first';
select ok(o.result is not null and exists (
  select 1 from public.ride_series s join public.rides r on r.id = s.published_ride_id
  where s.id = (o.result->>'series_id')::uuid
    and r.series_id = s.id and r.id = (o.result->>'ride_id')::uuid
    and r.share_code = o.result->>'share_code'
    and r.ride_date = pg_temp.weekday(1)
    and s.published_ride_count = (o.result->>'ride_count')::int
    and s.published_ride_count = (select count(*) from public.rides x where x.series_id = s.id)),
  'validation:publish-result:generated-count stored first ride and generated count match the first result')
from outcomes o where o.id = 'publish-result:first';
select ok(o.result is not null and (select count(*) from public.pilot_events e
  where e.series_id = (o.result->>'series_id')::uuid
    and e.ride_id = (o.result->>'ride_id')::uuid and e.event_type = 'ride_posted'
    and e.repeat = 'weekdays' and e.ride_count = (o.result->>'ride_count')::int) = 1,
  'validation:publish-result:event first-ride event stores repeat and count')
from outcomes o where o.id = 'publish-result:first';
select is((select count(*) from public.ride_series where request_id = pg_temp.request_id('replay-key')), 1::bigint,
  'validation:replay:one-series initial replays create no series');
select is((select count(*) from public.pilot_events where event_type = 'ride_posted'
  and user_id = 'a29b1000-0000-4000-8000-000000000001'), 1::bigint,
  'validation:replay:one-event initial replays create no event');

-- Model a later extension with a weekday OUTSIDE the original window. This date
-- cannot already exist, so ON CONFLICT DO NOTHING cannot hide a no-op extension.
insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date,
  departs_at, seats_offered, share_code)
select 'a29b1000-0000-4000-8000-000000000330', s.id, s.owner_id, s.route_id,
  s.direction, s.first_date + 14,
  (s.first_date + 14 + s.departure_time) at time zone 'Africa/Cairo', s.seats_offered, 'A29B1EXT'
from public.ride_series s where s.request_id = pg_temp.request_id('replay-key');
select ok(o.result is not null and (select count(*) from public.rides r
  where r.series_id = (o.result->>'series_id')::uuid) = (o.result->>'ride_count')::int + 1,
  'validation:replay:extension-added exactly one ride was added before replay')
from outcomes o where o.id = 'publish-result:first';
set local role authenticated;
select pg_temp.capture('replay:after-extension',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false, p_replayed => true);
reset role;
update public.rides set status = 'cancelled', cancelled_at = now()
where id = (select (result->>'ride_id')::uuid from outcomes where id = 'publish-result:first');
select is((select count(*) from public.rides where status = 'cancelled'
  and id = (select (result->>'ride_id')::uuid from outcomes where id = 'publish-result:first')), 1::bigint,
  'validation:replay:cancelled-fixture first ride is cancelled before replay');
set local role authenticated;
select pg_temp.capture('replay:after-cancel',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false, p_replayed => true);
reset role;
update public.rides set status = 'scheduled', cancelled_at = null, departs_at = now() - interval '1 minute'
where id = (select (result->>'ride_id')::uuid from outcomes where id = 'publish-result:first');
select is((select count(*) from public.rides where status = 'scheduled' and departs_at <= now()
  and id = (select (result->>'ride_id')::uuid from outcomes where id = 'publish-result:first')), 1::bigint,
  'validation:replay:departed-fixture first ride has departed before replay');
set local role authenticated;
select pg_temp.capture('replay:after-departure',
  pg_temp.call_sql('replay-key', p_repeat => '''weekdays'''), p_cleanup => false, p_replayed => true);
reset role;
select ok(first_call.result is not null and replay.result is not null
  and replay.result - 'replayed' = first_call.result - 'replayed'
  and replay.result->'replayed' = 'true'::jsonb,
  'validation:' || replay.id || ':four-fields equals the FIRST returned publish result')
from outcomes first_call cross join outcomes replay
where first_call.id = 'publish-result:first' and replay.expected_replayed
order by replay.id;
select is((select count(*) from public.ride_series where request_id = pg_temp.request_id('replay-key')), 1::bigint,
  'validation:replay:later-one-series later replays create no series');
select is((select count(*) from public.pilot_events where event_type = 'ride_posted'
  and user_id = 'a29b1000-0000-4000-8000-000000000001'), 1::bigint,
  'validation:replay:later-one-event later replays create no event');
select ok(o.result is not null and (select count(*) from public.rides r
  where r.series_id = (o.result->>'series_id')::uuid) = (o.result->>'ride_count')::int + 1,
  'validation:replay:later-ride-count replays do not add rides')
from outcomes o where o.id = 'publish-result:first';

-- Table-only builders run as owner. Deferring the circular published_ride_id FK
-- lets the series be inserted before its first ride, including after T2 alone.
create function pg_temp.clear_rides() returns void language plpgsql as $$
begin
  delete from public.pilot_events where user_id = 'a29b1000-0000-4000-8000-000000000001';
  delete from public.ride_series where owner_id = 'a29b1000-0000-4000-8000-000000000001';
end
$$;
create function pg_temp.seed_series(p_n int, p_repeat text, p_created timestamptz, p_date date, p_time time)
returns void language plpgsql as $$
declare
  v_series uuid := ('a29b3000-0000-4000-8000-' || lpad(p_n::text,12,'0'))::uuid;
  v_ride uuid := ('a29b4000-0000-4000-8000-' || lpad(p_n::text,12,'0'))::uuid;
begin
  insert into public.ride_series(id, owner_id, request_id, route_id, direction,
    first_date, departure_time, flex_minutes, seats_offered, repeat, created_at,
    published_ride_id, published_ride_count)
  values (v_series, 'a29b1000-0000-4000-8000-000000000001', pg_temp.request_id('seed-' || p_n),
    'a29b1000-0000-4000-8000-000000000016', 'a_to_b', p_date, p_time,
    0, 1, p_repeat, p_created, v_ride, 1);
  insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date,
    departs_at, seats_offered, share_code)
  values (v_ride, v_series, 'a29b1000-0000-4000-8000-000000000001',
    'a29b1000-0000-4000-8000-000000000016', 'a_to_b', p_date,
    (p_date + p_time) at time zone 'Africa/Cairo', 1, 'D' || lpad(p_n::text,7,'0'));
end
$$;

select pg_temp.clear_rides();
select pg_temp.seed_series(n, 'once',
  case when n = 1 then now() - interval '24 hours 1 second' else now() - interval '1 hour' end,
  pg_temp.today()-1, '02:00') from generate_series(1,10) as g(n);
select ok((select count(*) from public.ride_series where owner_id = 'a29b1000-0000-4000-8000-000000000001'
  and created_at >= now() - interval '24 hours') = 9
  and (select count(*) from public.ride_series where owner_id = 'a29b1000-0000-4000-8000-000000000001'
    and created_at = now() - interval '24 hours 1 second') = 1,
  'schema:validation:rate-limit-fixture nine inside and one just outside 24 hours');
set local role authenticated;
select pg_temp.capture('rate_limited:tenth-succeeds', pg_temp.call_sql('rate-tenth'), p_cleanup => false);
select pg_temp.capture('rate_limited:eleventh',
  pg_temp.call_sql('rate-eleventh', p_time => '''10:00'''), 'rate_limited');
reset role;
select is((select count(*) from public.ride_series
  where owner_id = 'a29b1000-0000-4000-8000-000000000001' and created_at >= now() - interval '24 hours'),
  10::bigint, 'validation:rate_limited:ten-persisted tenth persisted and eleventh added nothing');

select pg_temp.clear_rides();
select pg_temp.seed_series(21, 'weekdays', now(), pg_temp.weekday(1), '02:00');
select pg_temp.seed_series(22, 'weekdays', now(), pg_temp.weekday(1), '04:00');
-- The caller's cancelled weekdays series must not consume an active slot.
select pg_temp.seed_series(23, 'weekdays', now(), pg_temp.weekday(1), '06:00');
update public.ride_series set status = 'cancelled', cancelled_at = now()
where id = 'a29b3000-0000-4000-8000-000000000023';
update public.rides set status = 'cancelled', cancelled_at = now()
where series_id = 'a29b3000-0000-4000-8000-000000000023';
select is((select count(*) from public.ride_series
  where owner_id = 'a29b1000-0000-4000-8000-000000000001' and repeat = 'weekdays' and status = 'active'),
  2::bigint, 'schema:validation:series-limit-fixture two active weekdays series');
set local role authenticated;
select pg_temp.capture('too_many_series:third-succeeds',
  pg_temp.call_sql('series-third', p_repeat => '''weekdays'''), p_cleanup => false);
select pg_temp.capture('too_many_series:fourth',
  pg_temp.call_sql('series-fourth', p_time => '''10:00''', p_repeat => '''weekdays'''), 'too_many_series');
reset role;
select is((select count(*) from public.ride_series
  where owner_id = 'a29b1000-0000-4000-8000-000000000001' and repeat = 'weekdays' and status = 'active'),
  3::bigint, 'validation:too_many_series:three-persisted third persisted and fourth added nothing');

select pg_temp.clear_rides();
select pg_temp.seed_series(1, 'once', now(), pg_temp.weekday(1), '12:00');
-- seed 1 uses D0000001, a valid Crockford code (no U or L).
set local role authenticated;
select pg_temp.capture('duplicate_ride:minus-60', pg_temp.call_sql('minus-60', p_time => '''11:00'''), 'duplicate_ride');
select pg_temp.capture('duplicate_ride:plus-60', pg_temp.call_sql('plus-60', p_time => '''13:00'''), 'duplicate_ride');
select pg_temp.capture('duplicate_ride:minus-61', pg_temp.call_sql('minus-61', p_time => '''10:59'''));
select pg_temp.capture('duplicate_ride:plus-61', pg_temp.call_sql('plus-61', p_time => '''13:01'''));
reset role;
select pg_temp.clear_rides();
select pg_temp.seed_series(3, 'once', now(), pg_temp.weekday(1), '12:00');
update public.rides set status = 'cancelled', cancelled_at = now()
where id = 'a29b4000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.capture('duplicate_ride:cancelled-does-not-block',
  pg_temp.call_sql('cancelled-duplicate', p_time => '''12:00'''));
reset role;
select pg_temp.clear_rides();
select pg_temp.seed_series(4, 'once', now(), pg_temp.weekday(1), '12:00');
update public.ride_series set direction = 'b_to_a'
where id = 'a29b3000-0000-4000-8000-000000000004';
update public.rides set direction = 'b_to_a'
where id = 'a29b4000-0000-4000-8000-000000000004';
set local role authenticated;
select pg_temp.capture('duplicate_ride:opposite-direction-does-not-block',
  pg_temp.call_sql('opposite-duplicate', p_time => '''12:00'''));
reset role;
select pg_temp.clear_rides();
select pg_temp.seed_series(2, 'once', now(), pg_temp.weekday((pg_temp.weekday(1) - pg_temp.today()) + 1), '12:00');
select ok((select min(ride_date) from public.rides where owner_id = 'a29b1000-0000-4000-8000-000000000001') > pg_temp.weekday(1),
  'schema:validation:later-duplicate-fixture collision is after the requested first date');
set local role authenticated;
select pg_temp.capture('duplicate_ride:later-weekday',
  pg_temp.call_sql('later-duplicate', p_time => '''12:00''', p_repeat => '''weekdays'''), 'duplicate_ride');
reset role;

-- Static assertions over captured outcomes: no RPC is invoked by pgTAP itself.
-- Missing functions (42883), NULL results and the wrong caller all fail here.
-- Each successful capture also checks stored nonnull BEFORE nullable note values.
select case when o.expected_error is not null then
  is(o.error_state || ':' || o.error_message, 'P0001:' || o.expected_error,
    'validation:' || o.id || ' returns the specified error')
else
  ok(o.caller = 'authenticated' and o.error_state is null
    and o.result is not null and o.stored is not null
    and o.result->'replayed' = to_jsonb(o.expected_replayed)
    and o.result->>'series_id' is not null and o.result->>'ride_id' is not null
    and o.result->>'share_code' ~ '^[0-9A-HJKMNP-TV-Z]{8}$'
    and (o.result->>'ride_count')::int >= 1
    and (o.stored->>'rides')::int >= 1 and (o.stored->>'events')::int = 1
    and (o.stored->>'pickup') is not distinct from o.expected_pickup
    and (o.stored->>'notes') is not distinct from o.expected_notes,
    'validation:' || o.id || ' publishes as authenticated with persisted rows and normalized notes')
end from outcomes o order by o.id;

select * from finish();
rollback;
