begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(30);

create function pg_temp.dynamic_bool(p_sql text) returns boolean language plpgsql as $$
declare v boolean;
begin execute p_sql into v; return v; exception when others then return null; end
$$;
create function pg_temp.dynamic_text(p_sql text) returns text language plpgsql as $$
declare v text;
begin execute p_sql into v; return v; exception when others then return null; end
$$;

insert into auth.users(id) values
  ('a29a2000-0000-4000-8000-000000000001'), ('a29a2000-0000-4000-8000-000000000002'),
  ('a29a2000-0000-4000-8000-000000000003'), ('a29a2000-0000-4000-8000-000000000004'),
  ('a29a2000-0000-4000-8000-000000000005'), ('a29a2000-0000-4000-8000-000000000006');
insert into public.communities(id, name) values ('a29a2000-0000-4000-8000-000000000101', 'A29A2 community');
-- TAW-4 setup is deliberately untrapped: broken fixtures must abort.
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents(kind, version, is_current)
values ('terms', 'taw29-auth-v1', true), ('privacy', 'taw29-auth-v1', true);
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
select public.submit_car('a29a2000-0000-4000-8000-000000000301', null, 'A29A2 brand', null, 'A29A2 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000002","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000004","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
select public.submit_car('a29a2000-0000-4000-8000-000000000304', null, 'A29A2 brand', null, 'A29A2 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000005","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
select public.submit_car('a29a2000-0000-4000-8000-000000000305', null, 'A29A2 brand', null, 'A29A2 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000006","role":"authenticated"}';
select public.complete_profile('Auth', 'Fixture', 'a29a2000-0000-4000-8000-000000000101', 'car_owner', true, 'taw29-auth-v1', 'taw29-auth-v1');
select public.submit_car('a29a2000-0000-4000-8000-000000000306', null, 'A29A2 brand', null, 'A29A2 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local "request.jwt.claims" = '{}';
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000001","role":"service_role"}';
select public.review_item('a29a2000-0000-4000-8000-000000000001', 'car_owner', 1, 'approved', null);
reset role;
set local "request.jwt.claims" = '{}';
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000004","role":"service_role"}';
select public.review_item('a29a2000-0000-4000-8000-000000000004', 'car_owner', 1, 'approved', null);
reset role;
set local "request.jwt.claims" = '{}';
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000005","role":"service_role"}';
select public.review_item('a29a2000-0000-4000-8000-000000000005', 'car_owner', 1, 'approved', null);
reset role;
set local "request.jwt.claims" = '{}';
update public.accounts set phone_e164 = '+20100000000' || right(user_id::text, 1), phone_verified = true
where user_id in ('a29a2000-0000-4000-8000-000000000002', 'a29a2000-0000-4000-8000-000000000004', 'a29a2000-0000-4000-8000-000000000006');

create temp table a29a2_accounts_before as
select * from public.accounts where user_id::text like 'a29a2%';

-- All TAW-29 calls are strings: missing T3 functions report not-ok and do not abort this file at T2.
select is(pg_temp.dynamic_bool('select public.is_phone_verified()'), false, 'auth:is-phone:no-caller is_phone_verified is false without a caller');
select throws_ok($call$select public.require_phone_verified()$call$, 'P0001', 'phone_unverified', 'auth:require-phone:no-caller require_phone_verified rejects no caller');
select is(pg_temp.dynamic_text('select public.can_publish()'), 'phone_unverified', 'auth:can-publish:no-caller can_publish checks caller before profile and car');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.dynamic_bool('select public.is_phone_verified()'), false, 'auth:is-phone:unverified authenticated unverified caller returns false');
select is(pg_temp.dynamic_text('select public.can_publish()'), 'phone_unverified', 'auth:can-publish:unverified-approved unverified approved owner reports phone_unverified');
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000201', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'P0001', 'phone_unverified', 'auth:publish:unverified-approved unverified approved owner is rejected');
reset role;
select is(case when pg_temp.dynamic_text('select public.can_publish()') = 'phone_unverified' then (select count(*) from public.ride_series where owner_id = 'a29a2000-0000-4000-8000-000000000001') else -1 end, 0::bigint, 'auth:publish:unverified-approved-no-series rejection writes no series');
select is(case when pg_temp.dynamic_text('select public.can_publish()') = 'phone_unverified' then (select count(*) from public.pilot_events where user_id = 'a29a2000-0000-4000-8000-000000000001') else -1 end, 0::bigint, 'auth:publish:unverified-approved-no-event rejection writes no event');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.dynamic_text('select public.can_publish()'), 'car_not_approved', 'auth:can-publish:verified-no-car verified owner without an approved car reports car_not_approved');
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000202', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'P0001', 'car_not_approved', 'auth:publish:verified-no-car verified owner without approved car is rejected');
reset role;
select ok(pg_temp.dynamic_text('select public.can_publish()') = 'car_not_approved'
  and not exists (select 1 from public.ride_series where owner_id = 'a29a2000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.rides where owner_id = 'a29a2000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.pilot_events where user_id = 'a29a2000-0000-4000-8000-000000000002'),
  'auth:publish:verified-no-car-no-rows rejection writes no series rides or events');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(pg_temp.dynamic_text('select public.can_publish()'), 'phone_unverified', 'auth:can-publish:unverified-no-car phone status wins over missing car');
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000203', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'P0001', 'phone_unverified', 'auth:publish:unverified-no-car publish checks phone before car');
reset role;
select ok(pg_temp.dynamic_text('select public.can_publish()') = 'phone_unverified'
  and not exists (select 1 from public.ride_series where owner_id = 'a29a2000-0000-4000-8000-000000000003')
  and not exists (select 1 from public.rides where owner_id = 'a29a2000-0000-4000-8000-000000000003')
  and not exists (select 1 from public.pilot_events where user_id = 'a29a2000-0000-4000-8000-000000000003'),
  'auth:publish:unverified-no-car-no-rows rejection writes no series rides or events');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000006","role":"authenticated"}';
select is(pg_temp.dynamic_text('select public.can_publish()'), 'car_not_approved', 'auth:can-publish:verified-pending verified owner with a pending car reports car_not_approved');
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000207', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'P0001', 'car_not_approved', 'auth:publish:verified-pending pending car cannot publish');
reset role;
select ok(pg_temp.dynamic_text('select public.can_publish()') = 'car_not_approved'
  and not exists (select 1 from public.ride_series where owner_id = 'a29a2000-0000-4000-8000-000000000006')
  and not exists (select 1 from public.rides where owner_id = 'a29a2000-0000-4000-8000-000000000006')
  and not exists (select 1 from public.pilot_events where user_id = 'a29a2000-0000-4000-8000-000000000006'),
  'auth:publish:verified-pending-no-rows rejection writes no series rides or events');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(pg_temp.dynamic_bool('select public.is_phone_verified()'), true, 'auth:is-phone:verified is_phone_verified reads the caller account flag');
select lives_ok($call$select public.require_phone_verified()$call$, 'auth:require-phone:verified require_phone_verified accepts a verified caller');
select is(pg_temp.dynamic_text('select public.can_publish()'), 'ok', 'auth:can-publish:eligible verified approved owner reports ok');
select lives_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000204', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'auth:publish:verified-approved eligible owner publishes successfully');
reset role;
select is((select count(*) from public.ride_series where owner_id = 'a29a2000-0000-4000-8000-000000000004'), 1::bigint, 'auth:publish:verified-approved-series success writes one series');
select is((select count(*) from public.pilot_events where user_id = 'a29a2000-0000-4000-8000-000000000004' and event_type = 'ride_posted'), 1::bigint, 'auth:publish:verified-approved-event success writes one posted event');

set local role anon;
select throws_ok($call$select public.publish_ride(null, null, null, null, null, null, null, null, null, null)$call$, '42501', null, 'auth:publish_ride:anon:execute anon cannot execute publish_ride');
reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000205', (select id from public.routes where active limit 1), 'a_to_b', current_date + 1, '07:00', 0, 1, null, null, 'once')$call$, '42501', null, 'auth:publish_ride:service_role:execute forged authenticated claims do not give service_role execute');
reset role;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000206', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'P0001', 'phone_unverified', 'auth:publish:before-admin-verify approved owner starts unverified');
reset role;
update public.accounts set phone_e164 = '+201000000005', phone_verified = true where user_id = 'a29a2000-0000-4000-8000-000000000005';
delete from a29a2_accounts_before where user_id = 'a29a2000-0000-4000-8000-000000000005';
insert into a29a2_accounts_before select * from public.accounts where user_id = 'a29a2000-0000-4000-8000-000000000005';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a2000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok($call$select public.publish_ride('a29a2000-0000-4000-8000-000000000206', (select id from public.routes where active limit 1), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00', 0, 1, null, null, 'once')$call$, 'auth:publish:after-admin-verify owner-set phone verification enables the same user');
select throws_ok($$update public.accounts set phone_verified = false where user_id = 'a29a2000-0000-4000-8000-000000000005'$$, '42501', null, 'schema:auth:accounts:authenticated:update-phone-verified authenticated cannot change phone_verified');
reset role;

create temp view a29a2_function_presence as
select count(distinct p.proname) = 15 as complete
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_phone_verified','require_phone_verified','can_publish','publish_ride','list_rides','get_ride','resolve_shared_ride','taw29_post_eligible','taw29_ride_offerable','taw29_has_contact','taw29_log_view','taw29_new_share_code','ride_window_days','ride_limits','extend_weekday_series');
select is(case when (select complete from a29a2_function_presence) then
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('is_phone_verified','require_phone_verified','can_publish','publish_ride','list_rides','get_ride','resolve_shared_ride','taw29_post_eligible','taw29_ride_offerable','taw29_has_contact','taw29_log_view','taw29_new_share_code','ride_window_days','ride_limits','extend_weekday_series')
  and (p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.]accounts' or pg_get_functiondef(p.oid) ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.]accounts'))
  else -1 end, 0::bigint,
  'auth:functions:no-account-write no TAW-29 function body writes accounts');
select ok((select complete from a29a2_function_presence) and not exists (
  select 1 from a29a2_accounts_before b
  full join (select * from public.accounts where user_id::text like 'a29a2%') a using (user_id)
  where to_jsonb(a) is distinct from to_jsonb(b)),
  'auth:functions:no-account-write-behaviour TAW-29 calls leave fixture accounts unchanged');

select * from finish();
rollback;
