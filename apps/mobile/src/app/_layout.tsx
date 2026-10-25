import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View, useColorScheme } from 'react-native';
import { useTheme, typography, spacing } from '../theme';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { createProviderHandlers } from '../features/auth/providers';
import { installGuard } from '../features/auth/installGuard';
import { adaptAuthClient, getSupabase } from '../lib/supabase';
import { createOnboardingApi } from '../features/onboarding/api';
import { OnboardingApiProvider } from '../features/onboarding/OnboardingApiProvider';
import { strings } from '../strings';

export function AuthRoutes() {
  const { state } = useAuth();
  const t = useTheme();
  const ready = state === 'ready_to_browse';
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t['bg/base'] } }}>
    <Stack.Protected guard={!ready}><Stack.Screen name="(onboarding)" /></Stack.Protected>
    <Stack.Protected guard={ready}><Stack.Screen name="(tabs)" /><Stack.Screen name="debug" /></Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const [configuration] = useState(() => {
    try { return { onboarding: createOnboardingApi(), client: adaptAuthClient(getSupabase()), providers: createProviderHandlers(Platform.OS === 'ios' ? 'ios' : 'android') }; }
    catch { return null; }
  });
  return <><StatusBar style={dark ? 'light' : 'dark'} />{configuration ? <AuthProvider client={configuration.client} providers={configuration.providers} installGuard={installGuard}><OnboardingApiProvider api={configuration.onboarding}><AuthRoutes /></OnboardingApiProvider></AuthProvider> : <View style={{ flex: 1, justifyContent: 'center', padding: spacing['space/24'], backgroundColor: t['bg/base'] }}>
    <Text accessibilityRole="header" style={{ ...typography.title2, color: t['label/primary'] }}>{strings.auth.configuration}</Text>
    <Text accessibilityRole="alert" style={{ ...typography.body, color: t['label/primary'] }}>{strings.auth.configurationBody}</Text>
  </View>}</>;
}
