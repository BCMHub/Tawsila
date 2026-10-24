import { describe, expect, test } from '@jest/globals';
import { createSecureStorage } from '../../features/auth/secureStorage';

const key = 'sb-local-auth-token';
const oldValue = 'old-session-'.repeat(20);
const newValue = 'new-session-'.repeat(25);
function fake() {
  const data = new Map<string, string>();
  let writes = 0;
  let failAt = Infinity;
  const deletes: string[] = [];
  return {
    data,
    deletes,
    failDeletes: false,
    fail(n: number) { writes = 0; failAt = n; },
    async getItemAsync(k: string) { return data.get(k) ?? null; },
    async setItemAsync(k: string, v: string) {
      if (++writes === failAt) throw new Error('interrupted');
      data.set(k, v);
    },
    async deleteItemAsync(k: string) {
      deletes.push(k);
      if (this.failDeletes) throw new Error('delete interrupted');
      data.delete(k);
    },
  };
}
const adapter = (s: ReturnType<typeof fake>) => createSecureStorage(s, { chunkSize: 128 });

describe('secure session storage', () => {
  test('successful reads after the first read issue no deletes', async () => {
    const s = fake();
    await adapter(s).setItem(key, oldValue);
    const a = adapter(s);
    s.deletes.length = 0;
    expect(await a.getItem(key)).toBe(oldValue);
    expect(s.deletes.length).toBeGreaterThan(0);
    s.deletes.length = 0;
    expect(await a.getItem(key)).toBe(oldValue);
    expect(await a.getItem(key)).toBe(oldValue);
    expect(s.deletes).toEqual([]);
  });

  test('first read after restart removes abandoned chunks', async () => {
    const s = fake();
    await adapter(s).setItem(key, oldValue);
    const clean = new Map(s.data);
    // Model process death after writing into the inactive bank, before cleanup.
    const manifest = JSON.parse(s.data.get(key)!);
    s.data.set(`${key}.chunk.${1 - manifest.bank}.0`, 'abandoned');
    const restarted = adapter(s);
    expect(await restarted.getItem(key)).toBe(oldValue);
    expect(s.data).toEqual(clean);
  });

  test('same-instance read removes orphans after an interrupted write', async () => {
    const s = fake(); const a = adapter(s);
    await a.setItem(key, oldValue);
    await a.getItem(key);
    const clean = new Map(s.data);
    s.fail(2);
    s.failDeletes = true;
    await expect(a.setItem(key, newValue)).rejects.toThrow('interrupted');
    expect(s.data.size).toBeGreaterThan(clean.size);
    s.failDeletes = false;
    s.deletes.length = 0;
    expect(await a.getItem(key)).toBe(oldValue);
    expect(s.deletes.length).toBeGreaterThan(0);
    expect(s.data).toEqual(clean);
    s.deletes.length = 0;
    expect(await a.getItem(key)).toBe(oldValue);
    expect(s.deletes).toEqual([]);
  });

  test('multi-chunk round trip, entry bound, key and ASCII validation', async () => {
    const s = fake(); const a = adapter(s);
    await a.setItem(key, newValue);
    expect(await a.getItem(key)).toBe(newValue);
    expect([...s.data.values()].every(v => v.length < 128)).toBe(true);
    await expect(a.setItem('unknown', 'value')).rejects.toThrow();
    await expect(a.getItem('unknown')).rejects.toThrow();
    await expect(a.removeItem('unknown')).rejects.toThrow();
    await expect(a.setItem(key, 'é')).rejects.toThrow();
  });

  test.each([[false, false], [true, false], [false, true], [true, true]])('interruption at every write boundary, existing=%s restart=%s', async (existing, restart) => {
    const probe = fake(); const p = adapter(probe);
    await p.setItem(key, newValue);
    const boundaries = Math.ceil(newValue.length / 127) + 1;
    for (let boundary = 1; boundary <= boundaries; boundary++) {
      const s = fake(); const a = adapter(s);
      if (existing) await a.setItem(key, oldValue);
      s.fail(boundary);
      await expect(a.setItem(key, newValue)).rejects.toThrow('interrupted');
      // Abandon the writer, as on process termination, and recover in a new instance.
      const restarted = restart ? adapter(s) : a;
      expect(await restarted.getItem(key)).toBe(existing ? oldValue : null);
      s.fail(Infinity);
      await restarted.setItem(key, newValue);
      expect(await restarted.getItem(key)).toBe(newValue);
      expect(s.data.size).toBe(probe.data.size);
      await restarted.removeItem(key);
      expect(s.data.size).toBe(0);
    }
  });

  test('damage every actual stored entry and recover without orphans', async () => {
    const probe = fake(); await adapter(probe).setItem(key, newValue);
    for (const damaged of probe.data.keys()) {
      for (const garbage of [null, 'garbage']) {
        const s = fake(); const a = adapter(s);
        await a.setItem(key, newValue);
        if (garbage === null) s.data.delete(damaged); else s.data.set(damaged, garbage);
        const recovered = adapter(s);
        expect([null, newValue]).toContain(await recovered.getItem(key));
        await recovered.setItem(key, oldValue);
        expect(await recovered.getItem(key)).toBe(oldValue);
        await recovered.removeItem(key);
        expect(s.data.size).toBe(0);
      }
    }
  });

  test('serialized concurrent writes and removal after replacements', async () => {
    const s = fake(); const a = adapter(s);
    await Promise.all([a.setItem(key, oldValue), a.setItem(key, newValue), a.setItem(key, oldValue)]);
    expect(await a.getItem(key)).toBe(oldValue);
    const clean = fake(); await adapter(clean).setItem(key, oldValue);
    expect(s.data.size).toBe(clean.data.size);
    await a.removeItem(key);
    expect(s.data.size).toBe(0);
  });
});

test('SDK sign-out may read and remove its empty flow index', async () => {
  const s = fake(); const a = adapter(s); const index = key + '-flows-code-verifier';
  expect(await a.getItem(index)).toBeNull();
  await a.setItem(index, '[]'); await a.removeItem(index);
  expect(s.data.size).toBe(0);
});

test('absent reads avoid repeated sweeps and writes avoid redundant bank sweeps', async () => {
  const s = fake(); const a = createSecureStorage(s);
  await a.getItem(key); s.deletes.length = 0;
  expect(await a.getItem(key)).toBeNull(); expect(await a.getItem(key)).toBeNull();
  expect(s.deletes).toHaveLength(0);
  await a.setItem(key, 'x'.repeat(3000));
  expect(s.deletes.length).toBeLessThan(140);
  await a.removeItem(key); expect(s.data.size).toBe(0);
});

test('3 KB write uses a bounded number of native operations', async () => {
  const data = new Map<string,string>(); let operations = 0;
  const a = createSecureStorage({
    getItemAsync: async k => {operations++; return data.get(k) ?? null;},
    setItemAsync: async (k,v) => {operations++; data.set(k,v);},
    deleteItemAsync: async k => {operations++; data.delete(k);},
  });
  await a.setItem(key, 'x'.repeat(3000));
  expect(operations).toBeLessThanOrEqual(265);
  await a.removeItem(key); operations = 0;
  await a.getItem(key); await a.getItem(key);
  expect(operations).toBe(2); // Only the authoritative manifest lookups.
  operations = 0; await a.setItem(key, 'x'.repeat(3000));
  expect(operations).toBeLessThanOrEqual(6);
  operations = 0; await a.setItem(key, 'y'.repeat(3000));
  expect(operations).toBeLessThanOrEqual(10);
});

test('pruned 3 KB removal costs only chunks, manifest and bounded reads', async () => {
  const data = new Map<string,string>(); let operations = 0;
  const a = createSecureStorage({
    getItemAsync: async k => { operations++; return data.get(k) ?? null; },
    setItemAsync: async (k,v) => { operations++; data.set(k,v); },
    deleteItemAsync: async k => { operations++; data.delete(k); },
  });
  await a.setItem(key, 'x'.repeat(3000)); operations = 0;
  await a.removeItem(key); expect(operations).toBeLessThanOrEqual(7); expect(data.size).toBe(0);
});
test('first removal sweeps dead-process orphans even without a manifest', async () => {
  const s = fake(); s.data.set(`${key}.chunk.1.127`, 'orphan');
  await adapter(s).removeItem(key); expect(s.data.size).toBe(0);
});
