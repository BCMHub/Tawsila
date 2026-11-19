import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { redirectSystemPath } from '../../app/+native-intent';
import { clearPendingSharedRide, storePendingSharedRide, takePendingSharedRide } from '../../features/rides/pendingSharedRide';
import { AuthRoutes } from '../../app/_layout';

let mockState = 'signed_out'; const mockReplace = jest.fn();
jest.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: mockState }) }));
jest.mock('expo-router', () => {
 const React = jest.requireActual<typeof import('react')>('react'); const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
 const Screen = ({ name }: { name: string }) => <Text>{name}</Text>; const Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) => guard ? <>{children}</> : null; const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>; Stack.Screen = Screen; Stack.Protected = Protected;
 return { Stack, router: { replace: (href: unknown) => mockReplace(href) } };
});
afterEach(() => { clearPendingSharedRide(); mockReplace.mockReset(); mockState = 'signed_out'; jest.useRealTimers(); });
test.each(['https://tawsila.example/r/ABCI23LO', 'tawsila://r/ABCI23LO'])('native intent maps %s and stores its code', path => { expect(redirectSystemPath({ path, initial: true })).toBe('/r/ABCI23LO'); expect(takePendingSharedRide(new Date())).toBe('ABCI23LO'); });
test('native intent leaves unrelated and malformed paths safe', () => { expect(redirectSystemPath({ path: 'tawsila://profile', initial: true })).toBe('/'); expect(takePendingSharedRide(new Date())).toBeNull(); });
test.each([['signed_out', '(onboarding)'], ['needs_profile', '(onboarding)'], ['ready_to_browse', '(tabs)']] as const)('route guard for %s exposes only %s', async (authState, visible) => { mockState = authState; await render(<AuthRoutes />); expect(screen.getByText(visible)).toBeTruthy(); if (authState === 'ready_to_browse') for (const route of ['post', 'ride', 'r']) expect(screen.getByText(route)).toBeTruthy(); else for (const route of ['post', 'ride', 'r']) expect(screen.queryByText(route)).toBeNull(); });
test.each(['signed_out', 'needs_profile'])('pending link resumes once after %s becomes ready', async initial => { mockState = initial; storePendingSharedRide('CODE1234', new Date('2026-11-19T10:00:00Z')); jest.useFakeTimers().setSystemTime(new Date('2026-11-19T10:01:00Z')); const view = await render(<AuthRoutes />); mockState = 'ready_to_browse'; await act(async () => view.rerender(<AuthRoutes />)); expect(mockReplace).toHaveBeenCalledWith('/r/CODE1234'); await act(async () => view.rerender(<AuthRoutes />)); expect(mockReplace).toHaveBeenCalledTimes(1); });
test('sign-out clears a pending link', async () => { storePendingSharedRide('CODE1234'); mockState = 'ready_to_browse'; const view = await render(<AuthRoutes />); mockState = 'signed_out'; await act(async () => view.rerender(<AuthRoutes />)); expect(takePendingSharedRide()).toBeNull(); });
test('pending links expire at 30 minutes and a newer link replaces the older one', () => { storePendingSharedRide('OLD', new Date('2026-11-19T10:00:00Z')); storePendingSharedRide('NEW', new Date('2026-11-19T10:01:00Z')); expect(takePendingSharedRide(new Date('2026-11-19T10:30:59Z'))).toBe('NEW'); storePendingSharedRide('LATE', new Date('2026-11-19T10:00:00Z')); expect(takePendingSharedRide(new Date('2026-11-19T10:30:01Z'))).toBeNull(); });
