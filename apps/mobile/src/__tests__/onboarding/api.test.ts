import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createOnboardingApi, type OnboardingClient } from '../../features/onboarding/api';
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(() => { throw Error('inject client'); }) }));
type Response = { data: unknown; error: { message?: string } | null; status?: number };
function fake() {
 let response: Response = { data: [], error: null, status: 200 };
 let thrown: unknown;
 const calls: unknown[][] = [];
 const query: ReturnType<ReturnType<OnboardingClient['from']>['select']> & { select(columns: string): ReturnType<ReturnType<OnboardingClient['from']>['select']> } = {
  select: (columns: string) => { calls.push(['select', columns]); return query; },
  eq: (column: string, value: unknown) => { calls.push(['eq', column, value]); return query; },
  order: (column: string) => { calls.push(['order', column]); return query; },
  then: (resolve, reject) => thrown ? Promise.reject(thrown).then(resolve, reject) : Promise.resolve(response).then(resolve, reject),
 };
 const client = { from: (table: string) => { calls.push(['from', table]); return query; }, rpc: async (name: string, args?: Record<string, unknown>) => { calls.push(['rpc', name, args]); if (thrown) throw thrown; return response; } } satisfies OnboardingClient;
 return { api: createOnboardingApi(client), calls, reply: (r: Response) => { response = r; }, fail: (e: unknown) => { thrown = e; } };
}
let spies: { mockRestore(): void }[];
beforeEach(() => {
 spies = Object.getOwnPropertyNames(console).filter(key => typeof console[key as keyof Console] === 'function').map(key => jest.spyOn(console, key as 'log').mockImplementation(() => {}));
});
afterEach(() => { try { spies.forEach(spy => expect(spy).not.toHaveBeenCalled()); } finally { spies.forEach(spy => spy.mockRestore()); } });
test.each([
 ['listCommunities', 'communities', 'sort_order'], ['listCarBrands', 'car_brands', 'name'], ['listCarTypes', 'car_types', 'name'],
] as const)('%s queries active ordered rows', async (method, table, order) => {
 const f = fake(); const rows = [{ id: 'synthetic' }]; f.reply({ data: rows, error: null, status: 200 });
 expect(await f.api[method]()).toEqual(rows);
 expect(f.calls).toContainEqual(['from', table]); expect(f.calls).toContainEqual(['eq', 'active', true]); expect(f.calls).toContainEqual(['order', order]);
});
test('models filter by brand and active', async () => {
 const f = fake(); await f.api.listCarModels('brand'); expect(f.calls).toContainEqual(['from', 'car_models']); expect(f.calls).toContainEqual(['eq', 'brand_id', 'brand']); expect(f.calls).toContainEqual(['eq', 'active', true]);
});
test('legal versions come from current rows', async () => {
 const f = fake(); f.reply({ data: [{ kind: 'terms', version: 't' }, { kind: 'privacy', version: 'p' }], error: null });
 expect(await f.api.currentLegalVersions()).toEqual({ terms: 't', privacy: 'p' }); expect(f.calls).toContainEqual(['eq', 'is_current', true]);
});
test('missing current legal version fails closed', async () => { await expect(fake().api.currentLegalVersions()).rejects.toMatchObject({ code: 'unexpected_response', classification: 'uncertain' }); });
test('profile completion maps every argument', async () => {
 const f = fake(); await f.api.completeProfile({ firstName: 'Synthetic', lastName: 'Fixture', communityId: 'community', role: 'both', ageConfirmed: true, termsVersion: 't', privacyVersion: 'p' });
 expect(f.calls).toContainEqual(['rpc', 'complete_profile', { p_first_name: 'Synthetic', p_last_name: 'Fixture', p_community_id: 'community', p_role: 'both', p_age_confirmed: true, p_terms_version: 't', p_privacy_version: 'p' }]);
});
test('role RPC', async () => { const f = fake(); await f.api.setRole('rider'); expect(f.calls).toContainEqual(['rpc', 'set_role', { p_role: 'rider' }]); });
const car = { submissionKey: 'key', brandId: null, brandOther: 'Synthetic', modelId: null, modelOther: 'Fixture', typeId: 'type', year: 2000, plate: '1' };
test('car RPC preserves the key on retries and returns replay metadata', async () => {
 const f = fake(); const result = { revision: 1, status: 'pending', superseded: true }; f.reply({ data: result, error: null });
 expect(await f.api.submitCar(car)).toEqual(result); await f.api.submitCar(car);
 expect(f.calls).toEqual(Array(2).fill(['rpc', 'submit_car', { p_submission_key: 'key', p_brand_id: null, p_brand_other: 'Synthetic', p_model_id: null, p_model_other: 'Fixture', p_type_id: 'type', p_year: 2000, p_plate: '1' }]));
});
test('verification returns only the typed server shape', async () => {
 const f = fake(); const result = { car_owner: { status: 'rejected', revision: 2, reviewer_note: 'Try again' }, has_car_details: true }; f.reply({ data: result, error: null });
 expect(await f.api.myVerification()).toEqual(result); expect(f.calls).toContainEqual(['rpc', 'my_verification', undefined]);
});
test.each(['consent_version_stale', 'account_missing', 'invalid_name', 'invalid_community', 'invalid_role', 'age_not_confirmed', 'profile_missing', 'role_not_car_owner', 'invalid_car', 'invalid_plate', 'invalid_year', 'already_approved', 'stale_revision'])('exact server code %s is rejected', async code => {
 const f = fake(); f.reply({ data: null, error: { message: code }, status: 400 });
 await expect(f.api.submitCar(car)).rejects.toMatchObject({ code, classification: 'rejected', message: code });
});
test.each([undefined, 0, 500, 503])('transport status %s is uncertain and sanitized', async status => {
 const f = fake(); f.reply({ data: null, error: { message: 'submitted synthetic value' }, status });
 await expect(f.api.submitCar(car)).rejects.toMatchObject({ code: 'uncertain', classification: 'uncertain', message: 'uncertain' });
});
test('thrown network error is uncertain', async () => { const f = fake(); f.fail(Error('synthetic private value')); await expect(f.api.listCommunities()).rejects.toMatchObject({ message: 'uncertain', classification: 'uncertain' }); });
test('unknown 4xx response is sanitized rejected', async () => { const f = fake(); f.reply({ data: null, error: { message: 'invalid_plate plus private value' }, status: 400 }); await expect(f.api.setRole('both')).rejects.toMatchObject({ code: 'rejected', message: 'rejected', classification: 'rejected' }); });
test.each([null, undefined, {}, { revision: 1, status: 'pending' }])('missing or incomplete submission response is uncertain', async data => {
 const f = fake(); f.reply({ data, error: null, status: 200 });
 await expect(f.api.submitCar(car)).rejects.toMatchObject({ message: 'unexpected_response', classification: 'uncertain' });
});
test('5xx stays uncertain even if its message resembles a rejection', async () => {
 const f = fake(); f.reply({ data: null, error: { message: 'invalid_car' }, status: 503 });
 await expect(f.api.submitCar(car)).rejects.toMatchObject({ message: 'uncertain', classification: 'uncertain' });
});
