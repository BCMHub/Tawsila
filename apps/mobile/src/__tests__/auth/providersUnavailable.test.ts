import { expect, jest, test } from '@jest/globals';
import { createProviderHandlers } from '../../features/auth/providers';
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
  } finally {
    spies.forEach(spy => spy.mockRestore());
    if (web === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = web;
    if (ios === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ios;
  }
});
