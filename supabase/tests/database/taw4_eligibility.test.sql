begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);

-- Synthetic fixtures; all changes roll back at the end of this file.
insert into auth.users(id) values ('a4000000-0000-4000-8000-000000000001'), ('a4000000-0000-4000-8000-000000000002');
insert into public.communities(id,name,active) values ('b4000000-0000-4000-8000-000000000001','Test community',true),('b4000000-0000-4000-8000-000000000002','Inactive test community',false);
update public.legal_documents set is_current=false where is_current;
insert into public.legal_documents(kind,version,is_current) values ('terms','taw4-test-v1',true),('privacy','taw4-test-v1',true);
insert into public.car_brands(id,name,active) values ('b4000000-0000-4000-8000-000000000003','Test brand A',true),('b4000000-0000-4000-8000-000000000004','Inactive test brand',false),('b4000000-0000-4000-8000-000000000005','Test brand B',true);
insert into public.car_models(id,brand_id,name,active) values ('b4000000-0000-4000-8000-000000000006','b4000000-0000-4000-8000-000000000003','Test model A',true),('b4000000-0000-4000-8000-000000000007','b4000000-0000-4000-8000-000000000003','Inactive test model',false),('b4000000-0000-4000-8000-000000000008','b4000000-0000-4000-8000-000000000005','Test model B',true);
insert into public.car_types(id,code,name,active) values ('b4000000-0000-4000-8000-000000000009','taw4-test','Test type',true),('b4000000-0000-4000-8000-000000000010','taw4-inactive','Inactive test type',false);
-- A stable JSON snapshot detects all persisted mutations, including timestamps.
create function pg_temp.snapshot() returns jsonb language sql as $snapshot$
select jsonb_build_object(
 'accounts',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id),'[]') from public.accounts x),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id),'[]') from public.profiles x),
 'consents',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.consents x),
 'vehicles',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id),'[]') from public.vehicles x),
 'items',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id,kind),'[]') from public.verification_items x),
 'submissions',(select coalesce(jsonb_agg(to_jsonb(x) order by user_id,kind,revision),'[]') from public.verification_submissions x))
$snapshot$;
create temp table taw4_before(value jsonb);
grant all on taw4_before to authenticated,service_role;


reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.can_request_rides(), false, 'incomplete profile cannot request');

select is(public.can_post_rides(), false, 'incomplete profile cannot post');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is(public.can_request_rides(), false, 'can_request_rides false for missing account');

select lives_ok($test$select public.can_request_rides()$test$, 'can_request_rides never raises on missing account');

select is(public.can_post_rides(), false, 'can_post_rides false for missing account');

select lives_ok($test$select public.can_post_rides()$test$, 'can_post_rides never raises on missing account');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','rider',true,'taw4-test-v1','taw4-test-v1')$test$, 'complete rider');

select is(public.can_request_rides(), true, 'completed rider requests freely');

select is(public.can_post_rides(), false, 'rider cannot post');

select lives_ok($test$select public.set_role('car_owner')$test$, 'switch owner');

select is(public.can_post_rides(), false, 'owner with no item cannot post');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'pending item');

select is(public.can_post_rides(), false, 'pending owner cannot post');

select is(public.can_request_rides(), true, 'pending owner can request');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select lives_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',1,'rejected','Synthetic review note')$test$, 'reject item');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.can_post_rides(), false, 'rejected owner cannot post');

select is(public.can_request_rides(), true, 'rejected owner can request');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000102','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'resubmit');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select lives_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',2,'approved','Synthetic review note')$test$, 'approve revision 2');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.can_post_rides(), true, 'approved current owner can post');

select lives_ok($test$select public.set_role('both')$test$, 'both role');

select is(public.can_post_rides(), true, 'approved both can post');

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000103','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'already_approved', 'approved cannot submit new revision');

select lives_ok($test$select public.set_role('rider')$test$, 'former owner becomes rider');

select is(public.can_post_rides(), false, 'retained approved item cannot authorize rider');

select is(public.can_request_rides(), true, 'former owner requests freely');

reset role;

select ok(exists(select 1 from public.vehicles where user_id='a4000000-0000-4000-8000-000000000001') and exists(select 1 from public.verification_items where user_id='a4000000-0000-4000-8000-000000000001' and status='approved'), 'former owner keeps vehicle and item');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.set_role('car_owner')$test$, 'restore owner');

reset role;

-- Deliberately inconsistent fixture built as the table owner (service_role has no write grant): revision advances without a new decision.
-- Only revision changes, leaving the trigger-protected decision untouched.

select lives_ok($test$update public.verification_items set revision=revision+1 where user_id='a4000000-0000-4000-8000-000000000001'$test$, 'build older-approved-revision fixture');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.can_post_rides(), false, 'approval must bind current revision');

select is(public.can_request_rides(), true, 'revision mismatch does not block requesting');

select lives_ok($test$select public.can_request_rides()$test$, 'can_request_rides never raises for existing caller');

reset role;

select ok((select provolatile='s' and prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.can_request_rides()'::regprocedure), 'can_request_rides stable security definer empty search path');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.can_post_rides()$test$, 'can_post_rides never raises for existing caller');

reset role;

select ok((select provolatile='s' and prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.can_post_rides()'::regprocedure), 'can_post_rides stable security definer empty search path');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

reset role;
select * from finish();
rollback;
