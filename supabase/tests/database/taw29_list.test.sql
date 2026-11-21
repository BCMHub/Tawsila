begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Series fixtures reference their first ride before that ride is inserted.
set constraints all deferred;
reset role;
select set_config('request.jwt.claims','',true);
select plan(50);

-- Helpers never substitute a passing result for a missing TAW-29 function.
create function pg_temp.id(n int) returns uuid language sql immutable as $$
 select ('a29d1000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.today() returns date language sql stable as $$
 select (now() at time zone 'Africa/Cairo')::date
$$;
create function pg_temp.arr(v jsonb) returns jsonb language sql immutable as $$
 select case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end
$$;
create function pg_temp.has_ride(v jsonb, i uuid) returns boolean language sql immutable as $$
 select case when jsonb_typeof(v) = 'array' then
 exists(select 1 from jsonb_array_elements(pg_temp.arr(v)) x where (x->>'ride_id')::uuid = i) end
$$;
create function pg_temp.ids(v jsonb) returns uuid[] language sql immutable as $$
 select case when jsonb_typeof(v) = 'array' then
 (select coalesce(array_agg((x->>'ride_id')::uuid order by n),array[]::uuid[])
  from jsonb_array_elements(pg_temp.arr(v)) with ordinality e(x,n)) end
$$;
create function pg_temp.call_list(r uuid,d text,day date,a timestamptz,i uuid,n int)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
 execute 'select coalesce(jsonb_agg(x),''[]''::jsonb) from public.list_rides($1,$2,$3,$4,$5,$6) x'
 into v using r,d,day,a,i,n;
 return v;
exception when others then return jsonb_build_object('error',sqlerrm);
end $$;
create function pg_temp.board(day date default pg_temp.today()+1) returns jsonb language sql as $$
 select pg_temp.call_list(pg_temp.id(131),'a_to_b',day,null,null,50)
$$;

-- Fixed TAW-29 list fixtures. Dates are always relative to Cairo today.
insert into auth.users(id) values
 ('a29d1000-0000-4000-8000-000000000001'),('a29d1000-0000-4000-8000-000000000002'),('a29d1000-0000-4000-8000-000000000003'),('a29d1000-0000-4000-8000-000000000004');
insert into communities(id,name) values ('a29d1000-0000-4000-8000-000000000101','List community');
update legal_documents set is_current=false where is_current;
insert into legal_documents(kind,version,is_current) values ('terms','a29d1',true),('privacy','a29d1',true);
insert into car_brands(id,name) values ('a29d1000-0000-4000-8000-000000000111','List Brand');
insert into car_models(id,brand_id,name) values ('a29d1000-0000-4000-8000-000000000112','a29d1000-0000-4000-8000-000000000111','List Model');
insert into car_types(id,code,name) values ('a29d1000-0000-4000-8000-000000000113','a29d1','List Type');
-- Keep the TAW-29 column separate; fixture errors must not be trapped.
update car_types set passenger_seats=8 where id=pg_temp.id(113);
insert into places(id,name) values ('a29d1000-0000-4000-8000-000000000121','List A'),('a29d1000-0000-4000-8000-000000000122','List B'),('a29d1000-0000-4000-8000-000000000123','List C');
insert into routes(id,place_a_id,place_b_id,duration_minutes) values
 ('a29d1000-0000-4000-8000-000000000131','a29d1000-0000-4000-8000-000000000121','a29d1000-0000-4000-8000-000000000122',30),
 ('a29d1000-0000-4000-8000-000000000132','a29d1000-0000-4000-8000-000000000121','a29d1000-0000-4000-8000-000000000123',40);


create temp table expected(id uuid primary key, departs_at timestamptz);
grant select on expected to authenticated;
do $fixtures$
declare i int; u uuid; s uuid; r uuid; t timestamptz; d date := pg_temp.today()+1;
begin
 foreach i in array array[1,2,4] loop
  u := pg_temp.id(i);
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  perform complete_profile('List','Member',pg_temp.id(101),'car_owner',true,'a29d1','a29d1');
  perform submit_car(pg_temp.id(1000+i),pg_temp.id(111),null,pg_temp.id(112),null,pg_temp.id(113),2024,'ب ١٢٣');
  execute 'reset role';
  perform set_config('request.jwt.claims','',true);
  perform review_item(u,'car_owner',1,'approved','fixture');
 end loop;
 update accounts set phone_e164='+20100000000'||right(user_id::text,1),phone_verified=true
 where user_id in (pg_temp.id(1),pg_temp.id(2),pg_temp.id(4));
 -- Twelve groups of three simultaneous departures. Both page cuts (13,26) split ties.
 for i in 1..36 loop
  s:=pg_temp.id(2000+i); r:=pg_temp.id(3000+i);
  u:=case when i=36 then pg_temp.id(2) else pg_temp.id(1) end;
  t:=(d+time '06:00'+((i-1)/3)*interval '3 min') at time zone 'Africa/Cairo';
  insert into ride_series(id,owner_id,request_id,route_id,direction,first_date,departure_time,
    flex_minutes,seats_offered,repeat,published_ride_id,published_ride_count)
  values(s,u,pg_temp.id(4000+i),pg_temp.id(131),'a_to_b',d,
    (t at time zone 'Africa/Cairo')::time,0,3,'once',r,1);
  insert into rides(id,series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,share_code)
  values(r,s,u,pg_temp.id(131),'a_to_b',(t at time zone 'Africa/Cairo')::date,t,3,'A'||lpad(i::text,7,'0'));
  insert into expected values(r,t);
 end loop;
 -- Past date, departed exactly now, full, ride/series cancellation, direction,
 -- other valid day, route, phone, capacity, and beyond-window are independent.
 for i in 1..11 loop
  s:=pg_temp.id(5000+i); r:=pg_temp.id(5200+i);
  u:=case when i=9 then pg_temp.id(4) else pg_temp.id(1) end;
  t:=case when i=1 then (pg_temp.today()-1+time '12:00') at time zone 'Africa/Cairo'
          when i=2 then now()
          else (case when i=7 then d+1 when i=11 then pg_temp.today()+14 else d end
                +time '12:00'+i*interval '1 min') at time zone 'Africa/Cairo' end;
  insert into ride_series(id,owner_id,request_id,route_id,direction,first_date,departure_time,
    flex_minutes,seats_offered,repeat,status,cancelled_at,published_ride_id,published_ride_count)
  values(s,u,pg_temp.id(5100+i),pg_temp.id(case when i=8 then 132 else 131 end),
    case when i=6 then 'b_to_a' else 'a_to_b' end,(t at time zone 'Africa/Cairo')::date,
    date_trunc('minute',t at time zone 'Africa/Cairo')::time,0,case when i=10 then 8 else 2 end,
    'once',case when i=5 then 'cancelled' else 'active' end,case when i=5 then now() end,r,1);
  insert into rides(id,series_id,owner_id,route_id,direction,ride_date,departs_at,seats_offered,
    seats_taken,status,cancelled_at,share_code)
  values(r,s,u,pg_temp.id(case when i=8 then 132 else 131 end),case when i=6 then 'b_to_a' else 'a_to_b' end,
    (t at time zone 'Africa/Cairo')::date,t,case when i=10 then 8 else 2 end,
    case when i=3 then 2 else 0 end,case when i=4 then 'cancelled' else 'scheduled' end,
    case when i=4 then now() end,'X'||lpad(i::text,7,'0'));
 end loop;
 update accounts set phone_verified=false where user_id=pg_temp.id(4);
 update car_types set passenger_seats=4 where id=pg_temp.id(113);
end $fixtures$;

select ok((select count(*)=47 and bool_and(ride_date=(departs_at at time zone 'Africa/Cairo')::date)
 from rides where owner_id in (pg_temp.id(1),pg_temp.id(2),pg_temp.id(4))),
 'schema:list:fixture-dates all fixture dates derive from Cairo departure');
select is((select count(*) from (select departs_at from expected group by departs_at having count(*)=3) t),
 12::bigint,'schema:list:tie-groups twelve groups have three departures each');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';

create temp table all_rows as select pg_temp.board() v;
select is(jsonb_array_length(pg_temp.arr(v)),36,'list:exclude:all only eligible matching rides') from all_rows;
select is(pg_temp.ids(v),(select array_agg(id order by departs_at,id) from expected),
 'list:order:time-id exact time and UUID ordering') from all_rows;
select is((select x->'is_own' from all_rows,jsonb_array_elements(pg_temp.arr(v)) x
 where (x->>'ride_id')::uuid=pg_temp.id(3001)),'true'::jsonb,'list:owner:self own ride flagged');
select is((select x->'is_own' from all_rows,jsonb_array_elements(pg_temp.arr(v)) x
 where (x->>'ride_id')::uuid=pg_temp.id(3036)),'false'::jsonb,'list:owner:other other owner flagged');
select ok((select count(*)=36 and bool_and(x->'owner_phone_verified'='true'::jsonb)
 from all_rows,jsonb_array_elements(pg_temp.arr(v)) x),'list:owner:verified every listed owner verified');

-- Materialised pages ensure each RPC runs once; scalar subqueries keep error rows alive.
create temp table pages(p int primary key,v jsonb);
insert into pages values(1,pg_temp.call_list(pg_temp.id(131),'a_to_b',pg_temp.today()+1,null,null,13));
insert into pages select 2,pg_temp.call_list(pg_temp.id(131),'a_to_b',pg_temp.today()+1,
 (v->-1->>'departs_at')::timestamptz,(v->-1->>'ride_id')::uuid,13) from pages where p=1;
insert into pages select 3,pg_temp.call_list(pg_temp.id(131),'a_to_b',pg_temp.today()+1,
 (v->-1->>'departs_at')::timestamptz,(v->-1->>'ride_id')::uuid,13) from pages where p=2;
select is((select array_agg(jsonb_array_length(pg_temp.arr(v)) order by p) from pages),array[13,13,10],
 'list:paging:sizes three pages split both tie groups');
select is((select array_agg((x->>'ride_id')::uuid order by p,n)
 from pages,jsonb_array_elements(pg_temp.arr(v)) with ordinality e(x,n)),
 (select array_agg(id order by departs_at,id) from expected),'list:paging:ordered exact union has no gaps or reordering');
select is((select count(distinct (x->>'ride_id')::uuid) from pages,jsonb_array_elements(pg_temp.arr(v)) x),
 36::bigint,'list:paging:disjoint all 36 UUIDs occur once');
select ok((select a.v->-1->>'departs_at'=b.v->0->>'departs_at'
 and (a.v->-1->>'ride_id')::uuid<(b.v->0->>'ride_id')::uuid from pages a,pages b where a.p=1 and b.p=2)
 and (select a.v->-1->>'departs_at'=b.v->0->>'departs_at'
 and (a.v->-1->>'ride_id')::uuid<(b.v->0->>'ride_id')::uuid from pages a,pages b where a.p=2 and b.p=3),
 'list:paging:tie-boundaries UUID breaks equal-time ties at both cuts');
select is(jsonb_array_length(pg_temp.arr(pg_temp.call_list(pg_temp.id(131),'a_to_b',null,null,null,null))),
 30,'list:limit:null null limit defaults to thirty');
select is(jsonb_array_length(pg_temp.arr(pg_temp.board(null))),37,
 'list:day:all null day includes both valid dates');

select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5201)),false,
 'list:exclude:past excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update rides set departs_at=t, ride_date=(t at time zone 'Africa/Cairo')::date
from (select (pg_temp.today()+1+time '12:01') at time zone 'Africa/Cairo' as t) moved
where id=pg_temp.id(5201);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5201)),true,
 'list:control:past same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5202)),false,
 'list:exclude:departed excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update rides set departs_at=t, ride_date=(t at time zone 'Africa/Cairo')::date
from (select (pg_temp.today()+1+time '12:02') at time zone 'Africa/Cairo' as t) moved
where id=pg_temp.id(5202);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5202)),true,
 'list:control:departed same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5203)),false,
 'list:exclude:full excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update rides set seats_taken=0 where id=pg_temp.id(5203);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5203)),true,
 'list:control:full same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5204)),false,
 'list:exclude:cancelled excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update rides set status='scheduled',cancelled_at=null where id=pg_temp.id(5204);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5204)),true,
 'list:control:cancelled same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5205)),false,
 'list:exclude:cancelled-series excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update ride_series set status='active',cancelled_at=null where id=pg_temp.id(5005);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5205)),true,
 'list:control:cancelled-series same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5206)),false,
 'list:exclude:direction excluded by this predicate');
select is(pg_temp.has_ride(pg_temp.call_list(pg_temp.id(131),'b_to_a',pg_temp.today()+1,null,null,50),pg_temp.id(5206)),true,
 'list:control:direction same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5207)),false,
 'list:exclude:day excluded by this predicate');
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+2),pg_temp.id(5207)),true,
 'list:control:day same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5208)),false,
 'list:exclude:route excluded by this predicate');
select is(pg_temp.has_ride(pg_temp.call_list(pg_temp.id(132),'a_to_b',pg_temp.today()+1,null,null,50),pg_temp.id(5208)),true,
 'list:control:route same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5209)),false,
 'list:exclude:unverified excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update accounts set phone_verified=true where user_id=pg_temp.id(4);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5209)),true,
 'list:control:unverified same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5210)),false,
 'list:exclude:withdrawn excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update car_types set passenger_seats=8 where id=pg_temp.id(113);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+1),pg_temp.id(5210)),true,
 'list:control:withdrawn same ride appears when exclusion removed');

select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5211)),false,
 'list:exclude:beyond-window excluded by this predicate');
reset role;
select set_config('request.jwt.claims','',true);
update rides set departs_at=t, ride_date=(t at time zone 'Africa/Cairo')::date
from (select (pg_temp.today()+13+time '12:11') at time zone 'Africa/Cairo' as t) moved
where id=pg_temp.id(5211);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(null),pg_temp.id(5211)),true,
 'list:control:beyond-window same ride appears when exclusion removed');

select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',pg_temp.today()-1,null,null,30)->>'error','invalid_day',
 'list:error:day-before invalid_day');
select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',pg_temp.today()+14,null,null,30)->>'error','invalid_day',
 'list:error:day-after invalid_day');
select is(pg_temp.call_list(null,'a_to_b',null,null,null,30)->>'error','missing_argument',
 'list:error:missing-route missing_argument');
select is(pg_temp.call_list(pg_temp.id(131),null,null,null,null,30)->>'error','missing_argument',
 'list:error:missing-direction missing_argument');
select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',null,now(),null,30)->>'error','invalid_cursor',
 'list:error:cursor-time invalid_cursor');
select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',null,null,pg_temp.id(9999),30)->>'error','invalid_cursor',
 'list:error:cursor-id invalid_cursor');
select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',null,null,null,0)->>'error','invalid_limit',
 'list:error:limit-zero invalid_limit');
select is(pg_temp.call_list(pg_temp.id(131),'a_to_b',null,null,null,51)->>'error','invalid_limit',
 'list:error:limit-51 invalid_limit');
select is(pg_temp.call_list(pg_temp.id(9999),'a_to_b',null,null,null,30)->>'error','invalid_route',
 'list:error:unknown-route invalid_route');
select is(pg_temp.call_list(pg_temp.id(131),'bad',null,null,null,30)->>'error','invalid_direction',
 'list:error:direction invalid_direction');
select is(pg_temp.has_ride(pg_temp.board(pg_temp.today()+13),pg_temp.id(5211)),true,
 'list:day:13 last window day accepted with real ride');
reset role;
select set_config('request.jwt.claims','',true);
update routes set active=false where id=pg_temp.id(131);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.board()->>'error','invalid_route','list:error:inactive-route deactivated route rejected');
reset role;
select set_config('request.jwt.claims','',true);
update routes set active=true where id=pg_temp.id(131);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(pg_temp.has_ride(pg_temp.board(),pg_temp.id(3001)),true,'list:control:active-route reactivated route lists again');
reset role;
select set_config('request.jwt.claims','',true);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"a29d1000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(pg_temp.board()->>'error','profile_incomplete','list:error:profile-incomplete incomplete caller');
reset role;
select set_config('request.jwt.claims','',true);
select is(pg_temp.board()->>'error','not_authenticated','list:error:not-authenticated missing caller');
select * from finish();
rollback;
