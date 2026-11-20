#!/usr/bin/env bash
# Static generator/validator. Six CSV fields; only the first five form VALUES.
# --values emits that block, --ids emits the complete assertion inventory, and
# --mutations emits validated TSV input for mutation.sh. No database connection.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
python3 - "$root" "${1:---check}" <<'PY'
import csv
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
mode = sys.argv[2]
base = root / 'supabase/tests'
test = (base / 'database/taw29_privileges.test.sql').read_text()

def fail(message):
    raise SystemExit(message)

def read_csv(path, header):
    with path.open(newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != header:
            fail(f'{path.name}: invalid header')
        rows = list(reader)
    if not rows or any(None in row or None in row.values() for row in rows):
        fail(f'{path.name}: empty file or malformed row')
    return rows

rows = read_csv(base / 'taw29/expected-privileges.csv',
                ['object', 'kind', 'role', 'privilege', 'allowed', 'expected_ids'])
structural = read_csv(base / 'taw29/structural-mutations.csv', ['name', 'sql', 'expected_ids'])
values = []
cells = []
seen = set()
for number, row in enumerate(rows, 2):
    obj, kind, role, privilege, allowed, expected = row.values()
    if not re.fullmatch('[a-z][a-z0-9_]*', obj):
        fail(f'row {number}: invalid object')
    if role not in ('PUBLIC', 'anon', 'authenticated', 'service_role', 'owner'):
        fail(f'row {number}: invalid role')
    valid = (kind == 'table' and privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
             or kind == 'function' and privilege == 'EXECUTE'
             or kind == 'column' and obj == 'car_types' and role == 'authenticated' and privilege == 'UPDATE(passenger_seats)')
    if not valid or allowed not in ('true', 'false'):
        fail(f'row {number}: invalid kind, privilege or allowed value')
    key = (obj, kind, role, privilege)
    if key in seen:
        fail(f'row {number}: duplicate cell')
    seen.add(key)
    if bool(expected) != (allowed == 'false'):
        fail(f'row {number}: expected_ids must be populated exactly for forbidden cells')
    values.append(f"  ('{obj}','{kind}','{role}','{privilege}',{allowed})")
    prefix = '' if kind == 'function' else 'schema:'
    cell = f"{prefix}cell:{obj}:{role}:{'UPDATE-column' if kind == 'column' else privilege}"
    cells.append(cell)
    if expected and cell not in expected.split('|'):
        fail(f'row {number}: expected_ids omits its own catalogue cell {cell}')

block = ',\n'.join(values) + '\n'
match = re.search(r'-- BEGIN GENERATED PRIVILEGES\n(.*?)-- END GENERATED PRIVILEGES', test, re.S)
if mode != '--values' and (not match or match.group(1) != block):
    fail('embedded VALUES differ from CSV; generate replacement with gen-privileges.sh --values')
# These exact pieces identify the one SELECT which produces one catalogue id
# per VALUES row. All other ids MUST occur as literal assertion descriptions.
for fragment in ["format('%scell:%s:%s:%s expected %s'", "from taw29_expected e",
                 "case when kind='function' then '' else 'schema:' end",
                 "case when kind='column' then 'UPDATE-column' else privilege end"]:
    if fragment not in test:
        fail('catalogue id producer missing: ' + fragment)
id_pattern = r"'((?:schema:)?(?:cell|grant|bypass|struct):[A-Za-z0-9_:-]+) [^'\n]*'"
# Comments cannot produce TAP assertions.
assertion_source = re.sub(r'^\s*--[^\n]*', '', test, flags=re.M)
literal_ids = re.findall(id_pattern, assertion_source)
all_ids = cells + literal_ids
plans = re.findall(r'^select plan\((\d+)\);$', test, flags=re.M)
if plans != [str(len(all_ids))]:
    fail('TAP plan differs from assertion inventory')
if len(set(all_ids)) != len(all_ids):
    fail('duplicate produced assertion id')
produced = set(all_ids)
for other in sorted((base / 'database').glob('taw29_*.test.sql')):
    if other.name == 'taw29_privileges.test.sql':
        continue
    source = re.sub(r'^\s*--[^\n]*', '', other.read_text(), flags=re.M)
    reserved = re.findall(id_pattern, source)
    if reserved:
        fail(f'{other.name}: ids reserved for privilege test: ' + '|'.join(reserved))

def validate_ids(expected, context):
    ids = expected.split('|')
    if len(set(ids)) != len(ids):
        fail(f'{context}: duplicate expected id')
    for assertion in ids:
        if not re.fullmatch(r'(schema:)?(cell|grant|bypass|struct):[A-Za-z0-9_:-]+', assertion):
            fail(f'{context}: invalid assertion id {assertion}')
        if assertion not in produced:
            fail(f'{context}: assertion is not produced by privilege test: {assertion}')

mutations = []
for row, cell in zip(rows, cells):
    obj, kind, role, privilege, allowed, expected = row.values()
    if allowed == 'true':
        continue
    validate_ids(expected, cell)
    if kind == 'function':
        sql = ("do $mutation$ declare target regprocedure; begin "
               "select p.oid::regprocedure into strict target from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
               f"where n.nspname='public' and p.proname='{obj}'; "
               f"execute format('grant execute on function %s to {role}',target); end $mutation$")
    else:
        sql = f'grant {privilege} on table public.{obj} to {role}'
    mutations.append((cell, sql, expected))
names = set()
for row in structural:
    name, sql, expected = row.values()
    if not re.fullmatch('[a-z][a-z0-9-]*', name) or name in names:
        fail('invalid/duplicate structural mutation name: ' + name)
    names.add(name)
    if not sql or any(c in sql for c in '\t\r\n'):
        fail('structural SQL must be nonempty and on one line: ' + name)
    validate_ids(expected, name)
    mutations.append(('struct:' + name, sql, expected))

if mode == '--values':
    print(block, end='')
elif mode == '--ids':
    print('\n'.join(all_ids))
elif mode == '--mutations':
    for mutation in mutations:
        print('\t'.join(mutation))
elif mode == '--check':
    print(f'OK {len(cells)} cells; {len(all_ids)} assertion ids; {len(mutations)-len(structural)} grant mutations; {len(structural)} structural mutations')
else:
    fail('usage: gen-privileges.sh [--check|--values|--ids|--mutations]')
PY
