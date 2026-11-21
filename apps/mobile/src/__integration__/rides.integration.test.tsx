import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { adaptOnboardingClient, createOnboardingApi } from '../features/onboarding/api';
import { adaptRidesClient, createRidesApi } from '../features/rides/api';
import { createSecureStorage } from '../features/auth/secureStorage';
import { anonKey, serviceKey, url } from './environment';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const users = new Set<string>(), clients: { auth: { stopAutoRefresh(): void } }[] = [];
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); }); }
function phoneFromFixtureId(id: string) { const digits = id.replace(/\D/g, '').padEnd(9, '0'); return `+201${['0', '1', '2', '5'][Number(digits[0]) % 4]}${digits.slice(1, 9)}`; }
function check(error: unknown) { if (error) { const e = error as { code?: string; status?: number; name?: string }; throw Error(`Local rides fixture failed: ${e.name}, status ${e.status}, code ${e.code} (response omitted)`); } }
async function fixture(role: 'rider' | 'car_owner') {
 const id = uuid(), email = `rides-${id}@example.invalid`, password = `Synthetic-${id}-Aa9!`;
 const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); check(created.error); if (!created.data.user) throw Error('Local user creation failed'); users.add(created.data.user.id);
 const values = new Map<string, string>(), storage = createSecureStorage({ getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } });
 const client = Object.assign(createClient(url, anonKey, { auth: { ...options.auth, storage, storageKey: `rides-${id}` } }), { sessionStorage: storage, sessionStorageKey: `rides-${id}` }); clients.push(client);
 const signed = await client.auth.signInWithPassword({ email, password }); if (signed.error || !signed.data.session) { const link = await admin.auth.admin.generateLink({ type: 'magiclink', email }); check(link.error); const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties!.hashed_token }); check(verified.error); if (!verified.data.session) throw Error('Local fixture did not establish a session'); }
 const community = await admin.from('communities').select('id').eq('active', true).limit(1).single(); check(community.error);
 const legal = await admin.from('legal_documents').select('kind,version').eq('is_current', true); check(legal.error); const version = (kind: string) => legal.data!.find(row => row.kind === kind)!.version;
 const onboarding = createOnboardingApi(adaptOnboardingClient(client as never)); await onboarding.completeProfile({ firstName: 'Synthetic', lastName: 'Rider', communityId: community.data!.id, role, ageConfirmed: true, termsVersion: version('terms'), privacyVersion: version('privacy') });
 return { id: created.data.user.id, client, onboarding, rides: createRidesApi(adaptRidesClient(client as never)) };
}
let route: { id: string }, carType: { id: string }, brand: { id: string }, model: { id: string };
beforeAll(async () => {
 const routeResult = await admin.from('routes').select('id').eq('active', true).limit(1).single(); check(routeResult.error); route = routeResult.data!;
 const typeResult = await admin.from('car_types').select('id').eq('active', true).limit(1).single(); check(typeResult.error); carType = typeResult.data!;
 const brandResult = await admin.from('car_brands').select('id').eq('active', true).limit(1).single(); check(brandResult.error); brand = brandResult.data!;
 const modelResult = await admin.from('car_models').select('id').eq('brand_id', brand.id).eq('active', true).limit(1).single(); check(modelResult.error); model = modelResult.data!;
});
afterAll(async () => { const errors: unknown[] = []; for (const client of clients) client.auth.stopAutoRefresh(); for (const id of users) { try { const result = await admin.auth.admin.deleteUser(id); if (result.error) errors.push(result.error); } catch (error) { errors.push(error); } } check(errors[0]); });

it('gates, publishes and reads a ride end to end while recording pilot events', async () => {
 const owner = await fixture('car_owner'), viewer = await fixture('rider');
 await owner.onboarding.submitCar({ submissionKey: uuid(), brandId: brand.id, brandOther: null, modelId: model.id, modelOther: null, typeId: carType.id, year: 2024, plate: 'ا-١' });
 const publish = { requestId: uuid(), routeId: route.id, direction: 'a_to_b' as const, date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), time: '12:00', flexMinutes: 10, seats: 1, pickupNote: null, notes: null, repeat: 'once' as const };
 await expect(owner.rides.publishRide(publish)).rejects.toMatchObject({ code: 'phone_unverified', messageKey: 'rides.errors.phone_unverified' });
 check((await admin.from('accounts').update({ phone_verified: true, phone_e164: phoneFromFixtureId(owner.id) }).eq('user_id', owner.id)).error);
 check((await admin.rpc('review_item', { p_user_id: owner.id, p_kind: 'car_owner', p_revision: 1, p_status: 'approved', p_note: null })).error);
 const published = await owner.rides.publishRide(publish); expect(published.replayed).toBe(false);
 const listed = await viewer.rides.listRides({ routeId: route.id, direction: 'a_to_b', day: publish.date, after: null, limit: 30 }); expect(listed.some((row: { ride_id: string }) => row.ride_id === published.rideId)).toBe(true);
 expect((await viewer.rides.getRide(published.rideId, 'list')).ride_id).toBe(published.rideId);
 expect(await viewer.rides.resolveSharedRide(published.shareCode)).toMatchObject({ state: 'available', ride: { ride_id: published.rideId } });
 const events = await admin.from('pilot_events').select('event_type,user_id,source,ride_state,repeat,ride_count').eq('ride_id', published.rideId); check(events.error);
 expect(events.data!.filter(row => row.event_type === 'ride_posted')).toEqual([{ event_type: 'ride_posted', user_id: owner.id, source: null, ride_state: null, repeat: 'once', ride_count: 1 }]);
 expect(events.data!.filter(row => row.event_type === 'ride_viewed' && row.user_id === viewer.id)).toEqual([{ event_type: 'ride_viewed', user_id: viewer.id, source: 'list', ride_state: 'available', repeat: null, ride_count: null }]);
 expect(events.data!.filter(row => row.event_type === 'ride_viewed' && row.user_id === owner.id)).toHaveLength(0);
});
