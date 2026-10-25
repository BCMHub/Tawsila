begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(48);

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

insert into auth.users(id) values ('a4000000-0000-4000-8000-000000000003');

-- Documented single-session alternative to two concurrent sessions:
-- SELECT ... FOR UPDATE takes a RowShareLock on the item relation, held to
-- transaction end; plain INSERT/UPDATE takes RowExclusiveLock instead.
-- Inspect this backend after the second RPC and assert item/history consistency.
-- This checks lock acquisition, not scheduling or timing between two backends.


reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'prepare lock-probe owner');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000120','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'create lock-probe owner item');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000121','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'second submission serializes on existing item');

reset role;

select ok(exists(select 1 from pg_locks where pid=pg_backend_pid() and relation='public.verification_items'::regclass and locktype='relation' and mode='RowShareLock' and granted), 'submit acquires per-item row locking relation lock');

select ok((select revision=2 and status='pending' from public.verification_items where user_id='a4000000-0000-4000-8000-000000000003') and (select count(*)=2 and count(distinct revision)=2 and max(revision)=2 from public.verification_submissions where user_id='a4000000-0000-4000-8000-000000000003'), 'serialized item and history end in consistent revision');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'prepare owner');

select is((public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')), '{"revision":1,"status":"pending","superseded":false}'::jsonb, 'first submission revision 1 pending');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')), '{"revision":1,"status":"pending","superseded":false}'::jsonb, 'same key returns recorded result');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'same key changes no rows or timestamps');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((public.submit_car('b4000000-0000-4000-8000-000000000102','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢'))->>'revision', '2', 'new pending key creates revision 2');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')), '{"revision":1,"status":"pending","superseded":true}'::jsonb, 'A B replay A reports superseded');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'A replay leaves B current unchanged');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select throws_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',1,'approved','Synthetic review note')$test$, 'P0001', 'stale_revision', 'old review cannot approve replacement');

reset role;

select ok(exists(select 1 from public.verification_items where user_id='a4000000-0000-4000-8000-000000000001' and revision=2 and status='pending'), 'replacement stays pending');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select throws_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',2,'pending','Synthetic review note')$test$, 'P0001', 'invalid_status', 'review accepts decisions only');

select throws_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000002','car_owner',1,'approved','Synthetic review note')$test$, 'P0001', 'item_missing', 'missing item');

select lives_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',2,'rejected','Synthetic review note')$test$, 'owner rejects current revision');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((public.submit_car('b4000000-0000-4000-8000-000000000103','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢'))->>'revision', '3', 'new key after rejection creates revision 3');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select lives_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',3,'approved','Synthetic review note')$test$, 'owner approves current revision');

reset role;

select ok(exists(select 1 from public.verification_items where user_id='a4000000-0000-4000-8000-000000000001' and status='approved' and revision=3 and reviewed_revision=3 and reviewer_note='Synthetic review note' and reviewed_at is not null), 'review persists revision bound decision and time');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000104','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'already_approved', 'new submission after approval forbidden');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'approval rejection changes nothing');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')), '{"revision":1,"status":"pending","superseded":true}'::jsonb, 'replay of A after B approval retains recorded result');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'old replay cannot change approved current item');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.submit_car('b4000000-0000-4000-8000-000000000103','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢'), '{"revision":3,"status":"approved","superseded":false}'::jsonb, 'current key replay returns current approved status');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'current approved replay changes nothing');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',3,'approved','Synthetic review note')$test$, '42501', null, 'authenticated cannot review');

reset role;
set local role anon;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"anon"}';

select throws_ok($test$select public.review_item('a4000000-0000-4000-8000-000000000001','car_owner',3,'approved','Synthetic review note')$test$, '42501', null, 'anon cannot review');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$update public.verification_items set status='rejected'$test$, '42501', null, 'client cannot update status');

select throws_ok($test$update public.verification_items set reviewer_note='Tamper'$test$, '42501', null, 'client cannot update reviewer_note');

select throws_ok($test$update public.verification_items set reviewed_revision=99$test$, '42501', null, 'client cannot update reviewed_revision');

select throws_ok($test$update public.verification_submissions set revision=99$test$, '42501', 'permission denied for table verification_submissions', 'authenticated cannot mutate history');

select throws_ok($test$delete from public.verification_submissions$test$, '42501', 'permission denied for table verification_submissions', 'authenticated cannot mutate history');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select ok(not has_table_privilege('service_role','public.verification_items','UPDATE'), 'service role has no direct item update');

select throws_ok($test$update public.verification_items set status='rejected'$test$, '42501', 'permission denied for table verification_items', 'trigger blocks service role status');

select ok(not has_table_privilege('service_role','public.verification_items','UPDATE'), 'service role has no direct item update');

select throws_ok($test$update public.verification_items set reviewer_note='Tamper'$test$, '42501', 'permission denied for table verification_items', 'trigger blocks service role reviewer_note');

select ok(not has_table_privilege('service_role','public.verification_items','UPDATE'), 'service role has no direct item update');

select throws_ok($test$update public.verification_items set reviewed_revision=99$test$, '42501', 'permission denied for table verification_items', 'trigger blocks service role reviewed_revision');

select throws_ok($test$update public.verification_submissions set revision=99$test$, '42501', 'permission denied for table verification_submissions', 'service_role cannot mutate history');

select throws_ok($test$delete from public.verification_submissions$test$, '42501', 'permission denied for table verification_submissions', 'service_role cannot mutate history');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$insert into public.verification_items(user_id,kind,status,revision,submission_key) values ('a4000000-0000-4000-8000-000000000002','car_owner','pending',1,'b4000000-0000-4000-8000-000000000999')$test$, '42501', null, 'client cannot insert item');

select throws_ok($test$delete from public.verification_items$test$, '42501', null, 'client cannot delete item');

select is(public.my_verification(), '{"car_owner":{"status":"approved","revision":3,"reviewer_note":"Synthetic review note"},"has_car_details":true}'::jsonb, 'verification contains exact safe keys only');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(public.my_verification(), '{"car_owner":null,"has_car_details":false}'::jsonb, 'other caller sees no first caller details');

select is((select count(*) from public.vehicles), 0::bigint, 'vehicles own rows only');

select is((select count(*) from public.verification_items), 0::bigint, 'verification_items own rows only');

select is((select count(*) from public.verification_submissions), 0::bigint, 'verification_submissions own rows only');

reset role;
select * from finish();
rollback;
