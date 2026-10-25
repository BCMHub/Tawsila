import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = () => import('./build-catalogue.mjs');
async function fixture(t, files) {
  const dir = await mkdtemp(join(tmpdir(), 'catalogue-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body);
  return dir;
}
const header = 'year,make,model,body_styles\n';

test('builder merges years, normalizes whitespace, preserves first casing and sorts', async t => {
  const dir = await fixture(t, { 'a.csv': header + '2000, zed , Big   Car ,\n2001,ZED,big car,\n2002,Alpha,One,\n2003,,Empty,\n2004,Zed,,\n', 'b.csv': header });
  const { buildCatalogue, catalogueCSV } = await api();
  const result = await buildCatalogue(dir);
  assert.equal(result.rowsRead, 5);
  assert.deepEqual(result.pairs, [{ make: 'Alpha', model: 'One' }, { make: 'zed', model: 'Big Car' }]);
  assert.equal(catalogueCSV(result.pairs), 'make,model\nAlpha,One\nzed,Big Car\n');
});

test('CSV supports commas, escaped quotes and quoted newlines; invalid names are reported', async t => {
  const { buildCatalogue } = await api();
  const dir = await fixture(t, { 'a.csv': header + '2000,"A, B","The ""One""",\n' });
  assert.deepEqual((await buildCatalogue(dir)).pairs, [{ make: 'A, B', model: 'The "One"' }]);
  for (const name of ['bad\u0001name', 'x'.repeat(81), 'bad\nname', 'bad\tname']) {
    await writeFile(join(dir, 'a.csv'), header + `2000,"${name}",Model,\n`);
    await assert.rejects(buildCatalogue(dir), /a.csv:2: invalid make/);
  }
});

test('extension skips comments, requires header and merges with base casing', async t => {
  const { readExtension, mergePairs } = await api();
  const dir = await fixture(t, { 'ext.csv': '# proposal\nmake,model,status\nTOYOTA, Corolla ,proposed-unverified\nChery,Tiggo,proposed-unverified\n' });
  const extension = await readExtension(join(dir, 'ext.csv'));
  assert.equal(extension.length, 2);
  assert.deepEqual(mergePairs([{ make: 'Toyota', model: 'Corolla' }], extension), [{ make: 'Chery', model: 'Tiggo' }, { make: 'Toyota', model: 'Corolla' }]);
  await writeFile(join(dir, 'ext.csv'), 'Toyota,Corolla,proposed-unverified\n');
  await assert.rejects(readExtension(join(dir, 'ext.csv')), /header/);
});

test('builder rejects wrong headers and accepts header-only source', async t => {
  const { buildCatalogue } = await api();
  const dir = await fixture(t, { 'empty.csv': header });
  assert.deepEqual((await buildCatalogue(dir)).pairs, []);
  await writeFile(join(dir, 'empty.csv'), 'make,model\n');
  await assert.rejects(buildCatalogue(dir), /header/);
});

test('SQL escapes every value and emits deterministic insert-only transaction', async () => {
  const { emitSQL } = await import('./load-catalogue.mjs');
  const pairs = [{ make: "O'Brien", model: "X'); drop table x;--" }, { make: 'Alpha', model: 'One' }];
  const types = [{ code: 'other', name: "Owner's type" }];
  const sql = emitSQL(pairs, types);
  assert.equal(sql, emitSQL([...pairs].reverse(), types));
  assert.ok(sql.startsWith('begin;\n'));
  assert.ok(sql.endsWith('commit;\n'));
  assert.ok(sql.includes("values ('other', 'Owner''s type') on conflict do nothing;"));
  assert.ok(sql.includes("where name = 'O''Brien'"));
  assert.ok(sql.includes("'X''); drop table x;--'"));
  const stripped = sql.replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(stripped, /drop|update|delete|year/i);
  for (const line of stripped.trim().split('\n').slice(1, -1)) {
    assert.match(line, /^insert into public\.car_(types|brands|models) .+ on conflict do nothing;$/);
  }
});

test('coverage identifies fixed-list presence before and after extension without years', async () => {
  const { coverageReport } = await import('./coverage.mjs');
  const report = coverageReport(['Toyota', 'Chery', 'MG'], [{ make: 'TOYOTA', model: 'One' }], [{ make: 'Chery', model: 'Two' }]);
  assert.match(report, /\| Toyota \| present \| present \|/);
  assert.match(report, /\| Chery \| missing \| present \|/);
  assert.match(report, /\| MG \| missing \| missing \|/);
  assert.match(report, /proposed-unverified/);
  assert.doesNotMatch(report, /\b\d{4}\b/);
});
