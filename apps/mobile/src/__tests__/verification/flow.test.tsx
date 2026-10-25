import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { CarIntro, CarDetails, CarStatus } from '../../features/verification/CarScreens';
import { CarEntryPoints } from '../../features/verification/CarEntryPoints';
import { StatusBadge } from '../../components/StatusBadge';
import { OnboardingApiProvider } from '../../features/onboarding/OnboardingApiProvider';
import { OnboardingError, type OnboardingApi, type CarInput, type SubmissionResult, type Role } from '../../features/onboarding/api';
let mockDark = false;
jest.mock('../../theme', () => { const actual = jest.requireActual<typeof import('../../theme')>('../../theme'); return { ...actual, useTheme: () => mockDark ? actual.dark : actual.light }; });
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, useFocusEffect: (effect: () => void) => { const React = jest.requireActual<typeof import('react')>('react'); React.useEffect(effect, [effect]); } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'synthetic-key' }));
let api: OnboardingApi;
const vehicle = { brand_id: null, brand_other: 'Synthetic', model_id: null, model_other: 'Fixture', type_id: 'type', year: 2000, plate_number: '1' };
beforeEach(() => {
 jest.clearAllMocks(); mockDark = false;
 api = {
  listCarBrands: jest.fn<OnboardingApi['listCarBrands']>().mockResolvedValue([{ id: 'a', name: 'Brand A', active: true }, { id: 'b', name: 'Brand B', active: true }]),
  listCarModels: jest.fn<OnboardingApi['listCarModels']>().mockImplementation(async id => [{ id: `m-${id}`, brand_id: id, name: `Model ${id}`, active: true }]),
  listCarTypes: jest.fn<OnboardingApi['listCarTypes']>().mockResolvedValue([{ id: 'type', code: 'other', name: 'Type', active: true }]),
  myVehicle: jest.fn<OnboardingApi['myVehicle']>().mockResolvedValue(null),
  myProfile: jest.fn<OnboardingApi['myProfile']>().mockResolvedValue({ role: 'car_owner' }),
  myVerification: jest.fn<OnboardingApi['myVerification']>().mockResolvedValue({ car_owner: null, has_car_details: false }),
  submitCar: jest.fn<OnboardingApi['submitCar']>().mockResolvedValue({ revision: 1, status: 'pending', superseded: false }),
  setRole: jest.fn<OnboardingApi['setRole']>().mockResolvedValue(undefined),
 } as unknown as OnboardingApi;
});
const mount = async (child: React.ReactNode) => {
 const view = await render(<OnboardingApiProvider api={api}>{child}</OnboardingApiProvider>);
 const theme = jest.requireActual<typeof import('../../theme')>('../../theme')[mockDark ? 'dark' : 'light'];
 const hasThemeColor = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(hasThemeColor);
  if (!node || typeof node !== 'object') return false;
  const element = node as { props?: { style?: import('react-native').StyleProp<import('react-native').ViewStyle> }; children?: unknown };
  const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  const style = StyleSheet.flatten(element.props?.style);
  return style?.backgroundColor === theme['bg/base'] || style?.backgroundColor === theme['bg/elevated'] || hasThemeColor(element.children);
 };
 expect(hasThemeColor(screen.toJSON())).toBe(true);
 return view;
};
async function select(label: string, option: string) { await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${label},`) })); await fireEvent.press(screen.getByRole('radio', { name: option })); }
async function filled() {
 await screen.findByRole('button', { name: 'Car brand, Select brand' });
 await select('Car brand', 'Other');
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Car brand' }), ' Synthetic ');
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Model' }), ' Fixture ');
 await select('Car type', 'Type');
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), '2000');
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Plate number' }), '1');
}
const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Submit for review' }));
test.each([false, true])('intro actions and copy dark=%s', async dark => {
 mockDark = dark; await mount(<CarIntro />); expect(screen.getByText('Riders can request rides right away.')).toBeTruthy();
 expect(screen.getByText('Brand, model, type, year and plate number')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: 'Start' })); expect(router.push).toHaveBeenCalledWith('/(verify)/car');
 await fireEvent.press(screen.getByRole('button', { name: 'Not now' })); expect(router.replace).toHaveBeenCalledWith('/(tabs)');
});
test.each([false, true])('details validation, Other trimming and confirmed navigation dark=%s', async dark => {
 mockDark = dark; await mount(<CarDetails />); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 expect(screen.getByRole('button', { name: 'Model, Select model' })).toBeDisabled(); await filled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), '1900'); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), '2000');
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Plate number' }), 'bad'); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Plate number' }), '1'); await submit();
 expect(api.submitCar).toHaveBeenCalledWith(expect.objectContaining({ brandOther: 'Synthetic', modelOther: 'Fixture', year: 2000 }));
 expect(router.replace).toHaveBeenCalledWith('/(verify)/status');
});
test.each([false, true])('catalogue model dependencies, model Other, and brand changes clear the model dark=%s', async dark => { mockDark = dark;
 await mount(<CarDetails />); await select('Car brand', 'Brand A'); await screen.findByRole('button', { name: 'Model, Select model' });
 await select('Model', 'Model a'); await select('Car brand', 'Brand B');
 expect(screen.getByRole('button', { name: 'Model, Select model' })).toBeTruthy();
 await select('Model', 'Other'); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Model' }), 'Custom');
 await select('Car type', 'Type'); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), '2000'); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Plate number' }), '1'); await submit();
 expect(api.submitCar).toHaveBeenCalledWith(expect.objectContaining({ brandId: 'b', modelId: null, modelOther: 'Custom' }));
});
test.each([false, true])('sending locks filled inputs and duplicate taps until confirmed dark=%s', async dark => { mockDark = dark;
 let done!: (result: SubmissionResult) => void;
 jest.mocked(api.submitCar).mockReturnValue(new Promise(resolve => { done = resolve; }));
 await mount(<CarDetails />); await filled(); await submit(); expect(router.replace).not.toHaveBeenCalled();
 expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled(); expect(screen.getByDisplayValue(' Synthetic ').props.editable).toBe(false);
 await fireEvent.press(screen.getByRole('button', { name: 'Sending…' })); expect(api.submitCar).toHaveBeenCalledTimes(1);
 await act(async () => done({ revision: 1, status: 'pending', superseded: false })); expect(router.replace).toHaveBeenCalledWith('/(verify)/status');
});
test.each([false, true])('lost response retains inputs; same-key retry replays one effective submission dark=%s', async dark => {
 mockDark = dark; const recorded = new Map<string, SubmissionResult>(); let effective = 0;
 jest.mocked(api.submitCar).mockImplementation(async (input: CarInput) => {
  const previous = recorded.get(input.submissionKey); if (previous) return previous;
  effective++; recorded.set(input.submissionKey, { revision: 1, status: 'pending', superseded: false }); throw new OnboardingError('uncertain', 'uncertain');
 });
 await mount(<CarDetails />); await filled(); await submit();
 expect(await screen.findByText('We could not confirm that your car was sent. Check your connection and try again.')).toBeTruthy();
 expect(screen.getByDisplayValue(' Synthetic ')).toBeTruthy(); expect(screen.getByDisplayValue('2000')).toBeTruthy(); expect(router.replace).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); expect(effective).toBe(1);
 expect(jest.mocked(api.submitCar).mock.calls[0]).toEqual(jest.mocked(api.submitCar).mock.calls[1]); expect(router.replace).toHaveBeenCalledWith('/(verify)/status');
});
for (const dark of [false, true]) test.each(['invalid_plate', 'invalid_year', 'invalid_car', 'role_not_car_owner', 'account_missing', 'rejected'] as const)('sanitizes rejection %s dark='+dark, async code => { mockDark = dark;
 jest.mocked(api.submitCar).mockRejectedValueOnce(new OnboardingError(code, 'rejected'));
 await mount(<CarDetails />); await filled(); await submit(); expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.queryByText(code)).toBeNull(); expect(router.replace).not.toHaveBeenCalled();
 if (code === 'role_not_car_owner') expect(screen.getByText('Choose I have a car or Both in your profile first.')).toBeTruthy();
 if (code === 'invalid_plate') expect(screen.getByRole('textbox', { name: 'Plate number' }).props.accessibilityHint).toBeTruthy();
 if (code === 'invalid_year') expect(screen.getByRole('textbox', { name: 'Year' }).props.accessibilityHint).toBeTruthy();
});
test.each([false, true])('already approved opens status dark=%s', async dark => { mockDark = dark; jest.mocked(api.submitCar).mockRejectedValueOnce(new OnboardingError('already_approved', 'rejected')); await mount(<CarDetails />); await filled(); await submit(); expect(router.replace).toHaveBeenCalledWith('/(verify)/status'); });
for (const dark of [false, true]) test.each([
 ['pending', 'Car sent for review', 'Pending', 'Back to browsing'], ['approved', 'You are approved', 'Verified', 'Continue'], ['rejected', 'We need one more thing', 'Declined', 'Fix and resubmit'],
] as const)('status %s dark='+dark, async (status, title, badge, button) => {
 mockDark = dark; jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status, revision: 1, reviewer_note: 'Please check the model.' }, has_car_details: true });
 await mount(<CarStatus />); expect(await screen.findByText(title)).toBeTruthy(); expect(screen.getByText(badge)).toBeTruthy();
 if (status === 'rejected') { expect(screen.getByText('Reviewer note')).toBeTruthy(); expect(screen.getByText('Please check the model.')).toBeTruthy(); }
 await fireEvent.press(screen.getByRole('button', { name: button })); expect(status === 'rejected' ? router.push : router.replace).toHaveBeenCalledWith(status === 'rejected' ? '/(verify)/car' : '/(tabs)');
});
test.each([false, true])('resubmission prefill reads saved vehicle dark=%s', async dark => { mockDark = dark; jest.mocked(api.myVehicle).mockResolvedValue(vehicle); await mount(<CarDetails />); expect(await screen.findByDisplayValue('Synthetic')).toBeTruthy(); expect(screen.getByDisplayValue('Fixture')).toBeTruthy(); expect(screen.getByDisplayValue('2000')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Submit for review' })).not.toBeDisabled(); });
for (const dark of [false, true]) test.each(['rider', 'car_owner', 'both'] as Role[])('entry points role=%s dark='+dark, async role => {
 mockDark = dark; jest.mocked(api.myProfile).mockResolvedValue({ role }); await mount(<CarEntryPoints profile />);
 if (role === 'rider') { await fireEvent.press(await screen.findByRole('button', { name: 'I have a car' })); expect(api.setRole).toHaveBeenCalledWith('both'); expect(router.push).toHaveBeenCalledWith('/(verify)'); }
 else { await fireEvent.press(await screen.findByRole('button', { name: 'Add your car' })); expect(router.push).toHaveBeenCalledWith('/(verify)'); }
});
for (const dark of [false, true]) test.each(['pending', 'approved', 'rejected'] as const)('profile status %s opens status; Home prompts only rejection dark='+dark, async status => { mockDark = dark;
 jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status, revision: 1, reviewer_note: null }, has_car_details: true });
 const view = await mount(<CarEntryPoints profile />); await fireEvent.press(await screen.findByRole('button', { name: /Car owner approval/ })); expect(router.push).toHaveBeenCalledWith('/(verify)/status'); await view.unmount();
 await mount(<CarEntryPoints />); await waitFor(() => expect(api.myProfile).toHaveBeenCalledTimes(2)); expect(screen.queryByText('Add your car to start offering rides') !== null).toBe(status === 'rejected');
});
test.each([false, true])('former car owner now rider has no approval UI dark=%s', async dark => { mockDark = dark;
 jest.mocked(api.myProfile).mockResolvedValue({ role: 'rider' }); jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status: 'approved', revision: 1, reviewer_note: null }, has_car_details: true });
 await mount(<CarEntryPoints profile />); await screen.findByRole('button', { name: 'I have a car' }); expect(screen.queryByText('Verified')).toBeNull(); expect(screen.queryByText('Car owner approval')).toBeNull();
});
test.each([false, true])('role switching awaits server and failure never navigates dark=%s', async dark => { mockDark = dark;
 jest.mocked(api.myProfile).mockResolvedValue({ role: 'rider' }); jest.mocked(api.setRole).mockRejectedValueOnce(new Error('private detail'));
 await mount(<CarEntryPoints profile />); await fireEvent.press(await screen.findByRole('button', { name: 'I have a car' })); expect(router.push).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.queryByText('private detail')).toBeNull();
});
for (const dark of [false, true]) test.each(['pending', 'approved', 'rejected'] as const)('badge %s dark='+dark, async status => { mockDark = dark; await render(<StatusBadge status={status} />); const theme = jest.requireActual<typeof import('../../theme')>('../../theme')[dark ? 'dark' : 'light']; expect(screen.getByText({ pending: 'Pending', approved: 'Verified', rejected: 'Declined' }[status])).toHaveStyle({ color: theme['label/primary'] }); });
test.each([false, true])('uncertain submission freezes the original inputs until confirmed dark=%s', async dark => { mockDark = dark;
 jest.mocked(api.submitCar).mockRejectedValueOnce(new OnboardingError('uncertain', 'uncertain'));
 await mount(<CarDetails />); await filled(); await submit();
 expect(screen.getByDisplayValue(' Synthetic ').props.editable).toBe(false);
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), '2001');
 expect(screen.getByDisplayValue('2000')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: 'Try again' })); expect(jest.mocked(api.submitCar).mock.calls[1]).toEqual(jest.mocked(api.submitCar).mock.calls[0]);
});
test.each([false, true])('status success and warning banner tints dark=%s', async dark => {
 mockDark = dark;
 const theme = jest.requireActual<typeof import('../../theme')>('../../theme')[dark ? 'dark' : 'light'];
 jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status: 'approved', revision: 1, reviewer_note: null }, has_car_details: true });
 const view = await mount(<CarStatus />);
 expect((await screen.findByText('Your car was approved. You can now post rides.')).parent).toHaveStyle({ backgroundColor: theme['brand/tint'] });
 await view.unmount();
 jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status: 'rejected', revision: 1, reviewer_note: null }, has_car_details: true });
 await mount(<CarStatus />); expect((await screen.findByText('Your car needs another look before we can approve it.')).parent).toHaveStyle({ backgroundColor: theme['system/orange-tint'] });
 expect(screen.queryByText('Reviewer note')).toBeNull();
});
test.each([false, true])('Other text limits and Arabic plate field semantics dark=%s', async dark => {
 mockDark = dark; await mount(<CarDetails />); await filled();
 expect(screen.getByRole('textbox', { name: 'Plate number' }).props.autoCapitalize).toBe('none');
 expect(screen.getByRole('textbox', { name: 'Year' }).props.maxLength).toBe(4);
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Car brand' }), ' '.repeat(4)); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Car brand' }), 'x'.repeat(51)); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Car brand' }), 'x'.repeat(50));
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Model' }), 'x'.repeat(51)); expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Model' }), 'x'.repeat(50));
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Plate number' }), 'ب١'); expect(screen.getByRole('button', { name: 'Submit for review' })).not.toBeDisabled();
});
test('returning from model Other can select a catalogue model without clearing the brand', async () => {
 await mount(<CarDetails />); await select('Car brand', 'Brand A'); await select('Model', 'Other');
 await select('Change model', 'Model a'); expect(screen.getByRole('button', { name: 'Model, Model a' })).toBeTruthy();
});
test.each([false, true])('a rider cannot see retained approval through the status route dark=%s', async dark => {
 mockDark = dark; jest.mocked(api.myProfile).mockResolvedValue({ role: 'rider' });
 jest.mocked(api.myVerification).mockResolvedValue({ car_owner: { status: 'approved', revision: 1, reviewer_note: null }, has_car_details: true });
 await mount(<CarStatus />); await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
 expect(screen.queryByText('Verified')).toBeNull(); expect(screen.queryByText('You are approved')).toBeNull();
});

test.each(['٢٠٠٠', '۲۰۰۰', '2۰٠0'])('year %s submits ASCII numeric value', async year => {
 await mount(<CarDetails />); await filled();
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), year);
 expect(screen.getByRole('button', { name: 'Submit for review' })).not.toBeDisabled();
 await submit(); expect(api.submitCar).toHaveBeenCalledWith(expect.objectContaining({ year: 2000 }));
});
test.each(['۲۰۰', '۲۰۰۰۰', '۲۰O۰', '۱۹۷۹'])('invalid year %s stays disabled', async year => {
 await mount(<CarDetails />); await filled(); await fireEvent.changeText(screen.getByRole('textbox', { name: 'Year' }), year);
 expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
});
