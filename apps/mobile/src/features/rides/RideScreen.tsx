import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { strings } from '../../strings';
import { elevation, radius, spacing, typography, useTheme } from '../../theme';

export const rideStyles = StyleSheet.create({
  content: { padding: spacing['space/16'], gap: spacing['space/16'] },
  stack: { gap: spacing['space/8'] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing['space/8'] },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space/8'] },
  grow: { flex: 1 },
});

export function RideScreen({ title, onBack, children }: PropsWithChildren<{ title: string; onBack?: () => void }>) {
  const t = useTheme();
  return <SafeAreaView style={[rideStyles.grow, { backgroundColor: t['bg/base'] }]}>
    <KeyboardAvoidingView style={rideStyles.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[rideStyles.between, { paddingHorizontal: spacing['space/16'], minHeight: 48 }]}>
        {onBack && <Pressable accessibilityRole="button" accessibilityLabel={strings.back} onPress={onBack}
          style={{ width: 44, height: 44, borderRadius: radius['radius/full'], alignItems: 'center', justifyContent: 'center', backgroundColor: t['bg/elevated'] }}>
          <Icon name="back" size={20} color={t['label/primary']} />
        </Pressable>}
        <Text accessibilityRole="header" style={[rideStyles.grow, typography.headline, { color: t['label/primary'], textAlign: 'center' }]}>{title}</Text>
        {onBack && <View style={{ width: 44 }} />}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={rideStyles.content}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function RideCard({ children }: PropsWithChildren) {
  const t = useTheme();
  return <View style={{
    ...elevation.card, gap: spacing['space/12'], padding: spacing['space/16'],
    borderRadius: radius['radius/20'], borderWidth: 1, borderColor: t.separator,
    backgroundColor: t['bg/elevated'],
  }}>{children}</View>;
}

export function RideText({ children, kind = 'body', muted = false, header = false }:
  PropsWithChildren<{ kind?: keyof typeof typography; muted?: boolean; header?: boolean }>) {
  const t = useTheme();
  return <Text accessibilityRole={header ? 'header' : undefined} style={[typography[kind], {
    color: t[muted ? 'label/secondary' : 'label/primary'],
  }]}>{children}</Text>;
}

export function RideChip({ children }: PropsWithChildren) {
  const t = useTheme();
  return <View style={{
    borderRadius: radius['radius/full'], paddingHorizontal: spacing['space/12'],
    paddingVertical: spacing['space/4'], backgroundColor: t['brand/tint'],
  }}><Text style={[typography.footnoteSemibold, { color: t['brand/primary'] }]}>{children}</Text></View>;
}

export function RideChoice({ label, accessibilityLabel, selected, onPress, radio = false }:
  { label: string; accessibilityLabel?: string; selected?: boolean; onPress: () => void; radio?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole={radio ? 'radio' : 'button'} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected }} onPress={onPress}
    style={{
      justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing['space/12'], paddingVertical: spacing['space/8'],
      borderRadius: radius['radius/12'], borderWidth: 1, borderColor: t[selected ? 'brand/primary' : 'separator'],
      backgroundColor: t[selected ? 'brand/tint' : 'bg/elevated'],
    }}>
    <Text style={[typography.subheadlineSemibold, { color: t[selected ? 'brand/primary' : 'label/primary'] }]}>{label}</Text>
  </Pressable>;
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
