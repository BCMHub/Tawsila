begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(949);

-- PUBLIC is an ACL grantee, never a has_*_privilege role name.
-- This role has no memberships, so execution observes only PUBLIC privileges.
create role taw29_public_probe nologin noinherit;
-- PG16+ CREATEROLE gives ADMIN, but SET membership must be explicit.
grant taw29_public_probe to current_user with set true;
select ok(has_database_privilege(current_user, current_database(), 'CREATE'),
  'schema:struct:ref-probe:database-create owner can create the throwaway schema');
create schema taw29_ref_probe;
grant usage, create on schema taw29_ref_probe to anon, authenticated, service_role, taw29_public_probe;
create table taw29_ref_probe.select_control(x integer);
insert into taw29_ref_probe.select_control values (1);
grant select on taw29_ref_probe.select_control to PUBLIC;
select ok(not exists(select 1 from pg_auth_members where member='taw29_public_probe'::regrole),
  'schema:struct:public-probe:no-memberships PUBLIC probe has no role memberships');

-- Every probe traps missing objects and SQL errors. Successful destructive probes
-- roll back in a subtransaction; no extra grants or RLS changes leak to the next probe.
-- The helper is SECURITY INVOKER: SET ROLE really changes the executing identity.
create function pg_temp.observe(role_name text, statement text, isolate_table text default null,
                                keep_changes boolean default false) returns jsonb
language plpgsql as $fn$
declare original_role text := current_user; result text; result_state text := '00000';
        result_message text; affected bigint;
begin
  begin
    if isolate_table is not null then
      execute format('alter table public.%I disable row level security',isolate_table);
    end if;
    if role_name <> 'owner' then
      execute format('set local role %I',case when role_name='PUBLIC' then 'taw29_public_probe' else role_name end);
    end if;
    if statement ~* '^\s*(select|with)\s' then execute statement into result;
    else execute statement; end if;
    get diagnostics affected = row_count;
    if not keep_changes then raise exception using errcode='PZ001', message='rollback successful probe'; end if;
  exception
    when sqlstate 'PZ001' then null;
    when others then get stacked diagnostics result_state=returned_sqlstate, result_message=message_text;
  end;
  execute format('set local role %I',original_role);
  return jsonb_build_object('state',result_state,'value',result,'message',result_message,'rows',affected);
end
$fn$;
-- Retain producing-call outcomes so empty side-effect scans cannot pass alone.
create temp table taw29_probe_results(id text primary key, passed boolean not null);
create function pg_temp.check_probe(description text, role_name text, statement text,
  expected_state text default '00000', expected_value text default null,
  isolate_table text default null, keep_changes boolean default false) returns text
language plpgsql as $fn$
declare observed jsonb; passed boolean;
begin
  observed := pg_temp.observe(role_name,statement,isolate_table,keep_changes);
  passed := observed->>'state'=expected_state and
    (expected_value is null or coalesce(observed->>(case when expected_state='00000' then 'value' else 'message' end)=expected_value,false));
  insert into taw29_probe_results values (split_part(description,' ',1),coalesce(passed,false))
    on conflict (id) do update set passed=excluded.passed;
  return ok(passed,description) || case when passed then '' else E'\n' || diag(observed::text) end;
end
$fn$;
select pg_temp.check_probe('schema:bypass:control:PUBLIC:select-granted PUBLIC SELECT grant is usable', 'PUBLIC', $sql$select count(*) from taw29_ref_probe.select_control$sql$, '00000', '1');
select pg_temp.check_probe('schema:bypass:control:anon:select-granted PUBLIC SELECT grant is usable', 'anon', $sql$select count(*) from taw29_ref_probe.select_control$sql$, '00000', '1');
create function pg_temp.probe_trigger() returns trigger language plpgsql as $fn$ begin return new; end $fn$;

-- Resolve function arguments dynamically so state (b), with tables but no T3
-- functions, yields failed TAP assertions rather than a parse-time abort.
create function pg_temp.null_call(function_name text) returns text language plpgsql as $fn$
declare statement text;
begin
  select format('select public.%I(%s)',p.proname,
    (select string_agg('null::'||format_type(t,null),',' order by ord)
     from unnest(p.proargtypes::oid[]) with ordinality a(t,ord))) into strict statement
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=function_name;
  return statement;
exception when no_data_found then return format('select public.%I()',function_name);
end
$fn$;

create temp table taw29_expected(object_name text,kind text,role_name text,privilege text,allowed boolean);
insert into taw29_expected values
-- BEGIN GENERATED PRIVILEGES
  ('places','table','PUBLIC','SELECT',false),
  ('places','table','PUBLIC','INSERT',false),
  ('places','table','PUBLIC','UPDATE',false),
  ('places','table','PUBLIC','DELETE',false),
  ('places','table','PUBLIC','TRUNCATE',false),
  ('places','table','PUBLIC','REFERENCES',false),
  ('places','table','PUBLIC','TRIGGER',false),
  ('places','table','PUBLIC','MAINTAIN',false),
  ('places','table','anon','SELECT',false),
  ('places','table','anon','INSERT',false),
  ('places','table','anon','UPDATE',false),
  ('places','table','anon','DELETE',false),
  ('places','table','anon','TRUNCATE',false),
  ('places','table','anon','REFERENCES',false),
  ('places','table','anon','TRIGGER',false),
  ('places','table','anon','MAINTAIN',false),
  ('places','table','authenticated','SELECT',true),
  ('places','table','authenticated','INSERT',false),
  ('places','table','authenticated','UPDATE',false),
  ('places','table','authenticated','DELETE',false),
  ('places','table','authenticated','TRUNCATE',false),
  ('places','table','authenticated','REFERENCES',false),
  ('places','table','authenticated','TRIGGER',false),
  ('places','table','authenticated','MAINTAIN',false),
  ('places','table','service_role','SELECT',true),
  ('places','table','service_role','INSERT',true),
  ('places','table','service_role','UPDATE',true),
  ('places','table','service_role','DELETE',true),
  ('places','table','service_role','TRUNCATE',false),
  ('places','table','service_role','REFERENCES',false),
  ('places','table','service_role','TRIGGER',false),
  ('places','table','service_role','MAINTAIN',false),
  ('places','table','owner','SELECT',true),
  ('places','table','owner','INSERT',true),
  ('places','table','owner','UPDATE',true),
  ('places','table','owner','DELETE',true),
  ('places','table','owner','TRUNCATE',true),
  ('places','table','owner','REFERENCES',true),
  ('places','table','owner','TRIGGER',true),
  ('places','table','owner','MAINTAIN',true),
  ('routes','table','PUBLIC','SELECT',false),
  ('routes','table','PUBLIC','INSERT',false),
  ('routes','table','PUBLIC','UPDATE',false),
  ('routes','table','PUBLIC','DELETE',false),
  ('routes','table','PUBLIC','TRUNCATE',false),
  ('routes','table','PUBLIC','REFERENCES',false),
  ('routes','table','PUBLIC','TRIGGER',false),
  ('routes','table','PUBLIC','MAINTAIN',false),
  ('routes','table','anon','SELECT',false),
  ('routes','table','anon','INSERT',false),
  ('routes','table','anon','UPDATE',false),
  ('routes','table','anon','DELETE',false),
  ('routes','table','anon','TRUNCATE',false),
  ('routes','table','anon','REFERENCES',false),
  ('routes','table','anon','TRIGGER',false),
  ('routes','table','anon','MAINTAIN',false),
  ('routes','table','authenticated','SELECT',true),
  ('routes','table','authenticated','INSERT',false),
  ('routes','table','authenticated','UPDATE',false),
  ('routes','table','authenticated','DELETE',false),
  ('routes','table','authenticated','TRUNCATE',false),
  ('routes','table','authenticated','REFERENCES',false),
  ('routes','table','authenticated','TRIGGER',false),
  ('routes','table','authenticated','MAINTAIN',false),
  ('routes','table','service_role','SELECT',true),
  ('routes','table','service_role','INSERT',true),
  ('routes','table','service_role','UPDATE',true),
  ('routes','table','service_role','DELETE',true),
  ('routes','table','service_role','TRUNCATE',false),
  ('routes','table','service_role','REFERENCES',false),
  ('routes','table','service_role','TRIGGER',false),
  ('routes','table','service_role','MAINTAIN',false),
  ('routes','table','owner','SELECT',true),
  ('routes','table','owner','INSERT',true),
  ('routes','table','owner','UPDATE',true),
  ('routes','table','owner','DELETE',true),
  ('routes','table','owner','TRUNCATE',true),
  ('routes','table','owner','REFERENCES',true),
  ('routes','table','owner','TRIGGER',true),
  ('routes','table','owner','MAINTAIN',true),
  ('car_types','table','PUBLIC','SELECT',false),
  ('car_types','table','PUBLIC','INSERT',false),
  ('car_types','table','PUBLIC','UPDATE',false),
  ('car_types','table','PUBLIC','DELETE',false),
  ('car_types','table','PUBLIC','TRUNCATE',false),
  ('car_types','table','PUBLIC','REFERENCES',false),
  ('car_types','table','PUBLIC','TRIGGER',false),
  ('car_types','table','PUBLIC','MAINTAIN',false),
  ('car_types','table','anon','SELECT',false),
  ('car_types','table','anon','INSERT',false),
  ('car_types','table','anon','UPDATE',false),
  ('car_types','table','anon','DELETE',false),
  ('car_types','table','anon','TRUNCATE',false),
  ('car_types','table','anon','REFERENCES',false),
  ('car_types','table','anon','TRIGGER',false),
  ('car_types','table','anon','MAINTAIN',false),
  ('car_types','table','authenticated','SELECT',true),
  ('car_types','table','authenticated','INSERT',false),
  ('car_types','table','authenticated','UPDATE',false),
  ('car_types','table','authenticated','DELETE',false),
  ('car_types','table','authenticated','TRUNCATE',false),
  ('car_types','table','authenticated','REFERENCES',false),
  ('car_types','table','authenticated','TRIGGER',false),
  ('car_types','table','authenticated','MAINTAIN',false),
  ('car_types','table','service_role','SELECT',true),
  ('car_types','table','service_role','INSERT',true),
  ('car_types','table','service_role','UPDATE',true),
  ('car_types','table','service_role','DELETE',true),
  ('car_types','table','service_role','TRUNCATE',true),
  ('car_types','table','service_role','REFERENCES',true),
  ('car_types','table','service_role','TRIGGER',true),
  ('car_types','table','service_role','MAINTAIN',true),
  ('car_types','table','owner','SELECT',true),
  ('car_types','table','owner','INSERT',true),
  ('car_types','table','owner','UPDATE',true),
  ('car_types','table','owner','DELETE',true),
  ('car_types','table','owner','TRUNCATE',true),
  ('car_types','table','owner','REFERENCES',true),
  ('car_types','table','owner','TRIGGER',true),
  ('car_types','table','owner','MAINTAIN',true),
  ('ride_series','table','PUBLIC','SELECT',false),
  ('ride_series','table','PUBLIC','INSERT',false),
  ('ride_series','table','PUBLIC','UPDATE',false),
  ('ride_series','table','PUBLIC','DELETE',false),
  ('ride_series','table','PUBLIC','TRUNCATE',false),
  ('ride_series','table','PUBLIC','REFERENCES',false),
  ('ride_series','table','PUBLIC','TRIGGER',false),
  ('ride_series','table','PUBLIC','MAINTAIN',false),
  ('ride_series','table','anon','SELECT',false),
  ('ride_series','table','anon','INSERT',false),
  ('ride_series','table','anon','UPDATE',false),
  ('ride_series','table','anon','DELETE',false),
  ('ride_series','table','anon','TRUNCATE',false),
  ('ride_series','table','anon','REFERENCES',false),
  ('ride_series','table','anon','TRIGGER',false),
  ('ride_series','table','anon','MAINTAIN',false),
  ('ride_series','table','authenticated','SELECT',false),
  ('ride_series','table','authenticated','INSERT',false),
  ('ride_series','table','authenticated','UPDATE',false),
  ('ride_series','table','authenticated','DELETE',false),
  ('ride_series','table','authenticated','TRUNCATE',false),
  ('ride_series','table','authenticated','REFERENCES',false),
  ('ride_series','table','authenticated','TRIGGER',false),
  ('ride_series','table','authenticated','MAINTAIN',false),
  ('ride_series','table','service_role','SELECT',true),
  ('ride_series','table','service_role','INSERT',false),
  ('ride_series','table','service_role','UPDATE',false),
  ('ride_series','table','service_role','DELETE',false),
  ('ride_series','table','service_role','TRUNCATE',false),
  ('ride_series','table','service_role','REFERENCES',false),
  ('ride_series','table','service_role','TRIGGER',false),
  ('ride_series','table','service_role','MAINTAIN',false),
  ('ride_series','table','owner','SELECT',true),
  ('ride_series','table','owner','INSERT',true),
  ('ride_series','table','owner','UPDATE',true),
  ('ride_series','table','owner','DELETE',true),
  ('ride_series','table','owner','TRUNCATE',true),
  ('ride_series','table','owner','REFERENCES',true),
  ('ride_series','table','owner','TRIGGER',true),
  ('ride_series','table','owner','MAINTAIN',true),
  ('rides','table','PUBLIC','SELECT',false),
  ('rides','table','PUBLIC','INSERT',false),
  ('rides','table','PUBLIC','UPDATE',false),
  ('rides','table','PUBLIC','DELETE',false),
  ('rides','table','PUBLIC','TRUNCATE',false),
  ('rides','table','PUBLIC','REFERENCES',false),
  ('rides','table','PUBLIC','TRIGGER',false),
  ('rides','table','PUBLIC','MAINTAIN',false),
  ('rides','table','anon','SELECT',false),
  ('rides','table','anon','INSERT',false),
  ('rides','table','anon','UPDATE',false),
  ('rides','table','anon','DELETE',false),
  ('rides','table','anon','TRUNCATE',false),
  ('rides','table','anon','REFERENCES',false),
  ('rides','table','anon','TRIGGER',false),
  ('rides','table','anon','MAINTAIN',false),
  ('rides','table','authenticated','SELECT',false),
  ('rides','table','authenticated','INSERT',false),
  ('rides','table','authenticated','UPDATE',false),
  ('rides','table','authenticated','DELETE',false),
  ('rides','table','authenticated','TRUNCATE',false),
  ('rides','table','authenticated','REFERENCES',false),
  ('rides','table','authenticated','TRIGGER',false),
  ('rides','table','authenticated','MAINTAIN',false),
  ('rides','table','service_role','SELECT',true),
  ('rides','table','service_role','INSERT',false),
  ('rides','table','service_role','UPDATE',false),
  ('rides','table','service_role','DELETE',false),
  ('rides','table','service_role','TRUNCATE',false),
  ('rides','table','service_role','REFERENCES',false),
  ('rides','table','service_role','TRIGGER',false),
  ('rides','table','service_role','MAINTAIN',false),
  ('rides','table','owner','SELECT',true),
  ('rides','table','owner','INSERT',true),
  ('rides','table','owner','UPDATE',true),
  ('rides','table','owner','DELETE',true),
  ('rides','table','owner','TRUNCATE',true),
  ('rides','table','owner','REFERENCES',true),
  ('rides','table','owner','TRIGGER',true),
  ('rides','table','owner','MAINTAIN',true),
  ('pilot_events','table','PUBLIC','SELECT',false),
  ('pilot_events','table','PUBLIC','INSERT',false),
  ('pilot_events','table','PUBLIC','UPDATE',false),
  ('pilot_events','table','PUBLIC','DELETE',false),
  ('pilot_events','table','PUBLIC','TRUNCATE',false),
  ('pilot_events','table','PUBLIC','REFERENCES',false),
  ('pilot_events','table','PUBLIC','TRIGGER',false),
  ('pilot_events','table','PUBLIC','MAINTAIN',false),
  ('pilot_events','table','anon','SELECT',false),
  ('pilot_events','table','anon','INSERT',false),
  ('pilot_events','table','anon','UPDATE',false),
  ('pilot_events','table','anon','DELETE',false),
  ('pilot_events','table','anon','TRUNCATE',false),
  ('pilot_events','table','anon','REFERENCES',false),
  ('pilot_events','table','anon','TRIGGER',false),
  ('pilot_events','table','anon','MAINTAIN',false),
  ('pilot_events','table','authenticated','SELECT',false),
  ('pilot_events','table','authenticated','INSERT',false),
  ('pilot_events','table','authenticated','UPDATE',false),
  ('pilot_events','table','authenticated','DELETE',false),
  ('pilot_events','table','authenticated','TRUNCATE',false),
  ('pilot_events','table','authenticated','REFERENCES',false),
  ('pilot_events','table','authenticated','TRIGGER',false),
  ('pilot_events','table','authenticated','MAINTAIN',false),
  ('pilot_events','table','service_role','SELECT',true),
  ('pilot_events','table','service_role','INSERT',false),
  ('pilot_events','table','service_role','UPDATE',false),
  ('pilot_events','table','service_role','DELETE',false),
  ('pilot_events','table','service_role','TRUNCATE',false),
  ('pilot_events','table','service_role','REFERENCES',false),
  ('pilot_events','table','service_role','TRIGGER',false),
  ('pilot_events','table','service_role','MAINTAIN',false),
  ('pilot_events','table','owner','SELECT',true),
  ('pilot_events','table','owner','INSERT',true),
  ('pilot_events','table','owner','UPDATE',true),
  ('pilot_events','table','owner','DELETE',true),
  ('pilot_events','table','owner','TRUNCATE',true),
  ('pilot_events','table','owner','REFERENCES',true),
  ('pilot_events','table','owner','TRIGGER',true),
  ('pilot_events','table','owner','MAINTAIN',true),
  ('publish_ride','function','PUBLIC','EXECUTE',false),
  ('publish_ride','function','anon','EXECUTE',false),
  ('publish_ride','function','authenticated','EXECUTE',true),
  ('publish_ride','function','service_role','EXECUTE',false),
  ('publish_ride','function','owner','EXECUTE',true),
  ('can_publish','function','PUBLIC','EXECUTE',false),
  ('can_publish','function','anon','EXECUTE',false),
  ('can_publish','function','authenticated','EXECUTE',true),
  ('can_publish','function','service_role','EXECUTE',false),
  ('can_publish','function','owner','EXECUTE',true),
  ('list_rides','function','PUBLIC','EXECUTE',false),
  ('list_rides','function','anon','EXECUTE',false),
  ('list_rides','function','authenticated','EXECUTE',true),
  ('list_rides','function','service_role','EXECUTE',false),
  ('list_rides','function','owner','EXECUTE',true),
  ('get_ride','function','PUBLIC','EXECUTE',false),
  ('get_ride','function','anon','EXECUTE',false),
  ('get_ride','function','authenticated','EXECUTE',true),
  ('get_ride','function','service_role','EXECUTE',false),
  ('get_ride','function','owner','EXECUTE',true),
  ('resolve_shared_ride','function','PUBLIC','EXECUTE',false),
  ('resolve_shared_ride','function','anon','EXECUTE',false),
  ('resolve_shared_ride','function','authenticated','EXECUTE',true),
  ('resolve_shared_ride','function','service_role','EXECUTE',false),
  ('resolve_shared_ride','function','owner','EXECUTE',true),
  ('is_phone_verified','function','PUBLIC','EXECUTE',false),
  ('is_phone_verified','function','anon','EXECUTE',false),
  ('is_phone_verified','function','authenticated','EXECUTE',true),
  ('is_phone_verified','function','service_role','EXECUTE',false),
  ('is_phone_verified','function','owner','EXECUTE',true),
  ('require_phone_verified','function','PUBLIC','EXECUTE',false),
  ('require_phone_verified','function','anon','EXECUTE',false),
  ('require_phone_verified','function','authenticated','EXECUTE',true),
  ('require_phone_verified','function','service_role','EXECUTE',false),
  ('require_phone_verified','function','owner','EXECUTE',true),
  ('extend_weekday_series','function','PUBLIC','EXECUTE',false),
  ('extend_weekday_series','function','anon','EXECUTE',false),
  ('extend_weekday_series','function','authenticated','EXECUTE',false),
  ('extend_weekday_series','function','service_role','EXECUTE',false),
  ('extend_weekday_series','function','owner','EXECUTE',true),
  ('taw29_post_eligible','function','PUBLIC','EXECUTE',false),
  ('taw29_post_eligible','function','anon','EXECUTE',false),
  ('taw29_post_eligible','function','authenticated','EXECUTE',false),
  ('taw29_post_eligible','function','service_role','EXECUTE',false),
  ('taw29_post_eligible','function','owner','EXECUTE',true),
  ('taw29_ride_offerable','function','PUBLIC','EXECUTE',false),
  ('taw29_ride_offerable','function','anon','EXECUTE',false),
  ('taw29_ride_offerable','function','authenticated','EXECUTE',false),
  ('taw29_ride_offerable','function','service_role','EXECUTE',false),
  ('taw29_ride_offerable','function','owner','EXECUTE',true),
  ('taw29_has_contact','function','PUBLIC','EXECUTE',false),
  ('taw29_has_contact','function','anon','EXECUTE',false),
  ('taw29_has_contact','function','authenticated','EXECUTE',false),
  ('taw29_has_contact','function','service_role','EXECUTE',false),
  ('taw29_has_contact','function','owner','EXECUTE',true),
  ('taw29_log_view','function','PUBLIC','EXECUTE',false),
  ('taw29_log_view','function','anon','EXECUTE',false),
  ('taw29_log_view','function','authenticated','EXECUTE',false),
  ('taw29_log_view','function','service_role','EXECUTE',false),
  ('taw29_log_view','function','owner','EXECUTE',true),
  ('taw29_new_share_code','function','PUBLIC','EXECUTE',false),
  ('taw29_new_share_code','function','anon','EXECUTE',false),
  ('taw29_new_share_code','function','authenticated','EXECUTE',false),
  ('taw29_new_share_code','function','service_role','EXECUTE',false),
  ('taw29_new_share_code','function','owner','EXECUTE',true),
  ('ride_window_days','function','PUBLIC','EXECUTE',false),
  ('ride_window_days','function','anon','EXECUTE',false),
  ('ride_window_days','function','authenticated','EXECUTE',false),
  ('ride_window_days','function','service_role','EXECUTE',false),
  ('ride_window_days','function','owner','EXECUTE',true),
  ('ride_limits','function','PUBLIC','EXECUTE',false),
  ('ride_limits','function','anon','EXECUTE',false),
  ('ride_limits','function','authenticated','EXECUTE',false),
  ('ride_limits','function','service_role','EXECUTE',false),
  ('ride_limits','function','owner','EXECUTE',true),
  ('car_types','column','authenticated','UPDATE(passenger_seats)',false)
-- END GENERATED PRIVILEGES
;
select ok(
  case when kind='table' then
    case when c.oid is null then false
         when role_name='PUBLIC' then coalesce((select bool_or(a.privilege_type=e.privilege) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0),false)=allowed
         else has_table_privilege(case when role_name='owner' then current_user else role_name end,c.oid,privilege)=allowed end
  when kind='column' then
    case when c.oid is null or not exists(select 1 from pg_attribute where attrelid=c.oid and attname='passenger_seats' and not attisdropped) then false
         else has_column_privilege(role_name,c.oid,'passenger_seats','UPDATE')=allowed end
  else case when p.oid is null then false
            when role_name='PUBLIC' then coalesce((select bool_or(a.privilege_type=e.privilege) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0),false)=allowed
            else has_function_privilege(case when role_name='owner' then current_user else role_name end,p.oid,privilege)=allowed end
  end,
  format('%scell:%s:%s:%s expected %s',case when kind='function' then '' else 'schema:' end,
    object_name,role_name,case when kind='column' then 'UPDATE-column' else privilege end,allowed))
from taw29_expected e
left join pg_class c on c.oid=case when kind in ('table','column') then to_regclass(format('public.%I',object_name)) end
left join lateral (select p0.oid,p0.proacl,p0.proowner from pg_proc p0 join pg_namespace n0 on n0.oid=p0.pronamespace where n0.nspname='public' and p0.proname=e.object_name) p on kind='function';
select ok(case when to_regclass('public.car_types') is null then false
  else not has_any_column_privilege('authenticated',to_regclass('public.car_types'),'UPDATE') end,
  'schema:struct:car_types:no-column-update authenticated has no UPDATE on any column');

select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_ride'), 'struct:publish_ride:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_ride'), 'struct:publish_ride:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_publish'), 'struct:can_publish:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_publish'), 'struct:can_publish:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_rides'), 'struct:list_rides:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_rides'), 'struct:list_rides:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_ride'), 'struct:get_ride:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_ride'), 'struct:get_ride:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_shared_ride'), 'struct:resolve_shared_ride:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_shared_ride'), 'struct:resolve_shared_ride:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_phone_verified'), 'struct:is_phone_verified:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_phone_verified'), 'struct:is_phone_verified:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='require_phone_verified'), 'struct:require_phone_verified:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='require_phone_verified'), 'struct:require_phone_verified:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='extend_weekday_series'), 'struct:extend_weekday_series:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='extend_weekday_series'), 'struct:extend_weekday_series:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_post_eligible'), 'struct:taw29_post_eligible:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_post_eligible'), 'struct:taw29_post_eligible:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_ride_offerable'), 'struct:taw29_ride_offerable:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_ride_offerable'), 'struct:taw29_ride_offerable:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_has_contact'), 'struct:taw29_has_contact:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_has_contact'), 'struct:taw29_has_contact:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_log_view'), 'struct:taw29_log_view:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_log_view'), 'struct:taw29_log_view:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_new_share_code'), 'struct:taw29_new_share_code:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_new_share_code'), 'struct:taw29_new_share_code:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ride_window_days'), 'struct:ride_window_days:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ride_window_days'), 'struct:ride_window_days:search-path empty search path');
select ok((select count(*)=1 and bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ride_limits'), 'struct:ride_limits:security-definer security definer');
select ok((select count(*)=1 and bool_and(p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ride_limits'), 'struct:ride_limits:search-path empty search path');
select ok((select count(distinct p.proname)=7 and bool_and(not exists(select 1 from unnest(p.proargnames) a where a ~* '(^|_)(user|owner)(_id)?$')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('publish_ride','can_publish','list_rides','get_ride','resolve_shared_ride','is_phone_verified','require_phone_verified')), 'struct:client-functions:no-user-argument seven client functions accept no user argument');
select pg_temp.check_probe('schema:struct:privileges:fixtures operation succeeds', 'owner', $sql$do $fixture$
begin
  if to_regclass('public.places') is null or to_regclass('public.routes') is null then
    raise exception 'missing TAW-29 tables';
  end if;
  if to_regclass('public.ride_series') is not null then
    update public.ride_series set status='cancelled', cancelled_at=now() where status='active';
  end if;
  insert into public.places(id,name,active) values
    ('a29e1000-0000-4000-8000-000000000101','Privilege A',true),('a29e1000-0000-4000-8000-000000000102','Privilege B',true),('a29e1000-0000-4000-8000-000000000103','Privilege inactive',false);
  insert into public.routes(id,place_a_id,place_b_id,duration_minutes,active) values
    ('a29e1000-0000-4000-8000-000000000104','a29e1000-0000-4000-8000-000000000101','a29e1000-0000-4000-8000-000000000102',50,true),('a29e1000-0000-4000-8000-000000000105','a29e1000-0000-4000-8000-000000000102','a29e1000-0000-4000-8000-000000000101',50,false),('a29e1000-0000-4000-8000-000000000106','a29e1000-0000-4000-8000-000000000101','a29e1000-0000-4000-8000-000000000103',50,true);
  insert into public.car_types(id,code,name,passenger_seats) values ('a29e1000-0000-4000-8000-000000000107','taw29-privileges','Privilege car',4);
  insert into auth.users(id) values ('a29e1000-0000-4000-8000-000000000001'),('a29e1000-0000-4000-8000-000000000002'),('a29e1000-0000-4000-8000-000000000003'),('a29e1000-0000-4000-8000-000000000004'),('a29e1000-0000-4000-8000-000000000005');
  insert into public.communities(id,name,active) values ('a29e1000-0000-4000-8000-000000000110','Privilege community',true);
  update public.legal_documents set is_current=false where is_current;
  insert into public.legal_documents(kind,version,is_current) values
    ('terms','taw29-privileges-v1',true),('privacy','taw29-privileges-v1',true);
end $fixture$$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:no-active-weekdays no pre-existing active weekdays series remains', 'owner', $sql$select count(*) from public.ride_series where status='active' and repeat='weekdays'$sql$, '00000', '0');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('schema:struct:privileges:profile-1 operation succeeds', 'owner', $sql$select public.complete_profile('Privilege','Fixture','a29e1000-0000-4000-8000-000000000110','car_owner',true,'taw29-privileges-v1','taw29-privileges-v1')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:car-1 operation succeeds', 'owner', $sql$select public.submit_car('a29e1000-0000-4000-8000-000000000200',null,'Privilege',null,'Car','a29e1000-0000-4000-8000-000000000107',2020,'ب123')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:approve-1 operation succeeds', 'owner', $sql$select public.review_item('a29e1000-0000-4000-8000-000000000001','car_owner',1,'approved',null)$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.check_probe('schema:struct:privileges:profile-2 operation succeeds', 'owner', $sql$select public.complete_profile('Privilege','Fixture','a29e1000-0000-4000-8000-000000000110','car_owner',true,'taw29-privileges-v1','taw29-privileges-v1')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:car-2 operation succeeds', 'owner', $sql$select public.submit_car('a29e1000-0000-4000-8000-000000000201',null,'Privilege',null,'Car','a29e1000-0000-4000-8000-000000000107',2020,'ب124')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:approve-2 operation succeeds', 'owner', $sql$select public.review_item('a29e1000-0000-4000-8000-000000000002','car_owner',1,'approved',null)$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_probe('schema:struct:privileges:profile-3 operation succeeds', 'owner', $sql$select public.complete_profile('Privilege','Fixture','a29e1000-0000-4000-8000-000000000110','car_owner',true,'taw29-privileges-v1','taw29-privileges-v1')$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000004","role":"authenticated"}';
select pg_temp.check_probe('schema:struct:privileges:profile-4 operation succeeds', 'owner', $sql$select public.complete_profile('Privilege','Fixture','a29e1000-0000-4000-8000-000000000110','car_owner',true,'taw29-privileges-v1','taw29-privileges-v1')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:car-4 operation succeeds', 'owner', $sql$select public.submit_car('a29e1000-0000-4000-8000-000000000203',null,'Privilege',null,'Car','a29e1000-0000-4000-8000-000000000107',2020,'ب126')$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:struct:privileges:approve-4 operation succeeds', 'owner', $sql$select public.review_item('a29e1000-0000-4000-8000-000000000004','car_owner',1,'approved',null)$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000005","role":"authenticated"}';
select pg_temp.check_probe('schema:struct:privileges:profile-5 operation succeeds', 'owner', $sql$select public.complete_profile('Privilege','Fixture','a29e1000-0000-4000-8000-000000000110','car_owner',true,'taw29-privileges-v1','taw29-privileges-v1')$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('schema:struct:privileges:account-states operation succeeds', 'owner', $sql$with updated as (update public.accounts set phone_e164='+20100000100'||right(user_id::text,1), phone_verified=true where user_id in ('a29e1000-0000-4000-8000-000000000001','a29e1000-0000-4000-8000-000000000003','a29e1000-0000-4000-8000-000000000004') returning user_id) select count(*) from updated$sql$, '00000', '3', null, true);
select pg_temp.check_probe('schema:struct:privileges:incomplete operation succeeds', 'owner', $sql$with updated as (update public.accounts set profile_completed_at=null where user_id='a29e1000-0000-4000-8000-000000000004' returning user_id) select count(*) from updated$sql$, '00000', '1', null, true);
select pg_temp.check_probe('schema:struct:privileges:ride-fixtures operation succeeds', 'owner', $sql$do $fixture$
begin
  if to_regclass('public.ride_series') is null or to_regclass('public.rides') is null then raise exception 'missing ride tables'; end if;
  set constraints all deferred;
  insert into public.ride_series(id,owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count)
    values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000001','a29e1000-0000-4000-8000-000000000220','a29e1000-0000-4000-8000-000000000104','a_to_b',(now() at time zone 'Africa/Cairo')::date+1,'07:00',0,4,'once','a29e1000-0000-4000-8000-000000000109',1);
  insert into public.rides(id,series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code)
    values ('a29e1000-0000-4000-8000-000000000109','a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000001','a29e1000-0000-4000-8000-000000000104','a_to_b',(now() at time zone 'Africa/Cairo')::date+1,(((now() at time zone 'Africa/Cairo')::date+1)+time '07:00') at time zone 'Africa/Cairo',4,'A29E1000');
  set constraints all immediate;
end $fixture$$sql$, '00000', null, null, true);
select pg_temp.check_probe('schema:bypass:places:authenticated:select-active operation succeeds', 'authenticated', $sql$select count(*) from public.places where id='a29e1000-0000-4000-8000-000000000101'$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:places:authenticated:select-inactive operation succeeds', 'authenticated', $sql$select count(*) from public.places where id='a29e1000-0000-4000-8000-000000000103'$sql$, '00000', '0', null, false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:select-inactive operation succeeds', 'authenticated', $sql$select count(*) from public.routes where id='a29e1000-0000-4000-8000-000000000105'$sql$, '00000', '0', null, false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:select-inactive-place operation succeeds', 'authenticated', $sql$select count(*) from public.routes where id='a29e1000-0000-4000-8000-000000000106'$sql$, '00000', '0', null, false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:select-active operation succeeds', 'authenticated', $sql$select count(*) from public.routes where id='a29e1000-0000-4000-8000-000000000104'$sql$, '00000', '1', null, false);

-- Privilege isolation probes. Each RLS alteration and attempted operation rolls back.
-- REFERENCES ignores RLS, so grant and bypass probes use the same operation.
-- Permanent throwaway tables reach the REFERENCES check; TEMP FKs cannot.
select pg_temp.check_probe('schema:grant:places:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_1(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:places:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_2(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:places:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_3(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:places:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_4(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:places:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_5(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:places:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_6(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:places:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_7(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:places:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_8(x uuid references public.places(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:routes:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_9(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_10(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:routes:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_11(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:routes:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_12(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:routes:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_13(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:routes:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_14(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:routes:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_15(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:routes:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_16(x uuid references public.routes(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_17(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_18(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:car_types:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_19(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:car_types:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_20(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:car_types:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_21(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:car_types:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_22(x uuid references public.car_types(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_23(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_24(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:ride_series:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_25(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:ride_series:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_26(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:ride_series:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_27(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_28(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:ride_series:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_29(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:ride_series:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_30(x uuid references public.ride_series(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:rides:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_31(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_32(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:rides:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_33(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:rides:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_34(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:rides:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_35(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:rides:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_36(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:rides:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_37(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:rides:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_38(x uuid references public.rides(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_39(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:references expected 42501', 'PUBLIC', $sql$create table taw29_ref_probe.t_40(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:pilot_events:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_41(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:pilot_events:anon:references expected 42501', 'anon', $sql$create table taw29_ref_probe.t_42(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_43(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:references expected 42501', 'authenticated', $sql$create table taw29_ref_probe.t_44(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:grant:pilot_events:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_45(x bigint references public.pilot_events(id))$sql$, '42501');
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:references expected 42501', 'service_role', $sql$create table taw29_ref_probe.t_46(x bigint references public.pilot_events(id))$sql$, '42501');

select pg_temp.check_probe('schema:grant:places:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.places set sort_order=9910$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.places set sort_order=9910$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:select expected 42501', 'anon', $sql$select count(*) from public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:select expected 42501', 'anon', $sql$select count(*) from public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:insert expected 42501', 'anon', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:insert expected 42501', 'anon', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:update expected 42501', 'anon', $sql$update public.places set sort_order=9910$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:update expected 42501', 'anon', $sql$update public.places set sort_order=9910$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:delete expected 42501', 'anon', $sql$delete from public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:delete expected 42501', 'anon', $sql$delete from public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:truncate expected 42501', 'anon', $sql$truncate public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:truncate expected 42501', 'anon', $sql$truncate public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:anon:maintain expected 42501', 'anon', $sql$reindex table public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:anon:maintain expected 42501', 'anon', $sql$reindex table public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.places (name) values ('Privilege inserted')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:update expected 42501', 'authenticated', $sql$update public.places set sort_order=9910$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:update expected 42501', 'authenticated', $sql$update public.places set sort_order=9910$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:service_role:truncate expected 42501', 'service_role', $sql$truncate public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:service_role:truncate expected 42501', 'service_role', $sql$truncate public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.places for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:places:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.places$sql$, '42501', null, 'places', false);
select pg_temp.check_probe('schema:bypass:places:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.places$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:select expected 42501', 'anon', $sql$select count(*) from public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:select expected 42501', 'anon', $sql$select count(*) from public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:insert expected 42501', 'anon', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:insert expected 42501', 'anon', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:update expected 42501', 'anon', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:update expected 42501', 'anon', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:delete expected 42501', 'anon', $sql$delete from public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:delete expected 42501', 'anon', $sql$delete from public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:truncate expected 42501', 'anon', $sql$truncate public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:truncate expected 42501', 'anon', $sql$truncate public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:anon:maintain expected 42501', 'anon', $sql$reindex table public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:anon:maintain expected 42501', 'anon', $sql$reindex table public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:update expected 42501', 'authenticated', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:update expected 42501', 'authenticated', $sql$update public.routes set duration_minutes=51$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:service_role:truncate expected 42501', 'service_role', $sql$truncate public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:service_role:truncate expected 42501', 'service_role', $sql$truncate public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.routes for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:routes:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.routes$sql$, '42501', null, 'routes', false);
select pg_temp.check_probe('schema:bypass:routes:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.routes$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:select expected 42501', 'anon', $sql$select count(*) from public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:select expected 42501', 'anon', $sql$select count(*) from public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:insert expected 42501', 'anon', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:insert expected 42501', 'anon', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:update expected 42501', 'anon', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:update expected 42501', 'anon', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:delete expected 42501', 'anon', $sql$delete from public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:delete expected 42501', 'anon', $sql$delete from public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:truncate expected 42501', 'anon', $sql$truncate public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:truncate expected 42501', 'anon', $sql$truncate public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:anon:maintain expected 42501', 'anon', $sql$reindex table public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:anon:maintain expected 42501', 'anon', $sql$reindex table public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.car_types (code,name) values ('privilege-insert','Privilege insert')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:update expected 42501', 'authenticated', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:update expected 42501', 'authenticated', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.car_types for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:car_types:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.car_types$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.car_types$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:select expected 42501', 'anon', $sql$select count(*) from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:select expected 42501', 'anon', $sql$select count(*) from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:insert expected 42501', 'anon', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:insert expected 42501', 'anon', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:update expected 42501', 'anon', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:update expected 42501', 'anon', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:delete expected 42501', 'anon', $sql$delete from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:delete expected 42501', 'anon', $sql$delete from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:truncate expected 42501', 'anon', $sql$truncate public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:truncate expected 42501', 'anon', $sql$truncate public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:anon:maintain expected 42501', 'anon', $sql$reindex table public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:anon:maintain expected 42501', 'anon', $sql$reindex table public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:update expected 42501', 'authenticated', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:update expected 42501', 'authenticated', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:insert expected 42501', 'service_role', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:insert expected 42501', 'service_role', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:update expected 42501', 'service_role', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:update expected 42501', 'service_role', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:delete expected 42501', 'service_role', $sql$delete from public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:delete expected 42501', 'service_role', $sql$delete from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:truncate expected 42501', 'service_role', $sql$truncate public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:truncate expected 42501', 'service_role', $sql$truncate public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.ride_series for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:ride_series:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.ride_series$sql$, '42501', null, 'ride_series', false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.rides set seats_taken=1$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.rides set seats_taken=1$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:select expected 42501', 'anon', $sql$select count(*) from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:select expected 42501', 'anon', $sql$select count(*) from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:insert expected 42501', 'anon', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:insert expected 42501', 'anon', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:update expected 42501', 'anon', $sql$update public.rides set seats_taken=1$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:update expected 42501', 'anon', $sql$update public.rides set seats_taken=1$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:delete expected 42501', 'anon', $sql$delete from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:delete expected 42501', 'anon', $sql$delete from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:truncate expected 42501', 'anon', $sql$truncate public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:truncate expected 42501', 'anon', $sql$truncate public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:anon:maintain expected 42501', 'anon', $sql$reindex table public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:anon:maintain expected 42501', 'anon', $sql$reindex table public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:update expected 42501', 'authenticated', $sql$update public.rides set seats_taken=1$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:update expected 42501', 'authenticated', $sql$update public.rides set seats_taken=1$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:insert expected 42501', 'service_role', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:insert expected 42501', 'service_role', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:update expected 42501', 'service_role', $sql$update public.rides set seats_taken=1$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:update expected 42501', 'service_role', $sql$update public.rides set seats_taken=1$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:delete expected 42501', 'service_role', $sql$delete from public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:delete expected 42501', 'service_role', $sql$delete from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:truncate expected 42501', 'service_role', $sql$truncate public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:truncate expected 42501', 'service_role', $sql$truncate public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.rides for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:rides:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.rides$sql$, '42501', null, 'rides', false);
select pg_temp.check_probe('schema:bypass:rides:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:select expected 42501', 'PUBLIC', $sql$select count(*) from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:insert expected 42501', 'PUBLIC', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.pilot_events set source='list'$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:update expected 42501', 'PUBLIC', $sql$update public.pilot_events set source='list'$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:delete expected 42501', 'PUBLIC', $sql$delete from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:truncate expected 42501', 'PUBLIC', $sql$truncate public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:trigger expected 42501', 'PUBLIC', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:PUBLIC:maintain expected 42501', 'PUBLIC', $sql$reindex table public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:select expected 42501', 'anon', $sql$select count(*) from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:select expected 42501', 'anon', $sql$select count(*) from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:insert expected 42501', 'anon', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:insert expected 42501', 'anon', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:update expected 42501', 'anon', $sql$update public.pilot_events set source='list'$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:update expected 42501', 'anon', $sql$update public.pilot_events set source='list'$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:delete expected 42501', 'anon', $sql$delete from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:delete expected 42501', 'anon', $sql$delete from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:truncate expected 42501', 'anon', $sql$truncate public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:truncate expected 42501', 'anon', $sql$truncate public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:trigger expected 42501', 'anon', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:anon:maintain expected 42501', 'anon', $sql$reindex table public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:anon:maintain expected 42501', 'anon', $sql$reindex table public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:select expected 42501', 'authenticated', $sql$select count(*) from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:insert expected 42501', 'authenticated', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:update expected 42501', 'authenticated', $sql$update public.pilot_events set source='list'$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:update expected 42501', 'authenticated', $sql$update public.pilot_events set source='list'$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:delete expected 42501', 'authenticated', $sql$delete from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:truncate expected 42501', 'authenticated', $sql$truncate public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:trigger expected 42501', 'authenticated', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:authenticated:maintain expected 42501', 'authenticated', $sql$reindex table public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:insert expected 42501', 'service_role', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:insert expected 42501', 'service_role', $sql$insert into public.pilot_events (id,event_type,user_id,event_day) overriding system value values (9291001,'ride_posted','a29e1000-0000-4000-8000-000000000002',current_date)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:update expected 42501', 'service_role', $sql$update public.pilot_events set source='list'$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:update expected 42501', 'service_role', $sql$update public.pilot_events set source='list'$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:delete expected 42501', 'service_role', $sql$delete from public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:delete expected 42501', 'service_role', $sql$delete from public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:truncate expected 42501', 'service_role', $sql$truncate public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:truncate expected 42501', 'service_role', $sql$truncate public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:trigger expected 42501', 'service_role', $sql$create trigger taw29_trigger_probe before insert on public.pilot_events for each row execute function pg_temp.probe_trigger()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:grant:pilot_events:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.pilot_events$sql$, '42501', null, 'pilot_events', false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:maintain expected 42501', 'service_role', $sql$reindex table public.pilot_events$sql$, '42501', null, null, false);
select pg_temp.check_probe('grant:publish_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('bypass:publish_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('grant:publish_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('bypass:publish_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('grant:publish_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('bypass:publish_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('grant:can_publish:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('bypass:can_publish:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('grant:can_publish:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('bypass:can_publish:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('grant:can_publish:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('bypass:can_publish:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('grant:list_rides:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('bypass:list_rides:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('grant:list_rides:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('bypass:list_rides:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('grant:list_rides:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('bypass:list_rides:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('grant:get_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('bypass:get_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('grant:get_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('bypass:get_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('grant:get_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('bypass:get_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('grant:resolve_shared_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('bypass:resolve_shared_ride:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('grant:resolve_shared_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('bypass:resolve_shared_ride:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('grant:resolve_shared_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('bypass:resolve_shared_ride:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('grant:is_phone_verified:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('bypass:is_phone_verified:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('grant:is_phone_verified:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('bypass:is_phone_verified:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('grant:is_phone_verified:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('bypass:is_phone_verified:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('grant:require_phone_verified:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('bypass:require_phone_verified:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('grant:require_phone_verified:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('bypass:require_phone_verified:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('grant:require_phone_verified:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('bypass:require_phone_verified:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('grant:extend_weekday_series:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('bypass:extend_weekday_series:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('grant:extend_weekday_series:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('bypass:extend_weekday_series:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('grant:extend_weekday_series:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('bypass:extend_weekday_series:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('grant:extend_weekday_series:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('bypass:extend_weekday_series:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('grant:taw29_post_eligible:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('bypass:taw29_post_eligible:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('grant:taw29_post_eligible:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('bypass:taw29_post_eligible:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('grant:taw29_post_eligible:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('bypass:taw29_post_eligible:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('grant:taw29_post_eligible:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('bypass:taw29_post_eligible:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('grant:taw29_ride_offerable:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('bypass:taw29_ride_offerable:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('grant:taw29_ride_offerable:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('bypass:taw29_ride_offerable:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('grant:taw29_ride_offerable:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('bypass:taw29_ride_offerable:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('grant:taw29_ride_offerable:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('bypass:taw29_ride_offerable:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('grant:taw29_has_contact:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('bypass:taw29_has_contact:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('grant:taw29_has_contact:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('bypass:taw29_has_contact:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('grant:taw29_has_contact:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('bypass:taw29_has_contact:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('grant:taw29_has_contact:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('bypass:taw29_has_contact:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('grant:taw29_log_view:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('bypass:taw29_log_view:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('grant:taw29_log_view:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('bypass:taw29_log_view:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('grant:taw29_log_view:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('bypass:taw29_log_view:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('grant:taw29_log_view:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('bypass:taw29_log_view:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('grant:taw29_new_share_code:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('bypass:taw29_new_share_code:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('grant:taw29_new_share_code:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('bypass:taw29_new_share_code:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('grant:taw29_new_share_code:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('bypass:taw29_new_share_code:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('grant:taw29_new_share_code:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('bypass:taw29_new_share_code:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('grant:ride_window_days:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('bypass:ride_window_days:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('grant:ride_window_days:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('bypass:ride_window_days:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('grant:ride_window_days:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('bypass:ride_window_days:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('grant:ride_window_days:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('bypass:ride_window_days:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('grant:ride_limits:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('bypass:ride_limits:PUBLIC:execute EXECUTE denied', 'PUBLIC', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('grant:ride_limits:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('bypass:ride_limits:anon:execute EXECUTE denied', 'anon', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('grant:ride_limits:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('bypass:ride_limits:authenticated:execute EXECUTE denied', 'authenticated', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('grant:ride_limits:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('bypass:ride_limits:service_role:execute EXECUTE denied', 'service_role', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('schema:grant:car_types:authenticated:update-column expected 42501', 'authenticated', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, 'car_types', false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:update-column expected 42501', 'authenticated', $sql$update public.car_types set passenger_seats=3$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:places:service_role:select operation succeeds', 'service_role', $sql$select count(*) from public.places where id='a29e1000-0000-4000-8000-000000000101'$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:places:service_role:insert operation succeeds', 'service_role', $sql$with changed as (insert into public.places (name) values ('Privilege inserted') returning 1) select count(*) from changed$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:places:service_role:update operation succeeds', 'service_role', $sql$with changed as (update public.places set sort_order=9920 where id='a29e1000-0000-4000-8000-000000000101' returning 1) select count(*) from changed$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:places:service_role:delete operation succeeds', 'service_role', $sql$do $op$ declare target uuid; begin insert into public.places (name) values ('Privilege inserted') returning id into target; delete from public.places where id=target; if not found then raise exception 'delete did not affect row'; end if; end $op$$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:routes:service_role:select operation succeeds', 'service_role', $sql$select count(*) from public.routes where id='a29e1000-0000-4000-8000-000000000104'$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:routes:service_role:insert operation succeeds', 'service_role', $sql$with changed as (insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50) returning 1) select count(*) from changed$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:routes:service_role:update operation succeeds', 'service_role', $sql$with changed as (update public.routes set duration_minutes=52 where id='a29e1000-0000-4000-8000-000000000104' returning 1) select count(*) from changed$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:routes:service_role:delete operation succeeds', 'service_role', $sql$do $op$ declare target uuid; begin insert into public.routes (place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50) returning id into target; delete from public.routes where id=target; if not found then raise exception 'delete did not affect row'; end if; end $op$$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:select operation succeeds', 'service_role', $sql$select count(*) from public.ride_series$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:select operation succeeds', 'service_role', $sql$select count(*) from public.rides$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:pilot_events:service_role:select operation succeeds', 'service_role', $sql$select count(*) from public.pilot_events$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:car_types:authenticated:select operation succeeds', 'authenticated', $sql$select count(*) from public.car_types where id='a29e1000-0000-4000-8000-000000000107'$sql$, '00000', '1', null, false);
select pg_temp.check_probe('schema:bypass:car_types:service_role:update-capacity operation succeeds', 'service_role', $sql$with changed as (update public.car_types set passenger_seats=8 where id='a29e1000-0000-4000-8000-000000000107' returning passenger_seats) select passenger_seats from changed$sql$, '00000', '8', null, false);
select pg_temp.check_probe('schema:bypass:car_types:owner:update-capacity operation succeeds', 'owner', $sql$with changed as (update public.car_types set passenger_seats=8 where id='a29e1000-0000-4000-8000-000000000107' returning passenger_seats) select passenger_seats from changed$sql$, '00000', '8', null, false);
select pg_temp.check_probe('schema:bypass:car_types:owner:capacity-0 expected 23514', 'owner', $sql$update public.car_types set passenger_seats=0 where id='a29e1000-0000-4000-8000-000000000107'$sql$, '23514', null, null, false);
select pg_temp.check_probe('schema:bypass:car_types:owner:capacity-9 expected 23514', 'owner', $sql$update public.car_types set passenger_seats=9 where id='a29e1000-0000-4000-8000-000000000107'$sql$, '23514', null, null, false);
select pg_temp.check_probe('schema:bypass:routes:owner:runbook-change operation succeeds', 'owner', $sql$do $op$ declare target uuid; begin insert into public.routes(place_a_id,place_b_id,duration_minutes) values ('a29e1000-0000-4000-8000-000000000103','a29e1000-0000-4000-8000-000000000102',50) returning id into target; update public.routes set duration_minutes=55,active=false where id=target; if not exists(select 1 from public.routes where id=target and duration_minutes=55 and not active) then raise exception 'route change failed'; end if; end $op$$sql$, '00000', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:owner:runbook-cancel operation succeeds', 'owner', $sql$with changed as (update public.rides set status='cancelled',cancelled_at=now() where id='a29e1000-0000-4000-8000-000000000109' returning status) select status from changed$sql$, '00000', 'cancelled', null, false);
select pg_temp.check_probe('schema:bypass:ride_series:owner:runbook-cancel operation succeeds', 'owner', $sql$with changed as (update public.ride_series set status='cancelled',cancelled_at=now() where id='a29e1000-0000-4000-8000-000000000108' returning status) select status from changed$sql$, '00000', 'cancelled', null, false);
select pg_temp.check_probe('schema:bypass:pilot_events:owner:select operation succeeds', 'owner', $sql$select count(*) from public.pilot_events$sql$, '00000', null, null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('bypass:publish_ride:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('publish_ride'), '42501');
select pg_temp.check_probe('bypass:can_publish:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('can_publish'), '42501');
select pg_temp.check_probe('bypass:list_rides:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('list_rides'), '42501');
select pg_temp.check_probe('bypass:get_ride:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('get_ride'), '42501');
select pg_temp.check_probe('bypass:resolve_shared_ride:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('resolve_shared_ride'), '42501');
select pg_temp.check_probe('bypass:is_phone_verified:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('is_phone_verified'), '42501');
select pg_temp.check_probe('bypass:require_phone_verified:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('require_phone_verified'), '42501');
select pg_temp.check_probe('bypass:extend_weekday_series:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('extend_weekday_series'), '42501');
select pg_temp.check_probe('bypass:taw29_post_eligible:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('taw29_post_eligible'), '42501');
select pg_temp.check_probe('bypass:taw29_ride_offerable:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('taw29_ride_offerable'), '42501');
select pg_temp.check_probe('bypass:taw29_has_contact:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('taw29_has_contact'), '42501');
select pg_temp.check_probe('bypass:taw29_log_view:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('taw29_log_view'), '42501');
select pg_temp.check_probe('bypass:taw29_new_share_code:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('taw29_new_share_code'), '42501');
select pg_temp.check_probe('bypass:ride_window_days:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('ride_window_days'), '42501');
select pg_temp.check_probe('bypass:ride_limits:service_role:execute-forged forged claims do not grant EXECUTE', 'service_role', pg_temp.null_call('ride_limits'), '42501');
select pg_temp.check_probe('schema:bypass:ride_series:service_role:insert-forged expected 42501', 'service_role', $sql$insert into public.ride_series (owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count) values ('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000221','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+1,'08:00',0,1,'once','a29e1000-0000-4000-8000-000000000109',1)$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:update-forged expected 42501', 'service_role', $sql$update public.ride_series set status='cancelled',cancelled_at=now()$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:delete-forged expected 42501', 'service_role', $sql$delete from public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:ride_series:service_role:truncate-forged expected 42501', 'service_role', $sql$truncate public.ride_series$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:insert-forged expected 42501', 'service_role', $sql$insert into public.rides (series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code) values ('a29e1000-0000-4000-8000-000000000108','a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000104','a_to_b',current_date+2,now()+interval '2 days',1,'A29E1001')$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:update-forged expected 42501', 'service_role', $sql$update public.rides set seats_taken=1$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:delete-forged expected 42501', 'service_role', $sql$delete from public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:truncate-forged expected 42501', 'service_role', $sql$truncate public.rides$sql$, '42501', null, null, false);
select pg_temp.check_probe('schema:bypass:rides:service_role:update-status-forged expected 42501', 'service_role', $sql$update public.rides set status='cancelled',cancelled_at=now()$sql$, '42501');
set local "request.jwt.claims" = '{}';

-- Stable row snapshots are taken as owner outside SET ROLE. check_pure observes
-- real writes before rolling back its outer subtransaction, even on successful calls.
create function pg_temp.snapshot() returns jsonb language plpgsql as $fn$
declare result jsonb := '{}'::jsonb; table_name text; digest text;
begin
  foreach table_name in array array['ride_series','rides','pilot_events','accounts'] loop
    execute format('select md5(coalesce(string_agg(to_jsonb(t)::text, %L order by to_jsonb(t)::text),%L)) from public.%I t','','',table_name) into digest;
    result := result || jsonb_build_object(table_name,digest);
  end loop;
  return result;
end $fn$;
create function pg_temp.check_pure(description text, role_name text, statement text, expected text)
returns text language plpgsql as $fn$
declare before_rows jsonb; after_rows jsonb; observed jsonb; passed boolean := false; error_text text;
begin
  begin
    before_rows := pg_temp.snapshot();
    observed := pg_temp.observe(role_name,statement,null,true);
    after_rows := pg_temp.snapshot();
    passed := observed->>'state'='00000' and observed->>'value'=expected and before_rows=after_rows;
    raise exception using errcode='PZ001';
  exception when sqlstate 'PZ001' then null;
    when others then error_text := sqlstate||': '||sqlerrm;
  end;
  insert into taw29_probe_results values (split_part(description,' ',1),coalesce(passed,false))
    on conflict (id) do update set passed=excluded.passed;
  return ok(coalesce(passed,false),description)||case when passed then '' else E'\n'||diag(coalesce(error_text,observed::text,'no observation')) end;
end $fn$;
-- The spec leaves taw29_log_view's SQL signature open. Bind its documented
-- inputs by argument name/type, and fail explicitly on an unknown argument.
create function pg_temp.log_view(viewer uuid, ride uuid, source text, state text) returns void
language plpgsql as $fn$
declare p record; a record; args text := ''; v text; series uuid;
begin
  select p0.* into strict p from pg_proc p0 join pg_namespace n on n.oid=p0.pronamespace
    where n.nspname='public' and p0.proname='taw29_log_view';
  execute 'select series_id from public.rides where id=$1' into series using ride;
  for a in select t,ord from unnest(p.proargtypes::oid[]) with ordinality x(t,ord) loop
    v := case
      when p.proargnames[a.ord] ~ '(user|viewer)' then viewer::text
      when p.proargnames[a.ord] ~ 'series' then series::text
      when p.proargnames[a.ord] ~ 'state' then state
      when p.proargnames[a.ord] ~ 'ride' then ride::text
      when p.proargnames[a.ord] ~ 'source' then source
      else null end;
    if v is null then raise exception 'unmapped taw29_log_view argument %',p.proargnames[a.ord]; end if;
    args := args || case when args='' then '' else ',' end || format('%L::%s',v,format_type(a.t,null));
  end loop;
  execute 'select public.taw29_log_view('||args||')';
end $fn$;

set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:is_phone_verified:owner:outcome value and no side effect','owner',$sql$select public.is_phone_verified()$sql$,'false');
select pg_temp.check_pure('bypass:can_publish:owner:outcome value and no side effect','owner',$sql$select public.can_publish()$sql$,'phone_unverified');
select pg_temp.check_probe('bypass:require_phone_verified:owner:outcome expected outcome', 'owner', $sql$select public.require_phone_verified()$sql$, 'P0001', 'phone_unverified', null, false);
select pg_temp.check_probe('bypass:publish_ride:owner:outcome expected outcome', 'owner', $sql$select public.publish_ride('a29e1000-0000-4000-8000-000000000300','a29e1000-0000-4000-8000-000000000104','b_to_a',(now() at time zone 'Africa/Cairo')::date+1,'10:00',0,1,null,null,'once')$sql$, 'P0001', 'not_authenticated', null, false);
select pg_temp.check_probe('bypass:list_rides:owner:outcome expected outcome', 'owner', $sql$select public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30)$sql$, 'P0001', 'not_authenticated', null, false);
select pg_temp.check_probe('bypass:get_ride:owner:outcome expected outcome', 'owner', $sql$select public.get_ride('a29e1000-0000-4000-8000-000000000109','list')$sql$, 'P0001', 'not_authenticated', null, false);
select pg_temp.check_probe('bypass:resolve_shared_ride:owner:outcome expected outcome', 'owner', $sql$select public.resolve_shared_ride('A29E1000')$sql$, 'P0001', 'not_authenticated', null, false);
select pg_temp.check_probe('bypass:client-functions:owner:no-writes no ride or event side effects', 'owner', $sql$select ((select count(*)=7 and bool_and(passed) from taw29_probe_results where id in ('bypass:is_phone_verified:owner:outcome','bypass:can_publish:owner:outcome','bypass:require_phone_verified:owner:outcome','bypass:publish_ride:owner:outcome','bypass:list_rides:owner:outcome','bypass:get_ride:owner:outcome','bypass:resolve_shared_ride:owner:outcome')) and (select count(*) from public.ride_series where owner_id::text like 'a29e1000-%')=1 and (select count(*) from public.rides where owner_id::text like 'a29e1000-%')=1 and (select count(*) from public.pilot_events where user_id::text like 'a29e1000-%')=0)::text$sql$, '00000', 'true');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-1 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'true');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-1 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'ok');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-1 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, '00000', null, null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-1 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000001')$sql$,'true');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-2 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'false');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-2 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'phone_unverified');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-2 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, 'P0001', 'phone_unverified', null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-2 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000002')$sql$,'false');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-3 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'true');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-3 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'car_not_approved');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-3 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, '00000', null, null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-3 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000003')$sql$,'false');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000004","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-4 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'true');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-4 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'profile_incomplete');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-4 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, '00000', null, null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-4 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000004')$sql$,'true');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000005","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-5 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'false');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-5 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'phone_unverified');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-5 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, 'P0001', 'phone_unverified', null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-5 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000005')$sql$,'false');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000006","role":"authenticated"}';
select pg_temp.check_pure('bypass:is_phone_verified:authenticated:fixture-6 value and no side effect','authenticated',$sql$select public.is_phone_verified()$sql$,'false');
select pg_temp.check_pure('bypass:can_publish:authenticated:fixture-6 value and no side effect','authenticated',$sql$select public.can_publish()$sql$,'phone_unverified');
select pg_temp.check_probe('bypass:require_phone_verified:authenticated:fixture-6 expected outcome', 'authenticated', $sql$select public.require_phone_verified()$sql$, 'P0001', 'phone_unverified', null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_post_eligible:owner:fixture-6 value and no side effect','owner',$sql$select public.taw29_post_eligible('a29e1000-0000-4000-8000-000000000006')$sql$,'false');
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:eligible expected outcome', 'authenticated', $sql$select public.publish_ride('a29e1000-0000-4000-8000-000000000301','a29e1000-0000-4000-8000-000000000104','b_to_a',(now() at time zone 'Africa/Cairo')::date+1,'10:00',0,1,null,null,'once')$sql$, '00000', null, null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:created expected outcome', 'owner', $sql$select (count(*)=1 and bool_and(published_ride_count=1 and exists(select 1 from public.rides r where r.series_id=s.id)))::text from public.ride_series s where request_id='a29e1000-0000-4000-8000-000000000301'$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:phone_unverified expected outcome', 'authenticated', $sql$select public.publish_ride('a29e1000-0000-4000-8000-000000000303','a29e1000-0000-4000-8000-000000000104','b_to_a',(now() at time zone 'Africa/Cairo')::date+1,'10:00',0,1,null,null,'once')$sql$, 'P0001', 'phone_unverified', null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:phone_unverified-no-rows expected outcome', 'owner', $sql$select ((select passed from taw29_probe_results where id='bypass:publish_ride:authenticated:phone_unverified') and not exists(select 1 from public.ride_series where request_id='a29e1000-0000-4000-8000-000000000303') and not exists(select 1 from public.rides where owner_id='a29e1000-0000-4000-8000-000000000002') and not exists(select 1 from public.pilot_events where user_id='a29e1000-0000-4000-8000-000000000002'))::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:car_not_approved expected outcome', 'authenticated', $sql$select public.publish_ride('a29e1000-0000-4000-8000-000000000304','a29e1000-0000-4000-8000-000000000104','b_to_a',(now() at time zone 'Africa/Cairo')::date+1,'10:00',0,1,null,null,'once')$sql$, 'P0001', 'car_not_approved', null, false);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:publish_ride:authenticated:car_not_approved-no-rows expected outcome', 'owner', $sql$select ((select passed from taw29_probe_results where id='bypass:publish_ride:authenticated:car_not_approved') and not exists(select 1 from public.ride_series where request_id='a29e1000-0000-4000-8000-000000000304') and not exists(select 1 from public.rides where owner_id='a29e1000-0000-4000-8000-000000000003') and not exists(select 1 from public.pilot_events where user_id='a29e1000-0000-4000-8000-000000000003'))::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('bypass:list_rides:authenticated:completed-1 expected outcome', 'authenticated', $sql$select exists(select 1 from public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30) r where r->>'ride_id'='a29e1000-0000-4000-8000-000000000109')::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000002","role":"authenticated"}';
select pg_temp.check_probe('bypass:list_rides:authenticated:completed-2 expected outcome', 'authenticated', $sql$select exists(select 1 from public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30) r where r->>'ride_id'='a29e1000-0000-4000-8000-000000000109')::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_probe('bypass:list_rides:authenticated:completed-3 expected outcome', 'authenticated', $sql$select exists(select 1 from public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30) r where r->>'ride_id'='a29e1000-0000-4000-8000-000000000109')::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000005","role":"authenticated"}';
select pg_temp.check_probe('bypass:list_rides:authenticated:completed-5 expected outcome', 'authenticated', $sql$select exists(select 1 from public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30) r where r->>'ride_id'='a29e1000-0000-4000-8000-000000000109')::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000004","role":"authenticated"}';
select pg_temp.check_probe('bypass:list_rides:authenticated:incomplete expected outcome', 'authenticated', $sql$select public.list_rides('a29e1000-0000-4000-8000-000000000104','a_to_b',null,null,null,30)$sql$, 'P0001', 'profile_incomplete', null, false);
select pg_temp.check_probe('bypass:get_ride:authenticated:incomplete expected outcome', 'authenticated', $sql$select public.get_ride('a29e1000-0000-4000-8000-000000000109','list')$sql$, 'P0001', 'profile_incomplete', null, false);
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:incomplete expected outcome', 'authenticated', $sql$select public.resolve_shared_ride('A29E1000')$sql$, 'P0001', 'profile_incomplete', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('bypass:get_ride:authenticated:own-projection expected outcome', 'authenticated', $sql$select (public.get_ride('a29e1000-0000-4000-8000-000000000109','list') @> jsonb_build_object('state','available','ride_id','a29e1000-0000-4000-8000-000000000109'))::text$sql$, '00000', 'true', null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:get_ride:authenticated:own-no-event expected outcome', 'owner', $sql$select ((select passed from taw29_probe_results where id='bypass:get_ride:authenticated:own-projection') and (select count(*)=0 from public.pilot_events where event_type='ride_viewed' and ride_id='a29e1000-0000-4000-8000-000000000109' and user_id='a29e1000-0000-4000-8000-000000000001'))::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:own-projection expected outcome', 'authenticated', $sql$select (public.resolve_shared_ride('A29E1000') @> jsonb_build_object('state','available','ride',jsonb_build_object('ride_id','a29e1000-0000-4000-8000-000000000109')))::text$sql$, '00000', 'true', null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:own-no-event expected outcome', 'owner', $sql$select ((select passed from taw29_probe_results where id='bypass:resolve_shared_ride:authenticated:own-projection') and (select count(*)=0 from public.pilot_events where event_type='ride_viewed' and ride_id='a29e1000-0000-4000-8000-000000000109' and user_id='a29e1000-0000-4000-8000-000000000001'))::text$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_probe('bypass:get_ride:authenticated:projection expected outcome', 'authenticated', $sql$select (public.get_ride('a29e1000-0000-4000-8000-000000000109','list') @> jsonb_build_object('state','available','ride_id','a29e1000-0000-4000-8000-000000000109'))::text$sql$, '00000', 'true', null, true);
select pg_temp.check_probe('bypass:get_ride:authenticated:repeat expected outcome', 'authenticated', $sql$select (public.get_ride('a29e1000-0000-4000-8000-000000000109','list') @> jsonb_build_object('state','available','ride_id','a29e1000-0000-4000-8000-000000000109'))::text$sql$, '00000', 'true', null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:get_ride:authenticated:one-event expected outcome', 'owner', $sql$select (count(*)=1 and bool_and(source='list' and ride_state='available' and event_day=(now() at time zone 'Africa/Cairo')::date))::text from public.pilot_events where event_type='ride_viewed' and ride_id='a29e1000-0000-4000-8000-000000000109' and user_id='a29e1000-0000-4000-8000-000000000003'$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000005","role":"authenticated"}';
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:projection expected outcome', 'authenticated', $sql$select (public.resolve_shared_ride('A29E1000') @> jsonb_build_object('state','available','ride',jsonb_build_object('ride_id','a29e1000-0000-4000-8000-000000000109')))::text$sql$, '00000', 'true', null, true);
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:repeat expected outcome', 'authenticated', $sql$select (public.resolve_shared_ride('A29E1000') @> jsonb_build_object('state','available','ride',jsonb_build_object('ride_id','a29e1000-0000-4000-8000-000000000109')))::text$sql$, '00000', 'true', null, true);
set local "request.jwt.claims" = '{}';
select pg_temp.check_probe('bypass:resolve_shared_ride:authenticated:one-event expected outcome', 'owner', $sql$select (count(*)=1 and bool_and(source='link' and ride_state='available' and event_day=(now() at time zone 'Africa/Cairo')::date))::text from public.pilot_events where event_type='ride_viewed' and ride_id='a29e1000-0000-4000-8000-000000000109' and user_id='a29e1000-0000-4000-8000-000000000005'$sql$, '00000', 'true', null, false);
set local "request.jwt.claims" = '{"sub":"a29e1000-0000-4000-8000-000000000003","role":"authenticated"}';
select pg_temp.check_pure('bypass:resolve_shared_ride:authenticated:unknown value and no side effect','authenticated',$sql$select (public.resolve_shared_ride('ZZZZZZZZ')=jsonb_build_object('state','not_found'))::text$sql$,'true');
set local "request.jwt.claims" = '{}';
select pg_temp.check_pure('bypass:taw29_ride_offerable:owner:seats-4 value and no side effect','owner',$sql$select public.taw29_ride_offerable('a29e1000-0000-4000-8000-000000000001',4)$sql$,'true');
select pg_temp.check_pure('bypass:taw29_ride_offerable:owner:seats-5 value and no side effect','owner',$sql$select public.taw29_ride_offerable('a29e1000-0000-4000-8000-000000000001',5)$sql$,'false');
select pg_temp.check_pure('bypass:taw29_ride_offerable:owner:ineligible value and no side effect','owner',$sql$select public.taw29_ride_offerable('a29e1000-0000-4000-8000-000000000002',1)$sql$,'false');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:six value and no side effect','owner',$sql$select public.taw29_has_contact('123456')$sql$,'false');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:seven value and no side effect','owner',$sql$select public.taw29_has_contact('1234567')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:arabic value and no side effect','owner',$sql$select public.taw29_has_contact('١٢٣٤٥٦٧')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:extended value and no side effect','owner',$sql$select public.taw29_has_contact('۱۲۳۴۵۶۷')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:fullwidth value and no side effect','owner',$sql$select public.taw29_has_contact('１２３４５６７')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:separators value and no side effect','owner',$sql$select public.taw29_has_contact('+1 2.3-4/5(6)ـ7')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:email value and no side effect','owner',$sql$select public.taw29_has_contact('a@example.com')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:email-case value and no side effect','owner',$sql$select public.taw29_has_contact('A.B@Example.co.uk')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:at-fullwidth value and no side effect','owner',$sql$select public.taw29_has_contact('a＠example.com')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:https value and no side effect','owner',$sql$select public.taw29_has_contact('https://example.com')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:http-case value and no side effect','owner',$sql$select public.taw29_has_contact('HTTP://x.y')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:www value and no side effect','owner',$sql$select public.taw29_has_contact('www.example.com')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:whatsapp value and no side effect','owner',$sql$select public.taw29_has_contact('wa.me/123')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:telegram value and no side effect','owner',$sql$select public.taw29_has_contact('t.me/x')$sql$,'true');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:gate value and no side effect','owner',$sql$select public.taw29_has_contact('Main gate, Industrial Zone 1')$sql$,'false');
select pg_temp.check_pure('bypass:taw29_has_contact:owner:time value and no side effect','owner',$sql$select public.taw29_has_contact('Leaves 7:30, gate 2.')$sql$,'false');
select ok((select count(*)=1 and bool_and(p.provolatile='i') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='taw29_has_contact'), 'struct:taw29_has_contact:immutable contact filter is immutable');
select pg_temp.check_pure('bypass:taw29_new_share_code:owner:outcome value and no side effect','owner',$sql$with code as materialized (select public.taw29_new_share_code() value) select (value ~ '^[0-9A-HJKMNP-TV-Z]{8}$' and not exists(select 1 from public.rides where share_code=code.value))::text from code$sql$,'true');
select pg_temp.check_pure('bypass:ride_window_days:owner:outcome value and no side effect','owner',$sql$select public.ride_window_days()$sql$,'14');
select pg_temp.check_pure('bypass:ride_limits:owner:outcome value and no side effect','owner',$sql$select (public.ride_limits()=jsonb_build_object('max_series_per_24h',10,'max_active_weekday_series',3,'duplicate_window_minutes',60))::text$sql$,'true');
select pg_temp.check_probe('bypass:taw29_log_view:owner:first expected outcome', 'owner', $sql$select pg_temp.log_view('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000109','link','available')$sql$, '00000', null, null, true);
select pg_temp.check_probe('bypass:taw29_log_view:owner:repeat expected outcome', 'owner', $sql$select pg_temp.log_view('a29e1000-0000-4000-8000-000000000002','a29e1000-0000-4000-8000-000000000109','link','available')$sql$, '00000', null, null, true);
select pg_temp.check_probe('bypass:taw29_log_view:owner:one-event expected outcome', 'owner', $sql$select count(*) from public.pilot_events where event_type='ride_viewed' and user_id='a29e1000-0000-4000-8000-000000000002' and ride_id='a29e1000-0000-4000-8000-000000000109' and event_day=(now() at time zone 'Africa/Cairo')::date$sql$, '00000', '1', null, false);
select pg_temp.check_probe('bypass:taw29_log_view:owner:failure-contained expected outcome', 'owner', $sql$do $op$ begin alter table public.pilot_events add constraint taw29_privilege_event_failure check(false) not valid; perform pg_temp.log_view('a29e1000-0000-4000-8000-000000000004','a29e1000-0000-4000-8000-000000000109','link','available'); if exists(select 1 from public.pilot_events where event_type='ride_viewed' and user_id='a29e1000-0000-4000-8000-000000000004' and ride_id='a29e1000-0000-4000-8000-000000000109') then raise exception 'failed event left a row'; end if; end $op$$sql$, '00000', null, null, false);
select pg_temp.check_probe('bypass:extend_weekday_series:owner:created-count expected outcome', 'owner', $sql$do $op$
declare first_day date; missing integer; created integer; again integer; series uuid := 'a29e1000-0000-4000-8000-000000000400'; ride uuid := 'a29e1000-0000-4000-8000-000000000401';
begin
  select min(d::date) into first_day from generate_series((now() at time zone 'Africa/Cairo')::date+1,(now() at time zone 'Africa/Cairo')::date+13,interval '1 day') d where extract(dow from d) in (0,1,2,3,4);
  set constraints all deferred;
  insert into public.ride_series(id,owner_id,request_id,route_id,direction,first_date,departure_time,flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count)
    values(series,'a29e1000-0000-4000-8000-000000000001','a29e1000-0000-4000-8000-000000000402','a29e1000-0000-4000-8000-000000000104','a_to_b',first_day,'15:00',0,1,'weekdays',ride,1);
  insert into public.rides(id,series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code)
    values(ride,series,'a29e1000-0000-4000-8000-000000000001','a29e1000-0000-4000-8000-000000000104','a_to_b',first_day,(first_day+time '15:00') at time zone 'Africa/Cairo',1,'A29E1401');
  set constraints all immediate;
  select count(*) into missing from generate_series(first_day+1,(now() at time zone 'Africa/Cairo')::date+13,interval '1 day') d where extract(dow from d) in (0,1,2,3,4);
  perform pg_advisory_xact_lock(hashtext('taw29-extend-weekday-series'));
  created := public.extend_weekday_series();
  if created<>missing or (select count(*) from public.rides where series_id=series)<>missing+1 then raise exception 'extension count mismatch'; end if;
  again := public.extend_weekday_series();
  if again<>0 then raise exception 'extension not idempotent'; end if;
end $op$$sql$, '00000', null, null, false);
select * from finish();
rollback;
