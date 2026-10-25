#!/usr/bin/env bash
# Local stack only. Each invocation owns a fresh, random UUID prefix.
set -euo pipefail
cd "$(dirname "$0")/../../.."
command -v docker >/dev/null || { echo 'docker is required' >&2; exit 1; }
container=supabase_db_tawsila
prefix=$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-24)
ids=()
pids=()
for i in $(seq 1 20); do
  printf -v suffix '%012d' "$i"
  ids+=("${prefix}${suffix}")
done
sql_ids=$(printf "'%s'," "${ids[@]}")
sql_ids=${sql_ids%,}
psql_local() {
  docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}
cleanup() {
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  psql_local -c "delete from auth.users where id in ($sql_ids);" >/dev/null
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for id in "${ids[@]}"; do
  psql_local -c "begin; insert into auth.users (id) values ('$id'); commit;" >/dev/null &
  pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do
  wait "$pid" || failed=1
done
[[ "$failed" = 0 ]] || { echo 'FAIL parallel insert' >&2; exit 1; }
counts=$(psql_local -At -c "select
  (select count(*) from auth.users where id in ($sql_ids)),
  (select count(*) from public.accounts where user_id in ($sql_ids)),
  (select count(distinct user_id) from public.accounts where user_id in ($sql_ids));")
[[ "$counts" = '20|20|20' ]] || { echo 'FAIL expected one account per new user' >&2; exit 1; }
cleanup
trap - EXIT
echo 'PASS 20 users, 20 account rows'
