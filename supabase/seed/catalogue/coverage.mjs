import { readFile, writeFile } from 'node:fs/promises';
import { readBase, readExtension, mergePairs, isMain } from './build-catalogue.mjs';
export function coverageReport(brands, base, extension) {
  const merged = mergePairs(base, extension);
  const before = new Set(base.map(p => p.make.toLowerCase()));
  const after = new Set(merged.map(p => p.make.toLowerCase()));
  const presentBefore = brands.filter(b => before.has(b.toLowerCase())).length;
  const presentAfter = brands.filter(b => after.has(b.toLowerCase())).length;
  return '# Egypt-market catalogue coverage\n\n' +
    'The extension is proposed-unverified and requires owner review before real use. Presence means a brand has at least one model; it does not establish complete market or model coverage. Matching ignores case and normalized whitespace; spelling aliases are not inferred.\n\n' +
    `Base: ${before.size} brands, ${base.length} models. Extension: ${extension.length} rows. Merged: ${after.size} brands, ${merged.length} models.\n\n` +
    `Fixed list: ${brands.length} brands. Before: ${presentBefore} present, ${brands.length - presentBefore} missing. After: ${presentAfter} present, ${brands.length - presentAfter} missing.\n\n` +
    '| Brand | Base | With extension |\n| --- | --- | --- |\n' +
    brands.map(b => `| ${b} | ${before.has(b.toLowerCase()) ? 'present' : 'missing'} | ${after.has(b.toLowerCase()) ? 'present' : 'missing'} |\n`).join('');
}
if (isMain(import.meta.url)) {
  const here = new URL('.', import.meta.url);
  const brands = (await readFile(new URL('egypt-brands.txt', here), 'utf8')).trim().split(/\r?\n/);
  const base = await readBase(new URL('catalogue-base.csv', here));
  const extension = await readExtension(new URL('egypt-extension.csv', here));
  const report = coverageReport(brands, base, extension);
  await writeFile(new URL('COVERAGE.md', here), report);
  console.log(report);
}
