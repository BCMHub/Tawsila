import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { radius, spacing, typography, useTheme } from '../theme';

export function Banner({ text, polite = false, tone }: { text: string; polite?: boolean; tone?: 'success' | 'warning' }) {
  const t = useTheme();
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: polite });
  }, [text, polite]);
  return <View accessible accessibilityRole={polite ? 'text' : 'alert'} accessibilityLabel={text} accessibilityLiveRegion={polite ? 'polite' : 'assertive'} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space/12'], padding: spacing['space/16'], borderRadius: radius['radius/16'], borderWidth: 1, borderColor: t.separator, backgroundColor: t[tone === 'success' ? 'brand/tint' : tone === 'warning' ? 'system/orange-tint' : 'bg/elevated'] }}>
    <SymbolView name={tone === 'success' ? 'checkmark.circle' : polite ? 'info.circle' : 'exclamationmark.triangle'} size={20} tintColor={polite ? t['brand/primary'] : t['system/orange']} accessible={false} />
    <Text style={{ ...typography.subheadline, color: t['label/primary'], flex: 1 }}>{text}</Text>
  </View>;
}
