import type * as SecureStoreModule from 'expo-secure-store';

type Store = Pick<typeof SecureStoreModule, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;
// SecureStore cannot enumerate keys. Two bounded banks make orphan discovery independent
// of intact metadata after a process dies. At the default size this permits 243,072 bytes.
const SLOTS = 128;
function digest(value: string): string {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${a >>> 0}-${b >>> 0}`;
}
type Manifest = { v: 1; bank: 0 | 1; count: number; size: number; hash: string };
export function createSecureStorage(store: Store, options?: { chunkSize?: number }) {
  const limit = options?.chunkSize ?? 1900;
  if (!Number.isInteger(limit) || limit < 128 || limit > 2000) throw new Error('Invalid chunk size');
  let queue: Promise<unknown> = Promise.resolve();
  // Each session key needs its own restart scan; failed cleanup stays retryable.
  const pruned = new Set<string>();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }
  function validate(key: string) {
    if (!/^sb-[a-zA-Z0-9_-]+-auth-token(?:-code-verifier|-flows-code-verifier|-user)?$/.test(key)) throw new Error('Unknown session key');
  }
  const chunkKey = (key: string, bank: number, i: number) => `${key}.chunk.${bank}.${i}`;
  async function prune(key: string, keep?: Manifest) {
    pruned.delete(key);
    for (const bank of [0, 1]) {
      for (let i = 0; i < SLOTS; i++) {
        if (keep?.bank === bank && i < keep.count) continue;
        await store.deleteItemAsync(chunkKey(key, bank, i));
      }
    }
    pruned.add(key);
  }
  async function read(key: string): Promise<{ value: string; manifest: Manifest } | null> {
    const raw = await store.getItemAsync(key);
    let manifest: Manifest | undefined;
    try {
      const m = JSON.parse(raw ?? 'null');
      if (!m || m.v !== 1 || ![0, 1].includes(m.bank) || !Number.isInteger(m.count) || m.count < 1 || m.count > SLOTS || !Number.isInteger(m.size) || m.size < 0 || typeof m.hash !== 'string') throw new Error('Invalid manifest');
      manifest = m;
      const chunks: string[] = [];
      for (let i = 0; i < m.count; i++) {
        const chunk = await store.getItemAsync(chunkKey(key, m.bank, i));
        if (chunk === null || chunk.length >= limit || /[^\x00-\x7f]/.test(chunk)) throw new Error('Invalid chunk');
        chunks.push(chunk);
      }
      const value = chunks.join('');
      if (value.length !== m.size || digest(value) !== m.hash) throw new Error('Damaged session');
      if (!pruned.has(key)) await prune(key, manifest);
      return { value, manifest: m };
    } catch (error) {
      // Storage I/O errors must propagate; only malformed stored content is invalidated.
      if (!(error instanceof SyntaxError) && !(error instanceof Error && ['Invalid manifest', 'Invalid chunk', 'Damaged session'].includes(error.message))) throw error;
      await store.deleteItemAsync(key);
      await prune(key);
      return null;
    }
  }
  return {
    getItem(key: string): Promise<string | null> {
      return serial(async () => { validate(key); return (await read(key))?.value ?? null; });
    },
    setItem(key: string, value: string): Promise<void> {
      return serial(async () => {
        validate(key);
        if (/[^\x00-\x7f]/.test(value)) throw new Error('Session must be ASCII');
        const count = Math.max(1, Math.ceil(value.length / (limit - 1)));
        if (count > SLOTS) throw new Error('Session exceeds storage capacity');
        const previous = await read(key);
        const manifest: Manifest = { v: 1, bank: previous?.manifest.bank === 0 ? 1 : 0, count, size: value.length, hash: digest(value) };
        const encoded = JSON.stringify(manifest);
        if (encoded.length >= limit) throw new Error('Manifest exceeds chunk size');
        let committed = false;
        try {
          for (let i = 0; i < count; i++) {
            await store.setItemAsync(chunkKey(key, manifest.bank, i), value.slice(i * (limit - 1), (i + 1) * (limit - 1)));
          }
          await store.setItemAsync(key, encoded);
          committed = true;
          await prune(key, manifest);
        } catch (error) {
          try {
            await prune(key, committed ? manifest : previous?.manifest);
          } catch {
            // Preserve the write error; the next read retries cleanup.
          }
          pruned.delete(key);
          throw error;
        }
      });
    },
    removeItem(key: string): Promise<void> {
      return serial(async () => { validate(key); await store.deleteItemAsync(key); await prune(key); });
    },
  };
}
// Loading the module is deferred until an operation actually needs native storage.
const SecureStore: Store = {
  getItemAsync: async key => (await import('expo-secure-store')).getItemAsync(key),
  setItemAsync: async (key, value) => (await import('expo-secure-store')).setItemAsync(key, value),
  deleteItemAsync: async key => (await import('expo-secure-store')).deleteItemAsync(key),
};
export const secureStorage = createSecureStorage(SecureStore);
