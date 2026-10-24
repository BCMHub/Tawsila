import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createProviderHandlers } from '../../features/auth/providers';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';
// Jest runs these repository guards in Node; keep Node types out of the app config.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = require('node:fs') as {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }[];
  readFileSync(path: string, encoding: 'utf8'): string;
  mkdtempSync(prefix: string): string;
  mkdirSync(path: string, options: { recursive: true }): void;
  writeFileSync(path: string, content: string): void;
  symlinkSync(target: string, path: string): void;
  rmSync(path: string, options: { recursive: true; force: true }): void;
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
});
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: { configure: jest.fn(), presentExplicitSignIn: jest.fn() },
}));
// The mock intercepts the lazy import before native module initialization.
const native = jest.mocked(GoogleOneTapSignIn);
describe('default native Google adapter', () => {
  const oldWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const oldIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const run = () => createProviderHandlers('ios', {
    randomNonce: async () => 'synthetic-raw', sha256Hex: async () => 'synthetic-hash',
  }).google();
  beforeEach(() => {
    jest.clearAllMocks();
    native.configure.mockReset();
    native.presentExplicitSignIn.mockReset();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'synthetic-web';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'synthetic-ios';
  });
  afterEach(() => {
    if (oldWeb === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = oldWeb;
    if (oldIos === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = oldIos;
  });
  const success = (idToken: string) => ({ type: 'success' as const, data: {
    idToken, scopes: [], serverAuthCode: null,
    user: { id: 'synthetic', email: null, name: null, givenName: null, familyName: null, photo: null },
  } });
  test('explicit flow returns token and configures hashed nonce', async () => {
    native.presentExplicitSignIn.mockResolvedValue(success('synthetic-token'));
    await expect(run()).resolves.toEqual({ idToken: 'synthetic-token', nonce: 'synthetic-raw' });
    expect(native.configure).toHaveBeenCalledWith({ webClientId: 'synthetic-web', iosClientId: 'synthetic-ios', nonce: 'synthetic-hash' });
    expect(native.configure.mock.invocationCallOrder[0]).toBeLessThan(native.presentExplicitSignIn.mock.invocationCallOrder[0]);
  });
  test.each(['cancelled', 'noSavedCredentialFound'] as const)('maps response %s', async type => {
    native.presentExplicitSignIn.mockResolvedValue({ type, data: null });
    await expect(run()).rejects.toEqual({ code: type === 'cancelled' ? 'cancelled' : 'unavailable' });
  });
  test.each(['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'])('requires %s', async key => {
    delete process.env[key];
    await expect(run()).rejects.toEqual({ code: 'unavailable' });
    expect(native.configure).not.toHaveBeenCalled();
    expect(native.presentExplicitSignIn).not.toHaveBeenCalled();
  });
  test.each(['', '   '])('rejects empty token %j', async token => {
    native.presentExplicitSignIn.mockResolvedValue(success(token));
    await expect(run()).rejects.toEqual({ code: 'unavailable' });
  });
  test('native initialization failure is unavailable and logs nothing', async () => {
    const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
    try {
      native.configure.mockImplementation(() => { throw Error('synthetic missing native module'); });
      await expect(run()).rejects.toEqual({ code: 'unavailable' });
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });
  test('library rejection is unavailable and logs nothing', async () => {
    const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
    try {
      native.presentExplicitSignIn.mockRejectedValue(Error('synthetic sensitive failure'));
      await expect(run()).rejects.toEqual({ code: 'unavailable' });
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });
});
function files(dir: string, all = false): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isSymbolicLink()) return [];
    if (e.isDirectory() && ['node_modules', 'ios', 'android', '.expo', 'dist', 'coverage', 'Pods', 'build', 'DerivedData', '.git'].includes(e.name)) return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path, all);
    return e.isFile() && (all || /\.[cm]?[jt]sx?$/.test(e.name)) ? [path] : [];
  });
}
test('application source excludes forbidden authentication paths', () => {
  for (const path of files(join(process.cwd(), 'src')).filter(p => !/__tests__|__integration__/.test(p))) {
    expect(readFileSync(path, 'utf8')).not.toMatch(/signInWith(?:Otp|Password)|signInAnonymously|signUp\s*\(|(?:skip|bypass)[_\w]*profile|profile[_\w]*(?:skip|bypass)|expo-apple-authentication|AppleAuthentication|provider\s*:\s*['"]apple['"]/i);
  }
});
function expectNoProviderStub(root: string) {
  const marker = ['STUB', 'GOOGLE', 'PROVIDER'].join('_');
  for (const path of files(root, true)) expect(readFileSync(path, 'utf8')).not.toContain(marker);
}
describe('completion source scan fixtures', () => {
  let root: string;
  const marker = ['STUB', 'GOOGLE', 'PROVIDER'].join('_');
  const write = (relative: string, content: string) => {
    const path = join(root, relative);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  };
  beforeEach(() => { root = mkdtempSync('/private/tmp/taw7-provider-scan-'); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });
  test.each(['mobile/src/provider.ts', 'other/src/provider.ts', 'other/source.txt'])(
    'rejects marker in source file %s', relative => {
      write(relative, marker);
      expect(() => expectNoProviderStub(root)).toThrow(marker);
    },
  );
  test.each(['node_modules', 'ios', 'android', '.expo', 'dist', 'coverage', 'Pods', 'build', 'DerivedData', '.git'])(
    'ignores marker inside %s', directory => {
      write(`mobile/${directory}/nested/provider.ts`, marker);
      expect(() => expectNoProviderStub(root)).not.toThrow();
    },
  );
  test('ignores directory and file symlinks', () => {
    write('mobile/ios/provider.ts', marker);
    symlinkSync(join(root, 'mobile/ios'), join(root, 'linked-directory'));
    symlinkSync(join(root, 'mobile/ios/provider.ts'), join(root, 'linked-file.ts'));
    expect(() => expectNoProviderStub(root)).not.toThrow();
  });
});
(process.env.TAW7_COMPLETION === '1' ? test : test.skip)('completion has no provider stub anywhere under apps', () => {
  expectNoProviderStub(join(process.cwd(), '..'));
});
