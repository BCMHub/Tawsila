import { expect, test } from '@jest/globals';
import { buildShareMessage } from '../../features/rides/shareMessage';

const ride = { from_name: 'Maadi', to_name: 'New Cairo', ride_date: '2026-11-22', departure_time: '07:30:00', seats_offered: 1, repeat: 'once', share_code: 'ABC12345', owner_display: 'Private Name', owner_phone: '+201000000000', pickup_note: 'Secret pickup', notes: 'Secret notes', car_label: 'Secret car', plate_number: 'ABC 123' };
test('builds the exact singular https message', () => {
 expect(buildShareMessage(ride, 'https://tawsila.example')).toEqual({ developmentLink: false, link: 'https://tawsila.example/r/ABC12345', message: 'Tawsila · ride offer\nMaadi → New Cairo\nSun 22 Nov · leaves around 7:30 AM\n1 seat offered\nhttps://tawsila.example/r/ABC12345' });
});
test('plural weekdays message uses the development scheme and flag', () => {
 expect(buildShareMessage({ ...ride, seats_offered: 3, repeat: 'weekdays' })).toEqual({ developmentLink: true, link: 'tawsila://r/ABC12345', message: 'Tawsila · ride offer\nMaadi → New Cairo\nSun 22 Nov · leaves around 7:30 AM · weekdays\n3 seats offered\ntawsila://r/ABC12345' });
});
test('message excludes every private projection-adjacent value', () => {
 const output = buildShareMessage(ride, 'https://tawsila.example').message;
 for (const value of ['Private Name', '+201000000000', 'Secret pickup', 'Secret notes', 'Secret car', 'ABC 123']) expect(output).not.toContain(value);
});
