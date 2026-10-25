import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../theme';
export function RadioCard({ label, description, selected, onPress, disabled = false, icon = 'people' }: { label: string; description: string; selected: boolean; disabled?: boolean; icon?: 'people' | 'car' | 'shield'; onPress: () => void }) {
 const t = useTheme();
 return <Pressable accessibilityRole="radio" accessibilityLabel={`${label}. ${description}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'], padding: spacing['space/16'], borderWidth: 1, borderColor: t[selected ? 'brand/primary' : 'separator'], borderRadius: radius['radius/20'], backgroundColor: t['bg/elevated'] }}>
  <View style={{ width: 48, height: 48, borderRadius: radius['radius/16'], backgroundColor: t[selected ? 'brand/primary' : 'brand/tint'], alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: icon === 'car' ? 'car' : icon === 'shield' ? 'checkmark.shield' : 'person.2', android: icon === 'car' ? 'directions_car' : icon === 'shield' ? 'verified_user' : 'group', web: icon === 'car' ? 'directions_car' : icon === 'shield' ? 'verified_user' : 'group' }} size={24} tintColor={t[selected ? 'brand/on-primary' : 'brand/primary']} accessible={false} /></View>
  <View style={{ flex: 1, gap: spacing['space/4'] }}><Text style={{ ...typography.headline, textAlign: 'auto', color: t['label/primary'] }}>{label}</Text><Text style={{ ...typography.subheadline, textAlign: 'auto', color: t['label/secondary'] }}>{description}</Text></View>
  <View style={{ width: 24, height: 24, borderRadius: radius['radius/full'], borderWidth: 2, borderColor: t[selected ? 'brand/primary' : 'label/secondary'], alignItems: 'center', justifyContent: 'center' }}>{selected && <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={24} tintColor={t['brand/primary']} accessible={false} />}</View>
 </Pressable>;
}
