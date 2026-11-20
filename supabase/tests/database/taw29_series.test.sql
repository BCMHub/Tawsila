begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set constraints all deferred;
select plan(145);

-- T1: schema-only databases must reach finish(); absent schema must fail.
-- Only calls to TAW-29 functions are exception-trapped. TAW-4 fixture errors
-- abort loudly. No locks/concurrency claims: those belong to concurrency.sh.
select has_table('public', 'ride_series', 'schema:series-table ride_series exists');
select has_table('public', 'rides', 'schema:rides-table rides exists');

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('a29c1000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Each probe returns a tagged result, so missing functions cannot masquerade
-- as false/zero or compare equal to another missing-function result.
create function pg_temp.call(q text, actor uuid default null, api_role text default null)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', case when actor is null then '{}'
    else jsonb_build_object('sub', actor, 'role', 'authenticated')::text end, true);
  if api_role is not null then execute format('set local role %I', api_role); end if;
  execute q into v;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
  return jsonb_build_object('value', v);
exception when others then
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
  return jsonb_build_object('sqlstate', sqlstate, 'error', sqlerrm);
end $$;

-- These helpers deliberately have NO exception handler.
create function pg_temp.profile(n int, profile_role text default 'car_owner')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.complete_profile('Series', 'Fixture', 'a29c1000-0000-4000-8000-000000000001',
    profile_role, true, 'taw29-series-v1', 'taw29-series-v1');
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function pg_temp.car(n int, revision int default 1, car_type int default 31)
returns void language plpgsql as $$
declare k uuid := pg_temp.uid(10000 + n * 10 + revision); t uuid := pg_temp.uid(car_type);
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.submit_car(k, 'a29c1000-0000-4000-8000-000000000011', null,
    'a29c1000-0000-4000-8000-000000000021', null, t, 2024, 'س ١-٢');
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function pg_temp.review(n int, decision text, revision int default 1)
returns void language plpgsql as $$
declare u uuid := pg_temp.uid(n);
begin
  -- review_item is granted to service_role, never authenticated.
  execute 'set local role service_role';
  perform public.review_item(u, 'car_owner', revision, decision, 'TAW-29 series fixture');
  execute 'reset role';
end $$;

insert into public.communities(id, name, active)
values (pg_temp.uid(1), 'TAW-29 series community', true);
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents(kind, version, is_current)
values ('terms', 'taw29-series-v1', true), ('privacy', 'taw29-series-v1', true);
insert into public.car_brands(id, name, active) values (pg_temp.uid(11), 'TAW-29 series brand', true);
insert into public.car_models(id, brand_id, name, active)
values (pg_temp.uid(21), pg_temp.uid(11), 'TAW-29 series model', true);
insert into public.car_types(id, code, name, active) values
  (pg_temp.uid(31), 'taw29-series-eight', 'Series eight', true),
  (pg_temp.uid(32), 'taw29-series-four', 'Series four', true),
  (pg_temp.uid(33), 'taw29-series-lowered', 'Series private capacity', true);
-- The only guarded fixture statement: the added TAW-29 column may be absent.
-- The base type insert above must succeed independently of that column.
create temp table capacity_setup(ok boolean not null);
do $$ begin
  update public.car_types set passenger_seats = case when id = pg_temp.uid(32) then 4 else 8 end
  where id in (pg_temp.uid(31), pg_temp.uid(32), pg_temp.uid(33));
  insert into capacity_setup values (true);
exception when undefined_column then insert into capacity_setup values (false);
end $$;
select ok((select ok from capacity_setup), 'schema:series-capacity-column passenger_seats fixture update succeeded');

create temp table owners(n int primary key, state text, expected boolean);
insert into owners values
  (101, 'approved', true), (102, 'unverified', false), (103, 'pending', false),
  (104, 'rejected', false), (105, 'rider', false), (106, 'stale', false),
  (107, 'no-car', false), (108, 'both', true), (109, 'capacity', true),
  (110, 'publish', true), (201, 'idempotent', true), (202, 'control', true),
  (203, 'revoke', true), (204, 'reject', true), (205, 'resubmit', true),
  (206, 'replacement', true), (207, 'cancel-series', true), (208, 'cancel-day', true),
  (209, 'duplicate', true), (210, 'lower-type', true), (211, 'once-skip', true),
  (212, 'window', true), (213, 'time-projection', true);
insert into auth.users(id) select pg_temp.uid(n) from owners;
do $$ declare f record; begin
  for f in select * from owners order by n loop
    perform pg_temp.profile(f.n, case when f.n = 108 then 'both' else 'car_owner' end);
    if f.n <> 107 then
      perform pg_temp.car(f.n, 1, case when f.n = 210 then 33 else 31 end);
      if f.n <> 103 then
        perform pg_temp.review(f.n, case when f.n = 104 then 'rejected' else 'approved' end);
      end if;
    end if;
  end loop;
end $$;
-- The rider keeps an approved car, but TAW-4 permits submission only as an owner.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29c1000-0000-4000-8000-000000000105","role":"authenticated"}';
select public.set_role('rider');
reset role;
set local "request.jwt.claims" = '{}';
update public.accounts set phone_e164 = '+201000' || right(user_id::text, 6),
  phone_verified = (user_id <> pg_temp.uid(102)) where user_id in (select pg_temp.uid(n) from owners);
-- Deliberate TAW-4 stale revision fixture: preserve the previous decision.
update public.verification_items set revision = 2 where user_id = pg_temp.uid(106);
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(101) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-approved verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(102) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-unverified verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(103) and kind = 'car_owner' and status = 'pending' and revision = 1 and reviewed_revision is null),
  'schema:series-fixture-pending verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(104) and kind = 'car_owner' and status = 'rejected' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-rejected verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(105) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-rider verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(106) and kind = 'car_owner' and status = 'approved' and revision = 2 and reviewed_revision = 1),
  'schema:series-fixture-stale verification status and revision');
select ok(not exists(select 1 from public.verification_items where user_id = pg_temp.uid(107)),
  'schema:series-fixture-no-car verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(108) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-both verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(109) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-capacity verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(110) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-publish verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(201) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-idempotent verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(202) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-control verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(203) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-revoke verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(204) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-reject verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(205) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-resubmit verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(206) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-replacement verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(207) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-cancel-series verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(208) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-cancel-day verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(209) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-duplicate verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(210) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-lower-type verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(211) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-once-skip verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(212) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-window verification status and revision');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(213) and kind = 'car_owner' and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-time-projection verification status and revision');

insert into public.places(id, name) values (pg_temp.uid(41), 'Series origin'), (pg_temp.uid(42), 'Series destination');
insert into public.routes(id, place_a_id, place_b_id, duration_minutes)
values (pg_temp.uid(51), pg_temp.uid(41), pg_temp.uid(42), 50);

-- Isolate database-wide extension counts from pre-existing local series.
reset role;
update public.ride_series set status = 'cancelled', cancelled_at = now() where status = 'active';
select ok(not exists(select 1 from public.ride_series where status = 'active' and repeat = 'weekdays'),
  'schema:series-extension-isolated no active weekdays series before fixtures');

-- now() is transaction-stable; every chosen gap is at least tomorrow, and
-- never beyond Cairo today + 13. Next Sunday is 1..7 days ahead even on Sunday.
create temp table window_dates as
select today, today + 13 as last_date,
  today + (7 - extract(dow from today)::int) as first_sunday
from (select (now() at time zone 'Africa/Cairo')::date as today) d;
create temp table expected_dates as
select w.today + i as ride_date
from window_dates w cross join generate_series(0, 13) i
where w.today + i >= w.first_sunday and extract(dow from w.today + i) in (0,1,2,3,4)
  and ((w.today + i + time '07:00') at time zone 'Africa/Cairo') > now();
select ok((select count(*) >= 5 and min(ride_date) > (select today from window_dates)
  and max(ride_date) <= (select last_date from window_dates) from expected_dates),
  'schema:series-gap-window future weekday gap exists at every weekday and hour');

create function pg_temp.rows(s uuid) returns jsonb language sql as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.ride_date, r.id), '[]'::jsonb)
  from public.rides r where r.series_id = s
$$;
-- Snapshot all public persistent table data; eligibility/offerability must not
-- write to accounts, verification, rides, events, configuration, or any other table.
create function pg_temp.snapshot() returns jsonb language plpgsql as $$
declare t record; v jsonb; result jsonb := '{}'::jsonb;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t', t.tablename) into v;
    result := result || jsonb_build_object(t.tablename, v);
  end loop;
  return result;
end $$;
create temp table before_probe(value jsonb);
insert into before_probe select pg_temp.snapshot();
create temp table eligibility(n int primary key, internal jsonb, caller jsonb, offerable jsonb);
-- Separate owner and authenticated calls: no role changes inside a boolean
-- expression, and an absent function cannot pass by false = false.
insert into eligibility(n, internal)
select n, pg_temp.call(format('select to_jsonb(public.taw29_post_eligible(%L::uuid))', pg_temp.uid(n))) from owners;
update eligibility e set caller = pg_temp.call(
  'select to_jsonb(public.is_phone_verified() and public.can_post_rides())', pg_temp.uid(e.n), 'authenticated');
update eligibility e set offerable = pg_temp.call(format(
  'select to_jsonb(public.taw29_ride_offerable(%L::uuid, 8))', pg_temp.uid(e.n)));
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 101),
  'series:eligibility:approved owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 102),
  'series:eligibility:unverified owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 103),
  'series:eligibility:pending owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 104),
  'series:eligibility:rejected owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 105),
  'series:eligibility:rider owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 106),
  'series:eligibility:stale owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 107),
  'series:eligibility:no-car owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 108),
  'series:eligibility:both owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 109),
  'series:eligibility:capacity owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 110),
  'series:eligibility:publish owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 201),
  'series:eligibility:idempotent owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 202),
  'series:eligibility:control owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 203),
  'series:eligibility:revoke owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 204),
  'series:eligibility:reject owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 205),
  'series:eligibility:resubmit owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 206),
  'series:eligibility:replacement owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 207),
  'series:eligibility:cancel-series owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 208),
  'series:eligibility:cancel-day owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 209),
  'series:eligibility:duplicate owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 210),
  'series:eligibility:lower-type owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 211),
  'series:eligibility:once-skip owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 212),
  'series:eligibility:window owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select internal = jsonb_build_object('value', o.expected)
  and caller = internal and offerable = internal from eligibility e join owners o using(n) where n = 213),
  'series:eligibility:time-projection owner gate equals verified AND can_post_rides as user; offerable at capacity');
select ok((select bool_and(internal ? 'value' and caller ? 'value' and offerable ? 'value') from eligibility)
  and pg_temp.snapshot() = (select value from before_probe),
  'series:eligibility:no-side-effects gate probes change no persistent table');
truncate before_probe;
insert into before_probe select pg_temp.snapshot();
create temp table capacity_probes as
select seats, pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))', pg_temp.uid(109), seats)) as result
from (values (8), (9)) p(seats);
select is((select result from capacity_probes where seats = 8),
  '{"value":true}'::jsonb, 'series:capacity:equal eligible at current car capacity');
select is((select result from capacity_probes where seats = 9),
  '{"value":false}'::jsonb, 'series:capacity:plus-one ineligible above current car capacity');
select ok((select bool_and(result ? 'value') from capacity_probes)
  and pg_temp.snapshot() = (select value from before_probe),
  'series:capacity:no-side-effects capacity probes change no persistent table');
select is(pg_temp.call('select to_jsonb(public.ride_window_days())'), '{"value":14}'::jsonb,
  'series:window:days today plus thirteen days');

-- V5 pins are schema/data-only checks of the database tzdata, before API checks.
select is(timestamp '2026-10-29 23:30' at time zone 'Africa/Cairo', timestamptz '2026-10-29 21:30+00',
  'schema:series-time-fall-pin Cairo conversion uses the pinned offset');
select is(timestamp '2027-04-30 00:30' at time zone 'Africa/Cairo', timestamptz '2027-04-29 22:30+00',
  'schema:series-time-spring-pin Cairo conversion uses the pinned offset');
select is(timestamp '2026-10-29 07:00' at time zone 'Africa/Cairo', timestamptz '2026-10-29 04:00+00',
  'schema:series-time-fall-before Cairo conversion uses the pinned offset');
select is(timestamp '2026-11-01 07:00' at time zone 'Africa/Cairo', timestamptz '2026-11-01 05:00+00',
  'schema:series-time-fall-after Cairo conversion uses the pinned offset');
select is(timestamp '2027-04-29 07:00' at time zone 'Africa/Cairo', timestamptz '2027-04-29 05:00+00',
  'schema:series-time-spring-before Cairo conversion uses the pinned offset');
select is(timestamp '2027-05-02 07:00' at time zone 'Africa/Cairo', timestamptz '2027-05-02 04:00+00',
  'schema:series-time-spring-after Cairo conversion uses the pinned offset');
select is((timestamp '2027-04-30 00:30' at time zone 'Africa/Cairo' at time zone 'Africa/Cairo')::time,
  time '01:30', 'schema:series-time-spring-effective skipped 00:30 becomes 01:30');
select is((timestamp '2026-10-29 23:30' at time zone 'Africa/Cairo' at time zone 'Africa/Cairo')::time,
  time '23:30', 'schema:series-time-fall-effective ambiguous 23:30 stays 23:30');

select is(timestamp '2026-10-30 07:00' at time zone 'Africa/Cairo', timestamptz '2026-10-30 05:00+00',
  'schema:series-time-fall-next-day first standard-time morning');
select is(timestamp '2027-04-30 07:00' at time zone 'Africa/Cairo', timestamptz '2027-04-30 04:00+00',
  'schema:series-time-spring-next-day first daylight-saving morning');

-- Actual publish, separately trapped and named. All extension fixtures below
-- are independent table fixtures, so a broken publish cannot hide their setup.
create temp table published(kind text primary key, result jsonb);
insert into published values ('weekdays', pg_temp.call(format($q$
  select public.publish_ride(%L::uuid, %L::uuid, 'a_to_b', %L::date, '07:00'::time,
    10, 8, 'Gate A', 'Series fixture', 'weekdays')
$q$, pg_temp.uid(30001), pg_temp.uid(51), (select first_sunday from window_dates)), pg_temp.uid(110), 'authenticated'));
insert into published values ('once', pg_temp.call(format($q$
  select public.publish_ride(%L::uuid, %L::uuid, 'b_to_a', %L::date, '07:00'::time,
    5, 4, null, null, 'once')
$q$, pg_temp.uid(30002), pg_temp.uid(51), (select first_sunday from window_dates)), pg_temp.uid(110), 'authenticated'));
select ok((select count(*) = 2 and bool_and(result ? 'value'
  and result->'value' ?& array['series_id','ride_id','share_code','ride_count']
  and result->'value'->>'replayed' = 'false') from published),
  'series:fixture:publish-ok both publishes return complete non-replayed results');
select is((select array_agg(r.ride_date order by r.ride_date) from public.rides r
  where r.series_id = (select (result->'value'->>'series_id')::uuid from published where kind = 'weekdays')),
  (select array_agg(ride_date order by ride_date) from expected_dates),
  'series:generation:weekdays exact future Sunday-through-Thursday window set');
select is((select (result->'value'->>'ride_count')::int from published where kind = 'weekdays'),
  (select count(*)::int from expected_dates), 'series:generation:count count follows actual Cairo window');
select ok((select count(*) = 1 and min(ride_date) = (select first_sunday from window_dates)
  from public.rides where series_id = (select (result->'value'->>'series_id')::uuid from published where kind = 'once')),
  'series:generation:once exactly one row on requested date');
select ok((select count(*) = (select count(*) + 1 from expected_dates)
  and bool_and((r.owner_id, r.route_id, r.direction, r.seats_offered) =
    (s.owner_id, s.route_id, s.direction, s.seats_offered))
  from public.rides r join public.ride_series s on s.id = r.series_id where s.owner_id = pg_temp.uid(110)),
  'series:generation:copied-columns all published rows copy owner route direction and seats');
select ok((select count(*) > 0 and bool_and(r.departs_at > now()
  and r.ride_date between w.today and w.last_date
  and r.departs_at = ((r.ride_date + s.departure_time) at time zone 'Africa/Cairo'))
  from public.rides r join public.ride_series s on s.id = r.series_id cross join window_dates w
  where s.owner_id = pg_temp.uid(110)), 'series:generation:future-window future instants use Cairo date and requested time');

-- Direct, complete weekday fixtures. No TAW-29 function is used to arrange
-- extension tests; every fixture has its own owner, series, and request id.
create function pg_temp.seed(n int) returns void language plpgsql as $$
declare first_day date; d date; j int := 0; cnt int;
begin
  select min(ride_date), count(*) into first_day, cnt from expected_dates;
  insert into public.ride_series(id, owner_id, request_id, route_id, direction,
    first_date, departure_time, flex_minutes, seats_offered, pickup_note, notes,
    repeat, published_ride_id, published_ride_count)
  values (pg_temp.uid(40000+n), pg_temp.uid(n), pg_temp.uid(50000+n), pg_temp.uid(51), 'a_to_b',
    first_day, '07:00', 10, 8, 'Gate A', 'Series fixture', 'weekdays', pg_temp.uid(60000+n*100), cnt);
  for d in select ride_date from expected_dates order by ride_date loop
    insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date,
      departs_at, seats_offered, share_code)
    values (pg_temp.uid(60000+n*100+j), pg_temp.uid(40000+n), pg_temp.uid(n), pg_temp.uid(51), 'a_to_b',
      d, (d + time '07:00') at time zone 'Africa/Cairo', 8, lpad((60000+n*100+j)::text, 8, '0'));
    j := j + 1;
  end loop;
end $$;
create temp table extension_before(label text primary key, series_id uuid, gap date, rows jsonb);
create temp table extension_result(label text primary key, result jsonb);

-- Idempotency: delete the last future row, observe one repair, then exact replay.
select pg_temp.seed(201);
insert into extension_before
select 'idempotent', pg_temp.uid(40201), max(ride_date), null from expected_dates;
delete from public.rides where series_id = pg_temp.uid(40201)
  and ride_date = (select gap from extension_before where label = 'idempotent');
update extension_before set rows = pg_temp.rows(series_id) where label = 'idempotent';
select ok((select jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  and gap > (select today from window_dates) and not exists(select 1 from public.rides r
    where r.series_id = b.series_id and r.ride_date = b.gap)
  from extension_before b where label = 'idempotent'), 'schema:series-idempotent-gap last future ride deleted by owner');
reset role;
set local "request.jwt.claims" = '{}';
select pg_advisory_xact_lock(hashtext('taw29-extend-weekday-series'));
insert into extension_result values ('idempotent-first', pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is((select result from extension_result where label = 'idempotent-first'), '{"value":1}'::jsonb,
  'series:extension:idempotent-first exactly one missing date created');
select ok((select count(*) = 1 and bool_and(r.status = 'scheduled' and r.departs_at =
  ((b.gap + time '07:00') at time zone 'Africa/Cairo') and r.departs_at > now())
  from public.rides r join extension_before b on r.series_id = b.series_id and r.ride_date = b.gap
  where b.label = 'idempotent'), 'series:extension:idempotent-gap restored as one future scheduled ride');
select ok((select result ? 'value' from extension_result where label = 'idempotent-first')
  and (select coalesce(jsonb_agg(to_jsonb(r) order by r.ride_date, r.id), '[]'::jsonb)
  from public.rides r join extension_before b on r.series_id = b.series_id
  where b.label = 'idempotent' and r.ride_date <> b.gap) = (select rows from extension_before where label = 'idempotent'),
  'series:extension:idempotent-retained all other rows unchanged');
insert into extension_before values ('idempotent-second', pg_temp.uid(40201), null, pg_temp.rows(pg_temp.uid(40201)));
insert into extension_result values ('idempotent-second', pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is((select result from extension_result where label = 'idempotent-second'), '{"value":0}'::jsonb,
  'series:extension:idempotent-zero second immediate run creates zero');
select ok((select result ? 'value' from extension_result where label = 'idempotent-second')
  and pg_temp.rows(pg_temp.uid(40201)) = (select rows from extension_before where label = 'idempotent-second'),
  'series:extension:idempotent-row-set second run preserves ids dates and every stored value');

-- Skip cases share a single invocation and an eligible positive control, but
-- have independent owners/series. The private lowered type is never type 31.
do $$ declare n int; begin
  foreach n in array array[202,203,204,205,206,207,208,210] loop perform pg_temp.seed(n); end loop;
end $$;
insert into extension_before(label, series_id, gap)
select state, pg_temp.uid(40000+n), (select max(ride_date) from expected_dates)
from owners where n in (202,203,204,205,206,207,208,210);
delete from public.rides r using extension_before b
where r.series_id = b.series_id and r.ride_date = b.gap
  and b.label in ('control','revoke','reject','resubmit','replacement','cancel-series','lower-type');
update public.rides set status = 'cancelled', cancelled_at = now()
where series_id = pg_temp.uid(40208) and ride_date = (select max(ride_date) from expected_dates);
update public.accounts set phone_verified = false where user_id = pg_temp.uid(203);
select pg_temp.review(204, 'rejected');
select pg_temp.review(205, 'rejected');
select pg_temp.car(205, 2);
select pg_temp.review(206, 'rejected');
select pg_temp.car(206, 2, 32);
select pg_temp.review(206, 'approved', 2);
update public.ride_series set status = 'cancelled', cancelled_at = now() where id = pg_temp.uid(40207);
update public.car_types set passenger_seats = 4 where id = pg_temp.uid(33);
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(203)
  and status = 'approved' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-revoke-changed verification status and revision after change');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(204)
  and status = 'rejected' and revision = 1 and reviewed_revision = 1),
  'schema:series-fixture-reject-changed verification status and revision after change');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(205)
  and status = 'pending' and revision = 2 and reviewed_revision is null),
  'schema:series-fixture-resubmit-changed verification status and revision after change');
select ok(exists(select 1 from public.verification_items where user_id = pg_temp.uid(206)
  and status = 'approved' and revision = 2 and reviewed_revision = 2),
  'schema:series-fixture-replacement-changed verification status and revision after change');
select ok(exists(select 1 from public.vehicles v join public.car_types t on t.id = v.type_id
  where v.user_id = pg_temp.uid(206) and t.id = pg_temp.uid(32) and t.passenger_seats = 4)
  and (select seats_offered = 8 from public.ride_series where id = pg_temp.uid(40206)),
  'schema:series-fixture-smaller-car approved replacement has four seats for unchanged eight-seat series');
update extension_before set rows = pg_temp.rows(series_id)
where label in ('control','revoke','reject','resubmit','replacement','cancel-series','cancel-day','lower-type');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'control'),
  'schema:series-gap-control candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'revoke'),
  'schema:series-gap-revoke candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'reject'),
  'schema:series-gap-reject candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'resubmit'),
  'schema:series-gap-resubmit candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'replacement'),
  'schema:series-gap-replacement candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'cancel-series'),
  'schema:series-gap-cancel-series candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap and r.status = 'cancelled')
  and jsonb_array_length(rows) = (select count(*)   from expected_dates)
  from extension_before b cross join window_dates w where label = 'cancel-day'),
  'schema:series-gap-cancel-day candidate date is future inside window and arranged');
select ok((select gap > w.today and gap <= w.last_date and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap)
  and jsonb_array_length(rows) = (select count(*) - 1 from expected_dates)
  from extension_before b cross join window_dates w where label = 'lower-type'),
  'schema:series-gap-lower-type candidate date is future inside window and arranged');
-- Test the exact authorisation predicate independently from the equality suite.
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40202)),
  '{"value":true}'::jsonb, 'series:offerable:control authorisation uses current car and series seats');
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40203)),
  '{"value":false}'::jsonb, 'series:offerable:revoke authorisation uses current car and series seats');
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40204)),
  '{"value":false}'::jsonb, 'series:offerable:reject authorisation uses current car and series seats');
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40205)),
  '{"value":false}'::jsonb, 'series:offerable:resubmit authorisation uses current car and series seats');
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40206)),
  '{"value":false}'::jsonb, 'series:offerable:replacement authorisation uses current car and series seats');
select is((select pg_temp.call(format('select to_jsonb(public.taw29_ride_offerable(%L::uuid, %s))',
  s.owner_id, s.seats_offered)) from public.ride_series s where s.id = pg_temp.uid(40210)),
  '{"value":false}'::jsonb, 'series:offerable:lower-type authorisation uses current car and series seats');
reset role;
set local "request.jwt.claims" = '{}';
insert into extension_result values ('skips', pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is((select result from extension_result where label = 'skips'), '{"value":1}'::jsonb,
  'series:extension:skip-count only eligible control gap is filled');
select ok((select count(*) = 1 and bool_and(r.status = 'scheduled' and r.departs_at =
  ((b.gap + time '07:00') at time zone 'Africa/Cairo'))
  from public.rides r join extension_before b on r.series_id = b.series_id and r.ride_date = b.gap
  where b.label = 'control'), 'series:extension:positive-control eligible owner gap filled in same run');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and (select coalesce(jsonb_agg(to_jsonb(r) order by r.ride_date, r.id), '[]'::jsonb)
  from public.rides r join extension_before b on r.series_id = b.series_id
  where b.label = 'control' and r.ride_date <> b.gap) = (select rows from extension_before where label = 'control'),
  'series:extension:control-retained positive control changes only the missing date');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'revoke')) = (select rows from extension_before where label = 'revoke'),
  'series:extension:revoke exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'reject')) = (select rows from extension_before where label = 'reject'),
  'series:extension:reject exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'resubmit')) = (select rows from extension_before where label = 'resubmit'),
  'series:extension:resubmit exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'replacement')) = (select rows from extension_before where label = 'replacement'),
  'series:extension:replacement exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'cancel-series')) = (select rows from extension_before where label = 'cancel-series'),
  'series:extension:cancel-series exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'cancel-day')) = (select rows from extension_before where label = 'cancel-day'),
  'series:extension:cancel-day exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and pg_temp.rows((select series_id from extension_before where label = 'lower-type')) = (select rows from extension_before where label = 'lower-type'),
  'series:extension:lower-type exact row set preserved after extension');
select ok((select result ? 'value' from extension_result where label = 'skips')
  and (select count(*) = 1 and bool_and(r.status = 'cancelled')
  from public.rides r join extension_before b on r.series_id = b.series_id and r.ride_date = b.gap
  where b.label = 'cancel-day'), 'series:extension:cancelled-day-single exactly one cancelled row remains');
-- Retained skipped gaps must not contaminate later, independently counted runs.
-- All their owners remain ineligible or their series cancelled; cancelled days
-- remain present. No successful case changes another case's owner/type.

-- Duplicate-date boundaries: D at +60, D2 at +61, D3 opposite direction.
select pg_temp.seed(209);
create temp table duplicate_dates as
select ride_date, row_number() over(order by ride_date desc)::int as pos
from expected_dates;
insert into extension_before(label, series_id, gap)
select 'duplicate-' || pos, pg_temp.uid(40209), ride_date from duplicate_dates where pos <= 3;
delete from public.rides r using duplicate_dates d
where r.series_id = pg_temp.uid(40209) and r.ride_date = d.ride_date and d.pos <= 3;
-- Independent once series are table fixtures, not trapped publish calls.
insert into public.ride_series(id, owner_id, request_id, route_id, direction, first_date,
  departure_time, flex_minutes, seats_offered, repeat, published_ride_id, published_ride_count)
select pg_temp.uid(41000+pos), pg_temp.uid(209), pg_temp.uid(51000+pos), pg_temp.uid(51),
  case when pos = 3 then 'b_to_a' else 'a_to_b' end, ride_date,
  case pos when 1 then time '08:00' when 2 then time '08:01' else time '07:00' end,
  0, 8, 'once', pg_temp.uid(91000+pos), 1 from duplicate_dates where pos <= 3;
insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date, departs_at, seats_offered, share_code)
select s.published_ride_id, s.id, s.owner_id, s.route_id, s.direction, s.first_date,
  (s.first_date + s.departure_time) at time zone 'Africa/Cairo', s.seats_offered,
  lpad((91000+d.pos)::text, 8, '0') from public.ride_series s join duplicate_dates d on s.id = pg_temp.uid(41000+d.pos)
where d.pos <= 3;
update extension_before set rows = pg_temp.rows(series_id) where label like 'duplicate-%';
select ok((select count(*) = 3 and bool_and(b.gap > w.today and b.gap <= w.last_date
  and not exists(select 1 from public.rides r where r.series_id = b.series_id and r.ride_date = b.gap))
  from extension_before b cross join window_dates w where label like 'duplicate-%'),
  'schema:series-duplicate-gaps three distinct future missing weekdays');
create temp table duplicate_once_before as
select id, pg_temp.rows(id) as rows from public.ride_series where id in (pg_temp.uid(41001),pg_temp.uid(41002),pg_temp.uid(41003));
reset role;
set local "request.jwt.claims" = '{}';
insert into extension_result values ('duplicates', pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is((select result from extension_result where label = 'duplicates'), '{"value":2}'::jsonb,
  'series:extension:duplicate-count only sixty-one-minute and opposite-direction gaps filled');
select ok((select result ? 'value' from extension_result where label = 'duplicates')
  and not exists(select 1 from public.rides where series_id = pg_temp.uid(40209)
  and ride_date = (select ride_date from duplicate_dates where pos = 1)),
  'series:extension:duplicate-sixty inclusive sixty-minute duplicate date skipped');
select ok((select count(*) = 1 and bool_and(status = 'scheduled'
  and departs_at = ((ride_date + time '07:00') at time zone 'Africa/Cairo'))
  from public.rides where series_id = pg_temp.uid(40209)
  and ride_date = (select ride_date from duplicate_dates where pos = 2)),
  'series:extension:duplicate-sixty-one sixty-one-minute gap filled');
select ok((select count(*) = 1 and bool_and(status = 'scheduled' and direction = 'a_to_b'
  and departs_at = ((ride_date + time '07:00') at time zone 'Africa/Cairo'))
  from public.rides where series_id = pg_temp.uid(40209)
  and ride_date = (select ride_date from duplicate_dates where pos = 3)),
  'series:extension:duplicate-direction opposite direction does not block');
select ok((select result ? 'value' from extension_result where label = 'duplicates')
  and (select coalesce(jsonb_agg(to_jsonb(r) order by r.ride_date, r.id), '[]'::jsonb)
  from public.rides r where r.series_id = pg_temp.uid(40209)
  and r.ride_date not in (select ride_date from duplicate_dates where pos <= 3)) = (select rows from extension_before where label = 'duplicate-1'),
  'series:extension:duplicate-retained pre-existing weekday rows unchanged');
select ok((select result ? 'value' from extension_result where label = 'duplicates')
  and (select count(*) = 3 and bool_and(pg_temp.rows(id) = rows) from duplicate_once_before),
  'series:extension:duplicate-once-retained competing once rides unchanged');

-- Non-concurrent window rules: an old active series has no end date. Seed only
-- its historical published row; extension must create the entire future set,
-- omit elapsed departures, weekends and dates beyond today+13, ignoring limits.
create temp table window_expected as
select w.today + i as ride_date from window_dates w cross join generate_series(0,13) i
where extract(dow from w.today + i) in (0,1,2,3,4)
  and ((w.today + i + time '07:00') at time zone 'Africa/Cairo') > now();
insert into public.ride_series(id, owner_id, request_id, route_id, direction, first_date,
  departure_time, flex_minutes, seats_offered, repeat, published_ride_id, published_ride_count)
values (pg_temp.uid(40212), pg_temp.uid(212), pg_temp.uid(50212), pg_temp.uid(51), 'a_to_b',
  date '2020-01-05', '07:00', 10, 8, 'weekdays', pg_temp.uid(90212), 1),
  (pg_temp.uid(40211), pg_temp.uid(211), pg_temp.uid(50211), pg_temp.uid(51), 'a_to_b',
  date '2020-01-05', '07:00', 10, 8, 'once', pg_temp.uid(90211), 1);
insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date, departs_at, seats_offered, share_code)
select s.published_ride_id, s.id, s.owner_id, s.route_id, s.direction, s.first_date,
  (s.first_date + s.departure_time) at time zone 'Africa/Cairo', s.seats_offered,
  case when s.id = pg_temp.uid(40212) then '00090212' else '00090211' end
from public.ride_series s where id in (pg_temp.uid(40212), pg_temp.uid(40211));
-- Exhaust publish limits for this owner: eleven posts in the last 24 hours,
-- including three active weekday series. Other active series are already full
-- at distinct times; cancelled once series cannot add extension work.
do $$
declare i int; j int; d date; tm time; dates date[];
begin
  for i in 1..10 loop
    tm := case when i = 1 then time '10:00' else time '13:00' end;
    dates := case when i <= 2 then (select array_agg(ride_date order by ride_date) from expected_dates)
      else array[date '2020-01-05'] end;
    insert into public.ride_series(id, owner_id, request_id, route_id, direction, first_date,
      departure_time, flex_minutes, seats_offered, repeat, status, cancelled_at, published_ride_id, published_ride_count)
    values (pg_temp.uid(43000+i), pg_temp.uid(212), pg_temp.uid(53000+i), pg_temp.uid(51), 'a_to_b', dates[1],
      tm, 0, 8, case when i <= 2 then 'weekdays' else 'once' end,
      case when i <= 2 then 'active' else 'cancelled' end, case when i > 2 then now() end,
      pg_temp.uid(93000+i*100), cardinality(dates));
    j := 0;
    foreach d in array dates loop
      insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date, departs_at, seats_offered, share_code)
      values (pg_temp.uid(93000+i*100+j), pg_temp.uid(43000+i), pg_temp.uid(212), pg_temp.uid(51), 'a_to_b', d,
        (d + tm) at time zone 'Africa/Cairo', 8, lpad((93000+i*100+j)::text,8,'0'));
      j := j + 1;
    end loop;
  end loop;
end $$;
select ok((select count(*) = 11 and count(*) filter(where repeat = 'weekdays' and status = 'active') = 3
  from public.ride_series where owner_id = pg_temp.uid(212) and created_at > now() - interval '24 hours'),
  'schema:series-publish-limits owner already exceeds daily publish limit and has three active series');
create temp table limit_rows_before as
select id, pg_temp.rows(id) as rows from public.ride_series
where owner_id = pg_temp.uid(212) and id <> pg_temp.uid(40212);
insert into extension_before values
  ('window', pg_temp.uid(40212), null, pg_temp.rows(pg_temp.uid(40212))),
  ('once', pg_temp.uid(40211), null, pg_temp.rows(pg_temp.uid(40211)));
reset role;
set local "request.jwt.claims" = '{}';
insert into extension_result values ('window', pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is((select result from extension_result where label = 'window'),
  jsonb_build_object('value', (select count(*) from window_expected)),
  'series:extension:window-count exact number of future dates added to old series');
select ok((select result = jsonb_build_object('value', (select count(*) from window_expected))
  from extension_result where label = 'window') and
  (select count(*) = 10 and bool_and(pg_temp.rows(id) = rows) from limit_rows_before),
  'series:extension:ignores-publish-limits fills target despite limits and preserves other series');
select is((select array_agg(ride_date order by ride_date) from public.rides
  where series_id = pg_temp.uid(40212) and id <> pg_temp.uid(90212)),
  (select array_agg(ride_date order by ride_date) from window_expected),
  'series:extension:window-set no end date; future weekdays only through Cairo today plus thirteen');
select ok((select result ? 'value' from extension_result where label = 'window')
  and (select to_jsonb(r) from public.rides r where id = pg_temp.uid(90212)) = (select rows->0 from extension_before where label = 'window'),
  'series:extension:window-history historical published row unchanged');
select ok((select result ? 'value' from extension_result where label = 'window')
  and pg_temp.rows(pg_temp.uid(40211)) = (select rows from extension_before where label = 'once'),
  'series:extension:once-skip active once series never extended');
select ok((select count(*) > 0 and bool_and(r.departs_at > now()
  and r.departs_at = ((r.ride_date + s.departure_time) at time zone 'Africa/Cairo')
  and (r.owner_id,r.route_id,r.direction,r.seats_offered) = (s.owner_id,s.route_id,s.direction,s.seats_offered))
  from public.rides r join public.ride_series s on s.id = r.series_id
  where s.id = pg_temp.uid(40212) and r.id <> pg_temp.uid(90212)),
  'series:extension:copied-columns extended rows copy series columns and Cairo time');

-- Deterministic transition fixtures bypass only the rolling-window publish
-- validation. Their series are cancelled so cron must never extend them.
create temp table time_cases(n int, name text, local_time timestamp, expected_instant timestamptz, effective time);
insert into time_cases values
  (1, 'fall-pin', '2026-10-29 23:30', '2026-10-29 21:30+00', '23:30'),
  (2, 'spring-pin', '2027-04-30 00:30', '2027-04-29 22:30+00', '01:30'),
  (3, 'fall-before', '2026-10-29 07:00', '2026-10-29 04:00+00', '07:00'),
  (4, 'fall-after', '2026-11-01 07:00', '2026-11-01 05:00+00', '07:00'),
  (5, 'spring-before', '2027-04-29 07:00', '2027-04-29 05:00+00', '07:00'),
  (6, 'spring-after', '2027-05-02 07:00', '2027-05-02 04:00+00', '07:00');
insert into public.ride_series(id, owner_id, request_id, route_id, direction, first_date,
  departure_time, flex_minutes, seats_offered, repeat, status, cancelled_at, published_ride_id, published_ride_count)
select pg_temp.uid(42000+n), pg_temp.uid(213), pg_temp.uid(52000+n), pg_temp.uid(51), 'a_to_b',
  local_time::date, local_time::time, 0, 8, case when n = 2 then 'once' else 'weekdays' end,
  'cancelled', now(), pg_temp.uid(92000+n), 1 from time_cases;
insert into public.rides(id, series_id, owner_id, route_id, direction, ride_date, departs_at, seats_offered, share_code)
select pg_temp.uid(92000+n), pg_temp.uid(42000+n), pg_temp.uid(213), pg_temp.uid(51), 'a_to_b',
  local_time::date, local_time at time zone 'Africa/Cairo', 8, lpad((92000+n)::text,8,'0') from time_cases;
create temp table projections(ride_id uuid primary key, result jsonb);
insert into projections
select r.id, pg_temp.call(format('select public.get_ride(%L::uuid, ''list'')', r.id), r.owner_id, 'authenticated')
from public.rides r where r.owner_id in (pg_temp.uid(110),pg_temp.uid(201),pg_temp.uid(202),pg_temp.uid(209),pg_temp.uid(212),pg_temp.uid(213));
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 1),
  'series:time:fall-pin API returns pinned instant effective Cairo time and date');
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 2),
  'series:time:spring-pin API returns pinned instant effective Cairo time and date');
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 3),
  'series:time:fall-before API returns pinned instant effective Cairo time and date');
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 4),
  'series:time:fall-after API returns pinned instant effective Cairo time and date');
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 5),
  'series:time:spring-before API returns pinned instant effective Cairo time and date');
select ok((select p.result ? 'value'
  and (p.result->'value'->>'departs_at')::timestamptz = t.expected_instant
  and (p.result->'value'->>'departure_time')::time = t.effective
  and (p.result->'value'->>'ride_date')::date = t.local_time::date
  from projections p join time_cases t on p.ride_id = pg_temp.uid(92000+t.n) where t.n = 6),
  'series:time:spring-after API returns pinned instant effective Cairo time and date');
select ok((select count(*) > 0 and bool_and(coalesce(p.result ? 'value'
  and (p.result->'value'->>'departure_time')::time = (r.departs_at at time zone 'Africa/Cairo')::time
  and (p.result->'value'->>'ride_date')::date = r.ride_date
  and r.ride_date = (r.departs_at at time zone 'Africa/Cairo')::date, false))
  from projections p join public.rides r on r.id = p.ride_id),
  'series:time:effective-equalities every generated and transition ride exposes effective time and date');
select ok((select count(*) = (select count(*) from expected_dates)
  and bool_and(coalesce((p.result->'value'->>'departure_time')::time = time '07:00', false))
  from projections p join public.rides r on r.id = p.ride_id where r.series_id = pg_temp.uid(40201)),
  'series:time:generated-departure-time non-skipped generated rides keep requested 07:00');

-- Equality for the changed fixture states is tested independently of skipping.
truncate before_probe;
insert into before_probe select pg_temp.snapshot();
create temp table changed_eligibility(n int primary key, expected boolean, internal jsonb, caller jsonb);
insert into changed_eligibility(n, expected) values (203,false),(204,false),(205,false),(206,true),(210,true);
update changed_eligibility set internal = pg_temp.call(format(
  'select to_jsonb(public.taw29_post_eligible(%L::uuid))', pg_temp.uid(n)));
update changed_eligibility set caller = pg_temp.call(
  'select to_jsonb(public.is_phone_verified() and public.can_post_rides())', pg_temp.uid(n), 'authenticated');
select ok((select internal = jsonb_build_object('value', expected) and caller = internal
  from changed_eligibility where n = 203),
  'series:eligibility:revoked internal gate still equals user gate conjunction');
select ok((select internal = jsonb_build_object('value', expected) and caller = internal
  from changed_eligibility where n = 204),
  'series:eligibility:rejected-after-approval internal gate still equals user gate conjunction');
select ok((select internal = jsonb_build_object('value', expected) and caller = internal
  from changed_eligibility where n = 205),
  'series:eligibility:pending-revision-two internal gate still equals user gate conjunction');
select ok((select internal = jsonb_build_object('value', expected) and caller = internal
  from changed_eligibility where n = 206),
  'series:eligibility:approved-smaller-car internal gate still equals user gate conjunction');
select ok((select internal = jsonb_build_object('value', expected) and caller = internal
  from changed_eligibility where n = 210),
  'series:eligibility:lowered-capacity internal gate still equals user gate conjunction');
select ok((select bool_and(internal ? 'value' and caller ? 'value') from changed_eligibility)
  and pg_temp.snapshot() = (select value from before_probe),
  'series:eligibility:changed-no-side-effects changed-state probes leave every table unchanged');

-- All extension calls above run with RESET ROLE and empty claims, like cron.
-- API-role execution must fail with permission denied for each owner-only gate.
select is(pg_temp.call($q$select to_jsonb(public.extend_weekday_series())$q$, pg_temp.uid(109), 'anon')->>'sqlstate',
  '42501', 'series:access:extend_weekday_series-anon API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_post_eligible('a29c1000-0000-4000-8000-000000000109'::uuid))$q$, pg_temp.uid(109), 'anon')->>'sqlstate',
  '42501', 'series:access:taw29_post_eligible-anon API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_ride_offerable('a29c1000-0000-4000-8000-000000000109'::uuid, 8))$q$, pg_temp.uid(109), 'anon')->>'sqlstate',
  '42501', 'series:access:taw29_ride_offerable-anon API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.extend_weekday_series())$q$, pg_temp.uid(109), 'authenticated')->>'sqlstate',
  '42501', 'series:access:extend_weekday_series-authenticated API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_post_eligible('a29c1000-0000-4000-8000-000000000109'::uuid))$q$, pg_temp.uid(109), 'authenticated')->>'sqlstate',
  '42501', 'series:access:taw29_post_eligible-authenticated API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_ride_offerable('a29c1000-0000-4000-8000-000000000109'::uuid, 8))$q$, pg_temp.uid(109), 'authenticated')->>'sqlstate',
  '42501', 'series:access:taw29_ride_offerable-authenticated API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.extend_weekday_series())$q$, pg_temp.uid(109), 'service_role')->>'sqlstate',
  '42501', 'series:access:extend_weekday_series-service_role API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_post_eligible('a29c1000-0000-4000-8000-000000000109'::uuid))$q$, pg_temp.uid(109), 'service_role')->>'sqlstate',
  '42501', 'series:access:taw29_post_eligible-service_role API role cannot execute owner-only function');
select is(pg_temp.call($q$select to_jsonb(public.taw29_ride_offerable('a29c1000-0000-4000-8000-000000000109'::uuid, 8))$q$, pg_temp.uid(109), 'service_role')->>'sqlstate',
  '42501', 'series:access:taw29_ride_offerable-service_role API role cannot execute owner-only function');

reset role;
set local "request.jwt.claims" = '{}';
set constraints all immediate;
select * from finish();
rollback;
