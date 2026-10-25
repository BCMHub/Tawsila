import { readTable, readBase, readExtension, mergePairs, isMain } from './build-catalogue.mjs';
const quote = value => "'" + value.replaceAll("'", "''") + "'";
export function emitSQL(pairs, types) {
  const merged = mergePairs(pairs);
  const statements = ['begin;'];
  for (const { code, name } of [...types].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)) {
    statements.push(`insert into public.car_types (code, name) values (${quote(code)}, ${quote(name)}) on conflict do nothing;`);
  }
  for (const make of new Set(merged.map(p => p.make))) statements.push(`insert into public.car_brands (name) values (${quote(make)}) on conflict do nothing;`);
  for (const { make, model } of merged) statements.push(`insert into public.car_models (brand_id, name) select id, ${quote(model)} from public.car_brands where name = ${quote(make)} on conflict do nothing;`);
  return statements.join('\n') + '\ncommit;\n';
}
if (isMain(import.meta.url)) {
  try {
    const here = new URL('.', import.meta.url);
    const base = await readBase(new URL('catalogue-base.csv', here));
    const extension = await readExtension(new URL('egypt-extension.csv', here));
    const types = (await readTable(new URL('types.csv', here), ['code', 'name'])).map(([code, name]) => ({ code, name }));
    process.stdout.write(emitSQL(mergePairs(base, extension), types));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
