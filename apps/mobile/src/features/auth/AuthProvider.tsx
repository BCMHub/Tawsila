import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ProviderName } from './providers';
export type ProviderResult = { idToken: string; nonce?: string };
export type ProviderHandlers = Record<ProviderName, () => Promise<ProviderResult>>;
export type InstallGuard = { isFreshInstall(): Promise<boolean>; markVerified?(): Promise<void> };
export type Session = { access_token: string; user: { id: string } };
type Failure = { status?: number; name?: string; message?: string };
type Result<T> = { data: T; error: Failure | null };
export type AuthClient = {
  sessionStorageKey: string;
  sessionStorage: { getItem(k: string): Promise<string | null>; removeItem(k: string): Promise<void>; setItem(k: string,v: string): Promise<void> };
  auth: {
    getSession(): Promise<Result<{ session: Session | null }>>;
    signOut(input: { scope: 'local' }): Promise<{ error: Failure | null }>;
    signInWithIdToken(input: { provider: ProviderName; token: string; nonce?: string }): Promise<Result<{ session: Session | null }>>;
    onAuthStateChange(cb: (event: string) => void): { data: { subscription: { unsubscribe(): void } } };
    startAutoRefresh?(): void; stopAutoRefresh?(): void;
  };
  from(table: 'accounts'): { select(columns: string): { eq(column: string,value: string): { maybeSingle(): Promise<Result<{ profile_completed_at: string | null } | null>> } } };
};
export type AuthState = 'checking' | 'signed_out' | 'authenticating' | 'account_provision_error' | 'needs_profile' | 'ready_to_browse';
export type Notice = 'cancelled' | 'offline' | 'failed' | 'provider_failed' | 'unavailable' | null;
type Value = { state: AuthState; canRetry: boolean; notice: Notice; signIn(p: ProviderName): Promise<void>; retry(): Promise<void> };
const Context = createContext<Value | null>(null);
const exchangesInFlight = new WeakMap<AuthClient, number>();
const exchangeBlocked = (client: AuthClient) => !!exchangesInFlight.get(client) || pendingCompensations.has(client);
const settlementListeners = new WeakMap<AuthClient, Set<() => void>>();
const queues = new WeakMap<AuthClient, Promise<unknown>>();
async function localClear(client: AuthClient) {
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* Verify storage even when transport throws. */ }
  for (const suffix of ['', '-user', '-code-verifier', '-flows-code-verifier']) {
    const key = client.sessionStorageKey + suffix;
    // removeItem also prunes orphan chunks when the manifest is already absent.
    await client.sessionStorage.removeItem(key);
    if (await client.sessionStorage.getItem(key) !== null) throw Error('Session cleanup failed');
  }
}
type Saved = { key: string; value: string | null }[];
const pendingCompensations = new WeakMap<AuthClient, { token: string; saved: Saved }>();
async function compensate(client: AuthClient, token: string, saved: Saved) {
  pendingCompensations.set(client, { token, saved });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const persisted = await client.sessionStorage.getItem(client.sessionStorageKey);
      // Persisted newer credentials always veto cleanup, even if the SDK is stale.
      const storedToken = persisted === null ? null : (JSON.parse(persisted) as Session).access_token;
      if (storedToken && storedToken !== token) { pendingCompensations.delete(client); return false; }
      let sdkToken: string | undefined;
      try { const current = await client.auth.getSession(); if (!current.error) sdkToken = current.data.session?.access_token; } catch { /* Storage is an independent authority for compensation. */ }
      // The SDK read may itself refresh or observe a concurrently installed session.
      const latestPersisted = await client.sessionStorage.getItem(client.sessionStorageKey);
      if (latestPersisted !== persisted) continue;
      if (storedToken !== token && sdkToken && sdkToken !== token) { pendingCompensations.delete(client); return false; }
      if (storedToken === token || sdkToken === token || persisted === null) {
        await localClear(client);
        for (const { key, value } of saved) if (value !== null) await client.sessionStorage.setItem(key, value);
        pendingCompensations.delete(client);
        return true;
      }
      pendingCompensations.delete(client);
      return false;
    } catch { /* Keep the marker until a subsequent mount or exchange can recover. */ }
  }
  throw Error('Pending session cleanup');
}
async function recoverCompensation(client: AuthClient) {
  const pending = pendingCompensations.get(client);
  return pending ? compensate(client, pending.token, pending.saved) : false;
}
async function recoverBeforeMount(client: AuthClient) {
  if (!pendingCompensations.has(client)) return false;
  const previous = queues.get(client) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(() => recoverCompensation(client));
  queues.set(client, task);
  return task;
}
async function exchange(client: AuthClient, result: ProviderResult, active: () => boolean) {
  exchangesInFlight.set(client, (exchangesInFlight.get(client) ?? 0) + 1);
  const previous = queues.get(client) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    await recoverCompensation(client);
    if (!active()) return null;
    const before = await client.auth.getSession();
    // This entry point only creates sessions from signed_out. Never overwrite a live session.
    if (before.error || before.data.session || !active()) return null;
    const saved = await Promise.all(['', '-user', '-code-verifier', '-flows-code-verifier'].map(async suffix => { const key = client.sessionStorageKey + suffix; return { key, value: await client.sessionStorage.getItem(key) }; }));
    if (!active()) return null;
    const response = await client.auth.signInWithIdToken({ provider: 'google', token: result.idToken, nonce: result.nonce }).catch((error: Failure) => {
      throw { code: temporary(error) ? 'offline' : 'failed' };
    });
    if (!active() && response.data.session) {
      await compensate(client, response.data.session.access_token, saved);
      return null;
    }
    if (response.error) throw { code: temporary(response.error) ? 'offline' : 'failed' };
    if (!response.data.session) throw { code: 'failed' };
    return response.data.session;
  }).finally(() => { exchangesInFlight.set(client, (exchangesInFlight.get(client) ?? 1) - 1); settlementListeners.get(client)?.forEach(notify => notify()); });
  queues.set(client, task);
  return task;
}
const temporary = (e: Failure) => !e.status || e.status >= 500;
export function AuthProvider({ client, providers, installGuard, timeoutMs = 15000, children }: React.PropsWithChildren<{ client: AuthClient; providers: ProviderHandlers; installGuard: InstallGuard; timeoutMs?: number }>) {
  const [snapshot, setSnapshot] = useState<{ state: AuthState; notice: Notice }>({ state: 'checking', notice: null });
  const controller = useRef<{ signIn(p: ProviderName): Promise<void>; retry(): Promise<void> } | null>(null);
  useEffect(() => {
    let mounted = true, revision = 0, busy = false, terminating = false, initialized = false, ended = false;
    let currentState: AuthState = 'checking';
    let cleanupRequired = false, terminationDeferred = false, deriveDeferred = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (state: AuthState, notice: Notice = null) => { if (mounted) { currentState = state; setSnapshot(previous => previous.state === state && previous.notice === notice ? previous : { state, notice }); } };
    const begin = (fallback: AuthState | (() => AuthState), notice: () => Notice = () => 'failed') => {
      const id = ++revision;
      clearTimeout(timer);
      timer = setTimeout(() => { if (mounted && revision === id) { revision++; busy = false; update(typeof fallback === 'function' ? fallback() : fallback, notice()); } }, timeoutMs);
      return () => mounted && revision === id;
    };
    async function derive(silent = false, existingActive?: () => boolean) {
      const active = existingActive ?? begin('account_provision_error');
      if (!silent) update('checking');
      try {
        await recoverBeforeMount(client);
        if (!active()) return;
        const result = await client.auth.getSession();
        if (!active()) return;
        if (result.error) { update('account_provision_error', temporary(result.error) ? 'offline' : 'failed'); return; }
        if (!result.data.session) { update('signed_out'); return; }
        ended = false;
        const token = result.data.session.access_token;
        const row = await client.from('accounts').select('profile_completed_at').eq('user_id', result.data.session.user.id).maybeSingle();
        if (!active()) return;
        const latest = await client.auth.getSession();
        if (!active()) return;
        if (latest.error) { update('account_provision_error', 'offline'); return; }
        if (latest.data.session?.access_token !== token) { if (!latest.data.session) update('signed_out'); else await derive(silent, active); return; }
        update(row.error || !row.data ? 'account_provision_error' : row.data.profile_completed_at ? 'ready_to_browse' : 'needs_profile', row.error ? (temporary(row.error) ? 'offline' : 'failed') : null);
      } catch { if (active()) update('account_provision_error', 'offline'); }
      finally { if (active()) clearTimeout(timer); }
    }
    async function termination() {
      if (exchangeBlocked(client) || busy || !initialized) { terminationDeferred = true; return; }
      if (!mounted || terminating || ended) return;
      terminating = true;
      try {
        const result = await client.auth.getSession();
        if (!mounted) return;
        if (result.error) {
          if (result.error.name === 'AuthRefreshDiscardedError') return;
          if (temporary(result.error)) { setSnapshot(s => ({ ...s, notice: 'offline' })); return; }
        }
        if (result.data.session) return;
        revision++; clearTimeout(timer);
        await localClear(client);
        ended = true;
        update('signed_out');
      } catch { if (mounted) setSnapshot(s => ({ ...s, notice: 'offline' })); }
      finally { terminating = false; }
    }
    async function flushDeferred() {
      if (!mounted || !initialized || busy || exchangeBlocked(client)) return;
      const terminate = terminationDeferred, rederive = deriveDeferred;
      terminationDeferred = false; deriveDeferred = false;
      if (terminate) await termination();
      if (rederive && mounted && !busy && !exchangeBlocked(client)) await derive(true);
    }
    const notify = () => { void Promise.resolve().then(flushDeferred); };
    const listeners = settlementListeners.get(client) ?? new Set<() => void>();
    listeners.add(notify); settlementListeners.set(client, listeners);
    const subscription = client.auth.onAuthStateChange(event => {
      // initialize() owns the initial session read. The SDK's subscription
      // snapshot is not a change to replay after that read has timed out.
      if (event === 'INITIAL_SESSION') return;
      // Defer SDK calls outside its synchronous event callback.
      if (event === 'SIGNED_OUT') {
        terminationDeferred = true;
      } else {
        deriveDeferred = true;
      }
      notify();
    }).data.subscription;
    const foreground = (state: string) => { if (state === 'active') client.auth.startAutoRefresh?.(); else client.auth.stopAutoRefresh?.(); };
    foreground(AppState.currentState ?? 'inactive');
    const appSubscription = AppState.addEventListener('change', foreground);
    controller.current = {
      retry: async () => {
        if (!mounted || busy) return;
        if (!initialized && cleanupRequired) await initialize();
        else {
          busy = true;
          try {
            // A timed-out exchange can still install credentials before compensation.
            await queues.get(client)?.catch(() => {});
            if (mounted) await derive();
          } finally { busy = false; }
        }
        await flushDeferred();
      },
      signIn: async provider => {
        if (!mounted || !initialized || busy || terminating || currentState !== 'signed_out') return;
        busy = true;
        const id = ++revision;
        let active = () => mounted && revision === id;
        update('authenticating');
        try {
          const result = await providers[provider]();
          if (!active()) return;
          if (!result.idToken?.trim()) throw Error('Empty provider token');
          let committed = false;
          active = begin(() => committed ? 'account_provision_error' : 'signed_out', () => committed ? 'failed' : 'provider_failed');
          committed = !!(await exchange(client, result, active));
          if (!active()) return;
          await derive(false, active);
        } catch (error) {
          if (!active()) return;
          const code = (error as { code?: string })?.code;
          update('signed_out', code === 'cancelled' ? 'cancelled' : code === 'unavailable' ? 'unavailable' : code === 'offline' ? 'offline' : 'provider_failed');
        } finally {
          // An abandoned attempt must not release a newer attempt's event guard.
          if (active()) { busy = false; clearTimeout(timer); }
          await flushDeferred();
        }
      },
    };
    async function initialize() {
      if (busy) return;
      busy = true;
      try {
        const recovered = await recoverBeforeMount(client);
        let fresh = true;
        try { fresh = await installGuard.isFreshInstall(); } catch { /* Fail toward sign-in. */ }
        if (!mounted) return;
        cleanupRequired = fresh;
        if (fresh) {
          await localClear(client);
          if (!mounted) return;
          await installGuard.markVerified?.();
        }
        if (!mounted) return;
        initialized = true;
        cleanupRequired = false;
        if (fresh || recovered) update('signed_out');
        else await derive();
      } catch { cleanupRequired = true; update(pendingCompensations.has(client) ? 'account_provision_error' : 'signed_out', 'failed'); }
      finally { busy = false; await flushDeferred(); }
    }
    void initialize();
    return () => { mounted = false; revision++; clearTimeout(timer); controller.current = null; listeners.delete(notify); subscription.unsubscribe(); appSubscription.remove(); client.auth.stopAutoRefresh?.(); };
  }, [client, providers, installGuard, timeoutMs]);
  return <Context.Provider value={{ ...snapshot, canRetry: snapshot.state === 'account_provision_error' || (snapshot.state === 'signed_out' && snapshot.notice === 'failed'), signIn: async p => { await controller.current?.signIn(p); }, retry: async () => { await controller.current?.retry(); } }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw Error('useAuth requires AuthProvider'); return value; }
