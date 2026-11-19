import { expect, test } from '@jest/globals';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs') as { existsSync(path: string): boolean; readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]; readFileSync(path: string, encoding: 'utf8'): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path') as { join(...parts: string[]): string; sep: string };
function files(dir: string): string[] { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
test('ride implementation exists and contains no hard-coded pilot place names', () => {
 const root = path.join(process.cwd(), 'src'), implementation = path.join(root, 'features', 'rides');
 expect(fs.existsSync(implementation)).toBe(true);
 for (const file of files(root).filter(file => !file.includes(`${path.sep}__tests__${path.sep}`) && !file.includes(`${path.sep}__integration__${path.sep}`))) expect(fs.readFileSync(file, 'utf8')).not.toMatch(/10th of Ramadan|New Cairo/i);
});
