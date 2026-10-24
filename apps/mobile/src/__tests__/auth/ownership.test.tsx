import { useEffect } from 'react';
import { expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { AuthProvider, useAuth, type Session } from '../../features/auth/AuthProvider';
import { fakeAuthClient } from '../helpers/fakeAuthClient';
const session: Session = { access_token: 'fixture', user: { id: 'fixture' } };
const guard = { isFreshInstall: async () => false };
let auth: ReturnType<typeof useAuth>;
function Probe() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return null; }
function gate() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
const drain = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
async function mount(f: ReturnType<typeof fakeAuthClient>) {
  return render(<AuthProvider client={f.client} providers={{ google: async () => ({ idToken: 'fixture' }) }} installGuard={guard} timeoutMs={20}><Probe /></AuthProvider>);
}
it('retry during termination cannot strand busy or swallow future events', async () => {
  const f = fakeAuthClient(session);
  f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { status: 503 } }) }) }) });
  const view = await mount(f);
  const held = gate(), retryRead = gate(); const read = f.client.auth.getSession; let calls = 0;
  f.client.auth.getSession = jest.fn(async () => { const result = await read(); const n = ++calls; if (n === 1) await held.promise; if (n === 2) await retryRead.promise; return result; });
  f.setSession(null);
  await act(async () => { f.emit('SIGNED_OUT'); await drain(); });
  await act(async () => { void auth.retry(); await drain(); held.resolve(); await drain(); retryRead.resolve(); await drain(); });
  expect(auth.state).toBe('signed_out');
  expect(f.client.auth.signOut).toHaveBeenCalledTimes(1);
  expect(f.values.size).toBe(0);
  await act(async () => { await auth.signIn('google'); });
  expect(f.client.auth.signInWithIdToken).toHaveBeenCalledTimes(1);
  const before = calls;
  await act(async () => { f.emit('TOKEN_REFRESHED'); await drain(); });
  expect(calls).toBeGreaterThan(before);
  await view.unmount();
});
it('committed exchange resets termination deduplication before its derive times out', async () => {
  jest.useFakeTimers();
  try {
    const f = fakeAuthClient(session); const view = await mount(f);
    f.setSession(null); await act(async () => { f.emit('SIGNED_OUT'); await drain(); });
    const held = gate(); const read = f.client.auth.getSession; let calls = 0;
    f.client.auth.getSession = async () => { const result = await read(); if (++calls === 2) await held.promise; return result; };
    let pending!: Promise<void>;
    await act(async () => { pending = auth.signIn('google'); await drain(); jest.advanceTimersByTime(21); });
    await act(async () => { held.resolve(); await pending; });
    f.setSession(null); f.values.set(f.client.sessionStorageKey + '-user', 'residue');
    await act(async () => { f.emit('SIGNED_OUT'); await drain(); });
    expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0);
    expect(f.client.auth.signOut).toHaveBeenCalledTimes(2);
    await view.unmount();
  } finally { jest.useRealTimers(); }
});
it('late initialize cannot release a newer retry guard', async () => {
  jest.useFakeTimers();
  try {
    const f = fakeAuthClient(session); const first = gate(), second = gate(); let rows = 0;
    f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { if (++rows === 1) await first.promise; else await second.promise; return { data: null, error: { status: 503 } }; } }) }) });
    const view = await mount(f);
    await act(async () => { await drain(); jest.advanceTimersByTime(21); });
    let pending!: Promise<void>;
    await act(async () => { pending = auth.retry(); await drain(); first.resolve(); await drain(); });
    const before = jest.mocked(f.client.auth.getSession).mock.calls.length;
    await act(async () => { f.emit('TOKEN_REFRESHED'); await drain(); });
    expect(jest.mocked(f.client.auth.getSession).mock.calls.length).toBe(before);
    await act(async () => { second.resolve(); await pending; }); await view.unmount();
  } finally { jest.useRealTimers(); }
});

it('seeded interleavings preserve ownership, session authority, cleanup and late-answer isolation', async () => {
  jest.useFakeTimers();
  try {
    for (let seed = 1; seed <= 250; seed++) {
      let rng = seed;
      const random = (n: number) => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng % n; };
      const f = fakeAuthClient(seed % 2 ? session : null);
      let chaotic = true, deadline = 0, serial = 0;
      const legitimate = new Set([session.access_token]);
      const trace: unknown[] = [];
      const pending: Promise<void>[] = [];
      const gates: (() => void)[] = [];
      const delay = async () => {
        if (!chaotic) return;
        const choice = random(8);
        if (choice === 0) throw Error('synthetic offline');
        if (choice < 4) {
          const held = gate(); gates.push(held.resolve);
          setTimeout(held.resolve, choice === 1 ? 30 : random(12));
          await held.promise;
        }
      };
      const read = f.client.auth.getSession;
      f.client.auth.getSession = async () => { const snapshot = await read(); trace.push(['read', Date.now(), snapshot.data.session?.access_token]); await delay(); trace.push(['answer', Date.now(), snapshot.data.session?.access_token]); return snapshot; };
      f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
        await delay(); return { data: { profile_completed_at: random(2) ? null : 'complete' }, error: null };
      } }) }) });
      f.client.auth.signInWithIdToken = jest.fn(async () => {
        await delay();
        const installed = { access_token: `seed-${seed}-${++serial}`, user: { id: 'fixture' } };
        f.setSession(installed); f.values.set(f.client.sessionStorageKey, JSON.stringify(installed));
        if (Date.now() < deadline) legitimate.add(installed.access_token);
        f.emit('SIGNED_IN');
        return { data: { session: installed }, error: null };
      });
      const clear = f.client.auth.signOut;
      f.client.auth.signOut = jest.fn(async (input: { scope: 'local' }) => { await delay(); const result = await clear(input); f.emit('SIGNED_OUT'); return result; });
      const view = await render(<AuthProvider client={f.client} providers={{ google: async () => {
        await delay(); deadline = Date.now() + 20; return { idToken: 'fixture' };
      } }} installGuard={guard} timeoutMs={20}><Probe /></AuthProvider>);
      try {
        for (let step = 0; step < 28; step++) {
          await act(async () => {
            const action = random(8); trace.push([step, Date.now(), action, auth.state]);
            switch (action) {
              case 0: pending.push(auth.signIn('google')); break;
              case 1: pending.push(auth.retry()); break;
              case 2: f.emit('INITIAL_SESSION'); break;
              case 3: f.emit('SIGNED_IN'); break;
              case 4: f.emit('TOKEN_REFRESHED'); break;
              case 5: f.setSession(null); f.values.set(f.client.sessionStorageKey + '-user', 'residue'); f.emit('SIGNED_OUT'); break;
              case 6: gates.shift()?.(); break;
            }
            await drain(); jest.advanceTimersByTime(random(15)); await drain();
          });
        }
        chaotic = false;
        await act(async () => {
          for (let i = 0; i < 8; i++) { gates.splice(0).forEach(resolve => resolve()); jest.advanceTimersByTime(40); await drain(); }
          await Promise.all(pending);
        });
        if (auth.state === 'needs_profile' || auth.state === 'ready_to_browse') {
          const live = (await read()).data.session;
          // An offline termination intentionally preserves the last resolved view.
          if (live) expect(legitimate.has(live.access_token)).toBe(true);
          else expect(auth.notice).toBe('offline');
        }
        // A genuine revocation after quiescence must verify-clear residual storage.
        const clears = jest.mocked(f.client.auth.signOut).mock.calls.length;
        f.setSession(null); f.values.set(f.client.sessionStorageKey + '-user', 'residue');
        await act(async () => { f.emit('SIGNED_OUT'); await drain(); });
        expect(auth.state).toBe('signed_out'); expect(f.values.size).toBe(0);
        expect(jest.mocked(f.client.auth.signOut).mock.calls.length).toBeGreaterThan(clears);
        // A subsequent operation proves the guard was released.
        await act(async () => { await auth.signIn('google'); });
        expect(auth.state === 'needs_profile' || auth.state === 'ready_to_browse').toBe(true);
        if (auth.state === 'needs_profile' || auth.state === 'ready_to_browse') {
          const live = (await read()).data.session;
          expect(live).not.toBeNull(); expect(legitimate.has(live!.access_token)).toBe(true);
        }
        // Isolate an abandoned derive: no further events can justify its late result.
        const late = gate();
        f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { await late.promise; return { data: { profile_completed_at: 'complete' }, error: null }; } }) }) });
        let retry!: Promise<void>;
        await act(async () => { retry = auth.retry(); await drain(); jest.advanceTimersByTime(21); });
        expect(auth.canRetry).toBe(true); const state = auth.state, notice = auth.notice;
        await act(async () => { late.resolve(); await retry; });
        expect(auth.state).toBe(state); expect(auth.notice).toBe(notice);
        f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_completed_at: null }, error: null }) }) }) });
        await act(async () => { await auth.retry(); }); expect(auth.state).toBe('needs_profile');
      } catch (error) { throw new Error(`Interleaving seed ${seed}: ${String(error)} trace=${JSON.stringify(trace)}`); }
      finally { await view.unmount(); jest.clearAllTimers(); }
    }
  } finally { jest.useRealTimers(); }
});
