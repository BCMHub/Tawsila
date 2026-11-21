#!/usr/bin/env bash
# Local DB execution belongs to the operator. Each run is a rolled-back session.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
test_sql="$root/supabase/tests/database/taw29_privileges.test.sql"
generator="$root/supabase/tests/taw29/gen-privileges.sh"
container=supabase_db_tawsila
psql=(docker exec -i "$container" psql -X -q -A -t -U postgres -d postgres -v ON_ERROR_STOP=1)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/taw29-mutations.XXXXXX")
completed=0
trap 'rc=$?; rm -rf "$tmp_dir"; if [[ $rc -eq 0 && $completed -ne 1 ]]; then rc=1; fi; exit "$rc"' EXIT

bash "$generator" --ids > "$tmp_dir/ids"
bash "$generator" --mutations > "$tmp_dir/mutations"
[[ $(head -n 1 "$test_sql") == 'begin;' ]] || { echo 'test must start with begin;' >&2; exit 1; }

tap_status() {
  local tap_file=$1 err_file=$2 mode=$3 expected=${4:-}
  python3 - "$tap_file" "$err_file" "$tmp_dir/ids" "$mode" "$expected" <<'PY'
import re
import sys
from pathlib import Path

path, err_path, inventory, mode, expected = sys.argv[1:]
lines = Path(path).read_text().splitlines()
err_lines = Path(err_path).read_text().splitlines()
ids = Path(inventory).read_text().splitlines()
plans = [int(m.group(1)) for line in lines if (m := re.fullmatch(r'1\.\.(\d+)', line))]
results = []
for line in lines:
    m = re.fullmatch(r'(not )?ok (\d+) - ((?:schema:)?(?:cell|grant|bypass|struct):\S+)(?: .*)?', line)
    if m:
        results.append((int(m.group(2)), m.group(3), not bool(m.group(1))))
if any(re.search(r'Bail out!|(?:ERROR|FATAL|PANIC):', line) for line in lines + err_lines):
    raise SystemExit('aborted/error TAP session')
if plans != [len(ids)] or len(results) != len(ids):
    raise SystemExit('incomplete TAP plan/results')
if [n for n, _, _ in results] != list(range(1, len(ids)+1)):
    raise SystemExit('TAP numbering is incomplete or duplicated')
statuses = {id: status for _, id, status in results}
if len(statuses) != len(ids) or set(statuses) != set(ids):
    raise SystemExit('TAP assertion inventory differs from test')
if mode == 'baseline':
    failures = [id for id, status in statuses.items() if not status]
    if failures:
        raise SystemExit('baseline not green: ' + '|'.join(failures))
else:
    required = expected.split('|')
    if not expected or any(id not in statuses or statuses[id] for id in required):
        raise SystemExit('not every expected assertion failed: ' + expected)
PY
}

# Do not count mutations against an already-red or aborted test. Baseline must
# include every produced assertion exactly once and all of them must be green.
if ! "${psql[@]}" -f - < "$test_sql" > "$tmp_dir/baseline.tap" 2> "$tmp_dir/baseline.err"; then
  echo 'baseline SQL failed; no mutations attempted' >&2
  cat "$tmp_dir/baseline.tap" "$tmp_dir/baseline.err" >&2
  exit 1
fi
if ! tap_status "$tmp_dir/baseline.tap" "$tmp_dir/baseline.err" baseline; then
  echo 'baseline is not clean; no mutations attempted' >&2
  cat "$tmp_dir/baseline.tap" "$tmp_dir/baseline.err" >&2
  exit 1
fi
printf 'baseline OK\n'
detected=0
total=0
failures=()
run_mutation() {
  local name=$1 sql=$2 expected=$3 tap_file err_file session_file
  total=$((total + 1))
  tap_file="$tmp_dir/$total.tap"
  err_file="$tmp_dir/$total.err"
  session_file="$tmp_dir/$total.sql"
  {
    printf 'begin;\n%s;\n' "$sql"
    # Stream host content to psql stdin; the container cannot resolve host paths.
    # Omit only the test's BEGIN, retaining its final ROLLBACK.
    tail -n +2 "$test_sql"
  } > "$session_file"
  if "${psql[@]}" -f - < "$session_file" > "$tap_file" 2> "$err_file" && tap_status "$tap_file" "$err_file" mutation "$expected"; then
    detected=$((detected + 1))
    printf 'detected %s [%s]\n' "$name" "$expected"
  else
    failures+=("$name expected [$expected]")
    printf 'MISSED %s expected [%s]\n' "$name" "$expected" >&2
    cat "$tap_file" "$err_file" >&2
  fi
}
while IFS=$'\t' read -r name mutation_sql expected; do
  run_mutation "$name" "$mutation_sql" "$expected"
done < "$tmp_dir/mutations"
printf '%d/%d\n' "$detected" "$total"
if ((${#failures[@]})); then
  printf 'undetected mutation: %s\n' "${failures[@]}" >&2
  exit 1
fi
completed=1
