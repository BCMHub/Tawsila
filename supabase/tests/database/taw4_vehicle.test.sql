begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(57);

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

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'prepare car owner');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000102','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'catalogue relationship');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000103','b4000000-0000-4000-8000-000000000003',null,null,'Test custom model','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'catalogue brand custom model');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000104',null,'  Test custom brand  ',null,'  Test custom model  ','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'custom brand and model');

select is((select brand_other from public.vehicles where user_id='a4000000-0000-4000-8000-000000000001'), 'Test custom brand', 'brand trimmed');

select is((select model_other from public.vehicles where user_id='a4000000-0000-4000-8000-000000000001'), 'Test custom model', 'model trimmed');

select is((select plate_number from public.vehicles where user_id='a4000000-0000-4000-8000-000000000001'), 'ب12', 'plate stored normalized');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001007','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000008',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001009',null,'Custom','b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand,brand_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001011','b4000000-0000-4000-8000-000000000003','Custom','b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001013',null,null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001015','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006','Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001017','b4000000-0000-4000-8000-000000000003',null,null,null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001019','b4000000-0000-4000-8000-000000000004',null,null,'Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand,model,model_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001021','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000007',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001023','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000010',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: type');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001025','b4000000-0000-4000-8000-000000000999',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001027','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000999',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001029','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000999',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: type');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001031','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',1979,'ب ١-٢')$test$, 'P0001', 'invalid_year', 'invalid_year: year');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001033','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',extract(year from current_date)::int+2,'ب ١-٢')$test$, 'P0001', 'invalid_year', 'invalid_year: year');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001035','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ABC')$test$, 'P0001', 'invalid_plate', 'invalid_plate: plate');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001037',null,'',null,'Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand_other,brand,model,model_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001039',null,'   ',null,'Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand_other,brand,model,model_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001041',null,repeat('x',51),null,'Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: brand_other,brand,model,model_other');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001043','b4000000-0000-4000-8000-000000000003',null,null,'','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model_other,model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001045','b4000000-0000-4000-8000-000000000003',null,null,'   ','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model_other,model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;

truncate taw4_before; insert into taw4_before select pg_temp.snapshot();

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001047','b4000000-0000-4000-8000-000000000003',null,null,repeat('x',51),'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'invalid_car', 'invalid_car: model_other,model');

reset role;

select is(pg_temp.snapshot(), (select value from taw4_before), 'rejected call leaves every row identical');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001149','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',1980,'ب ١-٢')$test$, 'inclusive year boundary');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001150','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',extract(year from current_date)::int+1,'ب ١-٢')$test$, 'inclusive year boundary');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001251',null,repeat('x',50),null,'Custom','b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, '50-character free text accepted');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000001252','b4000000-0000-4000-8000-000000000003',null,null,repeat('x',50),'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, '50-character free text accepted');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','rider',true,'taw4-test-v1','taw4-test-v1')$test$, 'prepare rider');

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000002100','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'role_not_car_owner', 'rider cannot submit');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000002101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'P0001', 'account_missing', 'missing account');

reset role;
set local role anon;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"anon"}';

select throws_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000002102','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, '42501', null, 'anon cannot submit');

reset role;
select * from finish();
rollback;
