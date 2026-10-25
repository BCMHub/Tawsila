import { useEffect } from 'react';
import { expect, test, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, type Session } from '../../features/auth/AuthProvider';
import { fakeAuthClient } from '../helpers/fakeAuthClient';
const session: Session = { access_token: 'synthetic', user: { id: 'fixture' } };
const guard = { isFreshInstall: async () => false };
let auth: ReturnType<typeof useAuth>;
function Probe() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return null; }
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function setup(initial: Session | null = session, google = async () => ({ idToken: 'synthetic' })) {
 const f = fakeAuthClient(initial);
 let completed: string | null = null;
 let error: { status?: number } | null = null;
 let gate: Promise<void> | undefined;
 const read = jest.fn(async () => { await gate; return { data: { profile_completed_at: completed }, error }; });
 f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) });
 const view = await render(<AuthProvider client={f.client} providers={{ google }} installGuard={guard}><Probe /></AuthProvider>);
 await waitFor(() => expect(auth.state).not.toBe('checking'));
 return { f, view, read, complete: () => { completed = 'completed'; }, error: (e: typeof error) => { error = e; }, gate: (p: typeof gate) => { gate = p; } };
}
test('refresh confirms completion through the account read without auth writes', async () => {
 const s = await setup(); expect(auth.state).toBe('needs_profile'); s.complete();
 await act(async () => { await auth.refresh(); }); expect(auth.state).toBe('ready_to_browse');
 expect(s.f.client.auth.signInWithIdToken).not.toHaveBeenCalled(); expect(s.f.client.auth.signOut).not.toHaveBeenCalled();
});
test('incomplete account stays needs_profile', async () => { await setup(); await act(async () => { await auth.refresh(); }); expect(auth.state).toBe('needs_profile'); });
test.each([[503, 'offline'], [400, 'failed'], [undefined, 'offline']] as const)('read error %s fails closed with %s', async (status, notice) => {
 const s = await setup(); s.error({ status }); await act(async () => { await auth.refresh(); });
 expect(auth.state).toBe('account_provision_error'); expect(auth.notice).toBe(notice); expect(auth.canRetry).toBe(true);
 expect(s.f.client.auth.signOut).not.toHaveBeenCalled();
});
test('no session is a no-op', async () => { const s = await setup(null); const reads = jest.mocked(s.f.client.auth.getSession).mock.calls.length; await act(async () => { await auth.refresh(); }); expect(auth.state).toBe('signed_out'); expect(jest.mocked(s.f.client.auth.getSession)).toHaveBeenCalledTimes(reads); expect(s.read).not.toHaveBeenCalled(); });
test('refresh during provider sign-in is deferred', async () => {
 const d = deferred<{ idToken: string }>(); const s = await setup(null, () => d.promise);
 let signing!: Promise<void>; await act(async () => { signing = auth.signIn('google'); });
 await act(async () => { await auth.refresh(); }); expect(s.read).not.toHaveBeenCalled(); expect(auth.state).toBe('authenticating');
 s.complete(); await act(async () => { d.resolve({ idToken: 'synthetic' }); await signing; }); expect(auth.state).toBe('ready_to_browse'); expect(s.f.client.auth.signInWithIdToken).toHaveBeenCalledTimes(1);
});
test('refresh during termination waits for it to settle', async () => {
 const s = await setup(); const d = deferred<void>(); const original = s.f.client.auth.getSession;
 s.f.client.auth.getSession = async () => { await d.promise; return original(); };
 await act(async () => { s.f.emit('SIGNED_OUT'); });
 const count = s.read.mock.calls.length; s.complete(); await act(async () => { await auth.refresh(); }); expect(s.read).toHaveBeenCalledTimes(count);
 await act(async () => { d.resolve(); }); await waitFor(() => expect(auth.state).toBe('ready_to_browse'));
 expect(s.f.client.auth.signOut).not.toHaveBeenCalled();
});
test('refresh during genuine termination never restores the old session', async () => {
 const s = await setup(); const d = deferred<void>(); const original = s.f.client.auth.signOut;
 s.f.setSession(null); s.f.client.auth.signOut = async input => { await d.promise; return original(input); };
 await act(async () => { s.f.emit('SIGNED_OUT'); });
 await act(async () => { await auth.refresh(); }); expect(s.read).toHaveBeenCalledTimes(1);
 await act(async () => { d.resolve(); }); await waitFor(() => expect(auth.state).toBe('signed_out')); expect(s.read).toHaveBeenCalledTimes(1);
});
test('concurrent refresh requests coalesce without overlapping derives', async () => {
 const s = await setup(); const d = deferred<void>(); s.gate(d.promise);
 await act(async () => { void auth.refresh(); }); expect(s.read).toHaveBeenCalledTimes(2);
 await act(async () => { await auth.refresh(); await auth.refresh(); }); expect(s.read).toHaveBeenCalledTimes(2);
 s.complete(); await act(async () => { d.resolve(); }); await waitFor(() => expect(auth.state).toBe('ready_to_browse'));
 expect(s.read).toHaveBeenCalledTimes(3);
});
test('pending refresh and retained callback cannot update after unmount', async () => {
 const s = await setup(); const d = deferred<void>(); s.gate(d.promise); const refresh = auth.refresh;
 let pending!: Promise<void>; await act(async () => { pending = refresh(); }); await s.view.unmount(); const reads = s.read.mock.calls.length;
 s.complete(); d.resolve(); await pending; await refresh(); expect(s.read).toHaveBeenCalledTimes(reads);
});

test('deferred SIGNED_OUT is processed when a silent refresh times out', async () => {
 const s = await setup(); const d = deferred<void>(); s.gate(d.promise);
 jest.useFakeTimers();
 try {
  await act(async () => { void auth.refresh(); });
  expect(s.read).toHaveBeenCalledTimes(2);
  s.f.setSession(null);
  await act(async () => { s.f.emit('SIGNED_OUT'); });
  expect(auth.state).toBe('needs_profile');
  await act(async () => { await jest.advanceTimersByTimeAsync(15000); });
  expect(auth.state).toBe('signed_out');
  expect(s.f.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  await act(async () => { d.resolve(); });
  expect(auth.state).toBe('signed_out');
 } finally { jest.useRealTimers(); await s.view.unmount(); }
});
