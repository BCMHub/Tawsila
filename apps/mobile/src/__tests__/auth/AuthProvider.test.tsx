import { useEffect } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, type Session } from '../../features/auth/AuthProvider';
import { fakeAuthClient } from '../helpers/fakeAuthClient';
const stored: Session = { access_token: 'fixture-session', user: { id: 'fixture' } };
const guard = { isFreshInstall: async () => false };
function deferred<T>() { let resolve!: (v:T)=>void; const promise = new Promise<T>(r => { resolve=r; }); return { promise, resolve }; }
let auth: ReturnType<typeof useAuth>;
function Probe() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return null; }
async function mount(fake = fakeAuthClient(), providers = { google: async () => ({ idToken: 'fixture-token', nonce: 'raw' }) }, installGuard: import('../../features/auth/AuthProvider').InstallGuard = guard, timeoutMs = 1000) {
  const view = await render(<AuthProvider client={fake.client} providers={providers} installGuard={installGuard} timeoutMs={timeoutMs}><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.state).not.toBe('checking'));
  return view;
}
describe('session authority', () => {
  it('cold start without a session requires sign-in', async () => { await mount(); expect(auth.state).toBe('signed_out'); });
  it.each([null, 'completed'])('derives profile state from own row %s', async completed => {
    const f = fakeAuthClient(stored);
    f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_completed_at: completed }, error: null }) }) }) });
    await mount(f); expect(auth.state).toBe(completed ? 'ready_to_browse' : 'needs_profile');
  });
  it('missing and failed account reads fail closed with retry', async () => {
    const f = fakeAuthClient(stored); f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { status: 503 } }) }) }) });
    await mount(f); expect(auth.state).toBe('account_provision_error'); expect(auth.canRetry).toBe(true); expect(auth.notice).toBe('offline'); expect(f.client.auth.signOut).not.toHaveBeenCalled();
  });
  it('two taps exchange once and forward the raw nonce', async () => {
    const f = fakeAuthClient(); await mount(f);
    await act(async () => { await Promise.all([auth.signIn('google'), auth.signIn('google')]); });
    expect(f.client.auth.signInWithIdToken).toHaveBeenCalledTimes(1);
    expect(f.values.size).toBe(1);
    expect(f.client.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'fixture-token', nonce: 'raw' }); expect(auth.state).toBe('needs_profile');
  });
  it.each(['cancelled', 'denied', 'unavailable', 'unexpected'])('provider rejection %s leaves no session', async code => {
    const f = fakeAuthClient(); await mount(f, { google: async () => { throw { code }; } }); await act(async () => { await auth.signIn('google'); });
    expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe(code === 'cancelled' ? null : code === 'unavailable' ? 'unavailable' : 'provider_failed'); expect(f.values.size).toBe(0);
  });
  it('empty and malformed tokens cannot open protected state', async () => {
    const f = fakeAuthClient(); await mount(f, { google: async () => ({ idToken: '', nonce: 'raw' }) }); await act(async () => { await auth.signIn('google'); }); expect(auth.notice).toBe('provider_failed');
    f.client.auth.signInWithIdToken = jest.fn(async () => ({ data: { session: null }, error: Error('invalid') }));
    await mount(f); await act(async () => { await auth.signIn('google'); }); expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe('provider_failed');
  });
  it('stale termination is ignored; genuine termination uses local scope once', async () => {
    const f = fakeAuthClient(stored); await mount(f); await act(async () => f.emit('SIGNED_OUT')); expect(auth.state).toBe('needs_profile');
    f.setSession(null); await act(async () => { f.emit('SIGNED_OUT'); f.emit('SIGNED_OUT'); }); await waitFor(() => expect(auth.state).toBe('signed_out')); expect(f.client.auth.signOut).toHaveBeenCalledTimes(1); expect(f.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('expired offline session on fresh install is forcibly removed', async () => {
    const f = fakeAuthClient(stored); f.client.auth.signOut = jest.fn(async () => ({ error: Error('offline') }));
    await mount(f, undefined, { isFreshInstall: async () => true }); expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0); expect(f.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('unmount before provider answer starts no exchange', async () => {
    const d = deferred<{idToken:string;nonce:string}>(); const f = fakeAuthClient(); const v = await mount(f, { google: () => d.promise });
    let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); }); await v.unmount(); d.resolve({ idToken: 'fixture', nonce: 'raw' }); await pending; expect(f.client.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
  it('exchange finishing after unmount is compensated without an account read', async () => {
    const f = fakeAuthClient(); const d = deferred<void>(); const original = f.client.auth.signInWithIdToken;
    f.client.auth.signInWithIdToken = async input => { await d.promise; return original(input); };
    const read = jest.fn(f.client.from); f.client.from = read;
    const v = await mount(f); let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); }); await v.unmount(); d.resolve(); await pending;
    expect(f.values.size).toBe(0); expect((await f.client.auth.getSession()).data.session).toBeNull(); expect(read).not.toHaveBeenCalled();
  });
  it.each(['AuthRefreshDiscardedError', 'NetworkError', 'ServerError'])('temporary session read %s clears nothing', async name => {
    const f = fakeAuthClient(stored); await mount(f);
    f.client.auth.getSession = async () => ({ data: { session: null }, error: { name, ...(name === 'ServerError' ? { status: 503 } : {}) } });
    await act(async () => { f.emit('SIGNED_OUT'); });
    expect(auth.state).toBe('needs_profile'); expect(f.client.auth.signOut).not.toHaveBeenCalled(); expect(f.values.size).toBe(1);
    expect(auth.notice).toBe(name === 'AuthRefreshDiscardedError' ? null : 'offline');
  });
  it('guard failure requires sign-in while a normal update preserves the session', async () => {
    const f = fakeAuthClient(stored); const v = await mount(f); expect(f.client.auth.signOut).not.toHaveBeenCalled(); await v.unmount();
    await mount(f, undefined, { isFreshInstall: async () => { throw Error('read'); } }); expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0);
  });
  it('slow account read stays checking and a timed-out answer cannot open protected state', async () => {
    const f = fakeAuthClient(stored); const row = deferred<{data:{profile_completed_at:string};error:null}>();
    f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: () => row.promise }) }) });
    const v = await render(<AuthProvider client={f.client} providers={{ google: async () => ({idToken:'fixture'}) }} installGuard={guard} timeoutMs={30}><Probe /></AuthProvider>);
    expect(auth.state).toBe('checking'); await waitFor(() => expect(auth.state).toBe('account_provision_error'));
    await act(async () => row.resolve({data:{profile_completed_at:'complete'},error:null})); expect(auth.state).toBe('account_provision_error'); expect(f.client.auth.signOut).not.toHaveBeenCalled(); await v.unmount();
  });
  it('a later tree waits for abandoned exchange compensation before creating its session', async () => {
    const f = fakeAuthClient(); const d = deferred<void>(); const original = f.client.auth.signInWithIdToken; let calls = 0;
    f.client.auth.signInWithIdToken = async input => { calls++; if (calls === 1) await d.promise; return original(input); };
    const v = await mount(f); let first!:Promise<void>; await act(async () => { first=auth.signIn('google'); }); await v.unmount();
    await mount(f); let second!:Promise<void>; await act(async () => { second=auth.signIn('google'); }); expect(calls).toBe(1);
    await act(async () => { d.resolve(); await first; await second; }); expect(calls).toBe(2); expect(auth.state).toBe('needs_profile'); expect(f.values.size).toBe(1);
  });
  it('provider event alone cannot bypass an own-row read', async () => {
    const f = fakeAuthClient(); await mount(f); await act(async () => f.emit('SIGNED_IN')); expect(auth.state).toBe('signed_out');
  });

  it('a revoked current session is terminated locally exactly once', async () => {
    const f = fakeAuthClient(stored); await mount(f);
    f.client.auth.getSession = async () => ({ data: { session: null }, error: {status: 401, name:'AuthApiError'} });
    await act(async () => f.emit('SIGNED_OUT')); await waitFor(() => expect(auth.state).toBe('signed_out'));
    await act(async () => f.emit('SIGNED_OUT')); expect(f.client.auth.signOut).toHaveBeenCalledTimes(1); expect(f.values.size).toBe(0);
  });

});

describe('repair regressions', () => {
  it.each(['read-error', 'retry-clear', 'persistent-clear', 'newer-session', 'persistent-newer', 'newer-during-read'])('abandoned compensation: %s', async mode => {
    const f = fakeAuthClient(); const gate = deferred<void>(); const original = f.client.auth.signInWithIdToken;
    f.client.auth.signInWithIdToken = async input => { await gate.promise; const result = await original(input);
      if (mode === 'newer-during-read') f.client.auth.getSession = async () => {f.setSession(stored); f.values.set(f.client.sessionStorageKey, JSON.stringify(stored)); return {data:{session:stored},error:null};};
      if (mode === 'read-error') f.client.auth.getSession = async () => ({ data: { session: null }, error: { status: 503 } });
      if (mode === 'newer-session') { f.setSession(stored); f.values.set(f.client.sessionStorageKey, JSON.stringify(stored)); }
      return result;
    };
    const clear = f.client.auth.signOut; let attempts = 0;
    if (mode.includes('clear') || mode === 'persistent-newer') {
      f.client.auth.signOut = jest.fn(async (input: { scope: 'local' }) => { attempts++; if (mode.startsWith('persistent-') || attempts === 1) throw Error('clear'); return clear(input); });
      f.client.sessionStorage.removeItem = async key => { if (mode.startsWith('persistent-') || attempts === 1) throw Error('storage'); f.values.delete(key); };
    }
    const view = await mount(f); let pending!: Promise<void>;
    await act(async () => { pending = auth.signIn('google'); }); await view.unmount(); gate.resolve(); await pending;
    if (mode === 'newer-session' || mode === 'newer-during-read') { expect(f.values.get(f.client.sessionStorageKey)).toBe(JSON.stringify(stored)); expect(clear).not.toHaveBeenCalled(); return; }
    if (mode.startsWith('persistent-')) {
      expect(attempts).toBe(3);
      f.client.auth.signOut = clear; f.client.sessionStorage.removeItem = async key => { f.values.delete(key); };
      const read = jest.fn(f.client.from); f.client.from = read;
      if (mode === 'persistent-newer') {f.setSession(stored); f.values.delete(f.client.sessionStorageKey);}
      await mount(f);
      if (mode === 'persistent-newer') {expect(clear).not.toHaveBeenCalled(); expect(auth.state).toBe('needs_profile'); return;}
      expect(auth.state).toBe('signed_out'); expect(read).not.toHaveBeenCalled();
    }
    expect(f.values.size).toBe(0);
  });
  it('provider sheet can outlive timeout', async () => {
    const f = fakeAuthClient(); const provider = deferred<{idToken:string;nonce:string}>(); await mount(f, {google: () => provider.promise}); jest.useFakeTimers();
    try { let pending!:Promise<void>; await act(async () => {pending = auth.signIn('google');});
      await act(async () => {jest.advanceTimersByTime(2000);}); expect(auth.state).toBe('authenticating');
      await act(async () => {provider.resolve({idToken:'fixture',nonce:'raw'}); await pending;}); expect(auth.state).toBe('needs_profile');
    } finally {jest.useRealTimers();}
  });
  it.each(['TOKEN_REFRESHED', 'SIGNED_IN'])('%s keeps resolved state during re-derive', async event => {
    const f = fakeAuthClient(stored); let missing = false; const gate = deferred<void>();
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => {if (missing) await gate.promise; return {data: missing ? null : {profile_completed_at:'complete'}, error:null};}})})});
    await mount(f); missing = true; await act(async () => f.emit(event)); expect(auth.state).toBe('ready_to_browse');
    await act(async () => gate.resolve()); expect(auth.state).toBe('account_provision_error');
  });
  it.each(['clear', 'marker'])('fresh install retries failed %s', async failure => {
    const f = fakeAuthClient(stored); const remove = f.client.sessionStorage.removeItem; let fail = true;
    f.client.auth.signOut = jest.fn(async () => ({error:Error('offline')}));
    f.client.sessionStorage.removeItem = async key => {if (fail && failure === 'clear') throw Error('clear'); await remove(key);};
    const markVerified = jest.fn(async () => {if (fail && failure === 'marker') throw Error('marker');});
    await mount(f, undefined, {isFreshInstall:async () => true, markVerified});
    expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe('failed'); expect(auth.canRetry).toBe(true);
    await act(async () => auth.signIn('google')); expect(f.client.auth.signInWithIdToken).not.toHaveBeenCalled();
    fail = false; await act(async () => auth.retry()); expect(f.values.size).toBe(0); expect(markVerified).toHaveBeenCalled();
    f.setSession(null); await act(async () => auth.signIn('google')); expect(auth.state).toBe('needs_profile');
  });
});

describe('post-provider bounds and event snapshots', () => {
  it.each(['exchange', 'row'])('abandons a slow %s after provider completion', async phase => {
    const f = fakeAuthClient(); const gate = deferred<void>(); const original = f.client.auth.signInWithIdToken;
    f.client.auth.signInWithIdToken = async input => {if (phase === 'exchange') await gate.promise; return original(input);};
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => {await gate.promise; return {data:{profile_completed_at:'complete'},error:null};}})})});
    await mount(f); jest.useFakeTimers();
    try {let pending!:Promise<void>; await act(async () => {pending = auth.signIn('google');});
      await act(async () => {jest.advanceTimersByTime(1001);}); expect(auth.state).toBe('signed_out');
      await act(async () => {gate.resolve(); await pending;}); expect(auth.state).toBe('signed_out');
      if (phase === 'exchange') expect(f.values.size).toBe(0);
    } finally {jest.useRealTimers();}
  });
  it('exchange and row share one timeout budget', async () => {
    const f = fakeAuthClient(); const a = deferred<void>(); const b = deferred<void>(); const original = f.client.auth.signInWithIdToken;
    f.client.auth.signInWithIdToken = async input => {await a.promise; return original(input);};
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => {await b.promise; return {data:{profile_completed_at:'complete'},error:null};}})})});
    await mount(f); jest.useFakeTimers();
    try {let pending!:Promise<void>; await act(async () => {pending = auth.signIn('google');});
      await act(async () => {jest.advanceTimersByTime(600); a.resolve();});
      await act(async () => {jest.advanceTimersByTime(401);}); expect(auth.state).toBe('signed_out');
      await act(async () => {b.resolve(); await pending;}); expect(auth.state).toBe('signed_out');
    } finally {jest.useRealTimers();}
  });
  it.each(['TOKEN_REFRESHED', 'SIGNED_IN'])('%s emits no checking or duplicate snapshot', async event => {
    const f = fakeAuthClient(stored); const states:string[] = [];
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data:{profile_completed_at:'complete'},error:null})})})});
    function Watch() {const value = useAuth(); useEffect(() => {states.push(value.state);}, [value]); return null;}
    await render(<AuthProvider client={f.client} providers={{google:async () => ({idToken:'fixture'})}} installGuard={guard}><Watch /></AuthProvider>);
    await waitFor(() => expect(states.at(-1)).toBe('ready_to_browse')); states.length = 0;
    await act(async () => f.emit(event)); expect(states).toEqual([]);
  });
  it('own-row network failure shows offline without signing out', async () => {
    const f = fakeAuthClient(stored);
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => {throw Error('network');}})})});
    await mount(f); expect(auth.state).toBe('account_provision_error'); expect(auth.notice).toBe('offline'); expect(f.client.auth.signOut).not.toHaveBeenCalled();
  });
});

it('next exchange recovers pending compensation before creating a session', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>();
  const original = f.client.auth.signInWithIdToken; const clear = f.client.auth.signOut;
  let blocked = true; let calls = 0;
  f.client.auth.signInWithIdToken = async input => {calls++; if (calls === 1) await gate.promise; return original(input);};
  f.client.auth.signOut = async input => {if (blocked) throw Error('clear'); return clear(input);};
  f.client.sessionStorage.removeItem = async key => {if (blocked) throw Error('storage'); f.values.delete(key);};
  await mount(f); jest.useFakeTimers();
  try {
    let first!:Promise<void>; await act(async () => {first = auth.signIn('google');});
    await act(async () => {jest.advanceTimersByTime(1001); gate.resolve(); await first;});
    expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(1);
    blocked = false; await act(async () => auth.signIn('google'));
    expect(calls).toBe(2); expect(clear).toHaveBeenCalledTimes(1); expect(auth.state).toBe('needs_profile'); expect(f.values.size).toBe(1);
  } finally {jest.useRealTimers();}
});
