import { beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PostRideFlow } from '../../features/rides/PostRideFlow';
import { RidesApiProvider } from '../../features/rides/RidesApiProvider';
import { RidesError, type RidesApi } from '../../features/rides/api';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (href: unknown) => mockReplace(href), push: jest.fn(), back: jest.fn() } }));
let api: RidesApi;
beforeEach(() => { mockReplace.mockReset(); api = { canPublish: jest.fn(async () => 'ok'), publishRide: jest.fn(async () => ({ seriesId: 'series', rideId: 'ride', shareCode: 'CODE1234', rideCount: 1, replayed: false })) } as unknown as RidesApi; });
const start = async () => render(<RidesApiProvider api={api}><PostRideFlow route={{ id: 'route', fromName: 'Maadi', toName: 'New Cairo' }} car={{ label: 'Catalogue car · Sedan', passengerSeats: 4 }} window={{ first: '2026-11-19', last: '2026-12-02' }} /></RidesApiProvider>);

test.each([['phone_unverified', 'Verify your phone to post rides'], ['car_not_approved', '/(verify)/status']] as const)('entry gate %s blocks P1a at the mandated destination', async (gate, expected) => {
 jest.mocked(api.canPublish).mockResolvedValue(gate); await start();
 if (gate === 'phone_unverified') expect(await screen.findByText(expected)).toBeTruthy(); else await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expected));
 expect(screen.queryByText('Route and time')).toBeNull();
});

test('P1a swaps direction and offers only the approved schedule choices', async () => {
 await start(); expect(screen.getByText('Maadi')).toBeTruthy(); expect(screen.getByText('New Cairo')).toBeTruthy(); await fireEvent.press(screen.getByRole('button', { name: 'Reverse' }));
 expect(screen.getAllByText(/Maadi|New Cairo/).map(node => node.props.children)).toEqual(expect.arrayContaining(['New Cairo', 'Maadi']));
 await fireEvent.press(screen.getByRole('button', { name: /Flexibility/ })); for (const n of ['0', '5', '10', '15', '30']) expect(screen.getByRole('radio', { name: new RegExp(`^${n} minutes?$`) })).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: /Leaves at/ })); expect(screen.getByRole('radio', { name: '7:05 AM' })).toBeTruthy(); expect(screen.queryByRole('radio', { name: '7:03 AM' })).toBeNull();
});
test('Weekdays restricts the date sheet to Sunday through Thursday inside the window', async () => {
 await start(); await fireEvent.press(screen.getByRole('radio', { name: 'Weekdays' })); await fireEvent.press(screen.getByRole('button', { name: /Date/ }));
 expect(screen.queryByText('Fri 20 Nov')).toBeNull(); expect(screen.queryByText('Sat 21 Nov')).toBeNull(); expect(screen.getByText('Sun 22 Nov')).toBeTruthy();
});
test('P1b bounds seats by passenger capacity and enforces counters and contact hint', async () => {
 await start(); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); expect(screen.getByText('4 seats · plate hidden')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled(); expect(screen.getByText('To change your car, contact the Tawsila team')).toBeTruthy();
 const minus = screen.getByRole('button', { name: 'Remove seat' }), plus = screen.getByRole('button', { name: 'Add seat' }); expect(minus).toBeDisabled();
 for (let n = 1; n < 4; n++) await fireEvent.press(plus); expect(plus).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Pickup (optional)' }), 'x'.repeat(80)); expect(screen.getByText('80/80')).toBeTruthy();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Notes (optional)' }), 'x'.repeat(200)); expect(screen.getByText('200/200')).toBeTruthy(); expect(screen.getByText(/phone number|contact details/i)).toBeTruthy();
});
test('P1c keeps one request id for retries and disables drafts with approved notes', async () => {
 jest.mocked(api.publishRide).mockRejectedValueOnce(new RidesError('uncertain', 'uncertain', 'rides.errors.uncertain'));
 await start(); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
 expect(screen.getByRole('button', { name: 'Save as draft' })).toBeDisabled(); expect(screen.getByText('Drafts are coming soon')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: 'Publish ride' })); await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
 await waitFor(() => expect(api.publishRide).toHaveBeenCalledTimes(2)); expect(jest.mocked(api.publishRide).mock.calls[0][0].requestId).toBe(jest.mocked(api.publishRide).mock.calls[1][0].requestId);
});
test.each(['missing_argument', 'account_missing', 'request_conflict', 'invalid_route', 'invalid_direction', 'invalid_repeat', 'invalid_flexibility', 'invalid_time', 'invalid_seats', 'invalid_pickup_note', 'invalid_notes', 'contact_details_not_allowed', 'in_past', 'beyond_window', 'invalid_weekday', 'rate_limited', 'too_many_series', 'duplicate_ride', 'share_code_unavailable'] as const)('publish error %s is shown as safe copy', async code => {
 jest.mocked(api.publishRide).mockRejectedValue(new RidesError(code, 'rejected', `rides.errors.${code}`)); await start(); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); await fireEvent.press(screen.getByRole('button', { name: 'Publish ride' }));
 expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByText(code)).toBeNull();
});
test.each([['phone_unverified', 'Verify your phone to post rides'], ['car_not_approved', '/(verify)/status']] as const)('publish gate %s uses its mandated destination', async (code, expected) => {
 jest.mocked(api.publishRide).mockRejectedValue(new RidesError(code, 'rejected', `rides.errors.${code}`)); await start(); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); await fireEvent.press(screen.getByRole('button', { name: 'Continue' })); await fireEvent.press(screen.getByRole('button', { name: 'Publish ride' }));
 if (code === 'phone_unverified') { expect(await screen.findByText(expected)).toBeTruthy(); expect(screen.getByText('Posting is open to members with a verified phone number. Phone verification is coming to Tawsila soon.')).toBeTruthy(); } else await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expected));
});
