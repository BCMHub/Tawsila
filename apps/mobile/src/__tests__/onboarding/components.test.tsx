import { afterEach, expect, jest, test } from '@jest/globals';
import { AccessibilityInfo, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from '../../components/TextField';
import { Dropdown } from '../../components/Dropdown';
import { CheckboxRow } from '../../components/CheckboxRow';
import { RadioCard } from '../../components/RadioCard';
import { ProgressBar } from '../../components/ProgressBar';
import { dark, light } from '../../theme';
afterEach(() => { jest.restoreAllMocks(); });
let mockDark = false;
jest.mock('../../theme', () => { const actual = jest.requireActual<typeof import('../../theme')>('../../theme'); return { ...actual, useTheme: () => mockDark ? actual.dark : actual.light }; });
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
test.each([false, true])('text field editable, invalid and read-only states, dark=%s', async darkMode => {
 mockDark = darkMode; const change = jest.fn();
 const view = await render(<TextField label="Name" value="" placeholder="Name" onChangeText={change} />);
 await fireEvent.changeText(screen.getByRole('textbox', { name: 'Name' }), 'Sam'); expect(change).toHaveBeenCalledWith('Sam');
 await view.rerender(<TextField label="Name" value="123" error="Invalid name" />);
 expect(screen.getByRole('alert')).toHaveTextContent('Invalid name');
 await view.rerender(<TextField label="Email" value="demo@example.test" readOnly />);
 expect(screen.getByLabelText('Email').props.editable).toBe(false);
 expect(screen.getByLabelText('Email')).toHaveStyle({ color: (darkMode ? dark : light)['label/secondary'] });
});
test('dropdown announces selection and expansion, closes on selection, scrim and back', async () => {
 const select = jest.fn(); const view = await render(<Dropdown label="Community" placeholder="Select" options={[{ value: 'a', label: 'Area A' }]} onSelect={select} value="a" />);
 const open = () => fireEvent.press(screen.getByRole('button', { name: 'Community, Area A' }));
 expect(screen.getByRole('button', { name: 'Community, Area A' }).props.accessibilityState.expanded).toBe(false);
 await open(); expect(screen.getByRole('radio', { name: 'Area A' }).props.accessibilityState.selected).toBe(true);
 await fireEvent.press(screen.getByRole('radio', { name: 'Area A' })); expect(select).toHaveBeenCalledWith('a'); expect(screen.queryByRole('radio')).toBeNull();
 await open(); await fireEvent.press(screen.getByRole('button', { name: 'Close list' })); expect(screen.queryByRole('radio')).toBeNull();
 await open(); await fireEvent(screen.getByTestId('dropdown-modal'), 'requestClose'); expect(screen.queryByRole('radio')).toBeNull();
 await view.unmount();
});
test.each([false, true])('checkbox, radio and progress states dark=%s', async darkMode => {
 mockDark = darkMode; const onPress = jest.fn();
 const view = await render(<CheckboxRow label="Accept" checked={false} onPress={onPress} />);
 expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false); await fireEvent.press(screen.getByRole('checkbox')); expect(onPress).toHaveBeenCalledTimes(1);
 await view.rerender(<CheckboxRow label="Accept" checked onPress={onPress} />); expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(true);
 await view.rerender(<RadioCard label="Rider" description="Find trips" selected onPress={onPress} />); expect(screen.getByRole('radio').props.accessibilityState.selected).toBe(true);
 await view.rerender(<ProgressBar step={3} />); expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 1, max: 3, now: 3 });
});
test('radio uses a decorative platform car symbol', async () => {
 const view = await render(<RadioCard label="Car owner" description="Offer seats" selected={false} icon="car" onPress={() => {}} />);
 expect(JSON.stringify(view.toJSON())).toContain('directions_car');
});

test('inline errors announce on iOS', async () => {
 jest.replaceProperty(Platform, 'OS', 'ios'); const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
 await render(<TextField label="Name" value="123" error="Invalid name" />);
 expect(announce).toHaveBeenCalledWith('Invalid name', { queue: false });
});
