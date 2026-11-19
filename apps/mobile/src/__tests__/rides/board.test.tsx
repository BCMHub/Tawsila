import { beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RideBoard } from '../../features/rides/RideBoard';
import { RidesApiProvider } from '../../features/rides/RidesApiProvider';
import type { RidesApi, RideProjection } from '../../features/rides/api';

const mockPush = jest.fn(); jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));
const ride = { ride_id: 'ride', share_code: 'CODE1234', route_id: 'route', direction: 'a_to_b', from_name: 'Maadi', from_area: 'South', to_name: 'New Cairo', to_area: 'East', duration_minutes: 45, ride_date: '2026-11-22', departure_time: '07:30:00', departs_at: '2026-11-22T05:30:00Z', flex_minutes: 10, seats_offered: 3, seats_left: 2, repeat: 'weekdays', pickup_note: 'Main gate', notes: null, created_at: '2026-11-19T09:55:00Z', state: 'available', is_own: false, owner_display: 'Ahmed M.', owner_initials: 'AM', owner_member_since: 'Nov 2026', owner_phone_verified: true, car_label: 'Hyundai Elantra · Sedan' } as RideProjection;
let api: RidesApi;
beforeEach(() => { mockPush.mockReset(); api = { listRides: jest.fn(async () => [ride]) } as unknown as RidesApi; });
const start = () => render(<RidesApiProvider api={api}><RideBoard route={{ id: 'route', fromName: 'Maadi', toName: 'New Cairo' }} /></RidesApiProvider>);
test('D1 renders approved card content and disabled deferred controls', async () => {
 await start(); expect(await screen.findByText('Ahmed M.')).toBeTruthy(); for (const text of ['Phone verified', 'No ratings yet', 'Main gate', 'New Cairo', 'about 45 min', '2 seats left', 'Weekdays', 'Posted 5 min ago']) expect(screen.getByText(text)).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Request seat' })).toBeDisabled(); expect(screen.getByRole('button', { name: /Notifications/ })).toBeDisabled(); expect(screen.queryByText(/notification dot/i)).toBeNull();
});
test('direction and day controls refetch and pull-to-refresh reloads', async () => {
 await start(); await screen.findByText('Ahmed M.'); await fireEvent.press(screen.getByRole('button', { name: 'To Maadi' })); await fireEvent.press(screen.getByRole('button', { name: 'Tomorrow' })); fireEvent(screen.getByTestId('rides-list'), 'refresh');
 await waitFor(() => expect(api.listRides).toHaveBeenCalledTimes(4)); expect(screen.getByRole('button', { name: 'Pick a date' })).toBeTruthy();
});
test('D3 empty actions change day or start posting and retain car entry points', async () => {
 jest.mocked(api.listRides).mockResolvedValue([]); await start(); expect(await screen.findByText(/No rides to New Cairo/)).toBeTruthy(); await fireEvent.press(screen.getByRole('button', { name: 'Try another day' })); expect(screen.getByRole('dialog')).toBeTruthy(); await fireEvent.press(screen.getByRole('button', { name: 'Post a ride' })); expect(mockPush).toHaveBeenCalledWith('/post'); expect(screen.getByRole('button', { name: /car/i })).toBeTruthy();
});
test('list failure is sanitized and Retry reloads', async () => {
 jest.mocked(api.listRides).mockRejectedValueOnce(Error('private')); await start(); await fireEvent.press(await screen.findByRole('button', { name: 'Try again' })); await waitFor(() => expect(api.listRides).toHaveBeenCalledTimes(2)); expect(screen.queryByText('private')).toBeNull();
});
