import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { radius, spacing, typography, useTheme } from '../theme';
export function CheckboxRow({ label, checked, onPress, children, disabled = false }: { label: string; checked: boolean; onPress: () => void; children?: ReactNode; disabled?: boolean }) {
 const t = useTheme();
 return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'], padding: spacing['space/16'], borderWidth: 1, borderColor: t.separator, borderRadius: radius['radius/12'], backgroundColor: t['bg/elevated'] }}>
  <View style={{ width: 24, height: 24, borderWidth: 1, borderColor: t['brand/primary'], borderRadius: radius['radius/8'], backgroundColor: t[checked ? 'brand/primary' : 'bg/elevated'], alignItems: 'center', justifyContent: 'center' }}>{checked && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={t['brand/on-primary']} accessible={false} />}</View>
  <Text style={{ ...typography.body, flex: 1, color: t['label/primary'], textAlign: 'auto' }}>{children ?? label}</Text>
 </Pressable>;
}
