begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

create temp table taw29_expected_tables(name text primary key);
insert into taw29_expected_tables values ('places'), ('routes'), ('ride_series'), ('rides'), ('pilot_events');
create temp table taw29_expected_functions(name text primary key);
insert into taw29_expected_functions values
  ('is_phone_verified'), ('require_phone_verified'), ('can_publish'), ('publish_ride'), ('list_rides'),
  ('get_ride'), ('resolve_shared_ride'), ('taw29_post_eligible'), ('taw29_ride_offerable'),
  ('taw29_has_contact'), ('taw29_log_view'), ('taw29_new_share_code'), ('ride_window_days'),
  ('ride_limits'), ('extend_weekday_series');

select set_eq(
  $$select table_name from information_schema.tables where table_schema = 'public' and table_name in (select name from taw29_expected_tables)$$,
  $$select name from taw29_expected_tables$$,
  'schema:no_price:tables-present every TAW-29 table exists before the column scan');
select set_eq(
  $$select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in (select name from taw29_expected_functions)$$,
  $$select name from taw29_expected_functions$$,
  'no_price:functions-present every TAW-29 function exists before the argument scan');
select is((select count(*) from information_schema.columns c join taw29_expected_tables t on t.name = c.table_name
  where c.table_schema = 'public' and c.column_name ~* '(price|fare|cost|amount|currency|egp)'), 0::bigint,
  'schema:no_price:columns no TAW-29 table column has a price-like name');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join taw29_expected_functions f on f.name = p.proname
  cross join lateral unnest(coalesce(p.proargnames, array[]::text[])) arg(name)
  where n.nspname = 'public' and arg.name ~* '(price|fare|cost|amount|currency|egp)'), 0::bigint,
  'no_price:function-arguments no TAW-29 function argument has a price-like name');

select * from finish();
rollback;
