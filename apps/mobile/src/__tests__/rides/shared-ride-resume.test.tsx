import { afterEach, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { ExpoRoot, Slot, usePathname } from 'expo-router';
import { createContext, useEffect } from 'react';
import { Text } from 'react-native';
import { AuthRoutes } from '../../app/_layout';
import { redirectSystemPath } from '../../app/+native-intent';
import type { AuthState } from '../../features/auth/AuthProvider';
import { clearPendingSharedRide } from '../../features/rides/pendingSharedRide';

const mockAuthState = createContext<AuthState>('signed_out');
jest.mock('../../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: jest.requireActual<typeof import('react')>('react').useContext(mockAuthState),
  }),
}));
afterEach(clearPendingSharedRide);

test('real router resumes a pending link after the protected route redirects', async () => {
  const visits: string[] = [];
  function Board() {
    useEffect(() => { visits.push('Board'); }, []);
    return <Text>Board</Text>;
  }
  function SharedRide() {
    const path = usePathname();
    useEffect(() => { visits.push(path); }, [path]);
    return <Text>{path}</Text>;
  }
  const paths: Record<string, { default: React.ComponentType }> = {
    './_layout.tsx': { default: AuthRoutes },
    './(onboarding)/index.tsx': { default: () => <Text>Welcome</Text> },
    './(tabs)/_layout.tsx': { default: Slot },
    './(tabs)/index.tsx': { default: Board },
    './(verify)/_layout.tsx': { default: Slot },
    './(verify)/index.tsx': { default: () => null },
    './debug.tsx': { default: () => null },
    './post/_layout.tsx': { default: Slot },
    './post/index.tsx': { default: () => null },
    './ride/_layout.tsx': { default: Slot },
    './ride/[id].tsx': { default: () => null },
    './r/_layout.tsx': { default: Slot },
    './r/[code].tsx': { default: SharedRide },
  };
  const context = Object.assign((key: string) => paths[key], {
    keys: () => Object.keys(paths), id: 'router-trace', resolve: (key: string) => key,
  });
  const app = (state: AuthState) => (
    <mockAuthState.Provider value={state}>
      <ExpoRoot context={context} location="/(onboarding)" />
    </mockAuthState.Provider>
  );
  const view = await render(app('signed_out'));
  expect(screen.getByText('Welcome')).toBeTruthy();
  redirectSystemPath({ path: 'tawsila://r/E4CJREZW', initial: false });
  await view.rerender(app('ready_to_browse'));
  expect(await screen.findByText('/r/E4CJREZW')).toBeTruthy();
  expect(visits).toEqual(['Board', '/r/E4CJREZW']);
});
