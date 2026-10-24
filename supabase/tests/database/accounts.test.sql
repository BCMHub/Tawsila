begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);

insert into auth.users (id) values
  ('a7000000-0000-4000-8000-000000000001'),
  ('a7000000-0000-4000-8000-000000000002');

select is((select count(distinct user_id) from public.accounts where user_id in
  ('a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002')), 2::bigint,
  '1 trigger creates rows for both new users');
select ok((select count(*) = 2 and count(distinct user_id) = 2 from public.accounts where user_id in
  ('a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002')),
  '2 exactly one row per user');
select ok((select count(*) = 2 from public.accounts where user_id in
  ('a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002')
  and phone_e164 is null and phone_verified = false and profile_completed_at is null),
  '3 defaults are null phone, unverified, incomplete profile');
update auth.users set updated_at = now() where id = 'a7000000-0000-4000-8000-000000000001';
select is((select count(*) from public.accounts where user_id = 'a7000000-0000-4000-8000-000000000001'),
  1::bigint, '4 returning user update creates no extra row');

alter table public.accounts add constraint test_force_insert_failure check (false) not valid;
select throws_ok($$insert into auth.users (id) values ('a7000000-0000-4000-8000-000000000003')$$,
  '23514', null, '5 account insert failure aborts sign-up');
alter table public.accounts drop constraint test_force_insert_failure;
select is((select count(*) from auth.users where id = 'a7000000-0000-4000-8000-000000000003'),
  0::bigint, '6 failed sign-up leaves no auth user');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.accounts), 1::bigint, '7 user sees exactly one row');
select is((select user_id from public.accounts), 'a7000000-0000-4000-8000-000000000001'::uuid,
  '8 user sees their own row');
select throws_ok($$insert into public.accounts (user_id) values ('a7000000-0000-4000-8000-000000000001')$$,
  '42501', null, '9 direct insert denied');
select throws_ok($$update public.accounts set phone_verified = true$$,
  '42501', null, '10 phone_verified update denied');
select throws_ok($$update public.accounts set profile_completed_at = now()$$,
  '42501', null, '11 profile completion update denied');
select throws_ok($$update public.accounts set phone_e164 = '+201000000001'$$,
  '42501', null, '12 phone update denied');
select throws_ok($$delete from public.accounts$$, '42501', null, '13 delete denied');
reset role;
set local role anon;
select throws_ok($$select * from public.accounts$$, '42501', null, '14 anon has no access');
reset role;

select throws_ok($$update public.accounts set phone_verified = true
  where user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  '23514', null, '15 verified requires phone');
select lives_ok($$update public.accounts set phone_e164 = '+201000000001', phone_verified = true
  where user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  '16 valid verified phone succeeds');
select throws_ok($$update public.accounts set phone_e164 = '+201000000001', phone_verified = true
  where user_id = 'a7000000-0000-4000-8000-000000000002'$$,
  '23505', null, '17 duplicate verified phone denied');
select lives_ok($$update public.accounts set phone_e164 = '+201000000001', phone_verified = false
  where user_id = 'a7000000-0000-4000-8000-000000000002'$$,
  '18 duplicate unverified phone allowed');
select throws_ok($$update public.accounts set phone_e164 = '12345'
  where user_id = 'a7000000-0000-4000-8000-000000000002'$$,
  '23514', null, '19 malformed phone denied');
select ok((select relrowsecurity from pg_class where oid = 'public.accounts'::regclass),
  '20 row-level security enabled');

select * from finish();
rollback;
