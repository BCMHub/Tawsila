import React from 'react';
import { StyleSheet } from 'react-native';
import { strings } from '../../strings';
import { jest, test, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { AuthState, Notice } from '../../features/auth/AuthProvider';
import { AuthScreen } from '../../components/AuthScreen';
import RootLayout, { AuthRoutes } from '../../app/_layout';
let mockState: AuthState = 'signed_out';
const mockRetry = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockSignIn = jest.fn<(provider: 'google') => Promise<void>>().mockResolvedValue(undefined);
let mockNotice: Notice = null;
jest.mock('../../features/auth/AuthProvider', () => ({ AuthProvider: ({ children }: React.PropsWithChildren) => children, useAuth: () => ({ state: mockState, notice: mockNotice, canRetry: mockState === 'account_provision_error' || mockNotice === 'failed', retry: mockRetry, signIn: mockSignIn }) }));
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('expo-router', () => {
 const { View, Text } = jest.requireActual<typeof import('react-native')>('react-native');
 const Stack = Object.assign(({ children }: React.PropsWithChildren) => <View>{children}</View>, { Protected: ({ guard, children }: React.PropsWithChildren<{ guard: boolean }>) => guard ? children : null, Screen: ({ name }: { name: string }) => <Text>{name}</Text> });
 return { Stack };
});
const states: AuthState[] = ['signed_out', 'authenticating', 'checking', 'account_provision_error', 'needs_profile', 'ready_to_browse'];
test.each(states)('%s has its screen and protected route membership', async state => {
 mockState = state; mockNotice = null;
 const view = await render(<AuthScreen />);
 expect(screen.queryByRole('button', { name: 'Continue with Google' }) !== null).toBe(state === 'signed_out');
 expect(screen.queryByRole('button', { name: 'Try again' }) !== null).toBe(state === 'account_provision_error');
 expect(screen.queryByText('Almost there') !== null).toBe(state === 'needs_profile');
 expect(screen.queryByRole('progressbar') !== null).toBe(state === 'checking');
 if (state === 'authenticating') expect(screen.queryAllByRole('button')).toHaveLength(0);
 if (state === 'authenticating') expect(screen.getByText('Signing in with Google…').props.accessibilityLiveRegion).toBe('polite');
 expect(screen.queryByText(/Apple/)).toBeNull(); expect(screen.queryByRole('textbox')).toBeNull();
 if (state === 'needs_profile') expect(screen.queryAllByRole('button')).toHaveLength(0);
 await view.unmount();
 const routes = await render(<AuthRoutes />);
 for (const route of ['(tabs)', 'debug']) expect(screen.queryByText(route) !== null).toBe(state === 'ready_to_browse');
 expect(screen.queryByText('(onboarding)') !== null).toBe(state !== 'ready_to_browse');
 await routes.unmount();
});
test.each<[Notice, string, string]>([
 ['cancelled', 'Sign-in was cancelled. You can try again.', 'polite'],
 ['offline', "You're offline. Check your connection and try again.", 'polite'],
 ['unavailable', "Google sign-in isn't available on this device.", 'assertive'],
 ['provider_failed', 'Something went wrong with Google. Please try again.', 'assertive'],
 ['failed', 'Something went wrong with Google. Please try again.', 'assertive'],
])('notice %s is announced', async (notice, text, live) => {
 mockState = 'signed_out'; mockNotice = notice;
 const view = await render(<AuthScreen />);
 expect(screen.getByText(text).parent?.props.accessibilityLiveRegion).toBe(live);
 const button = screen.getByRole('button');
 expect(button.props.accessibilityState.disabled).toBe(notice === 'unavailable');
 mockRetry.mockClear(); mockSignIn.mockClear();
 if (notice !== 'unavailable') { await fireEvent.press(button); if (notice === 'failed') { expect(mockRetry).toHaveBeenCalled(); expect(mockSignIn).not.toHaveBeenCalled(); } else expect(mockSignIn).toHaveBeenCalledWith('google'); }
 await view.unmount();
});
test('provision retry is assertive and invokes retry', async () => {
 mockState = 'account_provision_error'; mockNotice = null;
 const view = await render(<AuthScreen />);
 expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
 await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); expect(mockRetry).toHaveBeenCalled();
 await view.unmount();
});

test('missing configuration displays developer guidance', async () => {
 const view = await render(<RootLayout />);
 expect(screen.getByText('Authentication configuration required')).toBeTruthy();
 expect(screen.getByRole('alert').props.children).toContain('EXPO_PUBLIC_SUPABASE_URL');
 await view.unmount();
});

test('Welcome benefits use available width and titles keep whole words at large text sizes', async () => {
 mockState = 'signed_out'; mockNotice = null;
 const view = await render(<AuthScreen />);
 for (const benefit of strings.auth.benefits) {
  const style = StyleSheet.flatten(screen.getByText(benefit).props.style);
  expect(style.maxWidth).toBeUndefined();
  expect(style.flex).toBe(1); expect(style.minWidth).toBe(0);
 }
 // Measured on the Simulator at the largest accessibility size: at 2 the longest headline line ("Go further,") still fits 345 pt with whole words; above it words break.
 for (const title of [screen.getByText(strings.auth.brand), screen.getByRole('header')]) {
  expect(title.props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(1.5);
  expect(title.props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  expect(title.props.allowFontScaling).not.toBe(false);
 }
 await view.unmount();
});
