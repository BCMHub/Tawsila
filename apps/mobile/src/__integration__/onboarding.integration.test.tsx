import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { adaptOnboardingClient, createOnboardingApi, type CarInput, type ProfileInput } from '../features/onboarding/api';
import { createSecureStorage } from '../features/auth/secureStorage';
import { anonKey, serviceKey, url } from './environment';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const suffix = randomUUID();
const users = new Set<string>();
const clients: (typeof admin)[] = [];
// Synthetic fixture identifiers only; these are not security credentials.
function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
const community = randomUUID(), inactiveCommunity = randomUUID();
const brand = randomUUID(), secondBrand = randomUUID(), inactiveBrand = randomUUID();
const model = randomUUID(), secondModel = randomUUID(), inactiveModel = randomUUID();
const type = randomUUID();
const versions = { terms: `integration-terms-${suffix}`, privacy: `integration-privacy-${suffix}` };
const nextVersions = { terms: `${versions.terms}-next`, privacy: `${versions.privacy}-next` };
let previousLegal: { kind: string; version: string }[] = [];
let legalCaptured = false;
let otherType: string;
// Never throw raw SDK errors: a failed fixture must not disclose credentials.
function check(error: unknown) {
  if (error) {
    const e = error as { code?: string; status?: number; name?: string };
    throw Error(`Local onboarding fixture failed: ${e.name}, status ${e.status}, code ${e.code} (response omitted)`);
  }
}
async function fixture() {
  const unique = randomUUID();
  const email = `onboarding-${unique}@example.invalid`, password = `Synthetic-${unique}-Aa9!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  check(created.error);
  if (!created.data.user) throw Error('Local user creation failed');
  const id = created.data.user.id;
  users.add(id);
  const values = new Map<string, string>();
  const storage = createSecureStorage({
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  });
  const storageKey = `onboarding-${unique}`;
  const client = Object.assign(createClient(url, anonKey, {
    auth: { ...options.auth, storage, storageKey },
  }), { sessionStorage: storage, sessionStorageKey: storageKey });
  clients.push(client);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    check(link.error);
    const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties!.hashed_token });
    check(verified.error);
    if (!verified.data.session) throw Error('Local fixture did not establish a session');
  }
  return { id, client, api: createOnboardingApi(adaptOnboardingClient(client)) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function profile(legal = versions): ProfileInput {
  return { firstName: 'Synthetic', lastName: 'Tester', communityId: community, role: 'rider', ageConfirmed: true, termsVersion: legal.terms, privacyVersion: legal.privacy };
}
function car(overrides: Partial<CarInput> = {}): CarInput {
  return { submissionKey: randomUUID(), brandId: brand, brandOther: null, modelId: model, modelOther: null, typeId: type, year: 2020, plate: 'ا-١', ...overrides };
}
async function eligible(f: Fixture, name: 'can_request_rides' | 'can_post_rides') {
  const result = await f.client.rpc(name); check(result.error); return result.data;
}
const ownedTables = ['profiles', 'consents', 'vehicles', 'verification_items', 'verification_submissions'] as const;
async function rows(table: string, id: string) {
  const result = await admin.from(table).select('*').eq('user_id', id).order(table === 'consents' ? 'id' : table === 'verification_submissions' ? 'revision' : 'user_id'); check(result.error); return result.data!;
}
async function snapshot(id: string) {
  const result: Record<string, unknown> = {};
  for (const table of ['accounts', ...ownedTables]) result[table] = await rows(table, id);
  return result;
}
async function ready(f: Fixture) { await f.api.completeProfile(profile()); }
async function owner(f: Fixture) { await ready(f); await f.api.setRole('car_owner'); }
function reviewArgs(f: Fixture, revision: number, status = 'approved', note: string | null = null) {
  return { p_user_id: f.id, p_kind: 'car_owner', p_revision: revision, p_status: status, p_note: note };
}
async function useLegal(legal: typeof versions) {
  check((await admin.from('legal_documents').update({ is_current: false }).eq('is_current', true)).error);
  for (const kind of ['terms', 'privacy'] as const) {
    check((await admin.from('legal_documents').update({ is_current: true }).eq('kind', kind).eq('version', legal[kind])).error);
  }
}
beforeAll(async () => {
  check((await admin.from('communities').insert([
    { id: community, name: `Active-${suffix}`, active: true },
    { id: inactiveCommunity, name: `Inactive-${suffix}`, active: false },
  ])).error);
  const current = await admin.from('legal_documents').select('kind,version').eq('is_current', true);
  check(current.error); previousLegal = current.data!; legalCaptured = true;
  for (const legal of [versions, nextVersions]) {
    check((await admin.from('legal_documents').insert(['terms', 'privacy'].map(kind => ({ kind, version: legal[kind as keyof typeof legal], is_current: false })))).error);
  }
  await useLegal(versions);
  check((await admin.from('car_brands').insert([
    { id: brand, name: `Brand-A-${suffix}`, active: true }, { id: secondBrand, name: `Brand-B-${suffix}`, active: true },
    { id: inactiveBrand, name: `Brand-Inactive-${suffix}`, active: false },
  ])).error);
  check((await admin.from('car_models').insert([
    { id: model, brand_id: brand, name: `Model-A-${suffix}`, active: true },
    { id: secondModel, brand_id: secondBrand, name: `Model-B-${suffix}`, active: true },
    { id: inactiveModel, brand_id: brand, name: `Model-Inactive-${suffix}`, active: false },
  ])).error);
  const other = await admin.from('car_types').select('id').eq('code', 'other').single(); check(other.error); otherType = other.data!.id;
  check((await admin.from('car_types').insert({ id: type, code: `integration-${suffix}`, name: `Type-${suffix}`, active: true })).error);
});
afterAll(async () => {
  // Attempt every cleanup even if one operation fails, then report a sanitized error.
  const errors: unknown[] = [];
  const clean = async (operation: PromiseLike<{ error: unknown }>) => { try { const r = await operation; if (r.error) errors.push(r.error); } catch (error) { errors.push(error); } };
  for (const client of clients) client.auth.stopAutoRefresh();
  for (const id of users) await clean(admin.auth.admin.deleteUser(id));
  await clean(admin.from('car_models').delete().in('id', [model, secondModel, inactiveModel]));
  await clean(admin.from('car_brands').delete().in('id', [brand, secondBrand, inactiveBrand]));
  await clean(admin.from('car_types').delete().eq('id', type));
  await clean(admin.from('communities').delete().in('id', [community, inactiveCommunity]));
  if (legalCaptured) {
    await clean(admin.from('legal_documents').delete().in('version', [...Object.values(versions), ...Object.values(nextVersions)]));
    for (const row of previousLegal) await clean(admin.from('legal_documents').update({ is_current: true }).eq('kind', row.kind).eq('version', row.version));
  }
  check(errors[0]);
});

it('completes a profile with current consents and repeats idempotently', async () => {
  const f = await fixture();
  expect(await eligible(f, 'can_request_rides')).toBe(false);
  const communities = await f.api.listCommunities();
  expect(communities.some(row => row.id === community)).toBe(true);
  expect(communities.every(row => row.active && row.id !== inactiveCommunity)).toBe(true);
  expect(await f.api.currentLegalVersions()).toEqual(versions);
  await ready(f);
  const before = await snapshot(f.id);
  expect((await rows('accounts', f.id))[0].profile_completed_at !== null).toBe(true);
  expect(await eligible(f, 'can_request_rides')).toBe(true);
  expect(await f.api.myProfile()).toEqual({ role: 'rider' });
  expect(await rows('consents', f.id)).toHaveLength(3);
  await ready(f);
  expect(await snapshot(f.id)).toEqual(before);
});
it('rejects stale consent atomically and accepts refreshed versions after a change', async () => {
  const f = await fixture();
  const before = await snapshot(f.id);
  await expect(f.api.completeProfile({ ...profile(), termsVersion: `stale-${suffix}` })).rejects.toMatchObject({ code: 'consent_version_stale' });
  expect(await snapshot(f.id)).toEqual(before);
  const observed = await f.api.currentLegalVersions();
  try {
    await useLegal(nextVersions);
    await expect(f.api.completeProfile(profile(observed))).rejects.toMatchObject({ code: 'consent_version_stale' });
    expect(await snapshot(f.id)).toEqual(before);
    const refreshed = await f.api.currentLegalVersions();
    expect(refreshed).toEqual(nextVersions);
    await f.api.completeProfile(profile(refreshed));
    expect(await eligible(f, 'can_request_rides')).toBe(true);
    expect(await rows('consents', f.id)).toHaveLength(3);
  } finally { await useLegal(versions); }
});
it('isolates callers and refuses direct client writes', async () => {
  const a = await fixture(), b = await fixture(); await owner(a); await a.api.submitCar(car());
  for (const table of ownedTables) {
    const result = await b.client.from(table).select('*').eq('user_id', a.id); check(result.error); expect(result.data).toEqual([]);
  }
  expect(await b.api.myProfile()).toBeNull(); expect(await b.api.myVehicle()).toBeNull();
  expect(await b.api.myVerification()).toEqual({ car_owner: null, has_car_details: false });
  const before = await snapshot(b.id);
  const inserts: Record<string, Record<string, unknown>> = {
    profiles: { user_id: b.id, first_name: 'Synthetic', last_name: 'Tester', community_id: community, role: 'rider' },
    consents: { user_id: b.id, kind: 'age_18', version: null },
    verification_items: { user_id: b.id, kind: 'car_owner', status: 'approved', revision: 1, submission_key: randomUUID() },
    verification_submissions: { user_id: b.id, kind: 'car_owner', revision: 1, submission_key: randomUUID() },
  };
  for (const [table, row] of Object.entries(inserts)) {
    const result = await b.client.from(table).insert(row); expect(result.error?.code).toBe('42501');
  }
  const update = await b.client.from('accounts').update({ profile_completed_at: new Date().toISOString() }).eq('user_id', b.id);
  expect(update.error?.code).toBe('42501'); expect(await snapshot(b.id)).toEqual(before);
});
it('submits revisions, replays keys without writes, and rejects invalid car inputs atomically', async () => {
  const f = await fixture(); await ready(f);
  const first = car(); const before = await snapshot(f.id);
  await expect(f.api.submitCar(first)).rejects.toMatchObject({ code: 'role_not_car_owner' });
  expect(await snapshot(f.id)).toEqual(before);
  await f.api.setRole('car_owner');
  expect(await f.api.submitCar(first)).toEqual({ revision: 1, status: 'pending', superseded: false });
  const once = await snapshot(f.id);
  expect(await f.api.submitCar(first)).toEqual({ revision: 1, status: 'pending', superseded: false });
  expect(await snapshot(f.id)).toEqual(once); expect(await rows('verification_submissions', f.id)).toHaveLength(1);
  const second = car({ year: 2021 });
  expect(await f.api.submitCar(second)).toEqual({ revision: 2, status: 'pending', superseded: false });
  const twice = await snapshot(f.id);
  expect(await f.api.submitCar(first)).toEqual({ revision: 1, status: 'pending', superseded: true });
  expect(await snapshot(f.id)).toEqual(twice); expect(await rows('verification_submissions', f.id)).toHaveLength(2);
  for (const [changes, code] of [
    [{ plate: 'INVALID' }, 'invalid_plate'], [{ year: 1800 }, 'invalid_year'],
    [{ brandId: inactiveBrand }, 'invalid_car'], [{ modelId: secondModel }, 'invalid_car'],
    [{ modelId: inactiveModel }, 'invalid_car'], [{ brandId: null, brandOther: 'Synthetic' }, 'invalid_car'],
    [{ brandOther: 'Synthetic' }, 'invalid_car'],
  ] as [Partial<CarInput>, string][]) {
    await expect(f.api.submitCar(car(changes))).rejects.toMatchObject({ code });
    expect(await snapshot(f.id)).toEqual(twice);
  }
  expect(await f.api.myVehicle()).toEqual({ brand_id: brand, brand_other: null, model_id: model, model_other: null, type_id: type, year: 2021, plate_number: 'ا1' });
  expect(await f.api.myVerification()).toEqual({ car_owner: { status: 'pending', revision: 2, reviewer_note: null }, has_car_details: true });
  expect(await eligible(f, 'can_post_rides')).toBe(false);
});
it('binds owner approval to the current revision and clears rejection on resubmission', async () => {
  const f = await fixture(); await owner(f); const first = car(); await f.api.submitCar(first);
  const before = await snapshot(f.id);
  const stale = await admin.rpc('review_item', reviewArgs(f, 0)); expect(stale.error?.message).toBe('stale_revision');
  expect(await snapshot(f.id)).toEqual(before);
  const denied = await f.client.rpc('review_item', reviewArgs(f, 1)); expect(denied.error?.code).toBe('42501');
  expect(await snapshot(f.id)).toEqual(before);
  check((await admin.rpc('review_item', reviewArgs(f, 1))).error);
  expect(await eligible(f, 'can_post_rides')).toBe(true);
  const approved = await snapshot(f.id);
  await expect(f.api.submitCar(car())).rejects.toMatchObject({ code: 'already_approved' });
  expect(await snapshot(f.id)).toEqual(approved);
  expect(await f.api.submitCar(first)).toEqual({ revision: 1, status: 'pending', superseded: false });
  expect(await snapshot(f.id)).toEqual(approved);
  // A separate owner exercises rejection independently of the approved car.
  const rejected = await fixture(); await owner(rejected); await rejected.api.submitCar(car());
  check((await admin.rpc('review_item', reviewArgs(rejected, 1, 'rejected', 'Synthetic review note'))).error);
  expect(await rejected.api.myVerification()).toEqual({ car_owner: { status: 'rejected', revision: 1, reviewer_note: 'Synthetic review note' }, has_car_details: true });
  expect(await eligible(rejected, 'can_post_rides')).toBe(false);
  expect(await rejected.api.submitCar(car())).toEqual({ revision: 2, status: 'pending', superseded: false });
  expect(await rejected.api.myVerification()).toEqual({ car_owner: { status: 'pending', revision: 2, reviewer_note: null }, has_car_details: true });
  expect(await eligible(rejected, 'can_post_rides')).toBe(false);
});
it('filters catalogue queries without changing seed rows', async () => {
  const f = await fixture(); const brands = await f.api.listCarBrands();
  expect(brands.some(row => row.id === brand)).toBe(true); expect(brands.some(row => row.id === secondBrand)).toBe(true);
  expect(brands.every(row => row.active && row.id !== inactiveBrand)).toBe(true);
  const models = await f.api.listCarModels(brand);
  expect(models.map(row => row.id)).toEqual([model]);
  expect(models.every(row => row.brand_id === brand && row.active)).toBe(true);
  expect((await f.api.listCarModels(secondBrand)).map(row => row.id)).toEqual([secondModel]);
  const types = await f.api.listCarTypes();
  expect(types.some(row => row.id === otherType && row.code === 'other')).toBe(true);
  expect(types.some(row => row.id === type)).toBe(true);
});
it('cascades real admin account deletion through all onboarding rows', async () => {
  const f = await fixture(); await owner(f); await f.api.submitCar(car()); await f.api.submitCar(car());
  for (const table of ['accounts', ...ownedTables]) expect((await rows(table, f.id)).length).toBeGreaterThan(0);
  check((await admin.auth.admin.deleteUser(f.id)).error); users.delete(f.id);
  for (const table of ['accounts', ...ownedTables]) expect(await rows(table, f.id)).toEqual([]);
});
