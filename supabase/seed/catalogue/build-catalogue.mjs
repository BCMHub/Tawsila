import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Strict CSV state machine: source contents are always data, never evaluated.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') {
        rows.push(row); row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (c === '"' && field === '' && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error('malformed CSV');
      field += c;
    }
  }
  if (quoted) throw new Error('unterminated CSV field');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
export async function readTable(path, header, comments = false) {
  let text = await readFile(path, 'utf8');
  if (comments) text = text.replace(/^(?:#[^\r\n]*(?:\r?\n|$))+/, '');
  const rows = parseCSV(text);
  if (JSON.stringify(rows.shift()) !== JSON.stringify(header)) throw new Error(`${path}: invalid header`);
  for (const [i, row] of rows.entries()) if (row.length !== header.length) throw new Error(`${path}:${i + 2}: invalid column count`);
  return rows;
}
function name(value, location) {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) throw new Error(`${location}: invalid name (control character)`);
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if ([...normalized].length > 80) throw new Error(`${location}: invalid name (over 80 characters)`);
  return normalized;
}
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function mergePairs(...groups) {
  const makes = new Map(), pairs = new Map();
  for (const group of groups) for (const pair of group) {
    const make = name(pair.make, 'make'), model = name(pair.model, 'model');
    if (!make || !model) continue;
    const mk = make.toLowerCase(), key = JSON.stringify([mk, model.toLowerCase()]);
    if (!makes.has(mk)) makes.set(mk, make);
    if (!pairs.has(key)) pairs.set(key, { make: makes.get(mk), model });
  }
  return [...pairs.values()].sort((a, b) => compare(a.make.toLowerCase(), b.make.toLowerCase()) || compare(a.model.toLowerCase(), b.model.toLowerCase()));
}
export async function buildCatalogue(source) {
  const pairs = []; let rowsRead = 0;
  for (const file of (await readdir(source)).filter(f => f.endsWith('.csv')).sort()) {
    const rows = await readTable(join(source, file), ['year', 'make', 'model', 'body_styles']);
    rowsRead += rows.length;
    for (const [i, row] of rows.entries()) {
      const make = name(row[1], `${file}:${i + 2}: invalid make`);
      const model = name(row[2], `${file}:${i + 2}: invalid model`);
      if (make && model) pairs.push({ make, model });
    }
  }
  return { rowsRead, pairs: mergePairs(pairs) };
}
export async function readExtension(path) {
  const rows = await readTable(path, ['make', 'model', 'status'], true);
  return rows.map(([make, model, status], i) => {
    if (status !== 'proposed-unverified') throw new Error(`${path}:${i + 2}: invalid proposal status`);
    return { make: name(make, `${path}:${i + 2}: invalid make`), model: name(model, `${path}:${i + 2}: invalid model`) };
  });
}
export async function readBase(path) {
  return (await readTable(path, ['make', 'model'])).map(([make, model]) => ({ make, model }));
}
const csvField = s => /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
export const catalogueCSV = pairs => 'make,model\n' + pairs.map(p => `${csvField(p.make)},${csvField(p.model)}\n`).join('');
export const isMain = url => process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;
if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 6 || args[0] !== '--source' || args[2] !== '--source-commit' || !/^[a-f0-9]{40}$/.test(args[3]) || args[4] !== '--out') throw new Error('Usage: --source <dir> --source-commit <sha> --out <csv>');
    const { rowsRead, pairs } = await buildCatalogue(args[1]);
    await writeFile(args[5], catalogueCSV(pairs));
    console.log(`Rows read: ${rowsRead}; makes: ${new Set(pairs.map(p => p.make)).size}; distinct pairs: ${pairs.length}; source commit: ${args[3]}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
