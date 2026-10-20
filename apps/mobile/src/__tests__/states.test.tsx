import { expect, jest, test } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { strings } from '../strings';

jest.mock('expo-image', () => ({ Image: 'Image' }));

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

test('error announces its title and message on mount', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await render(<ErrorState onRetry={() => {}} />);
  expect(announce).toHaveBeenCalledWith(`${strings.offlineTitle}. ${strings.offlineBody}`);
  expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
  announce.mockRestore();
});

test('fill centres each state in the available screen', async () => {
  const view = await render(<LoadingState fill />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
  await view.rerender(<EmptyState fill title="Empty" body="Nothing here" />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
  await view.rerender(<ErrorState fill onRetry={() => {}} />);
  expect(view.root).toHaveStyle({ flex: 1, justifyContent: 'center', alignItems: 'center' });
});
