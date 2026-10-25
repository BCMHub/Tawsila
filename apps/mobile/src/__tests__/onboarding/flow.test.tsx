import { beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { OnboardingFlow } from '../../features/onboarding/OnboardingFlow';
import { OnboardingApiProvider } from '../../features/onboarding/OnboardingApiProvider';
import { OnboardingError, type OnboardingApi } from '../../features/onboarding/api';
const mockRefresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
let mockDark = false;
let mockState = 'needs_profile';
jest.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ refresh: mockRefresh, state: mockState }) }));
jest.mock('../../features/onboarding/useSessionEmail', () => ({ useSessionEmail: () => 'demo@example.test' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../../theme', () => { const actual = jest.requireActual<typeof import('../../theme')>('../../theme'); return { ...actual, useTheme: () => mockDark ? actual.dark : actual.light }; });
const legal = { terms: 't1', privacy: 'p1' };
let api: OnboardingApi;
beforeEach(() => {
 mockRefresh.mockReset().mockResolvedValue(undefined); mockDark = false; mockState = 'needs_profile';
 api = { listCommunities: jest.fn<OnboardingApi['listCommunities']>().mockResolvedValue([{ id: 'area', name: 'Area A', active: true, sort_order: 0 }]), currentLegalVersions: jest.fn<OnboardingApi['currentLegalVersions']>().mockResolvedValue(legal), completeProfile: jest.fn<OnboardingApi['completeProfile']>().mockResolvedValue(undefined) } as unknown as OnboardingApi;
});
const start = async () => { const view = await render(<OnboardingApiProvider api={api}><OnboardingFlow /></OnboardingApiProvider>); const theme = jest.requireActual<typeof import('../../theme')>('../../theme')[mockDark ? 'dark' : 'light']; expect(screen.getByText('Tell us about you')).toHaveStyle({ color: theme['label/primary'] }); return view; };
const next = () => fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
async function names() { await fireEvent.changeText(screen.getByRole('textbox', { name: 'First name' }), 'Sam'); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Last name' }), 'Ali'); await next(); await waitFor(() => expect(screen.getAllByRole('checkbox')[0].props.accessibilityState.disabled).toBe(false)); }
async function accept() { for (const row of screen.getAllByRole('checkbox')) await fireEvent.press(row); await next(); await screen.findByRole('button', { name: /^Community,/ }); }
async function community() { await waitFor(() => expect(screen.queryByRole('progressbar', { name: 'Loading content' })).toBeNull()); if (!screen.queryByRole('button', { name: 'Community, Area A' })) { await fireEvent.press(screen.getByRole('button', { name: 'Community, Select your community' })); await fireEvent.press(screen.getByRole('radio', { name: 'Area A' })); } await next(); }
async function role() { await names(); await accept(); await community(); }
test.each([false, true])('P1 validation, disabled continue and read-only email dark=%s', async darkMode => {
 mockDark = darkMode; await start(); expect(screen.getByText('Tell us about you')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled(); expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
 expect(screen.getByDisplayValue('demo@example.test').props.editable).toBe(false);
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'First name' }), '123'); await fireEvent(screen.getByRole('textbox', { name: 'First name' }), 'blur'); expect(screen.getByRole('alert')).toBeTruthy();
 await names(); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});
test.each([false, true])('happy flow P1-P4 and server refresh dark=%s', async darkMode => {
 mockDark = darkMode; await start(); await role(); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
 await fireEvent.press(screen.getByRole('radio', { name: /I need rides/ })); await next(); await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
 expect(api.completeProfile).toHaveBeenCalledWith({ firstName: 'Sam', lastName: 'Ali', communityId: 'area', role: 'rider', ageConfirmed: true, termsVersion: 't1', privacyVersion: 'p1' });
 expect(JSON.stringify(jest.mocked(api.completeProfile).mock.calls)).not.toContain('demo@example.test');
});
test('back retains values; a remount starts empty at P1', async () => {
 const view = await start(); await names(); await fireEvent.press(screen.getByRole('button', { name: 'Go back' })); expect(screen.getByDisplayValue('Sam')).toBeTruthy(); await view.unmount(); await start(); expect(screen.getByRole('textbox', { name: 'First name' }).props.value).toBe('');
});
test.each(['before', 'server'])('consent drift %s requires fresh acceptance', async source => {
 await start(); await role();
 if (source === 'before') jest.mocked(api.currentLegalVersions).mockResolvedValue({ terms: 't2', privacy: 'p1' });
 else jest.mocked(api.completeProfile).mockRejectedValueOnce(new OnboardingError('consent_version_stale', 'rejected'));
 await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next();
 await screen.findByText('Our Terms or Privacy Policy changed. Please read and accept them again to continue.');
 expect(screen.getAllByRole('checkbox').every(row => row.props.accessibilityState.checked === false)).toBe(true); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
 expect(api.completeProfile).toHaveBeenCalledTimes(source === 'before' ? 0 : 1);
});
test('uncertain result retries identical input and refreshes only on success', async () => {
 jest.mocked(api.completeProfile).mockRejectedValueOnce(new OnboardingError('uncertain', 'uncertain')); await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /I have a car/ })); await next();
 await screen.findByRole('button', { name: 'Try again' }); expect(mockRefresh).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1)); expect(jest.mocked(api.completeProfile).mock.calls[0]).toEqual(jest.mocked(api.completeProfile).mock.calls[1]);
});
test.each([['invalid_name', 'Tell us about you'], ['invalid_community', 'Choose your community'], ['account_missing', 'How will you use Tawsila?']] as const)('rejected %s stays safe at relevant step', async (code, title) => {
 jest.mocked(api.completeProfile).mockRejectedValueOnce(new OnboardingError(code, 'rejected')); await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next(); await screen.findByRole('alert'); expect(screen.getByText(title)).toBeTruthy(); expect(mockRefresh).not.toHaveBeenCalled(); expect(screen.queryByText(code)).toBeNull();
});
test.each([false, true])('community states dark=%s', async darkMode => {
 for (const state of ['empty', 'error', 'loading']) {
 mockDark = darkMode;
 jest.mocked(api.listCommunities).mockReset().mockResolvedValue([{ id: 'area', name: 'Area A', active: true, sort_order: 0 }]);
 if (state === 'empty') jest.mocked(api.listCommunities).mockResolvedValue([]);
 if (state === 'error') jest.mocked(api.listCommunities).mockRejectedValueOnce(new Error('private detail'));
 if (state === 'loading') jest.mocked(api.listCommunities).mockReturnValue(new Promise(() => {}));
 const view = await start(); await names(); await accept(); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
 if (state === 'empty') expect(await screen.findByText('No communities are available yet. Please try again later.')).toBeTruthy();
 if (state === 'loading') expect(screen.getByRole('progressbar', { name: 'Loading content' })).toBeTruthy();
 if (state === 'error') { await fireEvent.press(await screen.findByRole('button', { name: 'Try again' })); await waitFor(() => expect(api.listCommunities).toHaveBeenCalledTimes(2)); expect(screen.queryByText('private detail')).toBeNull(); }
 await view.unmount();
 }
});
test('P2 legal loading failure is sanitized and retries before acceptance', async () => {
 jest.mocked(api.currentLegalVersions).mockRejectedValueOnce(new Error('private detail'));
 await start(); await fireEvent.changeText(screen.getByRole('textbox', { name: 'First name' }), 'Sam'); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Last name' }), 'Ali'); await next();
 await screen.findByRole('button', { name: 'Try again' }); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled(); expect(screen.getAllByRole('checkbox')[0]).toBeDisabled(); expect(screen.queryByText('private detail')).toBeNull();
 await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).not.toBeDisabled());
 expect(screen.queryByText('We could not load this information. Please try again.')).toBeNull();
});
test('back from P4 and P3 retains community and consent', async () => {
 await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
 expect(screen.getByRole('button', { name: 'Community, Area A' })).toBeTruthy(); await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
 await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()); expect(screen.getAllByRole('checkbox').every(row => row.props.accessibilityState.checked)).toBe(true);
});
test('sending prevents duplicate submissions and disables role changes', async () => {
 let resolve!: () => void; jest.mocked(api.completeProfile).mockReturnValue(new Promise<void>(done => { resolve = done; }));
 await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next();
 await waitFor(() => expect(api.completeProfile).toHaveBeenCalledTimes(1)); expect(screen.getByRole('button', { name: 'Saving your profile…' })).toBeDisabled();
 expect(screen.getByRole('radio', { name: /Both/ }).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(screen.getByRole('radio', { name: /I need rides/ })); resolve(); await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1)); expect(api.completeProfile).toHaveBeenCalledTimes(1);
});
test('fresh acceptance after drift submits only the new legal versions', async () => {
 await start(); await role(); jest.mocked(api.currentLegalVersions).mockResolvedValue({ terms: 't2', privacy: 'p2' });
 await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next(); await screen.findByText('Before you continue');
 await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).not.toBeDisabled()); await accept(); await community(); await next();
 await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1)); expect(api.completeProfile).toHaveBeenCalledTimes(1); expect(jest.mocked(api.completeProfile).mock.calls[0][0]).toMatchObject({ termsVersion: 't2', privacyVersion: 'p2' });
});

test('completion stays locked when refresh resolves before auth state changes', async () => {
 const view = await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next();
 await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('button', { name: 'Saving your profile…' })).toBeDisabled();
 await fireEvent.press(screen.getByRole('button', { name: 'Saving your profile…' }));
 expect(api.completeProfile).toHaveBeenCalledTimes(1);
 mockState = 'ready_to_browse';
 await view.rerender(<OnboardingApiProvider api={api}><OnboardingFlow /></OnboardingApiProvider>);
 expect(screen.queryByRole('button', { name: 'Saving your profile…' })).toBeNull();
});
test('derive failure releases the completion lock', async () => {
 const view = await start(); await role(); await fireEvent.press(screen.getByRole('radio', { name: /Both/ })); await next();
 await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
 mockState = 'account_provision_error';
 await view.rerender(<OnboardingApiProvider api={api}><OnboardingFlow /></OnboardingApiProvider>);
 expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
});
