import { expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSessionEmail } from '../../features/onboarding/useSessionEmail';
let mockResolve: (value: unknown) => void;
let mockListener: (event: string, session: unknown) => void;
const mockUnsubscribe = jest.fn();
jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ auth: {
 getSession: () => new Promise(resolve => { mockResolve = resolve; }),
 onAuthStateChange: (listener: typeof mockListener) => { mockListener = listener; return { data: { subscription: { unsubscribe: mockUnsubscribe } } }; },
} }) }));
function Display() { return <Text>{useSessionEmail()}</Text>; }
test('session email reads display data and unsubscribes on unmount', async () => {
 const view = await render(<Display />); await act(async () => mockResolve({ data: { session: { user: { email: 'demo@example.test' } } } })); expect(screen.getByText('demo@example.test')).toBeTruthy();
 await view.unmount(); expect(mockUnsubscribe).toHaveBeenCalled();
});
test('new auth event cannot be overwritten by an older session read', async () => {
 await render(<Display />); await act(async () => mockListener('SIGNED_OUT', null)); await act(async () => mockResolve({ data: { session: { user: { email: 'old@example.test' } } } })); expect(screen.queryByText('old@example.test')).toBeNull();
});
