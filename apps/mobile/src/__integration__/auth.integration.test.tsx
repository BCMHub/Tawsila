import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, expect, it } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { createClient, type Session, type AuthChangeEvent } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { createSecureStorage } from '../features/auth/secureStorage';
import { adaptAuthClient } from '../lib/supabase';
import { anonKey, serviceKey, url } from './environment';

const network = globalThis.fetch;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const ids: string[] = [];
const clients: {sdk: {auth: {stopAutoRefresh(): void}}; control: {intercept?: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>}}[] = [];
let email: string;
let password: string;
let exchangeToken: string;
function check(error: unknown) { if (error) { const e = error as {status?:number; name?:string; code?:string}; throw Error(`Local Supabase fixture operation failed: ${e.name}, status ${e.status}, code ${e.code} (response omitted)`); } }
function gate() { let release!: () => void; let entered!: () => void; return { wait: new Promise<void>(r => { release = r; }), entered: new Promise<void>(r => { entered = r; }), release: () => release(), enter: () => entered() }; }
function makeClient() {
  const values = new Map<string, string>();
  const storage = createSecureStorage({ getItemAsync: async k => values.get(k) ?? null, setItemAsync: async (k,v) => { values.set(k,v); }, deleteItemAsync: async k => { values.delete(k); } });
  const key = 'sb-integration-auth-token';
  const control: { intercept?: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response> } = {};
  const sdk = Object.assign(createClient(url, anonKey, { global: { fetch: (input, init) => control.intercept ? control.intercept(String(input),init) : network(String(input),init) }, auth: { storage, storageKey: key, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false } }), {sessionStorage: storage, sessionStorageKey: key});
  const result = {sdk, client: adaptAuthClient(sdk), values, storage, key, control};
  clients.push(result); return result;
}
type Fixture = ReturnType<typeof makeClient>;
// The SDK is real. This narrow test driver exposes protected SDK operations solely
// to deliver stale notifications and race storage changes without the SDK's public lock.
type Driver = { _notifyAllSubscribers(event: AuthChangeEvent, session: Session | null): Promise<void>; _callRefreshToken(token: string): Promise<{error: {name: string} | null}> };
const driver = (f: Fixture) => f.sdk.auth as unknown as Driver;
async function session(f: Fixture) { const r = await f.sdk.auth.getSession(); check(r.error); return r.data.session; }
async function login(f: Fixture) {
  const r = await f.sdk.auth.signInWithPassword({email, password});
  if (!r.error && r.data.session) return r.data.session;
  // Disabled email registration can also reject password grants on some local versions.
  const link = await admin.auth.admin.generateLink({type:'magiclink', email}); check(link.error);
  const verified = await f.sdk.auth.verifyOtp({type:'magiclink', token_hash:link.data.properties!.hashed_token}); check(verified.error);
  if (!verified.data.session) throw Error('Local fixture did not establish a session');
  return verified.data.session;
}
let auth: ReturnType<typeof useAuth>;
const states: string[] = [];
function Probe() {
  const value = useAuth();
  useEffect(() => { auth = value; states.push(value.state); }, [value]);
  return null;
}
const providers = {google: async () => ({idToken: exchangeToken})};
const guard = {isFreshInstall: async () => false};
async function mount(f: Fixture, timeoutMs = 15000, fresh = false) {
  const view = await render(<AuthProvider client={f.client} providers={providers} installGuard={fresh ? {isFreshInstall:async () => true} : guard} timeoutMs={timeoutMs}><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.state).not.toBe('checking')); return view;
}
async function same(f: Fixture, expected: Session | null) {
  // Never use token values as matcher inputs: failed assertions must not print them.
  expect((await session(f))?.access_token === expected?.access_token).toBe(true);
  const persisted = await f.storage.getItem(f.key);
  expect((persisted ? JSON.parse(persisted).access_token : undefined) === expected?.access_token).toBe(true);
  if (!expected) expect(f.values.size).toBe(0);
}
function delay(f: Fixture, matches: (s: string) => boolean) {
  const g = gate();
  f.control.intercept = async (input, init) => { const response = await network(input,init); if (matches(String(input))) {g.enter(); await g.wait;} return response; };
  return g;
}
// Translate ONLY the outgoing exchange HTTP request into a real local verification
// grant (email registration stays disabled). signInWithIdToken itself, response processing, storage and events stay real.
function exchangeDriver(f: Fixture, g = gate()) {
  const tokens: string[] = [];
  f.control.intercept = async (input, init) => {
    if (!String(input).includes('grant_type=id_token')) return network(input,init);
    const link = await admin.auth.admin.generateLink({type:'magiclink',email}); check(link.error);
    const response = await network(`${url}/auth/v1/verify`, {...init, body:JSON.stringify({type:'magiclink',token_hash:link.data.properties!.hashed_token})});
    const body = await response.clone().json();
    if (response.ok) tokens.push(body.access_token);
    g.enter(); await g.wait; return response;
  };
  return {...g,tokens};
}
beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  email = `integration-${suffix}@example.invalid`; password = `Integration-${suffix}-Aa9!`;
  const r = await admin.auth.admin.createUser({email,password,email_confirm:true}); check(r.error);
  if (!r.data.user) throw Error('Local user creation failed'); ids.push(r.data.user.id);
  exchangeToken = (await login(makeClient())).access_token;
});
afterEach(async () => { for (const f of clients) { f.control.intercept = undefined; f.sdk.auth.stopAutoRefresh(); } states.length = 0; });
afterAll(async () => { for (const id of ids) { const r = await admin.auth.admin.deleteUser(id); check(r.error); } });

it('stale sign-out notification after newer authentication preserves the session', async () => {
  const f = makeClient(); await login(f); await mount(f);
  await act(async () => { await f.sdk.auth.signOut({scope:'local'}); await login(f); });
  await waitFor(() => expect(auth.state).toBe('needs_profile')); const newer = await session(f);
  await act(async () => driver(f)._notifyAllSubscribers('SIGNED_OUT', null));
  expect(auth.state).toBe('needs_profile'); await same(f,newer);
});
it('delayed refresh discards its response after another client signs out and signs in', async () => {
  const f = makeClient(); const old = await login(f); await mount(f);
  const g = delay(f, s => s.includes('grant_type=refresh_token'));
  const pending = driver(f)._callRefreshToken(old.refresh_token); await g.entered;
  // A second real SDK client shares the persistence slot, as another process would.
  const other = Object.assign(createClient(url,anonKey,{auth:{storage:f.storage,storageKey:f.key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}}),{sessionStorage:f.storage,sessionStorageKey:f.key});
  await other.auth.signOut({scope:'local'});
  const newer = await login({...f,sdk:other});
  g.release(); const result = await pending;
  expect(result.error?.name).toBe('AuthRefreshDiscardedError');
  await act(async () => driver(f)._notifyAllSubscribers('SIGNED_IN',newer));
  await waitFor(() => expect(auth.state).toBe('needs_profile')); await same(f,newer); other.auth.stopAutoRefresh();
});
it('admin revocation signs out exactly once when refresh detects it', async () => {
  const f = makeClient(); const current = await login(f); await mount(f); states.length = 0;
  check((await admin.auth.admin.signOut(current.access_token,'global')).error);
  // Advance local expiry metadata so refresh must observe server revocation now.
  await f.storage.setItem(f.key,JSON.stringify({...current,expires_at:Math.floor(Date.now()/1000)-60}));
  await act(async () => { await f.sdk.auth.refreshSession(); });
  await waitFor(() => expect(auth.state).toBe('signed_out'));
  await act(async () => driver(f)._notifyAllSubscribers('SIGNED_OUT',null));
  expect(states.filter(s => s === 'signed_out')).toHaveLength(1); await same(f,null);
});
it('temporary failed fetch preserves credentials and shows an offline notice', async () => {
  const f = makeClient(); const current = await login(f); await mount(f);
  f.control.intercept = async () => { throw new TypeError('Synthetic transport failure'); };
  await act(async () => auth.retry()); expect(auth.notice).toBe('offline'); expect(auth.state).toBe('account_provision_error'); await same(f,current);
});
it.each(['timeout','unmount','queued','timeout-queued'] as const)('abandoned exchange: %s leaves no abandoned credentials', async mode => {
  const f = makeClient(); const g = exchangeDriver(f); const view = await mount(f,500);
  let first!:Promise<void>; await act(async () => {first=auth.signIn('google');}); await g.entered;
  if (mode.startsWith('timeout')) await waitFor(() => expect(auth.state).toBe('signed_out'));
  else await view.unmount();
  let second: Promise<void> | undefined;
  if (mode.includes('queued')) {if (mode === 'queued') await mount(f); await act(async () => {second=auth.signIn('google');});}
  await act(async () => {g.release(); await first; await second;});
  if (mode.includes('queued')) {
    expect(auth.state).toBe('needs_profile'); expect(g.tokens.length).toBe(2);
    const current = await session(f); expect(current?.access_token === g.tokens[1]).toBe(true); await same(f,current);
  }
  else {expect(auth.state).toBe(mode === 'unmount' ? 'authenticating' : 'signed_out'); await same(f,null);}
});
it('abandoned account read arriving after timeout changes no state or credentials', async () => {
  const f = makeClient(); const current = await login(f); const g = delay(f,s => s.includes('/rest/v1/accounts'));
  await mount(f,100); await g.entered; expect(auth.state).toBe('account_provision_error');
  await act(async () => {g.release();}); await new Promise(r => setTimeout(r,50));
  expect(auth.state).toBe('account_provision_error'); await same(f,current);
});
it('two real sessions: local sign-out leaves the other session valid', async () => {
  const a = makeClient(), b = makeClient(); await login(a); const other = await login(b); await mount(a);
  await act(async () => {check((await a.sdk.auth.signOut({scope:'local'})).error);});
  await waitFor(() => expect(auth.state).toBe('signed_out')); await same(a,null);
  check((await b.sdk.auth.getUser()).error); check((await b.sdk.auth.refreshSession()).error);
  const v = await mount(b); expect(auth.state).toBe('needs_profile'); expect((await session(b))?.user.id === other.user.id).toBe(true); await v.unmount();
});
it.each(['invalid','offline','expired-offline'] as const)('fresh install clears real SDK storage despite %s local sign-out', async mode => {
  const f = makeClient(); const current = await login(f);
  if (mode === 'invalid') await f.storage.setItem(f.key,JSON.stringify({...current,access_token:'invalid-test-credential'}));
  if (mode === 'expired-offline') await f.storage.setItem(f.key,JSON.stringify({...current,expires_at:Math.floor(Date.now()/1000)-60}));
  if (mode !== 'invalid') f.control.intercept = async () => {throw new TypeError('Synthetic offline');};
  const observed = await f.sdk.auth.signOut({scope:'local'});
  if (mode !== 'invalid') {expect(observed.error !== null).toBe(true); expect(await f.storage.getItem(f.key) !== null).toBe(mode === 'expired-offline');}
  else {check(observed.error); await same(f,null); await f.storage.setItem(f.key,JSON.stringify({...current,access_token:'invalid-test-credential'}));}
  await mount(f,3000,true); expect(auth.state).toBe('signed_out'); await same(f,null);
});

it('failed exchange fetch leaves the SDK and storage signed out', async () => {
  const f = makeClient(); await mount(f);
  f.control.intercept = async (input,init) => {
    if (String(input).includes('grant_type=id_token')) throw new TypeError('Synthetic exchange outage');
    return network(input,init);
  };
  await act(async () => auth.signIn('google'));
  expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe('offline'); await same(f,null);
});

it('rejected exchange token leaves the SDK and storage signed out', async () => {
  const f = makeClient(); await mount(f);
  f.control.intercept = async (input,init) => {
    if (String(input).includes('grant_type=id_token')) return new Response(JSON.stringify({error:'invalid_grant',error_description:'Synthetic rejected token'}), {status:400,headers:{'Content-Type':'application/json'}});
    return network(input,init);
  };
  await act(async () => auth.signIn('google'));
  expect(auth.state).toBe('signed_out'); expect(auth.notice).toBe('provider_failed'); await same(f,null);
});
