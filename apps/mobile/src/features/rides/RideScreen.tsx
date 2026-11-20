import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { strings } from '../../strings';
import { dark, elevation, radius, spacing, typography, useTheme } from '../../theme';

export const rideStyles = StyleSheet.create({
  content: { padding: spacing['space/16'], gap: spacing['space/16'] },
  stack: { gap: spacing['space/8'] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing['space/8'] },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space/8'] },
  grow: { flex: 1 },
});

export function RideScreen({ title, onBack, header, footer, children }:
  PropsWithChildren<{ title?: string; onBack?: () => void; header?: ReactNode; footer?: ReactNode }>) {
  const t = useTheme();
  return <SafeAreaView style={[rideStyles.grow, { backgroundColor: t['bg/base'] }]}>
    <KeyboardAvoidingView style={rideStyles.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {title && <View style={[rideStyles.between, { paddingHorizontal: spacing['space/16'], minHeight: 48 }]}>
        {onBack && <Pressable accessibilityRole="button" accessibilityLabel={strings.back} onPress={onBack}
          style={{ width: 44, height: 44, borderRadius: radius['radius/full'], alignItems: 'center', justifyContent: 'center', backgroundColor: t['bg/elevated'], borderWidth: 1, borderColor: t.separator }}>
          <Icon name="back" size={20} color={t['label/primary']} />
        </Pressable>}
        <Text accessibilityRole="header" style={[rideStyles.grow, typography.headline, { color: t['label/primary'], textAlign: 'center' }]}>{title}</Text>
        {onBack && <View style={{ width: 44 }} />}
      </View>}
      {header}
      <ScrollView style={rideStyles.grow} keyboardShouldPersistTaps="handled" contentContainerStyle={rideStyles.content}>
        {children}
      </ScrollView>
      {footer && <View style={styles.footer}>{footer}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function RideCard({ children, raised = false }: PropsWithChildren<{ raised?: boolean }>) {
  const t = useTheme();
  return <View style={{
    ...(raised && t !== dark ? elevation.card : undefined),
    gap: spacing['space/12'], padding: spacing['space/16'], borderRadius: radius['radius/20'],
    backgroundColor: t['bg/elevated'],
  }}>{children}</View>;
}

export function RideText({ children, kind = 'body', muted = false, header = false, color, align }:
  PropsWithChildren<{
    kind?: keyof typeof typography;
    muted?: boolean;
    header?: boolean;
    color?: keyof ReturnType<typeof useTheme>;
    align?: 'center' | 'right';
  }>) {
  const t = useTheme();
  return <Text accessibilityRole={header ? 'header' : undefined} style={[typography[kind], {
    color: t[color ?? (muted ? 'label/secondary' : 'label/primary')], textAlign: align,
  }]}>{children}</Text>;
}

export function RideChoice({ label, accessibilityLabel, selected, onPress, radio = false, variant = 'picker' }:
  { label: string; accessibilityLabel?: string; selected?: boolean; onPress: () => void; radio?: boolean; variant?: 'picker' | 'pill' | 'segment' }) {
  const t = useTheme();
  const segment = variant === 'segment';
  const pill = variant === 'pill';
  return <Pressable accessibilityRole={radio ? 'radio' : 'button'} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected }} onPress={onPress}
    style={[
      styles.choice,
      variant === 'picker' && styles.pickerChoice,
      segment ? styles.segment : { borderWidth: 1 },
      {
        borderRadius: radius[pill || segment ? 'radius/full' : 'radius/12'],
        borderColor: t[selected && !pill ? 'brand/primary' : 'separator'],
        backgroundColor: segment ? (selected ? t['bg/elevated'] : undefined) :
          selected ? t[pill ? 'brand/primary' : 'brand/tint'] : t['bg/elevated'],
      },
      segment && selected && elevation.tab,
    ]}>
    <RideText kind={segment || pill ? 'footnoteSemibold' : 'subheadlineSemibold'} align="center"
      muted={segment && !selected} color={selected && !segment ? (pill ? 'brand/on-primary' : 'brand/primary') : undefined}>
      {label}
    </RideText>
  </Pressable>;
}

export function RideSegments({ children }: PropsWithChildren) {
  const t = useTheme();
  return <View style={[styles.segments, { backgroundColor: t['fill/secondary'] }]}>{children}</View>;
}

export function RidePicker({ title, children }: PropsWithChildren<{ title: string }>) {
  const t = useTheme();
  return <RideCard>
    <Text accessible role="dialog" style={[typography.headline, { color: t['label/primary'] }]}>{title}</Text>
    <ScrollView nestedScrollEnabled style={{ maxHeight: spacing['space/40'] * 6 }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={rideStyles.stack}>
      {children}
    </ScrollView>
  </RideCard>;
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing['space/16'], paddingTop: spacing['space/8'],
    paddingBottom: spacing['space/8'], gap: spacing['space/8'],
  },
  choice: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing['space/12'], paddingVertical: spacing['space/4'],
  },
  pickerChoice: { minHeight: 44, paddingVertical: spacing['space/8'] },
  segment: { flex: 1, minHeight: spacing['space/32'] },
  segments: { flexDirection: 'row', borderRadius: radius['radius/full'], padding: spacing['space/4'] },
});
