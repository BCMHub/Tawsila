-- TEST ONLY: controlled database fixture for a synthetic local test user.
-- Never called by the app or loaded automatically by db reset.
-- Run with local psql: -v test_user_id=<synthetic-user-uuid> -f this-file
\set ON_ERROR_STOP on
-- The CLI recursively discovers SQL under tests; skip this manual fixture by default.
\if :{?test_user_id}
begin;
create temporary table profile_fixture_target (user_id uuid not null) on commit drop;
insert into profile_fixture_target values (:'test_user_id'::uuid);
do $$
begin
  if not exists (
    select 1 from public.accounts a
    join profile_fixture_target t on t.user_id = a.user_id
  ) then
    raise exception 'Test account does not exist';
  end if;
end;
$$;
update public.accounts
set profile_completed_at = now()
where user_id = (select user_id from profile_fixture_target);
commit;
\else
\echo 1..0 # SKIP manual test fixture requires test_user_id
\endif
