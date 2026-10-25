begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(75);

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

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'complete profile succeeds');

reset role;

select ok(exists(select 1 from public.profiles where user_id='a4000000-0000-4000-8000-000000000001' and first_name='Test' and last_name='Person' and community_id='b4000000-0000-4000-8000-000000000001' and role='car_owner'), 'profile persisted exactly');

select is((select count(*) from public.consents where user_id='a4000000-0000-4000-8000-000000000001'), 3::bigint, 'three consents');

select ok((select count(*)=2 from public.consents where user_id='a4000000-0000-4000-8000-000000000001' and kind in ('terms','privacy') and version='taw4-test-v1'), 'current legal versions recorded');

select ok(exists(select 1 from public.consents where user_id='a4000000-0000-4000-8000-000000000001' and kind='age_18' and version is null), 'age confirmation recorded');

select ok((select profile_completed_at is not null from public.accounts where user_id='a4000000-0000-4000-8000-000000000001'), 'completion timestamp set');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'same inputs idempotent');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'idempotent call changes nothing');

select ok(not exists(select 1 from public.profiles where user_id='a4000000-0000-4000-8000-000000000002') and not exists(select 1 from public.consents where user_id='a4000000-0000-4000-8000-000000000002') and (select profile_completed_at is null from public.accounts where user_id='a4000000-0000-4000-8000-000000000002'), 'second caller unaffected');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'first rejects ''''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile(repeat('a',51),'Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'first rejects repeat(''a'',51)');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test1','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'first rejects ''Test1''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test!','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'first rejects ''Test!''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('   ','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'first rejects ''   ''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'last rejects ''''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test',repeat('a',51),'b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'last rejects repeat(''a'',51)');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Test1','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'last rejects ''Test1''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Test!','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'last rejects ''Test!''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','   ','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_name', 'last rejects ''   ''');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid name writes nothing');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000002','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_community', 'invalid_community');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid_community leaves all rows unchanged');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000999','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_community', 'invalid_community');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid_community leaves all rows unchanged');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','unknown',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'invalid_role', 'invalid_role');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'invalid_role leaves all rows unchanged');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',false,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'age_not_confirmed', 'age_not_confirmed');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'age_not_confirmed leaves all rows unchanged');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'wrong','taw4-test-v1')$test$, 'P0001', 'consent_version_stale', 'consent_version_stale');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'consent_version_stale leaves all rows unchanged');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','wrong')$test$, 'P0001', 'consent_version_stale', 'consent_version_stale');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'consent_version_stale leaves all rows unchanged');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'account_missing', 'missing account cannot complete profile');

select throws_ok($test$select public.set_role('rider')$test$, 'P0001', 'account_missing', 'set_role missing account');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.set_role('rider')$test$, 'P0001', 'profile_missing', 'set_role needs profile');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.set_role('unknown')$test$, 'P0001', 'invalid_role', 'set_role rejects unknown role');

select throws_ok($test$update public.accounts set profile_completed_at=now()$test$, '42501', null, 'client cannot write completion timestamp');

reset role;

update public.legal_documents set is_current=false where kind='terms'; insert into public.legal_documents(kind,version,is_current) values ('terms','taw4-test-v2',true);

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'P0001', 'consent_version_stale', 'versions changed while form open');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'drift writes nothing');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','rider',true,'taw4-test-v2','taw4-test-v1')$test$, 'fresh acceptance recovers');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*) from public.profiles), 1::bigint, 'select own profile only');

select is((select count(*) from public.consents), 3::bigint, 'select own consents only');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'vehicle fixture');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.set_role('rider')$test$, 'owner switches to rider');

select lives_ok($test$select public.set_role('car_owner')$test$, 'rider switches back');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'round trip retains vehicle item and completion timestamp');

select ok(not has_function_privilege('anon','public.complete_profile(text,text,uuid,text,boolean,text,text)','EXECUTE'), 'anon denied complete_profile(text,text,uuid,text,boolean,text,text)');

select ok(has_function_privilege('authenticated','public.complete_profile(text,text,uuid,text,boolean,text,text)','EXECUTE'), 'authenticated execute contract complete_profile(text,text,uuid,text,boolean,text,text)');

select ok(not has_function_privilege('anon','public.set_role(text)','EXECUTE'), 'anon denied set_role(text)');

select ok(has_function_privilege('authenticated','public.set_role(text)','EXECUTE'), 'authenticated execute contract set_role(text)');

select ok(not has_function_privilege('anon','public.submit_car(uuid,uuid,text,uuid,text,uuid,integer,text)','EXECUTE'), 'anon denied submit_car(uuid,uuid,text,uuid,text,uuid,integer,text)');

select ok(has_function_privilege('authenticated','public.submit_car(uuid,uuid,text,uuid,text,uuid,integer,text)','EXECUTE'), 'authenticated execute contract submit_car(uuid,uuid,text,uuid,text,uuid,integer,text)');

select ok(not has_function_privilege('anon','public.review_item(uuid,text,integer,text,text)','EXECUTE'), 'anon denied review_item(uuid,text,integer,text,text)');

select ok(not has_function_privilege('authenticated','public.review_item(uuid,text,integer,text,text)','EXECUTE'), 'authenticated execute contract review_item(uuid,text,integer,text,text)');

select ok(not has_function_privilege('anon','public.my_verification()','EXECUTE'), 'anon denied my_verification()');

select ok(has_function_privilege('authenticated','public.my_verification()','EXECUTE'), 'authenticated execute contract my_verification()');

select ok(not has_function_privilege('anon','public.can_request_rides()','EXECUTE'), 'anon denied can_request_rides()');

select ok(has_function_privilege('authenticated','public.can_request_rides()','EXECUTE'), 'authenticated execute contract can_request_rides()');

select ok(not has_function_privilege('anon','public.can_post_rides()','EXECUTE'), 'anon denied can_post_rides()');

select ok(has_function_privilege('authenticated','public.can_post_rides()','EXECUTE'), 'authenticated execute contract can_post_rides()');

select ok(not has_function_privilege('anon','public.plate_normalized(text)','EXECUTE'), 'anon denied plate_normalized(text)');

select ok(has_function_privilege('authenticated','public.plate_normalized(text)','EXECUTE'), 'authenticated execute contract plate_normalized(text)');

select ok(not has_function_privilege('anon','public.plate_is_valid(text)','EXECUTE'), 'anon denied plate_is_valid(text)');

select ok(has_function_privilege('authenticated','public.plate_is_valid(text)','EXECUTE'), 'authenticated execute contract plate_is_valid(text)');

reset role;

select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'complete_profile' and p.prosrc ~* 'profile_completed_at[[:space:]]*[:=]'), 'no other public function assigns completion timestamp');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($test$select public.complete_profile(repeat('a',50),'اختبار','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v2','taw4-test-v1')$test$, '50 character and Arabic names accepted');

reset role;
select * from finish();
rollback;
