begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(54);

-- Only TAW-29 value probes trap missing functions at T2.
create function pg_temp.dynamic_text(p_sql text) returns text language plpgsql as $$
declare v text;
begin execute p_sql into v; return v; exception when others then return null; end
$$;


insert into auth.users(id) values
 ('a29a4000-0000-4000-8000-000000000001'), ('a29a4000-0000-4000-8000-000000000002'),
 ('a29a4000-0000-4000-8000-000000000003'), ('a29a4000-0000-4000-8000-000000000004');
insert into auth.users(id) values
 ('a29a4000-0000-4000-8000-000000000005'), ('a29a4000-0000-4000-8000-000000000006'),
 ('a29a4000-0000-4000-8000-000000000007');

select set_eq(
  $$select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pilot_events'$$,
  $$values ('id'),('event_type'),('user_id'),('series_id'),('ride_id'),('source'),('ride_state'),('repeat'),('ride_count'),('event_day'),('occurred_at')$$,
  'schema:events:columns pilot_events has exactly the specified columns');
select is((select identity_generation from information_schema.columns where table_schema = 'public' and table_name = 'pilot_events' and column_name = 'id'), 'ALWAYS',
  'schema:events:id-identity event id is generated always as identity');
select throws_ok($$insert into public.pilot_events(event_type, user_id, event_day) values ('other', 'a29a4000-0000-4000-8000-000000000001', current_date)$$,
  '23514', null, 'schema:events:event-type only ride_posted and ride_viewed are accepted');
select throws_ok($$insert into public.pilot_events(event_type, user_id, source, ride_state, event_day) values ('ride_viewed', 'a29a4000-0000-4000-8000-000000000001', 'other', 'available', current_date)$$,
  '23514', null, 'schema:events:source only list link or published is accepted for views');
select is((select confdeltype from pg_constraint where conrelid = 'public.pilot_events'::regclass and confrelid = 'public.accounts'::regclass), 'c'::"char",
  'schema:events:user-delete account deletion cascades event rows');
select is((select confdeltype from pg_constraint where conrelid = 'public.pilot_events'::regclass and confrelid = 'public.ride_series'::regclass), 'n'::"char",
  'schema:events:series-delete series deletion sets the event series id null');
select is((select confdeltype from pg_constraint where conrelid = 'public.pilot_events'::regclass and confrelid = 'public.rides'::regclass), 'n'::"char",
  'schema:events:ride-delete ride deletion sets the event ride id null');
select is((select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'pilot_events' and column_name = 'event_day'), 'NO',
  'schema:events:event-day-required event_day is not nullable');
select ok((select column_default is not null from information_schema.columns where table_schema = 'public' and table_name = 'pilot_events' and column_name = 'occurred_at'),
  'schema:events:occurred-default occurred_at defaults at insertion');
select is((select count(*) from pg_indexes where schemaname = 'public' and tablename = 'pilot_events' and indexdef ~* 'unique' and indexdef ~* '\(user_id, ride_id, event_day\)' and indexdef ~* 'event_type.*ride_viewed'), 1::bigint,
  'schema:events:view-unique-index one partial unique index enforces a daily view per user and ride');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'pilot_events' and column_name ~* '(name|phone|note|device|plate|community)'), 0::bigint,
  'schema:events:no-private-columns events store no names phones notes plates communities or device data');

insert into public.communities(id, name) values ('a29a4000-0000-4000-8000-000000000101', 'A29A4 community');
-- TAW-4 setup is deliberately untrapped: broken fixtures must abort.
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents(kind, version, is_current)
values ('terms', 'taw29-events-v1', true), ('privacy', 'taw29-events-v1', true);
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-events-v1', 'taw29-events-v1');
select public.submit_car('a29a4000-0000-4000-8000-000000000102', null, 'A29A4 brand', null, 'A29A4 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000002","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000004","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000005","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000006","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000007","role":"authenticated"}';
select public.complete_profile('Event', 'Fixture', 'a29a4000-0000-4000-8000-000000000101', 'rider', true, 'taw29-events-v1', 'taw29-events-v1');
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"service_role"}';
select public.review_item('a29a4000-0000-4000-8000-000000000001', 'car_owner', 1, 'approved', null);
reset role;
set local "request.jwt.claims" = '{}';
update public.accounts set phone_e164 = '+201000000401', phone_verified = true where user_id = 'a29a4000-0000-4000-8000-000000000001';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($call$select public.publish_ride('a29a4000-0000-4000-8000-000000000201', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$,
  'events:posted:publish successful publish completes');
reset role;
select is((select count(*) from public.pilot_events e join public.ride_series s on s.id = e.series_id where s.request_id = 'a29a4000-0000-4000-8000-000000000201' and e.event_type = 'ride_posted' and e.user_id = s.owner_id and e.ride_id = s.published_ride_id and e.source is null and e.ride_state is null and e.repeat = 'once' and e.ride_count = s.published_ride_count), 1::bigint,
  'events:posted:one successful publish writes one complete ride_posted event');

-- Capture restricted table values as owner; readers receive only temporary fixture ids.
create temp table a29a4_ride_ref as
select r.id as ride_id, r.share_code from public.rides r
join public.ride_series s on s.published_ride_id = r.id
where s.request_id = 'a29a4000-0000-4000-8000-000000000201';
grant select on a29a4_ride_ref to authenticated;
-- Keep the paired assertion outcome so empty-table checks cannot pass after a missing RPC.
create temp table a29a4_call_results (name text primary key, result text);
grant select, insert on a29a4_call_results to authenticated;


set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($call$select public.publish_ride('a29a4000-0000-4000-8000-000000000202', (select id from public.routes where active limit 1), 'bad', ((now() at time zone 'Africa/Cairo')::date + 1), '09:30', 0, 1, null, null, 'once')$call$,
  'P0001', 'invalid_direction', 'events:posted:none-on-failure failed validation writes no posted event');
select lives_ok($call$select public.publish_ride('a29a4000-0000-4000-8000-000000000201', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$,
  'events:posted:replay-call replay returns normally');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000001' and event_type = 'ride_posted'), 1::bigint,
  'events:posted:none-on-failure-or-replay failure and replay add no posted event');

alter table public.pilot_events add constraint taw29_a29a4_posted_failure check (false) not valid;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into a29a4_call_results select 'posted_failure', throws_ok($call$select public.publish_ride('a29a4000-0000-4000-8000-000000000203', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 2), '10:30', 0, 1, null, null, 'once')$call$,
  '23514', null, 'events:posted:atomic-failure injected posted-event failure fails publish');
select result from a29a4_call_results where name = 'posted_failure';
reset role;
select is(case when (select result like 'ok %' from a29a4_call_results where name = 'posted_failure') then (select count(*) from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000203') else -1 end, 0::bigint,
  'events:posted:atomic-no-series failed posted event rolls back its series');
select is(case when (select result like 'ok %' from a29a4_call_results where name = 'posted_failure') then (select count(*) from public.rides r join public.ride_series s on s.id = r.series_id where s.request_id = 'a29a4000-0000-4000-8000-000000000203') else -1 end, 0::bigint,
  'events:posted:atomic-no-rides failed posted event leaves no rides');
alter table public.pilot_events drop constraint taw29_a29a4_posted_failure;

alter table public.pilot_events add constraint taw29_a29a4_viewed_failure check (false) not valid;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into a29a4_call_results select 'failed_get', lives_ok($call$
  insert into a29a4_call_results select 'get_with_failure', public.get_ride((select ride_id from a29a4_ride_ref), 'list')::text
$call$,
  'events:viewed:failure-isolated-get injected event failure does not fail get_ride');
select result from a29a4_call_results where name = 'failed_get';
insert into a29a4_call_results select 'failed_link', lives_ok($call$
  insert into a29a4_call_results select 'link_with_failure', public.resolve_shared_ride((select share_code from a29a4_ride_ref))::text
$call$,
  'events:viewed:failure-isolated-link injected event failure does not fail resolve_shared_ride');
select result from a29a4_call_results where name = 'failed_link';
reset role;
select is(case when (select result like 'ok %' from a29a4_call_results where name = 'failed_get')
  and (select result like 'ok %' from a29a4_call_results where name = 'failed_link')
  then (select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000002' and event_type = 'ride_viewed') else -1 end, 0::bigint,
  'events:viewed:failure-no-event caught insert failures leave no view event');
alter table public.pilot_events drop constraint taw29_a29a4_viewed_failure;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($call$select public.get_ride((select ride_id from a29a4_ride_ref), 'published')$call$,
  'events:viewed:get-call get_ride returns normally while logging');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000002' and event_type = 'ride_viewed' and source = 'published' and ride_state = 'available'), 1::bigint,
  'events:viewed:get get_ride records its source and state');

set local role authenticated;
select ok((select result from a29a4_call_results where name = 'get_with_failure') =
  pg_temp.dynamic_text($call$select public.get_ride((select ride_id from a29a4_ride_ref), 'list')::text$call$),
  'events:viewed:failure-result-get injected event failure preserves the get_ride response');
select ok((select result from a29a4_call_results where name = 'link_with_failure') =
  pg_temp.dynamic_text($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))::text$call$),
  'events:viewed:failure-result-link injected event failure preserves the resolve_shared_ride response');
reset role;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))$call$,
  'events:viewed:resolve-call resolve_shared_ride returns normally while logging');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000003' and event_type = 'ride_viewed' and source = 'link' and ride_state = 'available'), 1::bigint,
  'events:viewed:resolve resolve_shared_ride records link source and state');

update public.rides set seats_taken = seats_offered where id = (select published_ride_id from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000201');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000005","role":"authenticated"}';
select is(pg_temp.dynamic_text($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))->>'state'$call$), 'full',
  'events:viewed:full-result shared full ride still resolves');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000005' and source = 'link' and ride_state = 'full'), 1::bigint,
  'events:viewed:full-event link view records full state');

update public.rides set seats_taken = 0, status = 'cancelled', cancelled_at = now() where id = (select published_ride_id from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000201');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000006","role":"authenticated"}';
select is(pg_temp.dynamic_text($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))->>'state'$call$), 'cancelled',
  'events:viewed:cancelled-result shared cancelled ride still resolves');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000006' and source = 'link' and ride_state = 'cancelled'), 1::bigint,
  'events:viewed:cancelled-event link view records cancelled state');

update public.rides set status = 'scheduled', cancelled_at = null,
  ride_date = ((now() - interval '1 minute') at time zone 'Africa/Cairo')::date,
  departs_at = now() - interval '1 minute' where id = (select published_ride_id from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000201');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000007","role":"authenticated"}';
select is(pg_temp.dynamic_text($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))->>'state'$call$), 'departed',
  'events:viewed:departed-result shared departed ride still resolves');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000007' and source = 'link' and ride_state = 'departed'), 1::bigint,
  'events:viewed:departed-event link view records departed state');

update public.rides set ride_date = (now() at time zone 'Africa/Cairo')::date + 1,
  departs_at = ((now() at time zone 'Africa/Cairo')::date + 1 + '07:00'::time) at time zone 'Africa/Cairo'
where id = (select published_ride_id from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000201');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into a29a4_call_results select 'owner_get', lives_ok($call$select public.get_ride((select ride_id from a29a4_ride_ref), 'published')$call$,
  'events:viewed:owner-call owner can read the ride');
select result from a29a4_call_results where name = 'owner_get';
reset role;
select is(case when (select result like 'ok %' from a29a4_call_results where name = 'owner_get')
  then (select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000001' and event_type = 'ride_viewed') else -1 end, 0::bigint,
  'events:viewed:none-owner owner view creates no view event');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into a29a4_call_results select 'owner_link', lives_ok($call$select public.resolve_shared_ride((select share_code from a29a4_ride_ref))$call$,
  'events:viewed:owner-link-call owner can resolve the shared ride');
select result from a29a4_call_results where name = 'owner_link';
reset role;
select is(case when (select result like 'ok %' from a29a4_call_results where name = 'owner_link')
  then (select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000001' and event_type = 'ride_viewed') else -1 end, 0::bigint,
  'events:viewed:none-owner-link owner shared-link view creates no view event');

-- A valid Crockford code absent from all rides exercises unknown, not malformed.
select ok(exists (select 1 from a29a4_ride_ref)
  and not exists (select 1 from public.rides where share_code = 'ZZZZZZZZ'),
  'events:viewed:unknown-code-absent valid unknown share code is absent from rides');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000004","role":"authenticated"}';
insert into a29a4_call_results select 'not_found', pg_temp.dynamic_text($call$select public.resolve_shared_ride('ZZZZZZZZ')->>'state'$call$);
select is((select result from a29a4_call_results where name = 'not_found'), 'not_found',
  'events:viewed:not-found-result unknown share code returns not_found');
reset role;
select is(case when (select result = 'not_found' from a29a4_call_results where name = 'not_found')
  then (select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000004' and event_type = 'ride_viewed') else -1 end, 0::bigint,
  'events:viewed:none-not-found not_found creates no view event');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a4000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($call$select public.get_ride((select ride_id from a29a4_ride_ref), 'list')$call$,
  'events:viewed:duplicate-call repeated same-day view returns normally');
reset role;
select is((select count(*) from public.pilot_events where user_id = 'a29a4000-0000-4000-8000-000000000002' and ride_id = (select published_ride_id from public.ride_series where request_id = 'a29a4000-0000-4000-8000-000000000201') and event_type = 'ride_viewed'), 1::bigint,
  'events:viewed:daily-unique repeated views produce one row per user ride and Cairo day');

-- Move the existing view to yesterday in Cairo while the transaction clock stays fixed.
update public.pilot_events set event_day = event_day - 1,
  occurred_at = ((event_day - 1) + time '12:00') at time zone 'Africa/Cairo'
where user_id = 'a29a4000-0000-4000-8000-000000000002'
  and ride_id = (select ride_id from a29a4_ride_ref) and event_type = 'ride_viewed';
set local role authenticated;
do $$ begin
  perform pg_temp.dynamic_text($call$select public.get_ride((select ride_id from a29a4_ride_ref), 'list')::text$call$);
end $$;
reset role;
select results_eq(
  $$select event_day from public.pilot_events
    where user_id = 'a29a4000-0000-4000-8000-000000000002'
      and ride_id = (select ride_id from a29a4_ride_ref) and event_type = 'ride_viewed'
    order by event_day$$,
  $$select (now() at time zone 'Africa/Cairo')::date - n from generate_series(0, 1) g(n) order by n desc$$,
  'events:viewed:cross-day same viewer and ride produce one event on each of two Cairo dates');
select ok((select count(*) >= 6
  and bool_and(event_day = (occurred_at at time zone 'Africa/Cairo')::date)
  from public.pilot_events where user_id::text like 'a29a4%'),
  'events:event-day:cairo every event_day is computed from occurred_at in Cairo');

set local role authenticated;
select throws_ok($$select * from public.pilot_events$$, '42501', null, 'schema:events:pilot_events:authenticated:select authenticated cannot select events');
select throws_ok($$insert into public.pilot_events(event_type,user_id,event_day) values ('ride_viewed','a29a4000-0000-4000-8000-000000000002',current_date)$$, '42501', null, 'schema:events:pilot_events:authenticated:insert authenticated cannot insert events');
reset role;
set local role anon;
select throws_ok($$select * from public.pilot_events$$, '42501', null, 'schema:events:pilot_events:anon:select anon cannot select events');
select throws_ok($$insert into public.pilot_events(event_type,user_id,event_day) values ('ride_viewed','a29a4000-0000-4000-8000-000000000002',current_date)$$, '42501', null, 'schema:events:pilot_events:anon:insert anon cannot insert events');
reset role;
set local role service_role;
select lives_ok($$select * from public.pilot_events$$, 'schema:events:pilot_events:service_role:select service_role can select events');
select throws_ok($$insert into public.pilot_events(event_type,user_id,event_day) values ('ride_viewed','a29a4000-0000-4000-8000-000000000002',current_date)$$, '42501', null, 'schema:events:pilot_events:service_role:insert service_role cannot insert events');
select throws_ok($$update public.pilot_events set event_day = event_day$$, '42501', null, 'schema:events:pilot_events:service_role:update service_role cannot update events');
select throws_ok($$delete from public.pilot_events$$, '42501', null, 'schema:events:pilot_events:service_role:delete service_role cannot delete events');
select throws_ok($$truncate public.pilot_events$$, '42501', null, 'schema:events:pilot_events:service_role:truncate service_role cannot truncate events');
reset role;

select * from finish();
rollback;
