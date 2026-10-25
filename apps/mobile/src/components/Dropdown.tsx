import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, I18nManager, useWindowDimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { radius, spacing, typography, useTheme } from '../theme';
import { strings } from '../strings';
type Props = { label: string; placeholder: string; value?: string; options: { value: string; label: string }[]; onSelect: (value: string) => void; disabled?: boolean };
export function Dropdown({ label, placeholder, value, options, onSelect, disabled = false }: Props) {
 const t = useTheme(); const window = useWindowDimensions(); const [open, setOpen] = useState(false);
 const trigger = useRef<ComponentRef<typeof View>>(null); const menu = useRef<ComponentRef<typeof View>>(null);
 const [anchor, setAnchor] = useState({ x: 16, y: 180, width: 361 });
 const selected = options.find(option => option.value === value)?.label ?? placeholder;
 const focus = (node: ComponentRef<typeof View> | null) => { const handle = node && findNodeHandle(node); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); };
 const close = () => { setOpen(false); };
 return <View style={{ gap: spacing['space/8'] }}>
  <Text style={{ ...typography.footnoteSemibold, color: t['label/secondary'], textAlign: 'auto' }}>{label}</Text>
  <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}, ${selected}`} accessibilityHint={strings.onboarding.openList} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => { trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y: Math.max(spacing['space/16'], Math.min(y + height + spacing['space/8'], window.height - Math.min(window.height / 2, options.length * 60) - spacing['space/16'])), width })); setOpen(true); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', padding: spacing['space/16'], borderRadius: radius['radius/16'], borderWidth: 1, borderColor: t[open ? 'brand/primary' : 'separator'], backgroundColor: t['bg/elevated'], gap: spacing['space/8'] }}>
   <Text style={{ ...typography.body, flex: 1, textAlign: 'auto', color: t[value ? 'label/primary' : 'label/tertiary'] }}>{selected}</Text><SymbolView name={{ ios: open ? 'chevron.up' : 'chevron.down', android: open ? 'expand_less' : 'expand_more', web: open ? 'expand_less' : 'expand_more' }} size={18} tintColor={t['label/secondary']} accessible={false} />
  </Pressable>
  <Modal testID="dropdown-modal" visible={open} transparent animationType="none" onRequestClose={close} onDismiss={() => focus(trigger.current)} onShow={() => focus(menu.current)}>
   <View accessibilityViewIsModal style={{ flex: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={strings.onboarding.closeList} onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: t['overlay/scrim'], opacity: 0.15 }} />
    <View style={{ position: 'absolute', start: I18nManager.isRTL ? window.width - anchor.x - anchor.width : anchor.x, top: anchor.y, width: anchor.width, maxHeight: '50%', borderRadius: radius['radius/16'], borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'], overflow: 'hidden' }}><ScrollView>{options.map((option, index) => <Pressable ref={value === option.value || (!value && index === 0) ? menu : undefined} key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected: value === option.value }} onPress={() => { onSelect(option.value); close(); }} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing['space/8'], padding: spacing['space/16'], backgroundColor: t[value === option.value ? 'brand/tint' : 'bg/elevated'] }}><Text style={{ ...typography.body, textAlign: 'auto', flex: 1, color: t['label/primary'] }}>{option.label}</Text>{value === option.value && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={20} tintColor={t['brand/primary']} accessible={false} />}</Pressable>)}</ScrollView></View>
   </View>
  </Modal>
 </View>;
}
