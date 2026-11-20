begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Series fixtures reference their first ride before that ride is inserted.
set constraints all deferred;
reset role;
select set_config('request.jwt.claims','',true);
select plan(107);

-- Dynamic, exception-trapped calls let the table-only T2 state finish every assertion.
create function pg_temp.id(n int) returns uuid language sql immutable as $$
 select ('a29d2000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.today() returns date language sql stable as $$
 select (now() at time zone 'Africa/Cairo')::date
$$;
create function pg_temp.call(q text) returns jsonb language plpgsql as $$
declare v jsonb;
begin execute q into v; return v;
exception when others then return jsonb_build_object('error',sqlerrm);
end $$;
create function pg_temp.getr(i uuid,s text default 'list') returns jsonb language sql as $$
 select pg_temp.call(format('select public.get_ride(%L::uuid,%L::text)',i,s))
$$;
create function pg_temp.resolve(c text) returns jsonb language sql as $$
 select pg_temp.call(format('select public.resolve_shared_ride(%L::text)',c))
$$;
create function pg_temp.list() returns jsonb language sql as $$
 select pg_temp.call($q$select coalesce(jsonb_agg(x),'[]'::jsonb)
 from public.list_rides('a29d2000-0000-4000-8000-000000000131','a_to_b',null,null,null,50) x$q$)
$$;
create function pg_temp.publish(n int,d date,t time,seats int,rep text default 'once',dir text default 'a_to_b')
returns jsonb language sql as $$
 select pg_temp.call(format($q$select public.publish_ride(%L::uuid,%L::uuid,%L::text,
 %L::date,%L::time,0,%L::int,null,null,%L::text)$q$,pg_temp.id(n),pg_temp.id(131),dir,d,t,seats,rep))
$$;
create function pg_temp.arr(v jsonb) returns jsonb language sql immutable as $$
 select case when jsonb_typeof(v)='array' then v else '[]'::jsonb end
$$;
create function pg_temp.has_ride(v jsonb,i uuid) returns boolean language sql immutable as $$
 select case when jsonb_typeof(v)='array' and i is not null then
 exists(select 1 from jsonb_array_elements(pg_temp.arr(v)) x where (x->>'ride_id')::uuid=i) end
$$;
create function pg_temp.keys(v jsonb) returns text[] language sql immutable as $$
 select array_agg(k order by k) from jsonb_object_keys(
 case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k
$$;
create function pg_temp.projection_keys() returns text[] language sql immutable as $$
 select array_agg(k order by k) from unnest(array[
 'ride_id','share_code','route_id','direction','from_name','from_area','to_name','to_area','duration_minutes',
 'ride_date','departure_time','departs_at','flex_minutes','seats_offered','seats_left','repeat','pickup_note',
 'notes','created_at','state','is_own','owner_display','owner_initials','owner_member_since',
 'owner_phone_verified','car_label']) k
$$;
create function pg_temp.clean(v jsonb) returns boolean language sql immutable as $$
 select coalesce(pg_temp.keys(v)=pg_temp.projection_keys() and v->>'ride_id' is not null
 and not (v ?| array['owner_id','last_name','phone_e164','plate_number','community_id','year','brand_other','model_other'])
 and v::text not like all(array['%+201099988877%','%ب9876%','%Surname%','%SECRET COMMUNITY%',
 '%PRIVATE BRAND +201099988877%','%PRIVATE MODEL ب9876%',
 '%a29d2000-0000-4000-8000-000000000001%','%a29d2000-0000-4000-8000-000000000101%']),false)
$$;
create function pg_temp.hidden(v jsonb,expected_state text) returns boolean language sql immutable as $$
 select coalesce(pg_temp.clean(v) and v->>'state'=expected_state and v->'car_label'='null'::jsonb
 and v->'owner_phone_verified'='false'::jsonb
 and v::text not like all(array['%Replacement Brand%','%Replacement Model%','%Small Type%']),false)
$$;
create temp table observed(name text primary key,v jsonb);
grant select,insert,update on observed to authenticated;
create function pg_temp.result(n text) returns jsonb language sql as $$
 select v from pg_temp.observed where name=n
$$;
create function pg_temp.published_id(n text) returns uuid language sql as $$
 select (pg_temp.result(n)->>'ride_id')::uuid
$$;
create function pg_temp.weekday() returns date language sql stable as $$
 select min(pg_temp.today()+i) from generate_series(1,3) i
 where extract(dow from pg_temp.today()+i) in (0,1,2,3,4)
$$;

-- Private owner plus independent viewer; fixed a29d2 ids only.
insert into auth.users(id) values ('a29d2000-0000-4000-8000-000000000001'),('a29d2000-0000-4000-8000-000000000002'),('a29d2000-0000-4000-8000-000000000003');
insert into communities(id,name) values ('a29d2000-0000-4000-8000-000000000101','SECRET COMMUNITY');
update legal_documents set is_current=false where is_current;
insert into legal_documents(kind,version,is_current) values ('terms','a29d2',true),('privacy','a29d2',true);
insert into car_brands(id,name) values ('a29d2000-0000-4000-8000-000000000111','Catalogue Brand'),('a29d2000-0000-4000-8000-000000000114','Replacement Brand');
insert into car_models(id,brand_id,name) values ('a29d2000-0000-4000-8000-000000000112','a29d2000-0000-4000-8000-000000000111','Catalogue Model'),('a29d2000-0000-4000-8000-000000000115','a29d2000-0000-4000-8000-000000000114','Replacement Model');
insert into car_types(id,code,name) values ('a29d2000-0000-4000-8000-000000000113','large-a29d2','Large Type'),('a29d2000-0000-4000-8000-000000000116','small-a29d2','Small Type');
-- Keep the TAW-29 column separate; fixture errors must not be trapped.
update car_types set passenger_seats=case when id=pg_temp.id(113) then 8 else 4 end
where id in (pg_temp.id(113),pg_temp.id(116));
insert into places(id,name) values ('a29d2000-0000-4000-8000-000000000121','Projection A'),('a29d2000-0000-4000-8000-000000000122','Projection B');
insert into routes(id,place_a_id,place_b_id,duration_minutes) values ('a29d2000-0000-4000-8000-000000000131','a29d2000-0000-4000-8000-000000000121','a29d2000-0000-4000-8000-000000000122',50);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
select complete_profile('Private','Surname',pg_temp.id(101),'car_owner',true,'a29d2','a29d2');
select submit_car(pg_temp.id(211),pg_temp.id(111),null,pg_temp.id(112),null,pg_temp.id(113),2024,'ب ٩٨٧٦');
reset role;
select set_config('request.jwt.claims','',true);
select review_item(pg_temp.id(1),'car_owner',1,'approved','fixture');
update accounts set phone_e164='+201099988877',phone_verified=true where user_id=pg_temp.id(1);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select complete_profile('Viewing','Member',pg_temp.id(101),'rider',true,'a29d2','a29d2');
reset role;
select set_config('request.jwt.claims','',true);

do $fixtures$
declare i int; t timestamptz; d date:=pg_temp.today()+1;
begin
 for i in 1..6 loop
  t:=case when i=3 then now() else (d+time '09:00'+i*interval '10 min') at time zone 'Africa/Cairo' end;
  insert into ride_series(id,owner_id,request_id,route_id,direction,first_date,departure_time,
   flex_minutes,seats_offered,pickup_note,notes,repeat,status,cancelled_at,published_ride_id,published_ride_count,created_at)
  values(pg_temp.id(2000+i),pg_temp.id(1),pg_temp.id(4000+i),pg_temp.id(131),'a_to_b',
   (t at time zone 'Africa/Cairo')::date,date_trunc('minute',t at time zone 'Africa/Cairo')::time,
   5,case when i in (2,6) then 4 else 8 end,'Safe pickup','Safe notes','once',
   case when i=5 then 'cancelled' else 'active' end,case when i=5 then now() end,pg_temp.id(3000+i),1,
   now()-interval '2 days'); -- Synthetic series must not consume the publish rate limit.
  insert into rides(id,series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,
   seats_taken,status,cancelled_at,share_code)
  values(pg_temp.id(3000+i),pg_temp.id(2000+i),pg_temp.id(1),pg_temp.id(131),'a_to_b',
   (t at time zone 'Africa/Cairo')::date,t,case when i in (2,6) then 4 else 8 end,
   case when i=2 then 4 else 0 end,case when i=4 then 'cancelled' else 'scheduled' end,
   case when i=4 then now() end,(array['A0B1CDEF','F2BCDEFG','D2BCDEFG','C2BCDEFG','S2BCDEFG','W2BCDEFG'])[i]);
 end loop;
end $fixtures$;
select ok((select count(*)=6 and bool_and(ride_date=(departs_at at time zone 'Africa/Cairo')::date)
 from rides where owner_id=pg_temp.id(1)),'schema:projection:fixture-dates Cairo dates include departed fixture');
select ok((select a.phone_e164='+201099988877' and p.last_name='Surname' and c.name='SECRET COMMUNITY'
 and v.plate_number='ب9876' and v.year=2024 from accounts a join profiles p using(user_id)
 join communities c on c.id=p.community_id join vehicles v using(user_id) where a.user_id=pg_temp.id(1)),
 'schema:projection:private-fixture private values really exist before disclosure checks');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into observed values('pub8',pg_temp.publish(801,pg_temp.weekday(),'07:00',8,'weekdays'));
select ok(pg_temp.result('pub8')->>'ride_id' is not null and (pg_temp.result('pub8')->>'ride_count')::int>1
 and pg_temp.result('pub8')->'replayed'='false'::jsonb,'projection:publish:eight real eight-seat weekday publish succeeds');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select count(*)>1 and bool_and(seats_offered=8) from rides
 where series_id=(pg_temp.result('pub8')->>'series_id')::uuid),
 'projection:publish:eight-rows real publish created eight-seat rows');
select ok((select count(*)>1 and count(*)=count(distinct share_code)
 and bool_and(share_code~'^[0-9A-HJKMNP-TV-Z]{8}$') from rides
 where series_id=(pg_temp.result('pub8')->>'series_id')::uuid),
 'projection:share-code:weekday each published day has a unique Crockford code');
select ok((select s.published_ride_id=pg_temp.published_id('pub8') and r.share_code=pg_temp.result('pub8')->>'share_code'
 and r.ride_date=(select min(r2.ride_date) from rides r2 where r2.series_id=s.id)
 from ride_series s join rides r on r.id=s.published_ride_id
 where s.id=(pg_temp.result('pub8')->>'series_id')::uuid),
 'projection:share-code:first publish returns the first day code');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into observed values('get',pg_temp.getr(pg_temp.id(3001))),('list',pg_temp.list()),('resolve',pg_temp.resolve('A0B1CDEF'));
select is(pg_temp.keys(pg_temp.result('get')),pg_temp.projection_keys(),'projection:keys:get exact sorted key set');
select ok((select count(*)>0 and bool_and(pg_temp.keys(x)=pg_temp.projection_keys())
 from jsonb_array_elements(pg_temp.arr(pg_temp.result('list'))) x),'projection:keys:list every list row has exact key set');
select is(pg_temp.keys(pg_temp.result('resolve')->'ride'),pg_temp.projection_keys(),'projection:keys:resolve exact nested ride key set');
select ok(pg_temp.clean(pg_temp.result('get')) and pg_temp.clean(pg_temp.result('resolve')->'ride')
 and (select count(*)>0 and bool_and(pg_temp.clean(x)) from jsonb_array_elements(pg_temp.arr(pg_temp.result('list'))) x),
 'projection:keys:forbidden forbidden keys and private values absent from all real projections');
select is(pg_temp.result('get')->>'car_label','Catalogue Brand Catalogue Model · Large Type',
 'projection:car-label:catalogue catalogue brand model and type');
select is(pg_temp.result('get')->>'owner_display','Private S.','projection:owner:display first name and last initial only');
select is(pg_temp.has_ride(pg_temp.result('list'),pg_temp.published_id('pub8')),true,
 'projection:capacity:before real eight-seat ride listed before downgrade');
select is(pg_temp.has_ride(pg_temp.result('list'),pg_temp.id(3006)),true,
 'projection:car-change:before four-seat control listed before replacement');

-- Fresh reads with the catalogue car in place. All checks require a real projection.
insert into observed values('catalogue-get',pg_temp.getr(pg_temp.id(3001))),
 ('catalogue-list',pg_temp.list()),('catalogue-resolve',pg_temp.resolve('A0B1CDEF'));
select ok(pg_temp.clean(pg_temp.result('catalogue-get'))
 and pg_temp.result('catalogue-get')->>'ride_id'=pg_temp.id(3001)::text,'projection:redaction:catalogue-get private values absent from get');
select ok(pg_temp.has_ride(pg_temp.result('catalogue-list'),pg_temp.id(3001))
 and (select count(*)>0 and bool_and(pg_temp.clean(x)) from jsonb_array_elements(pg_temp.arr(pg_temp.result('catalogue-list'))) x),
 'projection:redaction:catalogue-list private values absent from real list');
select ok(pg_temp.clean(pg_temp.result('catalogue-resolve')->'ride')
 and pg_temp.result('catalogue-resolve')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:redaction:catalogue-resolve private values absent from resolved ride');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select count(*)>0 and bool_and(to_jsonb(e)::text not like all(array[
 '%+201099988877%','%ب9876%','%Surname%','%SECRET COMMUNITY%','%PRIVATE BRAND%','%PRIVATE MODEL%']))
 from pilot_events e where user_id=pg_temp.id(2)),
 'projection:redaction:catalogue-events fresh view events exist and contain no private values');
select review_item(pg_temp.id(1),'car_owner',1,'rejected','free-text fixture');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
select submit_car(pg_temp.id(212),pg_temp.id(111),null,null,'+201099988877',pg_temp.id(113),2024,'ب ٩٨٧٦');
reset role;
select set_config('request.jwt.claims','',true);
select review_item(pg_temp.id(1),'car_owner',2,'approved','free-text fixture');
select ok((select v.model_other='+201099988877' and v.brand_id=pg_temp.id(111) and i.status='approved' and i.reviewed_revision=i.revision
 from vehicles v join verification_items i using(user_id) where v.user_id=pg_temp.id(1)),
 'schema:projection:custom-model-fixture approved free-text values exist in database');
delete from pilot_events where user_id=pg_temp.id(2);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.getr(pg_temp.id(3001))->>'car_label','Catalogue Brand · Large Type',
 'projection:car-label:custom-model excludes free text from label');

-- Fresh reads with the custom-model car in place. All checks require a real projection.
insert into observed values('custom-model-get',pg_temp.getr(pg_temp.id(3001))),
 ('custom-model-list',pg_temp.list()),('custom-model-resolve',pg_temp.resolve('A0B1CDEF'));
select ok(pg_temp.clean(pg_temp.result('custom-model-get'))
 and pg_temp.result('custom-model-get')->>'ride_id'=pg_temp.id(3001)::text,'projection:redaction:custom-model-get private values absent from get');
select ok(pg_temp.has_ride(pg_temp.result('custom-model-list'),pg_temp.id(3001))
 and (select count(*)>0 and bool_and(pg_temp.clean(x)) from jsonb_array_elements(pg_temp.arr(pg_temp.result('custom-model-list'))) x),
 'projection:redaction:custom-model-list private values absent from real list');
select ok(pg_temp.clean(pg_temp.result('custom-model-resolve')->'ride')
 and pg_temp.result('custom-model-resolve')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:redaction:custom-model-resolve private values absent from resolved ride');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select count(*)>0 and bool_and(to_jsonb(e)::text not like all(array[
 '%+201099988877%','%ب9876%','%Surname%','%SECRET COMMUNITY%','%PRIVATE BRAND%','%PRIVATE MODEL%']))
 from pilot_events e where user_id=pg_temp.id(2)),
 'projection:redaction:custom-model-events fresh view events exist and contain no private values');
select review_item(pg_temp.id(1),'car_owner',2,'rejected','free-text fixture');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
select submit_car(pg_temp.id(213),null,'PRIVATE BRAND +201099988877',null,'PRIVATE MODEL ب9876',pg_temp.id(113),2024,'ب ٩٨٧٦');
reset role;
select set_config('request.jwt.claims','',true);
select review_item(pg_temp.id(1),'car_owner',3,'approved','free-text fixture');
select ok((select v.brand_other='PRIVATE BRAND +201099988877' and v.model_other='PRIVATE MODEL ب9876' and i.status='approved' and i.reviewed_revision=i.revision
 from vehicles v join verification_items i using(user_id) where v.user_id=pg_temp.id(1)),
 'schema:projection:custom-brand-fixture approved free-text values exist in database');
delete from pilot_events where user_id=pg_temp.id(2);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.getr(pg_temp.id(3001))->>'car_label','Large Type',
 'projection:car-label:custom-brand excludes free text from label');

-- Fresh reads with the custom-brand car in place. All checks require a real projection.
insert into observed values('custom-brand-get',pg_temp.getr(pg_temp.id(3001))),
 ('custom-brand-list',pg_temp.list()),('custom-brand-resolve',pg_temp.resolve('A0B1CDEF'));
select ok(pg_temp.clean(pg_temp.result('custom-brand-get'))
 and pg_temp.result('custom-brand-get')->>'ride_id'=pg_temp.id(3001)::text,'projection:redaction:custom-brand-get private values absent from get');
select ok(pg_temp.has_ride(pg_temp.result('custom-brand-list'),pg_temp.id(3001))
 and (select count(*)>0 and bool_and(pg_temp.clean(x)) from jsonb_array_elements(pg_temp.arr(pg_temp.result('custom-brand-list'))) x),
 'projection:redaction:custom-brand-list private values absent from real list');
select ok(pg_temp.clean(pg_temp.result('custom-brand-resolve')->'ride')
 and pg_temp.result('custom-brand-resolve')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:redaction:custom-brand-resolve private values absent from resolved ride');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select count(*)>0 and bool_and(to_jsonb(e)::text not like all(array[
 '%+201099988877%','%ب9876%','%Surname%','%SECRET COMMUNITY%','%PRIVATE BRAND%','%PRIVATE MODEL%']))
 from pilot_events e where user_id=pg_temp.id(2)),
 'projection:redaction:custom-brand-events fresh view events exist and contain no private values');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.getr(null,'list')->>'error','ride_not_found','projection:get:null-id ride_not_found');
select is(pg_temp.getr(pg_temp.id(9999),'list')->>'error','ride_not_found','projection:get:unknown-id ride_not_found');
select is(pg_temp.getr(pg_temp.id(3001),'bad')->>'error','invalid_source','projection:get:invalid-source invalid_source');
select is(pg_temp.getr(pg_temp.id(3001),null)->>'error','invalid_source','projection:get:null-source invalid_source');
insert into observed values('resolve-available',pg_temp.resolve('A0B1CDEF'));
select ok(pg_temp.result('resolve-available')->>'state'='available'
 and pg_temp.result('resolve-available')->'ride'->>'state'='available'
 and pg_temp.result('resolve-available')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:available resolves to the expected ride and current state');
insert into observed values('resolve-full',pg_temp.resolve('F2BCDEFG'));
select ok(pg_temp.result('resolve-full')->>'state'='full'
 and pg_temp.result('resolve-full')->'ride'->>'state'='full'
 and pg_temp.result('resolve-full')->'ride'->>'ride_id'=pg_temp.id(3002)::text,
 'projection:resolve:full resolves to the expected ride and current state');
insert into observed values('resolve-departed',pg_temp.resolve('D2BCDEFG'));
select ok(pg_temp.result('resolve-departed')->>'state'='departed'
 and pg_temp.result('resolve-departed')->'ride'->>'state'='departed'
 and pg_temp.result('resolve-departed')->'ride'->>'ride_id'=pg_temp.id(3003)::text,
 'projection:resolve:departed resolves to the expected ride and current state');
insert into observed values('resolve-cancelled',pg_temp.resolve('C2BCDEFG'));
select ok(pg_temp.result('resolve-cancelled')->>'state'='cancelled'
 and pg_temp.result('resolve-cancelled')->'ride'->>'state'='cancelled'
 and pg_temp.result('resolve-cancelled')->'ride'->>'ride_id'=pg_temp.id(3004)::text,
 'projection:resolve:cancelled resolves to the expected ride and current state');
insert into observed values('resolve-cancelled-series',pg_temp.resolve('S2BCDEFG'));
select ok(pg_temp.result('resolve-cancelled-series')->>'state'='cancelled'
 and pg_temp.result('resolve-cancelled-series')->'ride'->>'state'='cancelled'
 and pg_temp.result('resolve-cancelled-series')->'ride'->>'ride_id'=pg_temp.id(3005)::text,
 'projection:resolve:cancelled-series resolves to the expected ride and current state');
insert into observed values('resolve-lowercase',pg_temp.resolve('a0b1cdef'));
select ok(pg_temp.result('resolve-lowercase')->>'state'='available'
 and pg_temp.result('resolve-lowercase')->'ride'->>'state'='available'
 and pg_temp.result('resolve-lowercase')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:lowercase resolves to the expected ride and current state');
insert into observed values('resolve-ambiguous-O-I',pg_temp.resolve('aObIcdef'));
select ok(pg_temp.result('resolve-ambiguous-O-I')->>'state'='available'
 and pg_temp.result('resolve-ambiguous-O-I')->'ride'->>'state'='available'
 and pg_temp.result('resolve-ambiguous-O-I')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:ambiguous-O-I resolves to the expected ride and current state');
insert into observed values('resolve-ambiguous-o-l',pg_temp.resolve('aoblcdef'));
select ok(pg_temp.result('resolve-ambiguous-o-l')->>'state'='available'
 and pg_temp.result('resolve-ambiguous-o-l')->'ride'->>'state'='available'
 and pg_temp.result('resolve-ambiguous-o-l')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:ambiguous-o-l resolves to the expected ride and current state');
insert into observed values('resolve-ambiguous-L',pg_temp.resolve('AOBLCDEF'));
select ok(pg_temp.result('resolve-ambiguous-L')->>'state'='available'
 and pg_temp.result('resolve-ambiguous-L')->'ride'->>'state'='available'
 and pg_temp.result('resolve-ambiguous-L')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:ambiguous-L resolves to the expected ride and current state');
insert into observed values('resolve-trim',pg_temp.resolve('  A0B1CDEF  '));
select ok(pg_temp.result('resolve-trim')->>'state'='available'
 and pg_temp.result('resolve-trim')->'ride'->>'state'='available'
 and pg_temp.result('resolve-trim')->'ride'->>'ride_id'=pg_temp.id(3001)::text,
 'projection:resolve:trim resolves to the expected ride and current state');
select is(pg_temp.resolve(null),'{"state":"not_found"}'::jsonb,
 'projection:resolve:null exact not-found response');
select is(pg_temp.resolve('ZZZZZZZZ'),'{"state":"not_found"}'::jsonb,
 'projection:resolve:unknown exact not-found response');
select is(pg_temp.resolve('bad!'),'{"state":"not_found"}'::jsonb,
 'projection:resolve:malformed exact not-found response');
select is(pg_temp.resolve('A0B1CDE'),'{"state":"not_found"}'::jsonb,
 'projection:resolve:short exact not-found response');
select is(pg_temp.resolve('A0B1CDEFX'),'{"state":"not_found"}'::jsonb,
 'projection:resolve:long exact not-found response');
reset role;
select set_config('request.jwt.claims','',true);
select review_item(pg_temp.id(1),'car_owner',3,'rejected','replacement');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
select submit_car(pg_temp.id(214),pg_temp.id(114),null,pg_temp.id(115),null,pg_temp.id(116),2024,'ج ١٢٣');
reset role;
select set_config('request.jwt.claims','',true);
delete from rides where series_id=(pg_temp.result('pub8')->>'series_id')::uuid
 and id<>pg_temp.published_id('pub8');
insert into observed values('before-extension',jsonb_build_object('count',(select count(*) from rides
 where series_id=(pg_temp.result('pub8')->>'series_id')::uuid)));
select ok((select count(*)=1 from rides where series_id=(pg_temp.result('pub8')->>'series_id')::uuid)
 and (select count(*)>1 from generate_series(0,13) i
 where pg_temp.today()+i>=pg_temp.weekday() and extract(dow from pg_temp.today()+i) in (0,1,2,3,4)),
 'projection:capacity:missing-days real weekday series has fillable missing dates');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),false,
 'projection:car-change:pending-list pending car removes real published ride');
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.id(3006)),false,
 'projection:car-change:pending-four four-seat control also removed while pending');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3001)),'withdrawn'),
 'projection:pending:available-get car label null phone false and all replacement names absent');
insert into observed values('pending-available',pg_temp.resolve('A0B1CDEF'));
select ok(pg_temp.result('pending-available')->>'state'='withdrawn'
 and pg_temp.hidden(pg_temp.result('pending-available')->'ride','withdrawn'),
 'projection:pending:available-resolve cancellation precedence and independent redaction');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3002)),'withdrawn'),
 'projection:pending:full-get car label null phone false and all replacement names absent');
insert into observed values('pending-full',pg_temp.resolve('F2BCDEFG'));
select ok(pg_temp.result('pending-full')->>'state'='withdrawn'
 and pg_temp.hidden(pg_temp.result('pending-full')->'ride','withdrawn'),
 'projection:pending:full-resolve cancellation precedence and independent redaction');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3003)),'withdrawn'),
 'projection:pending:departed-get car label null phone false and all replacement names absent');
insert into observed values('pending-departed',pg_temp.resolve('D2BCDEFG'));
select ok(pg_temp.result('pending-departed')->>'state'='withdrawn'
 and pg_temp.hidden(pg_temp.result('pending-departed')->'ride','withdrawn'),
 'projection:pending:departed-resolve cancellation precedence and independent redaction');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3004)),'cancelled'),
 'projection:pending:cancelled-get car label null phone false and all replacement names absent');
insert into observed values('pending-cancelled',pg_temp.resolve('C2BCDEFG'));
select ok(pg_temp.result('pending-cancelled')->>'state'='cancelled'
 and pg_temp.hidden(pg_temp.result('pending-cancelled')->'ride','cancelled'),
 'projection:pending:cancelled-resolve cancellation precedence and independent redaction');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3005)),'cancelled'),
 'projection:pending:cancelled-series-get car label null phone false and all replacement names absent');
insert into observed values('pending-cancelled-series',pg_temp.resolve('S2BCDEFG'));
select ok(pg_temp.result('pending-cancelled-series')->>'state'='cancelled'
 and pg_temp.hidden(pg_temp.result('pending-cancelled-series')->'ride','cancelled'),
 'projection:pending:cancelled-series-resolve cancellation precedence and independent redaction');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.published_id('pub8')),'withdrawn'),
 'projection:car-change:pending-published real eight-seat ride withdrawn and redacted');
select ok(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state'='withdrawn'
 and pg_temp.hidden(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->'ride','withdrawn'),
 'projection:car-change:pending-published-link real publish link redacts pending replacement');
reset role;
select set_config('request.jwt.claims','',true);
select review_item(pg_temp.id(1),'car_owner',4,'approved','smaller approved car');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),false,
 'projection:capacity:smaller-list eight-seat ride absent with approved four-seat car');
select is(pg_temp.getr(pg_temp.published_id('pub8'))->>'state','withdrawn',
 'projection:capacity:smaller-get eight-seat detail withdrawn');
select is(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state','withdrawn',
 'projection:capacity:smaller-resolve eight-seat link withdrawn');
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.id(3006)),true,
 'projection:car-change:approved-list four-seat control listed after approval');
select is((select x->>'car_label' from jsonb_array_elements(pg_temp.arr(pg_temp.list())) x
 where (x->>'ride_id')::uuid=pg_temp.id(3006)),'Replacement Brand Replacement Model · Small Type',
 'projection:car-change:approved-list-label list uses approved replacement catalogue names');
select ok(pg_temp.getr(pg_temp.id(3006))->>'state'='available'
 and pg_temp.getr(pg_temp.id(3006))->>'car_label'='Replacement Brand Replacement Model · Small Type',
 'projection:car-change:approved-get approved replacement label shown');
select ok(pg_temp.resolve('W2BCDEFG')->>'state'='available'
 and pg_temp.resolve('W2BCDEFG')->'ride'->>'car_label'='Replacement Brand Replacement Model · Small Type',
 'projection:car-change:approved-resolve link shows approved replacement');
reset role;
select set_config('request.jwt.claims','',true);
select pg_advisory_xact_lock(hashtext('taw29-extend-weekday-series'));
update public.ride_series set status='cancelled', cancelled_at=now()
where status='active' and repeat='weekdays' and owner_id <> pg_temp.id(1);
insert into observed values('extension-small',pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select is(pg_temp.result('extension-small'),'0'::jsonb,
 'projection:capacity:extension-skip owner extension adds zero rides for over-capacity series');
select ok((select count(*)>0 and count(*)=(pg_temp.result('before-extension')->>'count')::bigint
 from rides where series_id=(pg_temp.result('pub8')->>'series_id')::uuid),
 'projection:capacity:extension-unchanged existing weekday rows unchanged');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.publish(802,pg_temp.today()+1,'12:00',5)->>'error','invalid_seats',
 'projection:capacity:publish-five five seats rejected for four-seat car');
insert into observed values('pub4',pg_temp.publish(803,pg_temp.today()+1,'12:00',4));
select ok(pg_temp.result('pub4')->>'ride_id' is not null and pg_temp.result('pub4')->'replayed'='false'::jsonb,
 'projection:capacity:publish-four four seats accepted');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select seats_offered=4 and share_code=pg_temp.result('pub4')->>'share_code'
 from rides where id=pg_temp.published_id('pub4')),
 'projection:capacity:publish-four-row accepted publish persisted four seats');
update car_types set passenger_seats=8 where id=pg_temp.id(116);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),true,
 'projection:capacity:restored-list original eight-seat ride reappears');
select is(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state','available',
 'projection:capacity:restored-link original code becomes available');
reset role;
select set_config('request.jwt.claims','',true);
insert into observed values('extension-restored',pg_temp.call('select to_jsonb(public.extend_weekday_series())'));
select ok(case when jsonb_typeof(pg_temp.result('extension-restored'))='number'
 then (pg_temp.result('extension-restored')#>>'{}')::int>0 else false end,
 'projection:capacity:extension-control restored capacity fills missing weekdays');
select is((select array_agg(ride_date order by ride_date) from rides
 where series_id=(pg_temp.result('pub8')->>'series_id')::uuid),
 (select array_agg(pg_temp.today()+i order by i) from generate_series(0,13) i
 where pg_temp.today()+i>=pg_temp.weekday() and extract(dow from pg_temp.today()+i) in (0,1,2,3,4)),
 'projection:capacity:extension-dates restored series has every eligible date');
update car_types set passenger_seats=4 where id=pg_temp.id(116);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),false,
 'projection:capacity:lowered-list admin lowering capacity removes ride');
select is(pg_temp.getr(pg_temp.published_id('pub8'))->>'state','withdrawn',
 'projection:capacity:lowered-get admin lowering capacity withdraws detail');
select is(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state','withdrawn',
 'projection:capacity:lowered-link admin lowering capacity withdraws link');
reset role;
select set_config('request.jwt.claims','',true);
update car_types set passenger_seats=8 where id=pg_temp.id(116);
update accounts set phone_verified=false where user_id=pg_temp.id(1);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),false,
 'projection:phone:false-list unverified owner disappears');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.published_id('pub8')),'withdrawn'),
 'projection:phone:false-get phone revocation redacts current car and verification flag');
select ok(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state'='withdrawn'
 and pg_temp.hidden(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->'ride','withdrawn'),
 'projection:phone:false-resolve phone revocation withdraws and redacts link');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3004)),'cancelled')
 and pg_temp.hidden(pg_temp.resolve('C2BCDEFG')->'ride','cancelled'),
 'projection:phone:cancelled both readers redact cancelled ride while phone unverified');
select ok(pg_temp.hidden(pg_temp.getr(pg_temp.id(3005)),'cancelled')
 and pg_temp.hidden(pg_temp.resolve('S2BCDEFG')->'ride','cancelled'),
 'projection:phone:cancelled-series both readers redact cancelled ride while phone unverified');
reset role;
select set_config('request.jwt.claims','',true);
update accounts set phone_verified=true where user_id=pg_temp.id(1);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.list(),pg_temp.published_id('pub8')),true,
 'projection:phone:true-list reverification restores list presence');
select ok((select x->>'car_label'='Replacement Brand Replacement Model · Small Type'
 and x->'owner_phone_verified'='true'::jsonb from jsonb_array_elements(pg_temp.arr(pg_temp.list())) x
 where (x->>'ride_id')::uuid=pg_temp.published_id('pub8')),
 'projection:phone:true-list-label list restores car label and verified flag');
select ok(pg_temp.getr(pg_temp.published_id('pub8'))->>'state'='available'
 and pg_temp.getr(pg_temp.published_id('pub8'))->>'car_label'='Replacement Brand Replacement Model · Small Type'
 and pg_temp.getr(pg_temp.published_id('pub8'))->'owner_phone_verified'='true'::jsonb,
 'projection:phone:true-get reverification restores approved label and flag');
select is(pg_temp.resolve(pg_temp.result('pub8')->>'share_code')->>'state','available',
 'projection:phone:true-resolve same link reads current available state');
reset role;
select set_config('request.jwt.claims','',true);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(pg_temp.getr(pg_temp.id(3001))->>'error','profile_incomplete',
 'projection:auth:get-incomplete incomplete profile cannot read details');
select is(pg_temp.resolve('A0B1CDEF')->>'error','profile_incomplete',
 'projection:auth:resolve-incomplete incomplete profile cannot resolve code');
reset role;
select set_config('request.jwt.claims','',true);
select is(pg_temp.getr(pg_temp.id(3001))->>'error','not_authenticated',
 'projection:auth:get-no-caller owner without claims cannot read details');
select is(pg_temp.resolve('A0B1CDEF')->>'error','not_authenticated',
 'projection:auth:resolve-no-caller owner without claims cannot resolve code');

-- Test-only collision seam. nextval survives each failed INSERT subtransaction.
-- The trigger and its owner-created temp objects disappear with the final rollback.
-- extensions.gen_random_bytes is never replaced or called by the client.
create temp sequence collision_attempts;
create temp table collision_control(n int not null,occupied text not null);
insert into collision_control values(1,'A0B1CDEF');
create function pg_temp.force_share_collision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare attempt bigint; lim int; code text;
begin
 if new.owner_id='a29d2000-0000-4000-8000-000000000001'::uuid then
  attempt:=nextval('pg_temp.collision_attempts'::regclass);
  select n,occupied into lim,code from pg_temp.collision_control;
  if attempt<=lim then new.share_code:=code; end if;
 end if;
 return new;
end $$;
create trigger taw29_test_share_collision before insert on public.rides
 for each row execute function pg_temp.force_share_collision();

update collision_control set n=1;
select setval('pg_temp.collision_attempts',1,false);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into observed values('collision-1',pg_temp.publish(901,pg_temp.today()+10,'18:00',4,'once','b_to_a'));
select ok(pg_temp.result('collision-1')->>'ride_id' is not null
 and pg_temp.result('collision-1')->'replayed'='false'::jsonb
 and pg_temp.result('collision-1')->>'share_code'~'^[0-9A-HJKMNP-TV-Z]{8}$'
 and pg_temp.result('collision-1')->>'share_code'<>'A0B1CDEF',
 'projection:collision:1-success publish retries and returns a different valid code');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select is_called and last_value=2 from collision_attempts),
 'projection:collision:1-attempts exactly 2 insert attempts observed despite rollbacks');
select ok((select share_code=pg_temp.result('collision-1')->>'share_code'
 from rides where id=pg_temp.published_id('collision-1'))
 and (select count(*)=1 from pilot_events where event_type='ride_posted'
 and series_id=(pg_temp.result('collision-1')->>'series_id')::uuid),
 'projection:collision:1-persisted returned code belongs to committed test ride with one event');

update collision_control set n=4;
select setval('pg_temp.collision_attempts',1,false);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into observed values('collision-4',pg_temp.publish(902,pg_temp.today()+11,'18:00',4,'once','b_to_a'));
select ok(pg_temp.result('collision-4')->>'ride_id' is not null
 and pg_temp.result('collision-4')->'replayed'='false'::jsonb
 and pg_temp.result('collision-4')->>'share_code'~'^[0-9A-HJKMNP-TV-Z]{8}$'
 and pg_temp.result('collision-4')->>'share_code'<>'A0B1CDEF',
 'projection:collision:4-success publish retries and returns a different valid code');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select is_called and last_value=5 from collision_attempts),
 'projection:collision:4-attempts exactly 5 insert attempts observed despite rollbacks');
select ok((select share_code=pg_temp.result('collision-4')->>'share_code'
 from rides where id=pg_temp.published_id('collision-4'))
 and (select count(*)=1 from pilot_events where event_type='ride_posted'
 and series_id=(pg_temp.result('collision-4')->>'series_id')::uuid),
 'projection:collision:4-persisted returned code belongs to committed test ride with one event');

update collision_control set n=5;
select setval('pg_temp.collision_attempts',1,false);
insert into observed values('collision-before',jsonb_build_object(
 'series',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) from ride_series s where owner_id=pg_temp.id(1)),
 'rides',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from rides r where owner_id=pg_temp.id(1)),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from pilot_events e where user_id=pg_temp.id(1))));
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d2000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into observed values('collision-5',pg_temp.publish(903,pg_temp.today()+12,'18:00',4,'once','b_to_a'));
select is(pg_temp.result('collision-5')->>'error','share_code_unavailable',
 'projection:collision:5-error five collisions exhaust the retry budget');
reset role;
select set_config('request.jwt.claims','',true);
select ok((select is_called and last_value=5 from collision_attempts),
 'projection:collision:5-attempts exactly 5 insert attempts observed despite rollbacks');
select ok(pg_temp.result('collision-5')->>'error'='share_code_unavailable'
 and (select is_called and last_value=5 from collision_attempts)
 and jsonb_build_object(
 'series',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) from ride_series s where owner_id=pg_temp.id(1)),
 'rides',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from rides r where owner_id=pg_temp.id(1)),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from pilot_events e where user_id=pg_temp.id(1)))
 =pg_temp.result('collision-before'),'projection:collision:5-atomic no series ride or event left by failed publish');
select ok((select count(*)>=4 and count(*)=count(distinct r.share_code)
 and bool_and(r.share_code~'^[0-9A-HJKMNP-TV-Z]{8}$') from rides r join ride_series s on s.id=r.series_id
 where s.owner_id=pg_temp.id(1) and s.request_id in (pg_temp.id(801),pg_temp.id(803),pg_temp.id(901),pg_temp.id(902)))
 and (select count(distinct s.request_id)=4 from ride_series s where s.owner_id=pg_temp.id(1)
 and s.request_id in (pg_temp.id(801),pg_temp.id(803),pg_temp.id(901),pg_temp.id(902))),
 'projection:share-code:published-format-unique codes from four real publishes are valid and unique');
select ok((select count(*) filter(where event_type='ride_posted')>0
 and count(*) filter(where event_type='ride_viewed')>0
 and bool_and(to_jsonb(e)::text not like all(array['%+201099988877%','%ب9876%','%Surname%',
 '%SECRET COMMUNITY%','%PRIVATE BRAND%','%PRIVATE MODEL%']))
 from pilot_events e where user_id in (pg_temp.id(1),pg_temp.id(2))),
 'projection:redaction:all-events real publish and view events contain no private values');
select * from finish();
rollback;
