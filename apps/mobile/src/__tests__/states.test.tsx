import { expect, jest, test } from '@jest/globals';
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
  expect(screen.getByRole('summary', { name: 'No items. Come back soon' })).toBeTruthy();
  expect(screen.getByText('No items')).toBeTruthy();
  expect(screen.getByText('Come back soon')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add item' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Learn more' }));
  expect(primary).toHaveBeenCalledTimes(1); expect(secondary).toHaveBeenCalledTimes(1);
});
