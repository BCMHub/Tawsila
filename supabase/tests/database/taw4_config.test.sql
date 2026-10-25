begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(105);

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


select ok((select relrowsecurity from pg_class where oid='public.communities'::regclass), 'communities: RLS enabled');

select ok(not has_table_privilege('authenticated','public.communities','INSERT'), 'communities: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.communities','UPDATE'), 'communities: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.communities','DELETE'), 'communities: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.communities','INSERT'), 'communities: anon has no INSERT');

select ok(not has_table_privilege('anon','public.communities','UPDATE'), 'communities: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.communities','DELETE'), 'communities: anon has no DELETE');

select ok(not has_table_privilege('anon','public.communities','SELECT'), 'communities: anon has no SELECT');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select * from public.communities$test$, 'communities: authenticated can select');

reset role;

select ok((select relrowsecurity from pg_class where oid='public.legal_documents'::regclass), 'legal_documents: RLS enabled');

select ok(not has_table_privilege('authenticated','public.legal_documents','INSERT'), 'legal_documents: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.legal_documents','UPDATE'), 'legal_documents: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.legal_documents','DELETE'), 'legal_documents: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.legal_documents','INSERT'), 'legal_documents: anon has no INSERT');

select ok(not has_table_privilege('anon','public.legal_documents','UPDATE'), 'legal_documents: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.legal_documents','DELETE'), 'legal_documents: anon has no DELETE');

select ok(not has_table_privilege('anon','public.legal_documents','SELECT'), 'legal_documents: anon has no SELECT');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select * from public.legal_documents$test$, 'legal_documents: authenticated can select');

reset role;

select ok((select relrowsecurity from pg_class where oid='public.car_brands'::regclass), 'car_brands: RLS enabled');

select ok(not has_table_privilege('authenticated','public.car_brands','INSERT'), 'car_brands: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.car_brands','UPDATE'), 'car_brands: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.car_brands','DELETE'), 'car_brands: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.car_brands','INSERT'), 'car_brands: anon has no INSERT');

select ok(not has_table_privilege('anon','public.car_brands','UPDATE'), 'car_brands: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.car_brands','DELETE'), 'car_brands: anon has no DELETE');

select ok(not has_table_privilege('anon','public.car_brands','SELECT'), 'car_brands: anon has no SELECT');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select * from public.car_brands$test$, 'car_brands: authenticated can select');

reset role;

select ok((select relrowsecurity from pg_class where oid='public.car_models'::regclass), 'car_models: RLS enabled');

select ok(not has_table_privilege('authenticated','public.car_models','INSERT'), 'car_models: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.car_models','UPDATE'), 'car_models: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.car_models','DELETE'), 'car_models: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.car_models','INSERT'), 'car_models: anon has no INSERT');

select ok(not has_table_privilege('anon','public.car_models','UPDATE'), 'car_models: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.car_models','DELETE'), 'car_models: anon has no DELETE');

select ok(not has_table_privilege('anon','public.car_models','SELECT'), 'car_models: anon has no SELECT');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select * from public.car_models$test$, 'car_models: authenticated can select');

reset role;

select ok((select relrowsecurity from pg_class where oid='public.car_types'::regclass), 'car_types: RLS enabled');

select ok(not has_table_privilege('authenticated','public.car_types','INSERT'), 'car_types: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.car_types','UPDATE'), 'car_types: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.car_types','DELETE'), 'car_types: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.car_types','INSERT'), 'car_types: anon has no INSERT');

select ok(not has_table_privilege('anon','public.car_types','UPDATE'), 'car_types: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.car_types','DELETE'), 'car_types: anon has no DELETE');

select ok(not has_table_privilege('anon','public.car_types','SELECT'), 'car_types: anon has no SELECT');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select * from public.car_types$test$, 'car_types: authenticated can select');

reset role;

select ok((select relrowsecurity from pg_class where oid='public.profiles'::regclass), 'profiles: RLS enabled');

select ok(not has_table_privilege('authenticated','public.profiles','INSERT'), 'profiles: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.profiles','UPDATE'), 'profiles: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.profiles','DELETE'), 'profiles: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.profiles','INSERT'), 'profiles: anon has no INSERT');

select ok(not has_table_privilege('anon','public.profiles','UPDATE'), 'profiles: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.profiles','DELETE'), 'profiles: anon has no DELETE');

select ok(not has_table_privilege('anon','public.profiles','SELECT'), 'profiles: anon has no SELECT');

select ok((select relrowsecurity from pg_class where oid='public.consents'::regclass), 'consents: RLS enabled');

select ok(not has_table_privilege('authenticated','public.consents','INSERT'), 'consents: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.consents','UPDATE'), 'consents: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.consents','DELETE'), 'consents: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.consents','INSERT'), 'consents: anon has no INSERT');

select ok(not has_table_privilege('anon','public.consents','UPDATE'), 'consents: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.consents','DELETE'), 'consents: anon has no DELETE');

select ok(not has_table_privilege('anon','public.consents','SELECT'), 'consents: anon has no SELECT');

select ok((select relrowsecurity from pg_class where oid='public.vehicles'::regclass), 'vehicles: RLS enabled');

select ok(not has_table_privilege('authenticated','public.vehicles','INSERT'), 'vehicles: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.vehicles','UPDATE'), 'vehicles: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.vehicles','DELETE'), 'vehicles: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.vehicles','INSERT'), 'vehicles: anon has no INSERT');

select ok(not has_table_privilege('anon','public.vehicles','UPDATE'), 'vehicles: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.vehicles','DELETE'), 'vehicles: anon has no DELETE');

select ok(not has_table_privilege('anon','public.vehicles','SELECT'), 'vehicles: anon has no SELECT');

select ok((select relrowsecurity from pg_class where oid='public.verification_items'::regclass), 'verification_items: RLS enabled');

select ok(not has_table_privilege('authenticated','public.verification_items','INSERT'), 'verification_items: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.verification_items','UPDATE'), 'verification_items: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.verification_items','DELETE'), 'verification_items: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.verification_items','INSERT'), 'verification_items: anon has no INSERT');

select ok(not has_table_privilege('anon','public.verification_items','UPDATE'), 'verification_items: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.verification_items','DELETE'), 'verification_items: anon has no DELETE');

select ok(not has_table_privilege('anon','public.verification_items','SELECT'), 'verification_items: anon has no SELECT');

select ok((select relrowsecurity from pg_class where oid='public.verification_submissions'::regclass), 'verification_submissions: RLS enabled');

select ok(not has_table_privilege('authenticated','public.verification_submissions','INSERT'), 'verification_submissions: authenticated has no INSERT');

select ok(not has_table_privilege('authenticated','public.verification_submissions','UPDATE'), 'verification_submissions: authenticated has no UPDATE');

select ok(not has_table_privilege('authenticated','public.verification_submissions','DELETE'), 'verification_submissions: authenticated has no DELETE');

select ok(not has_table_privilege('anon','public.verification_submissions','INSERT'), 'verification_submissions: anon has no INSERT');

select ok(not has_table_privilege('anon','public.verification_submissions','UPDATE'), 'verification_submissions: anon has no UPDATE');

select ok(not has_table_privilege('anon','public.verification_submissions','DELETE'), 'verification_submissions: anon has no DELETE');

select ok(not has_table_privilege('anon','public.verification_submissions','SELECT'), 'verification_submissions: anon has no SELECT');

select ok(exists(select 1 from public.car_types where code='other'), 'migration provides other car type');

select throws_ok($test$insert into public.legal_documents(kind,version,is_current) values ('terms','taw4-duplicate',true)$test$, '23505', null, 'terms: only one current version');

select throws_ok($test$insert into public.legal_documents(kind,version,is_current) values ('privacy','taw4-duplicate',true)$test$, '23505', null, 'privacy: only one current version');

select throws_ok($test$insert into public.verification_items(user_id,kind,status,revision,submission_key) values ('a4000000-0000-4000-8000-000000000001','invalid_kind','pending',1,'b4000000-0000-4000-8000-000000000100')$test$, '23514', null, 'only car_owner kind accepted');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($test$select public.complete_profile('Test','Person','b4000000-0000-4000-8000-000000000001','car_owner',true,'taw4-test-v1','taw4-test-v1')$test$, 'prepare owner');

select lives_ok($test$select public.submit_car('b4000000-0000-4000-8000-000000000101','b4000000-0000-4000-8000-000000000003',null,'b4000000-0000-4000-8000-000000000006',null,'b4000000-0000-4000-8000-000000000009',2020,'ب ١-٢')$test$, 'prepare immutable history');

reset role;
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"service_role"}';

select ok(has_table_privilege('service_role','public.verification_submissions','UPDATE'), 'history trigger tested with service table privilege UPDATE');

select ok(has_table_privilege('service_role','public.verification_submissions','DELETE'), 'history trigger tested with service table privilege DELETE');

select throws_like($test$update public.verification_submissions set revision=99$test$, '%', 'history immutable even for service role');

select throws_like($test$delete from public.verification_submissions$test$, '%', 'history immutable even for service role');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.complete_profile(text,text,uuid,text,boolean,text,text)'::regprocedure), 'complete_profile(text,text,uuid,text,boolean,text,text) security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.set_role(text)'::regprocedure), 'set_role(text) security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.submit_car(uuid,uuid,text,uuid,text,uuid,integer,text)'::regprocedure), 'submit_car(uuid,uuid,text,uuid,text,uuid,integer,text) security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.review_item(uuid,text,integer,text,text)'::regprocedure), 'review_item(uuid,text,integer,text,text) security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.my_verification()'::regprocedure), 'my_verification() security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.can_request_rides()'::regprocedure), 'can_request_rides() security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.can_post_rides()'::regprocedure), 'can_post_rides() security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.plate_normalized(text)'::regprocedure), 'plate_normalized(text) security definer and empty search path');

reset role;

select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.plate_is_valid(text)'::regprocedure), 'plate_is_valid(text) security definer and empty search path');

select ok(has_function_privilege('service_role','public.review_item(uuid,text,integer,text,text)','EXECUTE'), 'service role can review');

reset role;
select * from finish();
rollback;
