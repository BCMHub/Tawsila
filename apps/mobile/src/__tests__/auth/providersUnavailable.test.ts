import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthProvider } from '../../features/auth/AuthProvider';
import { AuthScreen } from '../../components/AuthScreen';
import { fakeAuthClient } from '../helpers/fakeAuthClient';
import { expect, jest, test } from '@jest/globals';
import { createProviderHandlers } from '../../features/auth/providers';
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('react-native-nitro-google-signin', () => {
  throw Error('synthetic absent native module');
});
test('a missing native module is unavailable without logging', async () => {
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'synthetic-web';
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'synthetic-ios';
  const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
  try {
    await expect(createProviderHandlers('ios', {
      randomNonce: async () => 'synthetic-raw', sha256Hex: async () => 'synthetic-hash',
    }).google()).rejects.toEqual({ code: 'unavailable' });
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    const f = fakeAuthClient();
    await render(createElement(AuthProvider, {
      client: f.client, providers: createProviderHandlers('ios', {randomNonce:async () => 'raw', sha256Hex:async () => 'hash'}),
      installGuard: {isFreshInstall:async () => false},
    }, createElement(AuthScreen)));
    await act(async () => {await fireEvent.press(screen.getByRole('button'));});
    expect(screen.getByText("Google sign-in isn't available on this device.")).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);
  } finally {
    spies.forEach(spy => spy.mockRestore());
    if (web === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = web;
    if (ios === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ios;
  }
});
