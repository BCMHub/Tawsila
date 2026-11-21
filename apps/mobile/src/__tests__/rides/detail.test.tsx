import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RideDetail } from '../../features/rides/RideDetail';

const ride = { ride_id: 'ride', state: 'available', from_name: 'Maadi', from_area: 'South', to_name: 'New Cairo', to_area: 'East', duration_minutes: 45, ride_date: '2026-11-22', departure_time: '07:30:00', flex_minutes: 10, seats_left: 2, pickup_note: 'Main gate', notes: 'Quiet ride', owner_display: 'Ahmed M.', owner_initials: 'AM', owner_member_since: 'Nov 2026', owner_phone_verified: true, car_label: 'Hyundai Elantra · Sedan', repeat: 'once', share_code: 'CODE1234' } as const;
test('D2 shows route, owner privacy details and only approved actions', async () => {
 const share = jest.fn(); await render(<RideDetail ride={ride} onShare={share} />); for (const text of ['Main gate', 'Quiet ride', 'No ratings yet · since Nov 2026', 'Hyundai Elantra · Sedan', '2 seats left']) expect(screen.getByText(text)).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Request a seat' })).toBeDisabled(); expect(screen.queryByRole('button', { name: 'More options' })).toBeNull(); await fireEvent.press(screen.getByRole('button', { name: 'Share on WhatsApp' })); expect(share).toHaveBeenCalledTimes(1);
});
test('full detail shows the D4a banner and does not offer sharing', async () => {
 await render(<RideDetail ride={{ ...ride, state: 'full' }} onShare={() => {}} />);
 expect(screen.getByRole('alert')).toHaveTextContent('This ride is full. Ahmed has no seats left on Sun 22 Nov. Other rides on the same day are listed on the Rides tab.');
 expect(screen.queryByRole('button', { name: 'Share on WhatsApp' })).toBeNull();
});
test.each(['departed', 'cancelled', 'withdrawn'] as const)('non-available %s detail shows the D4b banner and does not offer sharing', async state => {
 await render(<RideDetail ride={{ ...ride, state }} onShare={() => {}} />);
 expect(screen.getByRole('alert')).toHaveTextContent('This ride is no longer available. It was cancelled or has already left. Shared links always show the latest status.');
 expect(screen.queryByRole('button', { name: 'Share on WhatsApp' })).toBeNull();
});
