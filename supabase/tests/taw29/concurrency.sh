#!/usr/bin/env bash
# Local-stack concurrency coverage for TAW-29 spec section 8.1.
set -euo pipefail

container=supabase_db_tawsila
db=(docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/taw29-concurrency.XXXXXX")
pids=()
passed=0
completed=0
failures=()

route_id=a29f1000-0000-4000-8000-000000000001
place_a_id=a29f1000-0000-4000-8000-000000000002
place_b_id=a29f1000-0000-4000-8000-000000000003
community_id=a29f0c00-0000-4000-8000-000000000001
owners=(
  a29f1001-0000-4000-8000-000000000001
  a29f1002-0000-4000-8000-000000000001
  a29f1003-0000-4000-8000-000000000001
  a29f1004-0000-4000-8000-000000000001
  a29f1005-0000-4000-8000-000000000001
  a29f1006-0000-4000-8000-000000000001
  a29f1009-0000-4000-8000-000000000001
)

psql_local() { "${db[@]}" "$@"; }

cleanup() {
  local pid active
  active=" $(jobs -pr | tr '\n' ' ') "
  for pid in ${pids[@]+"${pids[@]}"}; do
    if [[ "$active" == *" $pid "* ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  if command -v docker >/dev/null 2>&1; then
    psql_local >/dev/null 2>&1 <<SQL || true
delete from auth.users where id in (
  'a29f1001-0000-4000-8000-000000000001',
  'a29f1002-0000-4000-8000-000000000001',
  'a29f1003-0000-4000-8000-000000000001',
  'a29f1004-0000-4000-8000-000000000001',
  'a29f1005-0000-4000-8000-000000000001',
  'a29f1006-0000-4000-8000-000000000001',
  'a29f1009-0000-4000-8000-000000000001'
);
delete from public.routes where id = '$route_id';
delete from public.places where id in ('$place_a_id', '$place_b_id');
delete from public.legal_documents where version = 'taw29-concurrency-v1';
delete from public.communities where id = '$community_id';
SQL
  fi
  rm -rf "$tmp_dir"
}
on_exit() { local rc=$?; cleanup; if [[ $rc -eq 0 && $completed -ne 1 ]]; then rc=1; fi; exit "$rc"; }
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

die() { echo "FAIL $*" >&2; exit 1; }
scenario_fail() { echo "  $*" >&2; return 1; }

run_bg() {
  local name=$1 sql=$2
  local out="$tmp_dir/$name.out"
  (printf '%s\n' "$sql" | psql_local >"$out" 2>&1) &
  RUN_BG_PID=$!
  pids+=("$RUN_BG_PID")
}

wait_for_marker() {
  local file=$1 marker=$2 pid=$3 i
  for i in $(seq 1 200); do
    grep -Fqx "$marker" "$file" 2>/dev/null && return 0
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
      echo "session exited before marker '$marker':" >&2
      sed 's/^/    /' "$file" >&2
      return 1
    fi
    sleep 0.05
  done
  echo "timed out waiting for marker '$marker':" >&2
  sed 's/^/    /' "$file" >&2
  return 1
}

wait_ok() {
  local pid=$1 file=$2
  if ! wait "$pid"; then
    echo 'session failed:' >&2
    sed 's/^/    /' "$file" >&2
    return 1
  fi
}

wait_for_lock() {
  local application_name=$1 holder_pid=$2 waiter_pid=$3 waiter_file=$4 holder_application_name=${5:-} i blocked
  for i in $(seq 1 100); do
    blocked=$(psql_local -c "select exists (
      select 1 from pg_catalog.pg_stat_activity waiter
      where waiter.application_name = '$application_name' and waiter.wait_event_type = 'Lock'
        and ('$holder_application_name' = '' or exists (
          select 1 from pg_catalog.pg_stat_activity holder
          where holder.application_name = '$holder_application_name' and holder.xact_start is not null
            and holder.pid = any(pg_catalog.pg_blocking_pids(waiter.pid))
        )));") || return 1
    [[ "$blocked" == t ]] && return 0
    if ! kill -0 "$waiter_pid" 2>/dev/null; then
      wait "$waiter_pid" 2>/dev/null || true
      scenario_fail "$application_name exited before it was observed waiting on a lock" || true
      sed 's/^/    /' "$waiter_file" >&2
      return 1
    fi
    if ! kill -0 "$holder_pid" 2>/dev/null; then
      scenario_fail "$application_name was not observed waiting before the lock holder committed" || true
      return 1
    fi
    sleep 0.02
  done
  scenario_fail "$application_name was never observed waiting on a lock" || true
  return 1
}

jwt() {
  printf "do \$\$ begin perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub','%s','role','authenticated')::text, false); end \$\$;" "$1"
}

make_gap() {
  psql_local -c "delete from public.rides where id = (select id from public.rides where owner_id = '$1' and status = 'scheduled' order by ride_date desc limit 1);"
}
gap_count() { psql_local -c "select count(*) from public.rides where owner_id = '$1';"; }
scheduled_count() { psql_local -c "select count(*) from public.rides where owner_id = '$1' and status = 'scheduled' and departs_at > now();"; }

reset_gap() {
  local owner=$1
  psql_local >/dev/null <<SQL
update public.accounts set phone_verified = true where user_id = '$owner';
select public.review_item('$owner', 'car_owner', 1, 'approved', null);
update public.ride_series set status = 'active', cancelled_at = null where owner_id = '$owner';
update public.rides set status = 'scheduled', cancelled_at = null where owner_id = '$owner';
select public.extend_weekday_series();
SQL
  make_gap "$owner"
}

run_scenario() {
  local number=$1 title=$2 function=$3
  if "$function"; then
    passed=$((passed + 1))
    echo "ok $number - $title"
  else
    failures+=("$number: $title")
    echo "not ok $number - $title" >&2
  fi
}

command -v docker >/dev/null 2>&1 || die 'docker is required'
objects_ok=$(psql_local -c "select
  to_regclass('public.places') is not null
  and to_regclass('public.routes') is not null
  and to_regclass('public.ride_series') is not null
  and to_regclass('public.rides') is not null
  and to_regclass('public.pilot_events') is not null
  and to_regprocedure('public.extend_weekday_series()') is not null
  and to_regprocedure('public.publish_ride(uuid,uuid,text,date,time without time zone,integer,integer,text,text,text)') is not null;") || die 'cannot query the local Tawsila database'
[[ "$objects_ok" == t ]] || die 'TAW-29 objects missing; apply the TAW-29 schema and function migrations first'

# Fixed, script-owned fixtures. Cleanup first makes recovery from an interrupted run idempotent.
cleanup
trap on_exit EXIT
mkdir -p "$tmp_dir"

psql_local >/dev/null <<SQL
insert into public.communities (id, name, sort_order, active) values ('$community_id', 'TAW-29 concurrency community', 2901, true) on conflict (id) do nothing;
insert into public.legal_documents (kind, version, is_current) select v.k, 'taw29-concurrency-v1', true from (values ('terms'), ('privacy')) v(k) where not exists (select 1 from public.legal_documents d where d.kind = v.k and d.is_current) on conflict do nothing;
insert into public.places (id, name, area_label, active, sort_order) values
  ('$place_a_id', 'TAW-29 concurrency A', null, true, 2901),
  ('$place_b_id', 'TAW-29 concurrency B', null, true, 2902);
insert into public.routes (id, place_a_id, place_b_id, duration_minutes, active, sort_order)
values ('$route_id', '$place_a_id', '$place_b_id', 30, true, 2901);
SQL

for i in "${!owners[@]}"; do
  owner=${owners[$i]}
  phone=$(printf '+2012900%04d' "$i")
  submission=$(printf 'a29f1%03d-0000-4000-8000-000000000101' "$((i + 1))")
  psql_local >/dev/null <<SQL
insert into auth.users (id) values ('$owner');
$(jwt "$owner")
select public.complete_profile(
  'TAW', 'Concurrency',
  '$community_id',
  'car_owner', true,
  (select version from public.legal_documents where kind = 'terms' and is_current),
  (select version from public.legal_documents where kind = 'privacy' and is_current));
select public.submit_car(
  '$submission', null, 'TAW fixture', null, 'Concurrency fixture',
  (select id from public.car_types where active and passenger_seats >= 2 order by id limit 1),
  2020, '١$(printf '%03d' "$i")');
select public.review_item('$owner', 'car_owner', 1, 'approved', null);
update public.accounts set phone_e164 = '$phone', phone_verified = true where user_id = '$owner';
SQL
done

ride_date=$(psql_local -c "select min(d)::date from generate_series((now() at time zone 'Africa/Cairo')::date, (now() at time zone 'Africa/Cairo')::date + public.ride_window_days() - 1, interval '1 day') d where extract(dow from d) in (0,1,2,3,4) and ((d::date + time '12:00') at time zone 'Africa/Cairo') > now();")
[[ -n "$ride_date" ]] || die 'no future weekday exists in the configured ride window'

for i in $(seq 0 5); do
  owner=${owners[$i]}
  request=$(printf 'a29f1%03d-0000-4000-8000-000000000201' "$((i + 1))")
  psql_local >/dev/null <<SQL
$(jwt "$owner")
select public.publish_ride('$request', '$route_id', 'a_to_b', '$ride_date', time '12:00', 0, 2, null, null, 'weekdays');
SQL
done

scenario_phone_revocation() {
  local owner=${owners[0]} before pid_a pid_b after
  make_gap "$owner"; before=$(gap_count "$owner")
  run_bg s1_revoke_first "set application_name='taw29_phone_revoke'; begin; update public.accounts set phone_verified=false where user_id='$owner'; select 'READY_REVOKE'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s1_revoke_first.out" READY_REVOKE "$pid_a" || return 1
  run_bg s1_extend_after "set application_name='taw29_phone_extension'; select public.extend_weekday_series();"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_phone_extension "$pid_a" "$pid_b" "$tmp_dir/s1_extend_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s1_revoke_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s1_extend_after.out" || return 1
  after=$(gap_count "$owner"); [[ "$after" == "$before" ]] || scenario_fail "revoke-first created a day ($before -> $after)" || return 1

  reset_gap "$owner"; before=$(gap_count "$owner")
  run_bg s1_extend_first "set application_name='taw29_phone_extension'; begin; select public.extend_weekday_series(); select 'READY_EXTENSION'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s1_extend_first.out" READY_EXTENSION "$pid_a" || return 1
  run_bg s1_revoke_after "set application_name='taw29_phone_revoke'; update public.accounts set phone_verified=false where user_id='$owner';"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_phone_revoke "$pid_a" "$pid_b" "$tmp_dir/s1_revoke_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s1_extend_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s1_revoke_after.out" || return 1
  after=$(gap_count "$owner"); [[ "$after" == "$((before + 1))" ]] || scenario_fail "extension-first did not retain its new day ($before -> $after)" || return 1
  [[ $(psql_local -c "select phone_verified from public.accounts where user_id='$owner';") == f ]] || scenario_fail 'revocation did not commit' || return 1
}

scenario_car_rejection() {
  local owner=${owners[1]} before pid_a pid_b after
  make_gap "$owner"; before=$(gap_count "$owner")
  run_bg s2_reject_first "set application_name='taw29_car_reject'; begin; select public.review_item('$owner','car_owner',1,'rejected',null); select 'READY_REJECT'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s2_reject_first.out" READY_REJECT "$pid_a" || return 1
  run_bg s2_extend_after "set application_name='taw29_car_extension'; select public.extend_weekday_series();"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_car_extension "$pid_a" "$pid_b" "$tmp_dir/s2_extend_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s2_reject_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s2_extend_after.out" || return 1
  after=$(gap_count "$owner"); [[ "$after" == "$before" ]] || scenario_fail "reject-first created a day ($before -> $after)" || return 1

  reset_gap "$owner"; before=$(gap_count "$owner")
  run_bg s2_extend_first "set application_name='taw29_car_extension'; begin; select public.extend_weekday_series(); select 'READY_EXTENSION'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s2_extend_first.out" READY_EXTENSION "$pid_a" || return 1
  run_bg s2_reject_after "set application_name='taw29_car_reject'; select public.review_item('$owner','car_owner',1,'rejected',null);"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_car_reject "$pid_a" "$pid_b" "$tmp_dir/s2_reject_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s2_extend_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s2_reject_after.out" || return 1
  after=$(gap_count "$owner"); [[ "$after" == "$((before + 1))" ]] || scenario_fail "extension-first did not retain its new day ($before -> $after)" || return 1
  [[ $(psql_local -c "select status from public.verification_items where user_id='$owner' and kind='car_owner';") == rejected ]] || scenario_fail 'car rejection did not commit' || return 1
}

scenario_cancellation() {
  local owner=${owners[2]} series pid_a pid_b
  series=$(psql_local -c "select id from public.ride_series where owner_id='$owner';"); make_gap "$owner"
  run_bg s3_cancel_first "set application_name='taw29_cancel_cancel'; begin; select 1 from public.ride_series where id='$series' for update; update public.ride_series set status='cancelled',cancelled_at=now() where id='$series'; update public.rides set status='cancelled',cancelled_at=now() where series_id='$series' and departs_at>now(); select 'READY_CANCEL'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s3_cancel_first.out" READY_CANCEL "$pid_a" || return 1
  run_bg s3_extend_after "set application_name='taw29_cancel_extension'; select public.extend_weekday_series();"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_cancel_extension "$pid_a" "$pid_b" "$tmp_dir/s3_extend_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s3_cancel_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s3_extend_after.out" || return 1
  [[ $(scheduled_count "$owner") == 0 ]] || scenario_fail 'cancel-first left a scheduled future ride' || return 1

  reset_gap "$owner"
  run_bg s3_extend_first "set application_name='taw29_cancel_extension'; begin; select public.extend_weekday_series(); select 'READY_EXTENSION'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s3_extend_first.out" READY_EXTENSION "$pid_a" || return 1
  run_bg s3_cancel_after "set application_name='taw29_cancel_cancel'; begin; select 1 from public.ride_series where id='$series' for update; update public.ride_series set status='cancelled',cancelled_at=now() where id='$series'; update public.rides set status='cancelled',cancelled_at=now() where series_id='$series' and departs_at>now(); commit;"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_cancel_cancel "$pid_a" "$pid_b" "$tmp_dir/s3_cancel_after.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s3_extend_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s3_cancel_after.out" || return 1
  [[ $(scheduled_count "$owner") == 0 ]] || scenario_fail 'extension-first cancellation left a scheduled future ride' || return 1
}

scenario_overlapping_extensions() {
  local owner=${owners[3]} before after pid_a second first_open
  make_gap "$owner"; before=$(gap_count "$owner")
  run_bg s4_first "set application_name='taw29_overlap_first'; begin; select public.extend_weekday_series(); select 'READY_EXTENSION'; select pg_sleep(4); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s4_first.out" READY_EXTENSION "$pid_a" || return 1
  second=$(psql_local -c 'select public.extend_weekday_series();') || return 1
  first_open=$(psql_local -c "select exists (select 1 from pg_catalog.pg_stat_activity where application_name = 'taw29_overlap_first' and xact_start is not null and wait_event = 'PgSleep');") || return 1
  [[ "$first_open" == t ]] || scenario_fail 'second extension did not finish while the first transaction was paused' || return 1
  [[ "$second" == 0 ]] || scenario_fail "overlapping extension returned $second, expected 0" || return 1
  wait_ok "$pid_a" "$tmp_dir/s4_first.out" || return 1; after=$(gap_count "$owner")
  [[ "$after" == "$((before + 1))" ]] || scenario_fail "row count is not exactly one run's ($before -> $after)" || return 1
}

scenario_extension_vs_publish() {
  local owner=${owners[4]} publish_first_owner=${owners[5]} gap_date publish_first_gap_date series pid_a pid_b result pairs request=a29f1005-0000-4000-8000-000000000299 publish_first_request=a29f1006-0000-4000-8000-000000000299
  gap_date=$(psql_local -c "select ride_date from public.rides where owner_id='$owner' order by ride_date desc limit 1;"); make_gap "$owner"
  run_bg s5_extend "set application_name='taw29_publish_extension'; begin; select public.extend_weekday_series(); select 'READY_EXTENSION'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s5_extend.out" READY_EXTENSION "$pid_a" || return 1
  run_bg s5_publish "set application_name='taw29_publish_publish'; $(jwt "$owner") do \$\$ begin perform public.publish_ride('$request','$route_id','a_to_b','$gap_date',time '12:00',0,2,null,null,'once'); raise notice 'ERR|none|none'; exception when others then raise notice 'ERR|%|%',sqlstate,sqlerrm; end \$\$;"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_publish_publish "$pid_a" "$pid_b" "$tmp_dir/s5_publish.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s5_extend.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s5_publish.out" || return 1
  result=$(grep -o 'ERR|[^[:space:]]*|[^[:space:]]*' "$tmp_dir/s5_publish.out" | tail -1 || true)
  [[ "$result" == 'ERR|P0001|duplicate_ride' ]] || scenario_fail "publish outcome was '$result', expected P0001 duplicate_ride" || return 1
  pairs=$(psql_local -c "select count(*) from public.rides a join public.rides b on b.owner_id=a.owner_id and b.id>a.id and b.route_id=a.route_id and b.direction=a.direction and b.status='scheduled' and abs(extract(epoch from b.departs_at-a.departs_at)) <= 3600 where a.owner_id='$owner' and a.status='scheduled';")
  [[ "$pairs" == 0 ]] || scenario_fail "found $pairs scheduled pair(s) within 60 minutes" || return 1

  publish_first_gap_date=$(psql_local -c "select ride_date from public.rides where owner_id='$publish_first_owner' order by ride_date desc limit 1;")
  series=$(psql_local -c "select id from public.ride_series where owner_id='$publish_first_owner';")
  make_gap "$publish_first_owner"
  run_bg s5_publish_first "set application_name='taw29_publish_first_publish'; begin; $(jwt "$publish_first_owner") select 'RESULT|' || public.publish_ride('$publish_first_request','$route_id','a_to_b','$publish_first_gap_date',time '12:00',0,2,null,null,'once')::text; select 'READY_PUBLISH'; select pg_sleep(2); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s5_publish_first.out" READY_PUBLISH "$pid_a" || return 1
  run_bg s5_extend_after_publish "set application_name='taw29_publish_first_extension'; select public.extend_weekday_series();"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_publish_first_extension "$pid_a" "$pid_b" "$tmp_dir/s5_extend_after_publish.out" || return 1
  wait_ok "$pid_a" "$tmp_dir/s5_publish_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s5_extend_after_publish.out" || return 1
  [[ $(psql_local -c "select count(*) from public.rides where series_id='$series' and ride_date='$publish_first_gap_date';") == 0 ]] || scenario_fail 'publish-first extension did not skip the conflicting series date' || return 1
  pairs=$(psql_local -c "select count(*) from public.rides a join public.rides b on b.owner_id=a.owner_id and b.id>a.id and b.route_id=a.route_id and b.direction=a.direction and b.status='scheduled' and abs(extract(epoch from b.departs_at-a.departs_at)) <= 3600 where a.owner_id='$publish_first_owner' and a.status='scheduled';")
  [[ "$pairs" == 0 ]] || scenario_fail "publish-first found $pairs scheduled pair(s) within 60 minutes" || return 1
}

scenario_duplicate_request() {
  local owner=${owners[6]} request=a29f1009-0000-4000-8000-000000000299 pid_a pid_b a b count
  run_bg s6_first "set application_name='taw29_duplicate_first'; begin; $(jwt "$owner") select 'RESULT|' || public.publish_ride('$request','$route_id','b_to_a','$ride_date',time '14:00',5,1,'Gate 1','Bring ID','once')::text; select 'READY_PUBLISH'; select pg_sleep(4); commit;"; pid_a=$RUN_BG_PID
  wait_for_marker "$tmp_dir/s6_first.out" READY_PUBLISH "$pid_a" || return 1
  run_bg s6_second "set application_name='taw29_duplicate_replay'; $(jwt "$owner") select 'RESULT|' || public.publish_ride('$request','$route_id','b_to_a','$ride_date',time '14:00',5,1,'Gate 1','Bring ID','once')::text;"; pid_b=$RUN_BG_PID
  wait_for_lock taw29_duplicate_replay "$pid_a" "$pid_b" "$tmp_dir/s6_second.out" taw29_duplicate_first || return 1
  wait_ok "$pid_a" "$tmp_dir/s6_first.out" || return 1; wait_ok "$pid_b" "$tmp_dir/s6_second.out" || return 1
  a=$(grep '^RESULT|' "$tmp_dir/s6_first.out" | head -1 | cut -d'|' -f2- || true); b=$(grep '^RESULT|' "$tmp_dir/s6_second.out" | head -1 | cut -d'|' -f2- || true)
  [[ -n "$a" && -n "$b" ]] || scenario_fail 'one or both publish responses were missing' || return 1
  [[ $(psql_local -c "select ('$a'::jsonb - 'replayed') = ('$b'::jsonb - 'replayed');") == t ]] || scenario_fail 'publish result fields differ' || return 1
  [[ $(psql_local -c "select ('$a'::jsonb->>'replayed')::boolean=false and ('$b'::jsonb->>'replayed')::boolean=true;") == t ]] || scenario_fail 'responses were not false then true replays' || return 1
  count=$(psql_local -c "select (select count(*) from public.ride_series where owner_id='$owner' and request_id='$request') || '|' || (select count(*) from public.pilot_events e join public.ride_series s on s.id=e.series_id where s.owner_id='$owner' and s.request_id='$request' and e.event_type='ride_posted');")
  [[ "$count" == '1|1' ]] || scenario_fail "expected one series and one event, got $count" || return 1
}

run_scenario 1 'Extension vs admin revocation of phone_verified, both orders' scenario_phone_revocation
run_scenario 2 'Extension vs review_item rejecting the car, both orders' scenario_car_rejection
run_scenario 3 'Extension vs runbook cancellation, both orders' scenario_cancellation
run_scenario 4 'Two overlapping extension runs' scenario_overlapping_extensions
run_scenario 5 'Extension vs publish_ride by the same owner' scenario_extension_vs_publish
run_scenario 6 'Two concurrent publishes with the same request_id' scenario_duplicate_request

if [[ -n ${failures[@]+present} ]]; then
  printf 'FAIL %d/6 scenarios:' "$passed" >&2
  printf ' %s;' ${failures[@]+"${failures[@]}"} >&2
  echo >&2
  exit 1
fi
echo 'PASS 6 scenarios'
completed=1
