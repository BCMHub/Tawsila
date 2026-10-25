begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);

-- Synthetic fixtures only; the transaction restores all data and privileges.
insert into auth.users(id) values
  ('ac400000-0000-4000-8000-000000000001'), ('ac400000-0000-4000-8000-000000000002');
insert into public.communities(id, name) values
  ('bc400000-0000-4000-8000-000000000001', 'Cascade test community');
insert into public.profiles(user_id, first_name, last_name, community_id, role)
select user_id, 'Test', 'Person', 'bc400000-0000-4000-8000-000000000001', 'car_owner'
from public.accounts where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002');
insert into public.consents(user_id, kind, version)
select p.user_id, c.kind, c.version
from public.profiles p cross join (values
  ('age_18', null::text), ('terms', 'cascade-test-v1'), ('privacy', 'cascade-test-v1')
) as c(kind, version)
where p.user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002');
insert into public.vehicles(user_id, brand_other, model_other, type_id, year, plate_number)
select user_id, 'Synthetic brand', 'Synthetic model',
  (select id from public.car_types where code = 'other'), 2020, '1234'
from public.profiles where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002');
insert into public.verification_items(user_id, kind, status, revision, submission_key)
select user_id, 'car_owner', 'pending', 1, user_id
from public.profiles where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002');
insert into public.verification_submissions(user_id, kind, submission_key, revision)
select user_id, kind, submission_key, revision from public.verification_items
where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002');

select is((select count(*) from public.accounts where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 2::bigint, 'accounts: both users have fixtures');
select is((select count(*) from public.profiles where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 2::bigint, 'profiles: both users have fixtures');
select is((select count(*) from public.consents where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 6::bigint, 'consents: both users have fixtures');
select is((select count(*) from public.vehicles where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 2::bigint, 'vehicles: both users have fixtures');
select is((select count(*) from public.verification_items where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 2::bigint, 'verification_items: both users have fixtures');
select is((select count(*) from public.verification_submissions where user_id in ('ac400000-0000-4000-8000-000000000001', 'ac400000-0000-4000-8000-000000000002')), 2::bigint, 'verification_submissions: both users have fixtures');

-- Compare complete rows, including timestamps, for the surviving user.
create temp table cascade_survivor_before as
select jsonb_build_object(
  'accounts', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.accounts r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'profiles', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.profiles r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'consents', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.consents r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'vehicles', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.vehicles r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'verification_items', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.verification_items r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'verification_submissions', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.verification_submissions r where user_id = 'ac400000-0000-4000-8000-000000000002')) as rows;

set local role service_role;
select throws_ok($test$delete from public.consents where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'service_role: direct consents delete refused while account exists');
select throws_ok($test$update public.consents set version = version where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'service_role: direct consents update refused while account exists');
select throws_ok($test$delete from public.verification_submissions where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'service_role: direct verification_submissions delete refused while account exists');
select throws_ok($test$update public.verification_submissions set revision = revision where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'service_role: direct verification_submissions update refused while account exists');
reset role;

set local role postgres;
select throws_ok($test$delete from public.consents where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'postgres: direct consents delete refused while account exists');
select throws_ok($test$update public.consents set version = version where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'postgres: direct consents update refused while account exists');
select throws_ok($test$delete from public.verification_submissions where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'postgres: direct verification_submissions delete refused while account exists');
select throws_ok($test$update public.verification_submissions set revision = revision where user_id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'P0001', 'immutable_record', 'postgres: direct verification_submissions update refused while account exists');
reset role;

select lives_ok($test$delete from auth.users where id = 'ac400000-0000-4000-8000-000000000001'$test$,
  'auth user deletion cascades through immutable records');
select is((select count(*) from public.accounts where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'accounts: deleted user has no remaining rows');
select is((select count(*) from public.profiles where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'profiles: deleted user has no remaining rows');
select is((select count(*) from public.consents where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'consents: deleted user has no remaining rows');
select is((select count(*) from public.vehicles where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'vehicles: deleted user has no remaining rows');
select is((select count(*) from public.verification_items where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'verification_items: deleted user has no remaining rows');
select is((select count(*) from public.verification_submissions where user_id = 'ac400000-0000-4000-8000-000000000001'),
  0::bigint, 'verification_submissions: deleted user has no remaining rows');
select is(jsonb_build_object(
  'accounts', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.accounts r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'profiles', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.profiles r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'consents', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.consents r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'vehicles', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.vehicles r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'verification_items', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.verification_items r where user_id = 'ac400000-0000-4000-8000-000000000002'),
  'verification_submissions', (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.verification_submissions r where user_id = 'ac400000-0000-4000-8000-000000000002')), (select rows from cascade_survivor_before), 'second user rows are unchanged');

select * from finish();
rollback;
