import { describe, expect, jest, test } from '@jest/globals';
import { createProviderHandlers } from '../../features/auth/providers';
// Jest runs these repository guards in Node; keep Node types out of the app config.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync } = require('node:fs') as {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: 'utf8'): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require('node:path') as { join(...parts: string[]): string };

const deps = () => ({
  google: { signIn: jest.fn< (input: { nonce: string }) => Promise<{ idToken: string | null }> >().mockResolvedValue({ idToken: 'synthetic' }) },
  randomNonce: jest.fn<() => Promise<string>>().mockResolvedValueOnce('raw-one').mockResolvedValueOnce('raw-two'),
  sha256Hex: jest.fn<(s: string) => Promise<string>>().mockImplementation(async s => `hash-${s}`),
});
describe('Google provider', () => {
  test('passes hash, returns raw nonce, fresh for every attempt', async () => {
    const d = deps(); const h = createProviderHandlers('ios', d);
    expect(await h.google()).toEqual({ idToken: 'synthetic', nonce: 'raw-one' });
    expect(await h.google()).toEqual({ idToken: 'synthetic', nonce: 'raw-two' });
    expect(d.google.signIn.mock.calls).toEqual([[{ nonce: 'hash-raw-one' }], [{ nonce: 'hash-raw-two' }]]);
  });
  test.each(['cancelled', 'denied', 'unavailable'] as const)('maps %s', async code => {
    const d = deps(); d.google.signIn.mockRejectedValue({ code });
    await expect(createProviderHandlers('ios', d).google()).rejects.toEqual({ code });
  });
  test.each(['', null])('rejects empty token %s', async idToken => {
    const d = deps(); d.google.signIn.mockResolvedValue({ idToken });
    await expect(createProviderHandlers('ios', d).google()).rejects.toEqual({ code: 'unavailable' });
  });
  test('sanitizes unexpected failures and never logs token or error', async () => {
    const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
    try {
      const d = deps(); d.google.signIn.mockRejectedValue(new Error('sensitive synthetic failure'));
      await expect(createProviderHandlers('ios', d).google()).rejects.toEqual({ code: 'unavailable' });
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });
  test('Android unavailable without invoking dependencies', async () => {
    const d = deps();
    await expect(createProviderHandlers('android', d).google()).rejects.toEqual({ code: 'unavailable' });
    expect(d.randomNonce).not.toHaveBeenCalled(); expect(d.google.signIn).not.toHaveBeenCalled();
  });
  test('default stub unavailable', async () => {
    await expect(createProviderHandlers('ios').google()).rejects.toEqual({ code: 'unavailable' });
  });
});
function files(dir: string, all = false): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['node_modules', '.expo', '.git'].includes(e.name)) return [];
    const path = join(dir, e.name);
    return e.isDirectory() ? files(path, all) : all || /\.[cm]?[jt]sx?$/.test(e.name) ? [path] : [];
  });
}
test('application source excludes forbidden authentication paths', () => {
  for (const path of files(join(process.cwd(), 'src')).filter(p => !/__tests__|__integration__/.test(p))) {
    expect(readFileSync(path, 'utf8')).not.toMatch(/signInWith(?:Otp|Password)|signInAnonymously|signUp\s*\(|(?:skip|bypass)[_\w]*profile|profile[_\w]*(?:skip|bypass)|expo-apple-authentication|AppleAuthentication|provider\s*:\s*['"]apple['"]/i);
  }
});
(process.env.TAW7_COMPLETION === '1' ? test : test.skip)('completion has no provider stub anywhere under apps', () => {
  const marker = ['STUB', 'GOOGLE', 'PROVIDER'].join('_');
  for (const path of files(join(process.cwd(), '..'), true)) expect(readFileSync(path, 'utf8')).not.toContain(marker);
});
