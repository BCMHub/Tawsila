export type ProviderName = 'google';
type ProviderCode = 'cancelled' | 'denied' | 'unavailable';
type Dependencies = {
  google?: { signIn(input: { nonce: string }): Promise<{ idToken: string | null }> };
  randomNonce?: () => string | Promise<string>;
  sha256Hex?: (raw: string) => string | Promise<string>;
};
const defaultGoogle = {
  async signIn(_input: { nonce: string }): Promise<{ idToken: string | null }> {
    // STUB_GOOGLE_PROVIDER: replaced by the verified native adapter in T10.
    throw { code: 'unavailable' };
  },
};
export function createProviderHandlers(platform: 'ios' | 'android', deps: Dependencies = {}) {
  return {
    async google(): Promise<{ idToken: string; nonce: string }> {
      if (platform !== 'ios') throw { code: 'unavailable' };
      try {
        const randomNonce = deps.randomNonce ?? (async () => {
          const crypto = await import('expo-crypto');
          return Array.from(await crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
        });
        const sha256Hex = deps.sha256Hex ?? (async (raw: string) => {
          const crypto = await import('expo-crypto');
          return crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, raw, { encoding: crypto.CryptoEncoding.HEX });
        });
        const nonce = await randomNonce();
        const result = await (deps.google ?? defaultGoogle).signIn({ nonce: await sha256Hex(nonce) });
        if (typeof result?.idToken !== 'string' || !result.idToken.trim()) throw { code: 'unavailable' };
        return { idToken: result.idToken, nonce };
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const mapped: ProviderCode = code === 'cancelled' || code === 'denied' ? code : 'unavailable';
        throw { code: mapped };
      }
    },
  };
}
