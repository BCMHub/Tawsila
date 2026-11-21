begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(43);

select is((select count(*) from public.places where name in ('10th of Ramadan City', 'New Cairo')), 2::bigint, 'schema:config:pilot-places both pilot places exist');
select is((select count(*) from public.places where name = '10th of Ramadan City' and area_label is null), 1::bigint, 'schema:config:ramadan-place 10th of Ramadan City has no area label');
select is((select count(*) from public.places where name = 'New Cairo' and area_label = 'Fifth Settlement'), 1::bigint, 'schema:config:new-cairo-place New Cairo has the configured area label');
select is((select count(*) from public.routes r join public.places a on a.id = r.place_a_id join public.places b on b.id = r.place_b_id where a.name = '10th of Ramadan City' and b.name = 'New Cairo' and r.duration_minutes = 50), 1::bigint, 'schema:config:pilot-route the configured 50-minute pilot route exists');
select ok((select bool_and(active) from public.places where name in ('10th of Ramadan City', 'New Cairo')), 'schema:config:pilot-places-active both pilot places are active');
select is((select count(*) from public.routes r join public.places a on a.id = r.place_a_id join public.places b on b.id = r.place_b_id where a.name = '10th of Ramadan City' and b.name = 'New Cairo' and r.active), 1::bigint, 'schema:config:pilot-route-active the pilot route is active');
select ok((select relrowsecurity from pg_class where oid = 'public.places'::regclass), 'schema:places:rls places has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.routes'::regclass), 'schema:routes:rls routes has RLS enabled');
select col_default_is('public', 'car_types', 'passenger_seats', '4', 'schema:car-types:capacity-default passenger_seats defaults to four');
select lives_ok($$insert into public.car_types(code, name, active) values ('a29a1-default', 'A29A1 default', true)$$, 'schema:car-types:capacity-default-insert omitted passenger_seats uses its default');
select is((select passenger_seats from public.car_types where code = 'a29a1-default'), 4::smallint, 'schema:car-types:capacity-default-value the stored default is four');
select lives_ok($$insert into public.car_types(code, name, active, passenger_seats) values ('a29a1-one', 'A29A1 one', true, 1), ('a29a1-eight', 'A29A1 eight', true, 8)$$, 'schema:car-types:capacity-bounds one and eight seats are accepted');
select throws_ok($$insert into public.car_types(code, name, active, passenger_seats) values ('a29a1-zero', 'A29A1 zero', true, 0)$$, '23514', null, 'schema:car-types:capacity-low zero seats is rejected');
select throws_ok($$insert into public.car_types(code, name, active, passenger_seats) values ('a29a1-nine', 'A29A1 nine', true, 9)$$, '23514', null, 'schema:car-types:capacity-high nine seats is rejected');
select throws_ok($$insert into public.car_types(code, name, active, passenger_seats) values ('a29a1-null', 'A29A1 null', true, null)$$, '23502', null, 'schema:car-types:capacity-required passenger_seats is required');

select lives_ok($$insert into public.places(name) values ('A29A1 defaults')$$, 'schema:places:defaults a place id active flag and sort order have usable defaults');
select ok((select id is not null and active and sort_order = 0 from public.places where name = 'A29A1 defaults'), 'schema:places:default-values place defaults are UUID active true and sort zero');
select throws_ok($$insert into public.places(name) values (' ')$$, '23514', null, 'schema:places:name-empty blank place names are rejected');
select throws_ok($$insert into public.places(name) values (' A29A1 untrimmed ')$$, '23514', null, 'schema:places:name-trim place names must already be trimmed');
select throws_ok($$insert into public.places(name) values (repeat('x', 61))$$, '23514', null, 'schema:places:name-length place names longer than 60 are rejected');
select throws_ok($$insert into public.places(name) values ('A29A1 defaults')$$, '23505', null, 'schema:places:name-unique place names are unique');
select throws_ok($$insert into public.places(name, area_label) values ('A29A1 bad area trim', ' area ')$$, '23514', null, 'schema:places:area-trim area labels must already be trimmed');
select throws_ok($$insert into public.places(name, area_label) values ('A29A1 bad area length', repeat('x', 61))$$, '23514', null, 'schema:places:area-length area labels longer than 60 are rejected');

insert into public.places(id, name) values ('a29a1000-0000-4000-8000-000000000011', 'A29A1 route A'), ('a29a1000-0000-4000-8000-000000000012', 'A29A1 route B');
select throws_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000020', 'a29a1000-0000-4000-8000-000000000011', 'a29a1000-0000-4000-8000-000000000011', 50)$$, '23514', null, 'schema:routes:distinct-places a route cannot connect a place to itself');
select lives_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000021', 'a29a1000-0000-4000-8000-000000000011', 'a29a1000-0000-4000-8000-000000000012', 1), ('a29a1000-0000-4000-8000-000000000022', 'a29a1000-0000-4000-8000-000000000012', 'a29a1000-0000-4000-8000-000000000011', 600)$$, 'schema:routes:duration-bounds duration boundaries one and 600 are accepted');
select ok((select bool_and(active and sort_order = 0) from public.routes where id in ('a29a1000-0000-4000-8000-000000000021', 'a29a1000-0000-4000-8000-000000000022')), 'schema:routes:defaults routes default active true and sort zero');
select throws_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000023', 'a29a1000-0000-4000-8000-000000000011', 'a29a1000-0000-4000-8000-000000000012', 50)$$, '23505', null, 'schema:routes:pair-unique an ordered place pair is unique');
select throws_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000024', 'a29a1000-0000-4000-8000-000000000011', 'a29a1000-0000-4000-8000-000000000012', 0)$$, '23514', null, 'schema:routes:duration-low zero minutes is rejected');
select throws_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000025', 'a29a1000-0000-4000-8000-000000000011', 'a29a1000-0000-4000-8000-000000000012', 601)$$, '23514', null, 'schema:routes:duration-high 601 minutes is rejected');
insert into public.places(id, name, active) values ('a29a1000-0000-4000-8000-000000000010', 'A29A1 inactive place', false);

set local role authenticated;
select is((select count(*) from public.places where name in ('10th of Ramadan City', 'New Cairo')), 2::bigint, 'schema:config:places:authenticated:select-active authenticated reads active pilot places');
select is((select count(*) from public.routes r join public.places a on a.id = r.place_a_id join public.places b on b.id = r.place_b_id where a.name = '10th of Ramadan City' and b.name = 'New Cairo'), 1::bigint, 'schema:config:routes:authenticated:select-active authenticated reads the active pilot route');
select is((select count(*) from public.places where id = 'a29a1000-0000-4000-8000-000000000010'), 0::bigint, 'schema:config:places:authenticated:select-inactive authenticated cannot read inactive places');
select throws_ok($$insert into public.places(name) values ('A29A1 forbidden')$$, '42501', null, 'schema:config:places:authenticated:insert authenticated cannot insert places');
select throws_ok($$update public.places set sort_order = sort_order$$, '42501', null, 'schema:config:places:authenticated:update authenticated cannot update places');
select throws_ok($$delete from public.places$$, '42501', null, 'schema:config:places:authenticated:delete authenticated cannot delete places');
select throws_ok($$insert into public.routes(id, place_a_id, place_b_id, duration_minutes) values ('a29a1000-0000-4000-8000-000000000001', gen_random_uuid(), gen_random_uuid(), 50)$$, '42501', null, 'schema:config:routes:authenticated:insert authenticated cannot insert routes');
select throws_ok($$update public.routes set sort_order = sort_order$$, '42501', null, 'schema:config:routes:authenticated:update authenticated cannot update routes');
select throws_ok($$delete from public.routes$$, '42501', null, 'schema:config:routes:authenticated:delete authenticated cannot delete routes');
reset role;

set local role anon;
select throws_ok($$select * from public.places$$, '42501', null, 'schema:config:places:anon:select anon cannot read places');
select throws_ok($$select * from public.routes$$, '42501', null, 'schema:config:routes:anon:select anon cannot read routes');
reset role;

insert into auth.users(id) values ('a29a1000-0000-4000-8000-000000000099');
insert into public.communities(id, name) values ('a29a1000-0000-4000-8000-000000000098', 'A29A1 community');
-- TAW-4 setup is deliberately untrapped: broken fixtures must abort.
update public.legal_documents set is_current = false where is_current;
insert into public.legal_documents(kind, version, is_current)
values ('terms', 'taw29-config-v1', true), ('privacy', 'taw29-config-v1', true);
set local "request.jwt.claims" = '{"sub":"a29a1000-0000-4000-8000-000000000099","role":"authenticated"}';
select public.complete_profile('Config', 'Fixture', 'a29a1000-0000-4000-8000-000000000098', 'car_owner', true, 'taw29-config-v1', 'taw29-config-v1');
select public.submit_car('a29a1000-0000-4000-8000-000000000097', null, 'A29A1 brand', null, 'A29A1 model',
  (select id from public.car_types where code = 'other'), 2020, 'ب12');
set local role service_role;
set local "request.jwt.claims" = '{"sub":"a29a1000-0000-4000-8000-000000000099","role":"service_role"}';
select public.review_item('a29a1000-0000-4000-8000-000000000099', 'car_owner', 1, 'approved', null);
reset role;
set local "request.jwt.claims" = '{}';
update public.accounts set phone_e164 = '+201000000099', phone_verified = true
  where user_id = 'a29a1000-0000-4000-8000-000000000099';

create temp table a29a1_inactive_route as select r.id from public.routes r join public.places a on a.id = r.place_a_id join public.places b on b.id = r.place_b_id where a.name = '10th of Ramadan City' and b.name = 'New Cairo';
grant select on a29a1_inactive_route to authenticated;
update public.routes set active = false where id = (select id from a29a1_inactive_route);
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a29a1000-0000-4000-8000-000000000099","role":"authenticated"}';
select is((select count(*) from public.routes where not active), 0::bigint, 'schema:config:routes:authenticated:select-inactive authenticated cannot read inactive routes');
select throws_ok($call$select public.list_rides((select id from a29a1_inactive_route), 'a_to_b', null, null, null, 30)$call$, 'P0001', 'invalid_route', 'config:list-inactive list_rides rejects a deactivated route');
select throws_ok($call$select public.publish_ride('a29a1000-0000-4000-8000-000000000002', (select id from a29a1_inactive_route), 'a_to_b', ((now() at time zone 'Africa/Cairo')::date + 1), '07:00'::time, 0, 1, null, null, 'once')$call$, 'P0001', 'invalid_route', 'config:publish-inactive publish_ride rejects a deactivated route');
reset role;

select * from finish();
rollback;
