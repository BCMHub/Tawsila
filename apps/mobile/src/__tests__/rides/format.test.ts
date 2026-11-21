import { afterEach, expect, jest, test } from '@jest/globals';
import { formatPostedAt, formatRideDate, formatRideTime } from '../../features/rides/format';

const originalTz = process.env.TZ;
afterEach(() => {
 jest.restoreAllMocks();
 if (originalTz === undefined) delete process.env.TZ;
 else process.env.TZ = originalTz;
});
test('formats effective Cairo local fields without converting through the device time zone', () => {
 process.env.TZ = 'America/Los_Angeles';
 expect(formatRideDate('2027-04-30')).toBe('Fri 30 Apr');
 expect(formatRideTime('01:30:00')).toBe('1:30 AM');
});
test('Intl and fallback render the server-effective fields for Cairo skipped hour 2027-04-30 00:30', () => {
 const serverResult = { ride_date: '2027-04-30', departure_time: '01:30:00' };
 process.env.TZ = 'Asia/Tokyo';
 expect(formatRideTime(serverResult.departure_time)).toBe('1:30 AM');
 expect(formatRideDate(serverResult.ride_date)).toBe('Fri 30 Apr');
 jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw Error('Intl unavailable'); });
 process.env.TZ = 'America/Los_Angeles';
 expect(formatRideTime(serverResult.departure_time)).toBe('1:30 AM');
 expect(formatRideDate(serverResult.ride_date)).toBe('Fri 30 Apr');
});
test.each([['2026-11-19T09:59:40Z', 'Posted just now'], ['2026-11-19T09:55:00Z', 'Posted 5 min ago'], ['2026-11-19T07:00:00Z', 'Posted 3 hr ago'], ['2026-11-17T10:00:00Z', 'Posted 2 days ago']] as const)('relative timestamp %s renders %s', (created, expected) => {
 expect(formatPostedAt(created, new Date('2026-11-19T10:00:00Z'))).toBe(expected);
});
