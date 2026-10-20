import { jest, test, expect, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { I18nManager, Alert } from 'react-native';
import DebugScreen from '../app/debug';
import TabsLayout from '../app/(tabs)/_layout';
import { NavBar } from '../components/NavBar';
import { TabScreen } from '../components/TabScreen';
import { strings } from '../strings';

let mockState: string | undefined;
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('expo-router', () => {
 const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
 return ({
  useLocalSearchParams: () => ({ state: mockState }),
  Redirect: ({ href }: { href: string }) => <Text>Redirect {href}</Text>,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <Text accessibilityRole="link" accessibilityLabel={href}>{children}</Text>,
  router: { back: jest.fn(), push: jest.fn() },
}); });
jest.mock('expo-router/native-tabs', () => {
  const { View, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const NativeTabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const Trigger = ({ children, name }: { children: React.ReactNode; name: string }) => <View testID={name}>{children}</View>;
  Trigger.Label = function Label({ children }: { children: React.ReactNode }) { return <Text>{children}</Text>; };
  Trigger.Icon = function Icon() { return null; };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
afterEach(() => { mockState = undefined; Object.assign(globalThis, { __DEV__: true }); jest.restoreAllMocks(); });

test('tabs retain approved order and labels', async () => {
  await render(<TabsLayout />);
  expect(screen.getAllByText(/^(Board|Trips|Messages|Profile)$/).map(n => n.props.children)).toEqual(['Board', 'Trips', 'Messages', 'Profile']);
  expect(screen.getAllByTestId(/^(index|trips|messages|profile)$/).map(n => n.props.testID)).toEqual(['index', 'trips', 'messages', 'profile']);
});
test('debug redirects in production', async () => {
  Object.assign(globalThis, { __DEV__: false });
  await render(<DebugScreen />);
  expect(screen.getByText('Redirect /')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
test.each([undefined, 'unknown'])('debug index links to each state for %s', async state => {
  mockState = state;
  await render(<DebugScreen />);
  expect(screen.getAllByRole('link').map(n => n.props.accessibilityLabel)).toEqual(['/debug?state=loading', '/debug?state=empty', '/debug?state=error']);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText(strings.emptyTitle)).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
test.each(['loading', 'empty', 'error'])('debug renders only the %s state', async state => {
  mockState = state;
  await render(<DebugScreen />);
  expect(screen.queryAllByRole('progressbar')).toHaveLength(state === 'loading' ? 1 : 0);
  expect(screen.queryAllByText(strings.emptyTitle)).toHaveLength(state === 'empty' ? 1 : 0);
  expect(screen.queryAllByRole('alert')).toHaveLength(state === 'error' ? 1 : 0);
});
test.each(['large', 'inline'] as const)('NavBar %s title and optional back action', async variant => {
  const view = await render(<NavBar title="Title" variant={variant} onMore={() => {}} />);
  expect(screen.getByRole('header', { name: 'Title' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: strings.back })).toBeNull();
  const back = jest.fn();
  await view.rerender(<NavBar title="Title" variant={variant} onBack={back} onMore={() => {}} />);
  await fireEvent.press(screen.getByRole('button', { name: strings.back }));
  expect(back).toHaveBeenCalledTimes(1);
});
test('back chevron mirrors in RTL', async () => {
  jest.replaceProperty(I18nManager, 'isRTL', true);
  await render(<NavBar title="Title" variant="inline" onBack={() => {}} onMore={() => {}} />);
  expect(screen.getByRole('button', { name: strings.back }).children[0]).toHaveStyle({ transform: [{ scaleX: -1 }] });
});
test('tab more action is neutral', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await render(<TabScreen title="Board" />);
  await fireEvent.press(screen.getByRole('button', { name: strings.more }));
  expect(alert).not.toHaveBeenCalled();
});
