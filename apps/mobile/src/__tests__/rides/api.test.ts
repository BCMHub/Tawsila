/**
 * TAW-29 implementation contract (all names are exported).
 * api.ts: RideDirection = 'a_to_b' | 'b_to_a'; RideProjection, PublishRideInput, PublishRideResult, SharedRideResult,
 * RideListInput, RidesClient; RidesApi { canPublish(); publishRide(input);
 * listRides(input); getRide(id, source); resolveSharedRide(code) };
 * adaptRidesClient(supabase): RidesClient; createRidesApi(client?: RidesClient): RidesApi; RidesError(code, classification,
 * messageKey); publishErrorMessageKey(code): RideMessageKey.
 * RidesApiProvider.tsx: RidesApiProvider({api, children}); useRidesApi().
 * format.ts: formatRideDate(date), formatRideTime(time), formatPostedAt(createdAt, now?).
 * shareMessage.ts: buildShareMessage(ride, baseUrl?): {message, developmentLink, link}.
 * usePostRideDraft.ts: PostRideDraftProvider, usePostRideDraft() with setRoute,
 * setSchedule, setCarDetails, clear and getOrCreateRequestId(reviewVisitKey).
 * pendingSharedRide.ts: storePendingSharedRide(code, arrivedAt?),
 * takePendingSharedRide(now?), clearPendingSharedRide().
 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createRidesApi, publishErrorMessageKey, type PublishRideInput, type RidesClient } from '../../features/rides/api';

const input: PublishRideInput = { requestId: 'request', routeId: 'route', direction: 'a_to_b', date: '2026-11-22', time: '07:30', flexMinutes: 10, seats: 2, pickupNote: null, notes: null, repeat: 'once' };
type Response = { data: unknown; error: { message?: string } | null; status?: number };
function fixture() {
 let response: Response = { data: null, error: null, status: 200 };
 const calls: unknown[][] = [];
 const client: RidesClient = { rpc: async (name: string, args?: Record<string, unknown>) => { calls.push([name, args]); return response; } };
 return { api: createRidesApi(client), calls, reply: (next: Response) => { response = next; } };
}
let spies: { mockRestore(): void }[];
beforeEach(() => { spies = Object.getOwnPropertyNames(console).filter(key => typeof console[key as keyof Console] === 'function').map(key => jest.spyOn(console, key as 'log').mockImplementation(() => {})); });
afterEach(() => { try { spies.forEach(spy => expect(spy).not.toHaveBeenCalled()); } finally { spies.forEach(spy => spy.mockRestore()); } });

test('publishRide maps the complete typed input and returns the immutable publish result', async () => {
 const f = fixture(); const result = { series_id: 'series', ride_id: 'ride', share_code: 'ABC12345', ride_count: 1, replayed: false };
 f.reply({ data: result, error: null });
 expect(await f.api.publishRide(input)).toEqual({ seriesId: 'series', rideId: 'ride', shareCode: 'ABC12345', rideCount: 1, replayed: false });
 expect(f.calls).toEqual([['publish_ride', { p_request_id: 'request', p_route_id: 'route', p_direction: 'a_to_b', p_date: '2026-11-22', p_time: '07:30', p_flex_minutes: 10, p_seats: 2, p_pickup_note: null, p_notes: null, p_repeat: 'once' }]]);
});

test('list, detail, link and gate wrappers preserve their typed RPC contracts', async () => {
 const f = fixture(); f.reply({ data: [], error: null });
 expect(await f.api.listRides({ routeId: 'route', direction: 'b_to_a', day: null, after: null, limit: 30 })).toEqual([]);
 expect(f.calls.pop()).toEqual(['list_rides', { p_route_id: 'route', p_direction: 'b_to_a', p_day: null, p_after_departs_at: null, p_after_id: null, p_limit: 30 }]);
 f.reply({ data: { ride_id: 'ride' }, error: null }); await f.api.getRide('ride', 'published'); expect(f.calls.pop()).toEqual(['get_ride', { p_ride_id: 'ride', p_source: 'published' }]);
 f.reply({ data: { state: 'not_found' }, error: null }); expect(await f.api.resolveSharedRide(' code ')).toEqual({ state: 'not_found' }); expect(f.calls.pop()).toEqual(['resolve_shared_ride', { p_code: ' code ' }]);
 f.reply({ data: 'phone_unverified', error: null }); expect(await f.api.canPublish()).toBe('phone_unverified');
});

const publishCodes = ['not_authenticated', 'missing_argument', 'account_missing', 'request_conflict', 'phone_unverified', 'car_not_approved', 'invalid_route', 'invalid_direction', 'invalid_repeat', 'invalid_flexibility', 'invalid_time', 'invalid_seats', 'invalid_pickup_note', 'invalid_notes', 'contact_details_not_allowed', 'in_past', 'beyond_window', 'invalid_weekday', 'rate_limited', 'too_many_series', 'duplicate_ride', 'share_code_unavailable'] as const;
test.each(publishCodes)('publish code %s has a stable message key and is rejected without leaking payloads', async code => {
 const f = fixture(); f.reply({ data: null, error: { message: code }, status: 400 });
 await expect(f.api.publishRide({ ...input, notes: 'private phone 01000000000' })).rejects.toMatchObject({ code, classification: 'rejected', messageKey: publishErrorMessageKey(code) });
 expect(publishErrorMessageKey(code)).toMatch(/^rides\.errors\./);
});

test.each(['profile_incomplete', 'invalid_cursor', 'invalid_limit', 'invalid_day', 'ride_not_found', 'invalid_source'] as const)('reader code %s remains typed', async code => {
 const f = fixture(); f.reply({ data: null, error: { message: code }, status: 400 });
 await expect(f.api.getRide('ride', 'list')).rejects.toMatchObject({ code, classification: 'rejected' });
});

test.each([undefined, 0, 401, 408, 429, 500, 503])('transport status %s is sanitized and uncertain', async status => {
 const f = fixture(); f.reply({ data: null, error: { message: 'private ride payload' }, status });
 await expect(f.api.publishRide(input)).rejects.toMatchObject({ code: 'uncertain', classification: 'uncertain', messageKey: 'rides.errors.uncertain' });
});

const uncertain = { code: 'uncertain', classification: 'uncertain', messageKey: 'rides.errors.uncertain' };

test.each([[{}], [[null]], [[{ ride_id: 1 }]]])('list rejects malformed data %j', async data => {
 const f = fixture();
 f.reply({ data, error: null });
 await expect(f.api.listRides({ routeId: 'route', direction: 'a_to_b' })).rejects.toMatchObject(uncertain);
});

test.each([[[]], [{}], [{ ride_id: 1 }]])('detail rejects malformed data %j', async data => {
 const f = fixture();
 f.reply({ data, error: null });
 await expect(f.api.getRide('ride', 'list')).rejects.toMatchObject(uncertain);
});

test.each([{ state: 'unknown', ride: { ride_id: 'ride' } }, { state: 'available' }, { state: 'full', ride: {} }, { state: 'not_found', ride: { ride_id: 'ride' } }])('link rejects malformed data %j', async data => {
 const f = fixture();
 f.reply({ data, error: null });
 await expect(f.api.resolveSharedRide('CODE1234')).rejects.toMatchObject(uncertain);
});
