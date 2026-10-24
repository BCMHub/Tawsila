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
    expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe(code === 'cancelled' ? 'cancelled' : code === 'unavailable' ? 'unavailable' : 'provider_failed'); expect(f.values.size).toBe(0);
  });
  it('empty and malformed tokens cannot open protected state', async () => {
    const f = fakeAuthClient(); await mount(f, { google: async () => ({ idToken: '', nonce: 'raw' }) }); await act(async () => { await auth.signIn('google'); }); expect(auth.notice).toBe('provider_failed');
    f.client.auth.signInWithIdToken = jest.fn(async () => ({ data: { session: null }, error: { status: 400, message: 'invalid' } }));
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
  it('INITIAL_SESSION cannot replay a late row answer after the startup timeout', async () => {
    const f = fakeAuthClient(stored);
    const row = deferred<{ data: { profile_completed_at: null }; error: null }>();
    const entered = deferred<void>();
    const credentials = [...f.values.entries()];
    let reads = 0;
    f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      reads++; entered.resolve(); return row.promise;
    } }) }) });
    const view = await render(<AuthProvider client={f.client} providers={{ google: async () => ({ idToken: 'fixture' }) }} installGuard={guard} timeoutMs={30}><Probe /></AuthProvider>);
    await act(async () => {
      await entered.promise;
      // The real SDK emits this subscription snapshot during initialization.
      f.emit('INITIAL_SESSION');
    });
    await waitFor(() => expect(auth.state).toBe('account_provision_error'));
    await act(async () => { row.resolve({ data: { profile_completed_at: null }, error: null }); });
    expect(auth.state).toBe('account_provision_error');
    expect(auth.canRetry).toBe(true);
    expect([...f.values.entries()]).toEqual(credentials);
    expect((await f.client.auth.getSession()).data.session).toEqual(stored);
    expect(reads).toBe(1);
    await view.unmount();
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
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => {await gate.promise; return {data:{profile_completed_at:null},error:null};}})})});
    await mount(f); jest.useFakeTimers();
    try {let pending!:Promise<void>; await act(async () => {pending = auth.signIn('google');});
      await act(async () => {jest.advanceTimersByTime(1001);}); expect(auth.state).toBe(phase === 'row' ? 'account_provision_error' : 'signed_out');
      await act(async () => {gate.resolve(); await pending;}); expect(auth.state).toBe(phase === 'row' ? 'account_provision_error' : 'signed_out');
      if (phase === 'row') { expect(auth.canRetry).toBe(true); expect(f.values.size).toBe(1); await act(async () => auth.retry()); expect(auth.state).toBe('needs_profile'); }
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
      await act(async () => {jest.advanceTimersByTime(401);}); expect(auth.state).toBe('account_provision_error');
      await act(async () => {b.resolve(); await pending;}); expect(auth.state).toBe('account_provision_error');
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

it.each([undefined, 503, 400])('exchange failure status %s preserves network classification', async status => {
  const f = fakeAuthClient(); f.client.auth.signInWithIdToken = async () => ({data:{session:null},error:{status}});
  await mount(f); await act(async () => auth.signIn('google'));
  expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe(status === 400 ? 'provider_failed' : 'offline');
});
it('late abandoned SIGNED_IN never opens protected state', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>(); const clearGate = deferred<void>();
  const original = f.client.auth.signInWithIdToken; const clear = f.client.auth.signOut;
  f.client.auth.signInWithIdToken = async input => {await gate.promise; const result = await original(input); f.emit('SIGNED_IN'); return result;};
  f.client.auth.signOut = async input => {await clearGate.promise; return clear(input);};
  const states: string[] = [];
  function Watch() {const value = useAuth(); useEffect(() => {states.push(value.state);}, [value]); return <Probe />;}
  await render(<AuthProvider client={f.client} providers={{google:async () => ({idToken:'fixture'})}} installGuard={guard} timeoutMs={20}><Watch /></AuthProvider>);
  await waitFor(() => expect(auth.state).toBe('signed_out'));
  let pending!:Promise<void>; await act(async () => {pending = auth.signIn('google');});
  await waitFor(() => expect(auth.notice).toBe('provider_failed'));
  await act(async () => gate.resolve());
  expect(states).not.toContain('needs_profile'); expect(states).not.toContain('ready_to_browse');
  await act(async () => {clearGate.resolve(); await pending;});
  expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0);
});

it('retry refuses an abandoned session until compensation succeeds', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>(); const original = f.client.auth.signInWithIdToken;
  let blocked = true;
  f.client.auth.signInWithIdToken = async input => { await gate.promise; return original(input); };
  const clear = f.client.auth.signOut;
  f.client.auth.signOut = async input => { if (blocked) throw Error('Keychain'); return clear(input); };
  f.client.sessionStorage.removeItem = async key => { if (blocked) throw Error('Keychain'); f.values.delete(key); };
  await mount(f); jest.useFakeTimers();
  try {
    let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); });
    await act(async () => { jest.advanceTimersByTime(1001); gate.resolve(); await pending; });
    await act(async () => { f.emit('SIGNED_OUT'); f.emit('TOKEN_REFRESHED'); await auth.retry(); });
    expect(auth.state).toBe('account_provision_error'); expect(auth.canRetry).toBe(true);
    blocked = false; await act(async () => auth.retry());
    expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0);
    await act(async () => auth.signIn('google')); expect(auth.state).toBe('needs_profile');
    const count = jest.mocked(clear).mock.calls.length;
    f.setSession(null); await act(async () => { f.emit('SIGNED_OUT'); f.emit('SIGNED_OUT'); });
    expect(auth.state).toBe('signed_out'); expect(clear).toHaveBeenCalledTimes(count + 1);
  } finally { jest.useRealTimers(); }
});
it('SIGNED_OUT during exchange is checked after settlement', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>();
  f.client.auth.signInWithIdToken = async () => { await gate.promise; return { data: { session: null }, error: null }; };
  await mount(f); let pending!: Promise<void>;
  await act(async () => { pending = auth.signIn('google'); });
  f.values.set(f.client.sessionStorageKey, JSON.stringify(stored));
  await act(async () => f.emit('SIGNED_OUT'));
  await act(async () => { gate.resolve(); await pending; });
  expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0); expect(f.client.auth.signOut).toHaveBeenCalledTimes(1);
});
it('uncommitted exchange timeout offers provider retry', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>(); const original = f.client.auth.signInWithIdToken;
  f.client.auth.signInWithIdToken = async input => { await gate.promise; return original(input); };
  await mount(f); jest.useFakeTimers();
  try {
    let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); });
    await act(async () => jest.advanceTimersByTime(1001));
    expect(auth.notice).toBe('provider_failed'); expect(auth.canRetry).toBe(false);
    await act(async () => { gate.resolve(); await pending; });
  } finally { jest.useRealTimers(); }
});

it('local clear sweeps first-use orphans and uses one verification read per key', async () => {
  const f = fakeAuthClient(); const data = new Map<string,string>(); let operations = 0;
  const { createSecureStorage } = await import('../../features/auth/secureStorage');
  const storage = createSecureStorage({
    getItemAsync: async key => { operations++; return data.get(key) ?? null; },
    setItemAsync: async (key,value) => { operations++; data.set(key,value); },
    deleteItemAsync: async key => { operations++; data.delete(key); },
  });
  f.client.sessionStorage = storage;
  for (const suffix of ['', '-user', '-code-verifier', '-flows-code-verifier']) data.set(`${f.client.sessionStorageKey}${suffix}.chunk.1.127`, 'orphan');
  const view = await mount(f, undefined, {isFreshInstall:async () => true});
  expect(data.size).toBe(0); expect(operations).toBe(4 * 258);
  await view.unmount(); operations = 0;
  await mount(f, undefined, {isFreshInstall:async () => true});
  expect(data.size).toBe(0); expect(operations).toBe(4 * 3);
});

it.each([false, true])('own SIGNED_IN causes one derive, including abandoned read: %s', async slow => {
  const f = fakeAuthClient(); const exchange = f.client.auth.signInWithIdToken;
  f.client.auth.signInWithIdToken = async input => { const result = await exchange(input); f.emit('SIGNED_IN'); return result; };
  const row = deferred<void>(); let reads = 0;
  f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => { reads++; if (slow && reads === 1) await row.promise; return {data:{profile_completed_at:null},error:null}; }})})});
  await mount(f); jest.useFakeTimers();
  try {
    let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); });
    if (slow) { await act(async () => jest.advanceTimersByTime(1001)); expect(auth.state).toBe('account_provision_error'); }
    await act(async () => { row.resolve(); await pending; });
    expect(auth.state).toBe(slow ? 'account_provision_error' : 'needs_profile'); expect(reads).toBe(1);
  } finally { jest.useRealTimers(); }
});
it('compensation SIGNED_OUT preserves the provider failure banner', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>(); const exchange = f.client.auth.signInWithIdToken; const clear = f.client.auth.signOut;
  f.client.auth.signInWithIdToken = async input => { await gate.promise; const result = await exchange(input); f.emit('SIGNED_IN'); return result; };
  f.client.auth.signOut = jest.fn(async () => { const result = await clear({scope:'local'}); f.emit('SIGNED_OUT'); return result; });
  await mount(f); jest.useFakeTimers();
  try {
    let pending!: Promise<void>; await act(async () => { pending = auth.signIn('google'); });
    await act(async () => jest.advanceTimersByTime(1001));
    await act(async () => { gate.resolve(); await pending; });
    expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe('provider_failed'); expect(f.client.auth.signOut).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
it('genuine SIGNED_OUT during stale termination is replayed and cleared once', async () => {
  const f = fakeAuthClient(stored); await mount(f); const gate = deferred<void>(); const read = f.client.auth.getSession; let hold = true;
  f.client.auth.getSession = async () => { const snapshot = await read(); if (hold) { hold = false; await gate.promise; } return snapshot; };
  await act(async () => f.emit('SIGNED_OUT'));
  f.setSession(null); await act(async () => f.emit('SIGNED_OUT'));
  await act(async () => gate.resolve());
  expect(auth.state).toBe('signed_out'); expect(f.client.auth.signOut).toHaveBeenCalledTimes(1); expect(f.values.size).toBe(0);
});
it('abandoned retry cannot release the newer retry event guard', async () => {
  const f = fakeAuthClient(stored); const first = deferred<void>(); const second = deferred<void>(); let reads = 0;
  f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => { const n = ++reads; if (n === 2) await first.promise; if (n >= 3) await second.promise; return {data:null,error:{status:503}}; }})})});
  await mount(f); jest.useFakeTimers();
  try {
    let r1!: Promise<void>, r2!: Promise<void>;
    await act(async () => { r1 = auth.retry(); }); await act(async () => jest.advanceTimersByTime(1001));
    await act(async () => { r2 = auth.retry(); });
    await act(async () => { first.resolve(); await r1; });
    const before = jest.mocked(f.client.auth.getSession).mock.calls.length;
    await act(async () => f.emit('TOKEN_REFRESHED'));
    expect(jest.mocked(f.client.auth.getSession).mock.calls.length).toBe(before);
    await act(async () => { second.resolve(); await r2; });
  } finally { jest.useRealTimers(); }
});
it('retry timeout includes waiting for a stalled exchange queue', async () => {
  const f = fakeAuthClient(); const gate = deferred<void>(); const exchange = f.client.auth.signInWithIdToken;
  f.client.auth.signInWithIdToken = async input => { await gate.promise; return exchange(input); };
  await mount(f); jest.useFakeTimers();
  try {
    let pending!: Promise<void>, retry!: Promise<void>;
    await act(async () => { pending = auth.signIn('google'); }); await act(async () => jest.advanceTimersByTime(1001));
    await act(async () => { retry = auth.retry(); }); await act(async () => jest.advanceTimersByTime(1001));
    expect(auth.state).toBe('account_provision_error'); expect(auth.canRetry).toBe(true);
    await act(async () => { gate.resolve(); await pending; await retry; });
  } finally { jest.useRealTimers(); }
});
