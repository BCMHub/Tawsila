import { afterEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import { ShareRideSheet } from '../../features/rides/ShareRideSheet';
import { PublishedRide } from '../../features/rides/PublishedRide';

const message = 'Arabic عربي & ? # +\nMaadi → New Cairo';
afterEach(() => { jest.restoreAllMocks(); });
test('Open WhatsApp URL-encodes the whole message exactly once', async () => {
 const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
 await render(<ShareRideSheet message={message} developmentLink={false} />); await fireEvent.press(screen.getByRole('button', { name: 'Open WhatsApp' }));
 await waitFor(() => expect(open).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(message)}`)); expect(open).toHaveBeenCalledTimes(1);
});
test('opening failure falls back to the system share with identical text and no visible error', async () => {
 jest.spyOn(Linking, 'openURL').mockRejectedValue(Error('unavailable')); const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
 await render(<ShareRideSheet message={message} developmentLink={false} />); await fireEvent.press(screen.getByRole('button', { name: 'Open WhatsApp' }));
 await waitFor(() => expect(share).toHaveBeenCalledWith({ message })); expect(share).toHaveBeenCalledTimes(1); expect(screen.queryByRole('alert')).toBeNull();
});
test('both share mechanisms failing shows a sanitized error', async () => {
 jest.spyOn(Linking, 'openURL').mockRejectedValue(Error('private')); jest.spyOn(Share, 'share').mockRejectedValue(Error('private'));
 await render(<ShareRideSheet message={message} developmentLink />); expect(screen.getByText('Development link')).toBeTruthy(); await fireEvent.press(screen.getByRole('button', { name: 'Open WhatsApp' }));
 expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.queryByText('private')).toBeNull();
});
test('P2 Share on WhatsApp opens P3 with the exact generated message', async () => {
 await render(<PublishedRide rideId="ride" message={message} />); await fireEvent.press(screen.getByRole('button', { name: 'Share on WhatsApp' })); expect(screen.getByText(message)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Open WhatsApp' })).toBeTruthy();
});
