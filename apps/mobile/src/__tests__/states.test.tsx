import { afterEach, expect, jest, test } from '@jest/globals';
import { AccessibilityInfo, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { strings } from '../strings';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SymbolView: (props: object) => <View {...props} testID="offline-symbol" /> };
});
afterEach(() => { jest.restoreAllMocks(); });

test('loading announces progress and busy state', async () => {
  await render(<LoadingState />);
  expect(screen.getByRole('progressbar', { name: strings.loading }).props.accessibilityState.busy).toBe(true);
});
test('offline error announces an alert and retries', async () => {
  const onRetry = jest.fn();
  await render(<ErrorState onRetry={onRetry} />);
  expect(screen.getByRole('alert', { name: `${strings.offlineTitle}. ${strings.offlineBody}` })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: strings.retry }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
test('offline icon uses decorative platform symbols instead of the supplied SVG', async () => {
  const view = await render(<ErrorState onRetry={() => {}} />);
  const symbol = screen.getByTestId('offline-symbol');
  expect(symbol.props.name).toEqual({ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' });
  expect(symbol.props.size).toBe(60);
  expect(symbol.props.accessible).toBe(false);
  expect(symbol.props.tintColor).toBe(screen.getByText(strings.offlineBody).props.style.color);
  expect(JSON.stringify(view.toJSON())).not.toContain('"type":"Image"');
});
test('empty state renders supplied content and both functional actions', async () => {
  const primary = jest.fn(); const secondary = jest.fn();
  await render(<EmptyState title="No items" body="Come back soon" primaryAction={{ label: 'Add item', onPress: primary }} secondaryAction={{ label: 'Learn more', onPress: secondary }} />);
  expect(screen.queryByRole('summary')).toBeNull();
  expect(screen.getByText('No items')).toBeTruthy();
  expect(screen.getByText('Come back soon')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add item' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Learn more' }));
  expect(primary).toHaveBeenCalledTimes(1); expect(secondary).toHaveBeenCalledTimes(1);
});

test.each(['ios', 'android'] as const)('error announcement on %s avoids duplicate live-region speech', async platform => {
  jest.replaceProperty(Platform, 'OS', platform);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  announce.mockClear();
  await render(<ErrorState onRetry={() => {}} />);
  if (platform === 'ios') {
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(`${strings.offlineTitle}. ${strings.offlineBody}`);
  } else {
    expect(announce).not.toHaveBeenCalled();
  }
  expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
});

test('fill centres each state in the available screen', async () => {
  const view = await render(<LoadingState fill />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
  await view.rerender(<EmptyState fill title="Empty" body="Nothing here" />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
  await view.rerender(<ErrorState fill onRetry={() => {}} />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
});
