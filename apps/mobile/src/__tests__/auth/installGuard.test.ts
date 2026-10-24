import { describe, expect, it } from '@jest/globals';
import { createInstallGuard } from '../../features/auth/installGuard';
describe('sandbox install marker', () => {
  it('missing remains fresh until verified completion writes the marker', async () => {
    let value: string | null = null;
    const guard = createInstallGuard({ read: async () => value, write: async v => { value = v; } });
    expect(await guard.isFreshInstall()).toBe(true);
    expect(value).toBeNull();
    await guard.markVerified();
    expect(await guard.isFreshInstall()).toBe(false);
  });
  it('read errors require sign-in and write errors propagate', async () => {
    const guard = createInstallGuard({ read: async () => { throw Error(); }, write: async () => { throw Error('write'); } });
    expect(await guard.isFreshInstall()).toBe(true);
    await expect(guard.markVerified()).rejects.toThrow('write');
  });
});
