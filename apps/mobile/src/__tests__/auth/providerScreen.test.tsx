import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';
import { AuthProvider } from '../../features/auth/AuthProvider';
import { createProviderHandlers } from '../../features/auth/providers';
import { AuthScreen } from '../../components/AuthScreen';
import { fakeAuthClient } from '../helpers/fakeAuthClient';
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: { configure: jest.fn(), presentExplicitSignIn: jest.fn() },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-symbols', () => ({ SymbolView: (props: object) => require('react').createElement(require('react-native').View, { ...props, testID: 'symbol' }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
const native = jest.mocked(GoogleOneTapSignIn);
const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
afterEach(() => {
  if (web === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = web;
  if (ios === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ios;
  jest.clearAllMocks();
});
test.each(['thrown', 'noSavedCredentialFound', 'other', 'missing-config', 'android'])('real handler screen: %s', async mode => {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'synthetic-web';
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'synthetic-ios';
  if (mode === 'missing-config') delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (mode === 'thrown') native.presentExplicitSignIn.mockRejectedValue({code:'ONE_TAP_START_FAILED'});
  else native.presentExplicitSignIn.mockResolvedValue({type: mode === 'other' ? 'unexpected' : 'noSavedCredentialFound', data:null} as never);
  const handlers = createProviderHandlers(mode === 'android' ? 'android' : 'ios', {randomNonce:async () => 'raw', sha256Hex:async () => 'hash'});
  const unavailable = mode === 'missing-config' || mode === 'android';
  await expect(handlers.google()).rejects.toEqual({code: unavailable ? 'unavailable' : 'failed'});
  const f = fakeAuthClient();
  await render(<AuthProvider client={f.client} providers={handlers} installGuard={{isFreshInstall:async () => false}}><AuthScreen /></AuthProvider>);
  await act(async () => {await fireEvent.press(screen.getByRole('button'));});
  expect(screen.getByText(unavailable ? "Google sign-in isn't available on this device." : 'Something went wrong with Google. Please try again.')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(unavailable);
});

test('offline provision error uses an assertive warning banner', async () => {
  const f = fakeAuthClient({access_token:'fixture',user:{id:'fixture'}});
  f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data:null,error:{status:503}})})})});
  await render(<AuthProvider client={f.client} providers={{google:async () => ({idToken:'fixture'})}} installGuard={{isFreshInstall:async () => false}}><AuthScreen /></AuthProvider>);
  expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
  expect(screen.getAllByTestId('symbol').some(icon => icon.props.name === 'exclamationmark.triangle')).toBe(true);
});
