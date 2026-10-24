import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureStorage } from '../features/auth/secureStorage';
let singleton: (SupabaseClient & { sessionStorage: typeof secureStorage; sessionStorageKey: string }) | undefined;
export function getSupabase() {
  if (singleton) return singleton;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY before using authentication');
  const sessionStorageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const client = createClient(url, key, { auth: { storage: secureStorage, storageKey: sessionStorageKey, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
  singleton = Object.assign(client, { sessionStorage: secureStorage, sessionStorageKey });
  return singleton;
}
