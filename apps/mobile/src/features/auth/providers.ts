export type ProviderName = 'google';
type ProviderCode = 'cancelled' | 'denied' | 'unavailable' | 'failed';
type Dependencies = {
  google?: { signIn(input: { nonce: string }): Promise<{ idToken: string | null }> };
  randomNonce?: () => string | Promise<string>;
  sha256Hex?: (raw: string) => string | Promise<string>;
};
const defaultGoogle = {
  async signIn({ nonce }: { nonce: string }): Promise<{ idToken: string | null }> {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!webClientId?.trim() || !iosClientId?.trim()) throw { code: 'unavailable' };
    // Native module loading stays inside the attempt so Expo Go can render Welcome.
    const { GoogleOneTapSignIn } = await import('react-native-nitro-google-signin').catch(() => { throw { code: 'unavailable' }; });
    const result = await (async () => {
      GoogleOneTapSignIn.configure({ webClientId, iosClientId, nonce });
      return GoogleOneTapSignIn.presentExplicitSignIn();
    })().catch(error => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      throw { code: code === 'cancelled' || code === 'denied' ? code : 'failed' };
    });
    if (result.type === 'cancelled') throw { code: 'cancelled' };
    if (result.type !== 'success' || !result.data) throw { code: 'failed' };
    return { idToken: result.data.idToken };
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
        if (typeof result?.idToken !== 'string' || !result.idToken.trim()) throw { code: 'failed' };
        return { idToken: result.idToken, nonce };
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const mapped: ProviderCode = code === 'cancelled' || code === 'denied' || code === 'unavailable' ? code : 'failed';
        throw { code: mapped };
      }
    },
  };
}
