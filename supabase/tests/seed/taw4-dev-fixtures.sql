-- TEST ONLY: three clearly named test communities and the current test Terms and Privacy versions,
-- so that the onboarding screens can be tried by hand on the LOCAL stack. Never loaded by db reset or by the app.
-- Real communities and the real Terms and Privacy versions are the owner's content (spec section 7).
-- Run with: docker exec -i supabase_db_tawsila psql -U postgres -X -v load_taw4_fixtures=1 < supabase/tests/seed/taw4-dev-fixtures.sql
\set ON_ERROR_STOP on
-- The CLI recursively discovers SQL under tests; skip this manual fixture by default.
\if :{?load_taw4_fixtures}
begin;
insert into public.communities (name, sort_order, active)
select v.name, v.sort_order, true
from (values ('Test community A', 1), ('Test community B', 2), ('Test community C', 3)) as v(name, sort_order)
where not exists (select 1 from public.communities c where c.name = v.name);
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents (kind, version, is_current)
values ('terms', 'test-v1', true), ('privacy', 'test-v1', true)
on conflict (kind, version) do update set is_current = true;
commit;
\else
\echo skipped: pass -v load_taw4_fixtures=1 to load the TAW-4 test fixtures
\endif
