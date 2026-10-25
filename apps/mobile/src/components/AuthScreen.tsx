import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Text, View, useColorScheme, useWindowDimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthProvider';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { Banner } from './Banner';
import { LoadingState } from './States';
import { radius, spacing, typography, useTheme } from '../theme';
import { strings } from '../strings';

export function AuthScreen() {
  const { state, notice, signIn, retry, canRetry } = useAuth();
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const a = strings.auth;
  const progressing = state === 'authenticating';
  useEffect(() => {
    if (progressing && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(a.progress, { queue: true });
  }, [progressing, a.progress]);
  if (state === 'checking') return <LoadingState fill />;
  if (state === 'ready_to_browse') return null;
  if (state === 'needs_profile') return <OnboardingFlow />;
  const provision = state === 'account_provision_error';
  const failed = notice === 'provider_failed' || notice === 'failed';
  const message = provision ? a.provision : notice === 'cancelled' ? a.cancelled : notice === 'offline' ? a.offline : notice === 'unavailable' ? a.unavailable : failed ? a.failed : null;
  const disabled = notice === 'unavailable';
  const label = provision || failed ? strings.retry : a.google;
  return <View style={{ flex: 1, backgroundColor: t['bg/base'] }}>
    <Image source={dark ? require('../../assets/images/welcome-bg-dark.png') : require('../../assets/images/welcome-bg-light.png')} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom, minHeight: '100%' }}>
      <View style={{ paddingHorizontal: spacing['space/24'], gap: spacing['space/24'] }}>
        <Text maxFontSizeMultiplier={2} style={{ ...typography.title1, color: t['brand/primary'] }}>{a.brand}</Text>
        <Text maxFontSizeMultiplier={2} accessibilityRole="header" style={{ ...typography.largeTitle, color: t['label/primary'] }}>{a.headline}{'\n'}<Text style={{ color: t['brand/primary'] }}>{a.together}</Text></Text>
      </View>
      <View style={{ flexGrow: 1, minHeight: 280 }} />
      <View style={{ paddingHorizontal: spacing['space/24'], gap: spacing['space/16'] }}>
        {message ? <Banner text={message} polite={!provision && (notice === 'cancelled' || notice === 'offline')} /> : progressing ? <Text accessibilityLiveRegion="polite" style={{ ...typography.subheadline, color: t['label/primary'] }}>{a.progress}</Text> : a.benefits.map((benefit, index) => <View key={benefit} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'] }}>
          <View style={{ padding: spacing['space/8'], borderRadius: radius['radius/12'], backgroundColor: t['brand/tint'] }}><SymbolView name={(['mappin.circle', 'person.2', 'leaf'] as const)[index]} size={20} tintColor={t['brand/primary']} accessible={false} /></View>
          <Text style={{ ...typography.footnoteSemibold, color: t['label/primary'], flexShrink: 1, maxWidth: 120 * fontScale }}>{benefit}</Text>
        </View>)}
      </View>
      <View style={{ minHeight: spacing['space/32'], flexGrow: 0.3 }} />
      <View style={{ paddingHorizontal: spacing['space/16'] }}>
        {!progressing && <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (canRetry) void retry(); else void signIn('google'); }} style={({ pressed }) => ({ minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing['space/24'], paddingVertical: spacing['space/12'], borderRadius: radius['radius/full'], borderWidth: provision || failed ? 0 : 1, borderColor: t['brand/primary'], backgroundColor: provision || failed ? t[pressed ? 'brand/primary-pressed' : 'brand/primary'] : undefined, opacity: disabled ? 0.4 : 1 })}>
          <Text style={{ ...typography.headline, textAlign: 'center', color: provision || failed ? t['brand/on-primary'] : t['brand/primary'] }}>{label}</Text>
        </Pressable>}
      </View>
    </ScrollView>
  </View>;
}
