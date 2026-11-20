import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { NavigationState } from 'expo-router';
import { redirectSystemPath } from '../../app/+native-intent';
import { clearPendingSharedRide, storePendingSharedRide, takePendingSharedRide } from '../../features/rides/pendingSharedRide';
import { AuthRoutes } from '../../app/_layout';

let mockState = 'signed_out'; const mockReplace = jest.fn();
function navigationState(name: string, code?: string): NavigationState {
 const rideState = code ? {
  index: 0,
  routes: [{ key: 'shared-ride', name: '[code]', params: { code } }],
 } : undefined;
 return {
  key: 'root',
  routeKeySeq: 1,
  stale: false,
  index: 0,
  routeNames: ['__root'],
  routes: [{
   key: 'root-layout',
   name: '__root',
   state: {
    key: 'app-stack',
    index: 0,
    // Expo Router keeps all the protected routes registered.
    routeNames: ['(onboarding)/index', '(tabs)', 'r'],
    routes: [{ key: name, name, state: rideState }],
   },
  }],
 };
}
let mockNavigation: NavigationState | undefined = navigationState('(tabs)');
jest.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: mockState }) }));
jest.mock('expo-router', () => {
 const React = jest.requireActual<typeof import('react')>('react'); const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
 const Screen = ({ name }: { name: string }) => <Text>{name}</Text>; const Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) => guard ? <>{children}</> : null;
 const Stack = ({ children, layout }: { children: React.ReactNode; layout?: (props: { children: React.ReactNode }) => React.ReactNode }) =>
  layout ? layout({ children }) : <>{children}</>;
 Stack.Screen = Screen; Stack.Protected = Protected;
 return { Stack, router: { replace: (href: unknown) => mockReplace(href) }, useRootNavigationState: () => mockNavigation };
});
afterEach(() => { clearPendingSharedRide(); mockReplace.mockReset(); mockState = 'signed_out'; mockNavigation = navigationState('(tabs)'); jest.useRealTimers(); });
test.each(['https://tawsila.example/r/ABCI23LO', 'tawsila://r/ABCI23LO'])('native intent maps %s and stores its code', path => { expect(redirectSystemPath({ path, initial: true })).toBe('/r/ABCI23LO'); expect(takePendingSharedRide(new Date())).toBe('ABCI23LO'); });
test('native intent leaves unrelated and malformed paths safe', () => { expect(redirectSystemPath({ path: 'tawsila://profile', initial: true })).toBe('/'); expect(takePendingSharedRide(new Date())).toBeNull(); });
test.each([['signed_out', '(onboarding)'], ['needs_profile', '(onboarding)'], ['ready_to_browse', '(tabs)']] as const)('route guard for %s exposes only %s', async (authState, visible) => { mockState = authState; await render(<AuthRoutes />); expect(screen.getByText(visible)).toBeTruthy(); if (authState === 'ready_to_browse') for (const route of ['post', 'ride', 'r']) expect(screen.getByText(route)).toBeTruthy(); else for (const route of ['post', 'ride', 'r']) expect(screen.queryByText(route)).toBeNull(); });
test.each(['signed_out', 'needs_profile'])('pending link resumes once after %s becomes ready', async initial => { mockState = initial; storePendingSharedRide('CODE1234', new Date('2026-11-19T10:00:00Z')); jest.useFakeTimers().setSystemTime(new Date('2026-11-19T10:01:00Z')); const view = await render(<AuthRoutes />); mockState = 'ready_to_browse'; await act(async () => view.rerender(<AuthRoutes />)); expect(mockReplace).toHaveBeenCalledWith('/r/CODE1234'); await act(async () => view.rerender(<AuthRoutes />)); expect(mockReplace).toHaveBeenCalledTimes(1); });

test('pending link waits for the Board after the sign-in guard changes', async () => {
 mockNavigation = undefined;
 redirectSystemPath({ path: 'tawsila://r/E4CJREZW', initial: false });
 const view = await render(<AuthRoutes />);

 for (const state of ['authenticating', 'checking', 'ready_to_browse']) {
  mockState = state;
  await view.rerender(<AuthRoutes />);
  expect(mockReplace).not.toHaveBeenCalled();
 }

 mockNavigation = navigationState('(onboarding)/index');
 await view.rerender(<AuthRoutes />);
 expect(mockReplace).not.toHaveBeenCalled();

 mockNavigation = navigationState('(tabs)');
 await view.rerender(<AuthRoutes />);
 expect(mockReplace).toHaveBeenCalledWith('/r/E4CJREZW');

 mockNavigation = navigationState('r', 'E4CJREZW');
 await view.rerender(<AuthRoutes />);
 mockNavigation = navigationState('(tabs)');
 await view.rerender(<AuthRoutes />);
 expect(mockReplace).toHaveBeenCalledTimes(1);
 expect(takePendingSharedRide()).toBeNull();
});

test('sign-out clears a link while the guard redirect is pending', async () => {
 mockNavigation = navigationState('(onboarding)/index');
 storePendingSharedRide('E4CJREZW');
 mockState = 'ready_to_browse';
 const view = await render(<AuthRoutes />);
 mockState = 'signed_out';
 await view.rerender(<AuthRoutes />);
 expect(takePendingSharedRide()).toBeNull();
 expect(mockReplace).not.toHaveBeenCalled();
});

test('an already-open shared ride is not replaced on ready startup', async () => {
 mockState = 'ready_to_browse';
 mockNavigation = navigationState('r', 'E4CJREZW');
 redirectSystemPath({ path: 'tawsila://r/E4CJREZW', initial: true });
 await render(<AuthRoutes />);
 expect(mockReplace).not.toHaveBeenCalled();
 expect(takePendingSharedRide()).toBeNull();
});

test('sign-out clears a pending link', async () => { storePendingSharedRide('CODE1234'); mockState = 'ready_to_browse'; const view = await render(<AuthRoutes />); mockState = 'signed_out'; await act(async () => view.rerender(<AuthRoutes />)); expect(takePendingSharedRide()).toBeNull(); });
test('pending links expire at 30 minutes and a newer link replaces the older one', () => { storePendingSharedRide('OLD', new Date('2026-11-19T10:00:00Z')); storePendingSharedRide('NEW', new Date('2026-11-19T10:01:00Z')); expect(takePendingSharedRide(new Date('2026-11-19T10:30:59Z'))).toBe('NEW'); storePendingSharedRide('LATE', new Date('2026-11-19T10:00:00Z')); expect(takePendingSharedRide(new Date('2026-11-19T10:30:01Z'))).toBeNull(); });
