import { expect, test } from '@jest/globals';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs') as { existsSync(path: string): boolean; readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean; isFile(): boolean }[]; readFileSync(path: string, encoding: 'utf8'): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path') as { join(...parts: string[]): string };
function scan(dir: string): string[] {
 if (!fs.existsSync(dir)) return [];
 return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? scan(file) : entry.isFile() ? [file] : [];
 });
}
test('onboarding and verification never log', () => {
 const files = ['onboarding', 'verification'].flatMap(name => scan(path.join(process.cwd(), 'src/features', name)));
 expect(files.length).toBeGreaterThan(0);
 for (const file of files) expect(fs.readFileSync(file, 'utf8')).not.toMatch(/console\s*\./);
});
