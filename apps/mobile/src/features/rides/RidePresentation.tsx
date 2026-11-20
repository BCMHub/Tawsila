import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { RideText, rideStyles } from './RideScreen';

const symbols = {
  pin: { ios: 'mappin.circle', android: 'location_on', web: 'location_on' },
  down: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  forward: { ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  verified: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  repeat: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  reverse: { ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  car: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  note: { ios: 'note.text', android: 'notes', web: 'notes' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  group: { ios: 'person.2', android: 'group', web: 'group' },
} satisfies Record<string, SymbolViewProps['name']>;

export type RideGlyph = keyof typeof symbols;
type ThemeColor = keyof ReturnType<typeof useTheme>;

export function RideSymbol({ name, size = spacing['space/16'], color = 'brand/primary' }:
  { name: RideGlyph; size?: number; color?: ThemeColor }) {
  const t = useTheme();
  return <SymbolView name={symbols[name]} size={size} tintColor={t[color]} accessible={false} />;
}

export function RideIconTile({ icon }: { icon: RideGlyph }) {
  const t = useTheme();
  return <View style={[styles.tile, { backgroundColor: t['brand/tint'] }]}>
    <RideSymbol name={icon} size={spacing['space/20']} />
  </View>;
}

export function RideAvatar({ children, large }: PropsWithChildren<{ large?: boolean }>) {
  const t = useTheme();
  const size = large ? spacing['space/24'] * 2 + spacing['space/8'] : spacing['space/40'];
  return <View style={[styles.round, { width: size, minHeight: size, backgroundColor: t['brand/tint'] }]}>
    <RideText kind={large ? 'headline' : 'footnoteSemibold'} color="brand/primary">{children}</RideText>
  </View>;
}

export function RideBadge({ children, icon, tone = 'neutral' }: PropsWithChildren<{
  icon?: RideGlyph; tone?: 'neutral' | 'accent' | 'status';
}>) {
  const t = useTheme();
  const color = tone === 'accent' ? 'brand/primary' : 'label/secondary';
  return <View style={[styles.badge, { backgroundColor: t[tone === 'accent' ? 'brand/tint' : 'fill/secondary'] }]}>
    {icon && <RideSymbol name={icon} size={spacing['space/12']} color={color} />}
    {tone === 'status' && <View style={[styles.statusDot, { backgroundColor: t['label/tertiary'] }]} />}
    <View style={styles.shrink}><RideText kind="caption1" color={color}>{children}</RideText></View>
  </View>;
}

type Stop = { name: string; label?: string; caption?: ReactNode; action?: ReactNode };

export function RouteTimeline({ from, to, spacious = false }: { from: Stop; to: Stop; spacious?: boolean }) {
  const t = useTheme();
  const stops = [from, to];
  return <View>{stops.map(({ name, label, caption, action }, index) => {
    const first = index === 0;
    return <View key={index} style={[
      styles.stop,
      first && (spacious ? styles.spaciousFirst : styles.first),
      { borderColor: t.separator },
    ]}>
      <View style={[styles.rail, spacious && styles.spaciousRail]}>
        {first && !spacious && <View style={[styles.line, { backgroundColor: t['label/quaternary'] }]} />}
        <View style={[styles.dot, {
          borderColor: t['brand/primary'], backgroundColor: first ? t['bg/elevated'] : t['brand/primary'],
        }]} />
      </View>
      <View style={rideStyles.grow}>
        {label && <RideText kind="caption1" muted>{label}</RideText>}
        <RideText kind={spacious ? 'headline' : 'subheadlineSemibold'}>{name}</RideText>
        {caption && <RideText kind="footnote" muted>{caption}</RideText>}
      </View>
      {action}
    </View>;
  })}</View>;
}

export function RideNotice({ icon, children }: PropsWithChildren<{ icon: 'lock' | 'info' }>) {
  const t = useTheme();
  return <View style={[styles.notice, { backgroundColor: t['brand/tint'] }]}>
    <RideSymbol name={icon} size={spacing['space/20']} />
    <View style={rideStyles.grow}><RideText kind="subheadline">{children}</RideText></View>
  </View>;
}

export function RideDivider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator }} />;
}

export function RideButton({ label, onPress, disabled = false, busy = false, icon, iconOnly = false,
  variant = 'primary', compact = false, hint }: {
  label: string; onPress?: () => void; disabled?: boolean; busy?: boolean; icon?: RideGlyph; iconOnly?: boolean;
  variant?: 'primary' | 'outline' | 'tint' | 'text' | 'surface'; compact?: boolean; hint?: string;
}) {
  const t = useTheme();
  const color = variant === 'primary' ? 'brand/on-primary' : variant === 'surface' ? 'label/primary' : 'brand/primary';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    hitSlop={compact ? spacing['space/4'] : undefined}
    style={({ pressed }) => [
      styles.button,
      compact && styles.compact,
      iconOnly && (compact ? styles.compactIcon : styles.iconOnly),
      {
        backgroundColor: variant === 'primary' ? t[pressed ? 'brand/primary-pressed' : 'brand/primary'] :
          variant === 'tint' ? t['brand/tint'] : variant === 'surface' ? t['bg/elevated'] : undefined,
        borderWidth: variant === 'outline' || variant === 'surface' ? 1 : 0,
        borderColor: t[variant === 'outline' ? 'brand/primary' : 'separator'],
        opacity: disabled && variant !== 'surface' ? 0.5 : 1,
      },
    ]}>
    {busy && <ActivityIndicator color={t[color]} />}
    {icon && <RideSymbol name={icon} size={compact ? spacing['space/16'] : spacing['space/20']} color={color} />}
    {!iconOnly && <View style={styles.shrink}>
      <RideText kind={compact ? 'footnoteSemibold' : 'headline'} color={color} align="center">{label}</RideText>
    </View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  round: { borderRadius: radius['radius/full'], alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: spacing['space/40'], height: spacing['space/40'], borderRadius: radius['radius/12'],
    alignItems: 'center', justifyContent: 'center',
  },
  shrink: { flexShrink: 1 },
  badge: {
    alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing['space/4'],
    paddingHorizontal: spacing['space/8'], paddingVertical: spacing['space/4'], borderRadius: radius['radius/full'],
  },
  statusDot: { width: spacing['space/8'], height: spacing['space/8'], borderRadius: radius['radius/full'] },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'] },
  first: { paddingBottom: spacing['space/12'] },
  spaciousFirst: { paddingBottom: spacing['space/20'], marginBottom: spacing['space/20'], borderBottomWidth: StyleSheet.hairlineWidth },
  rail: { alignSelf: 'stretch', alignItems: 'center', paddingTop: spacing['space/4'] },
  spaciousRail: { justifyContent: 'center', paddingTop: 0 },
  line: {
    position: 'absolute', top: spacing['space/12'], bottom: -spacing['space/4'], width: StyleSheet.hairlineWidth,
  },
  dot: { width: spacing['space/12'], height: spacing['space/12'], borderRadius: radius['radius/full'], borderWidth: 2 },
  notice: { flexDirection: 'row', gap: spacing['space/8'], padding: spacing['space/16'], borderRadius: radius['radius/16'] },
  button: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing['space/8'],
    paddingHorizontal: spacing['space/16'], paddingVertical: spacing['space/8'], borderRadius: radius['radius/full'],
  },
  compact: { minHeight: 36, paddingVertical: spacing['space/4'], paddingHorizontal: spacing['space/12'], flexShrink: 1 },
  compactIcon: { width: 36, paddingHorizontal: 0, flexShrink: 0 },
  iconOnly: { width: 44, paddingHorizontal: 0, minHeight: 44 },
});
