import { jest } from '@jest/globals';
import type { AuthClient, Session } from '../../features/auth/AuthProvider';
export function fakeAuthClient(session: Session | null = null) {
  const values = new Map<string, string>();
  if (session) values.set('sb-test-auth-token', JSON.stringify(session));
  let current = session;
  let listener: (event: string) => void = () => {};
  const client: AuthClient = {
    sessionStorage: { getItem: async k => values.get(k) ?? null, removeItem: async k => { values.delete(k); }, setItem: async (k,v) => { values.set(k,v); } },
    sessionStorageKey: 'sb-test-auth-token',
    auth: {
      getSession: jest.fn(async () => ({ data: { session: current }, error: null })),
      signOut: jest.fn(async () => { current = null; values.clear(); return { error: null }; }),
      signInWithIdToken: jest.fn(async () => { current = { access_token: 'synthetic-session', user: { id: 'fixture' } }; values.set('sb-test-auth-token', JSON.stringify(current)); return { data: { session: current }, error: null }; }),
      onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe() { listener = () => {}; } } } }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_completed_at: null }, error: null }) }) }) }),
  };
  return { client, values, emit: (event: string) => listener(event), setSession: (s: Session | null) => { current = s; } };
}
