import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { typography, useTheme } from '../theme';
import { strings } from '../strings';

type Action = { label: string; onPress: () => void };
function ActionButton({ action, secondary = false }: { action: Action; secondary?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress}
    style={({ pressed }) => ({ minHeight: 52, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 24, justifyContent: 'center', backgroundColor: secondary ? t['brand/tint'] : pressed ? t['brand/primary-pressed'] : t['brand/primary'] })}>
    <Text style={{ ...typography.headline, textAlign: 'center', color: secondary ? t['brand/primary'] : t['brand/on-primary'] }}>{action.label}</Text>
  </Pressable>;
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  return <View style={[styles.state, { backgroundColor: t['bg/base'] }]}>
    <View style={[styles.circle, { backgroundColor: t['fill/secondary'] }]}><Icon name="wifi" size={60} color={t['label/secondary']} /></View>
    <View accessible accessibilityRole="alert" accessibilityLabel={`${strings.offlineTitle}. ${strings.offlineBody}`} style={styles.copy}>
      <Text style={{ ...typography.title1, color: t['label/primary'], textAlign: 'center' }}>{strings.offlineTitle}</Text>
      <Text style={{ ...typography.body, color: t['label/secondary'], textAlign: 'center' }}>{strings.offlineBody}</Text>
    </View>
    <View style={{ width: '100%', maxWidth: 200 }}><ActionButton action={{ label: strings.retry, onPress: onRetry }} /></View>
  </View>;
}
export function EmptyState({ icon = 'empty', title, body, primaryAction, secondaryAction }: { icon?: IconName; title: string; body: string; primaryAction?: Action; secondaryAction?: Action }) {
  const t = useTheme();
  return <View style={[styles.state, { backgroundColor: t['bg/base'] }]}>
    <View style={[styles.circle, { backgroundColor: t['brand/tint'] }]}><View style={{ width: 88, height: 88, borderRadius: 999, backgroundColor: t['bg/elevated'], alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={40} color={t['brand/primary']} /></View></View>
    <View accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${body}`} style={styles.copy}>
      <Text style={{ ...typography.title2, color: t['label/primary'], textAlign: 'center' }}>{title}</Text>
      <Text style={{ ...typography.body, color: t['label/secondary'], textAlign: 'center' }}>{body}</Text>
    </View>
    <View style={{ width: '100%', maxWidth: 361, gap: 10 }}>
      {primaryAction && <ActionButton action={primaryAction} />}
      {secondaryAction && <ActionButton action={secondaryAction} secondary />}
    </View>
  </View>;
}
export function LoadingState() {
  const t = useTheme();
  const bar = (width: number | `${number}%`, height: number, radius = 6) => <View style={{ width, maxWidth: '100%', height, borderRadius: radius, backgroundColor: t['fill/secondary'] }} />;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={strings.loading} accessibilityState={{ busy: true }} style={{ backgroundColor: t['bg/base'], padding: 16, gap: 14, alignItems: 'center' }}>
    {[0, 1].map(i => <View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: '100%', maxWidth: 361, borderRadius: 20, padding: 16, gap: 14, backgroundColor: t['bg/elevated'] }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {bar(40, 40, 999)}<View style={{ flex: 1, minWidth: 100, gap: 8 }}>{bar(120, 12)}{bar(170, 10)}</View>{bar(56, 18)}
      </View>
      {bar(220, 12)}{bar(160, 10)}{bar(200, 12)}
      <View style={{ flexDirection: 'row', gap: 8 }}>{bar(80, 24, 12)}{bar(90, 24, 12)}</View>
      {bar('100%', 36, 18)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  state: { padding: 16, alignItems: 'center', width: '100%' },
  circle: { width: 140, height: 140, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  copy: { width: '100%', maxWidth: 300, paddingVertical: 24, gap: 8 },
});
