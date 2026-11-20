import { useEffect, useRef, useState } from 'react';
import { router, Stack, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View, useColorScheme } from 'react-native';
import { useTheme, typography, spacing } from '../theme';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { createProviderHandlers } from '../features/auth/providers';
import { installGuard } from '../features/auth/installGuard';
import { adaptAuthClient, getSupabase } from '../lib/supabase';
import { createOnboardingApi } from '../features/onboarding/api';
import { OnboardingApiProvider } from '../features/onboarding/OnboardingApiProvider';
import { createRidesApi } from '../features/rides/api';
import { RidesApiProvider } from '../features/rides/RidesApiProvider';
import { clearPendingSharedRide, takePendingSharedRide } from '../features/rides/pendingSharedRide';
import { strings } from '../strings';

function ResumePendingSharedRide({ ready }: { ready: boolean }) {
  const root = useRootNavigationState();
  // Expo Router wraps the app's Stack in the root layout route.
  const stack = root?.routes[root.index]?.state;
  const focusedRoute = stack?.routes[stack.index ?? 0];
  const focusedGroup = focusedRoute?.name.split('/')[0];
  const navigationReady = Boolean(root?.key && stack?.key && focusedGroup && focusedGroup !== '(onboarding)');
  const rideRoute = focusedRoute?.name === 'r' ? focusedRoute.state : undefined;
  const params = rideRoute?.routes[rideRoute.index ?? 0]?.params;
  const openCode = params && 'code' in params ? params.code : undefined;
  const checkedPendingLink = useRef(false);

  useEffect(() => {
    if (!ready) {
      checkedPendingLink.current = false;
      return;
    }
    // The protected onboarding screen queues its own redirect when auth changes.
    // Wait until the committed stack has focused a ready screen before taking the link.
    if (!navigationReady || checkedPendingLink.current) return;
    checkedPendingLink.current = true;
    const code = takePendingSharedRide();
    if (code && code !== openCode) router.replace(`/r/${code}`);
  }, [ready, navigationReady, openCode]);

  return null;
}

export function AuthRoutes() {
  const { state } = useAuth();
  const t = useTheme();
  const ready = state === 'ready_to_browse';
  const hadSession = useRef(false);

  useEffect(() => {
    if (ready || state === 'needs_profile') {
      hadSession.current = true;
    } else if (state === 'signed_out' && hadSession.current) {
      // Visiting sign-in on a cold start must preserve the incoming link.
      clearPendingSharedRide();
      hadSession.current = false;
    }
  }, [ready, state]);

  return <Stack
    layout={({ children }) => <>{children}<ResumePendingSharedRide ready={ready} /></>}
    screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t['bg/base'] } }}
  >
    <Stack.Protected guard={!ready}><Stack.Screen name="(onboarding)" /></Stack.Protected>
    <Stack.Protected guard={ready}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(verify)" />
      <Stack.Screen name="debug" />
      <Stack.Screen name="post" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="r" />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const [configuration] = useState(() => {
    try {
      return {
        onboarding: createOnboardingApi(),
        rides: createRidesApi(),
        client: adaptAuthClient(getSupabase()),
        providers: createProviderHandlers(Platform.OS === 'ios' ? 'ios' : 'android'),
      };
    }
    catch { return null; }
  });
  return <><StatusBar style={dark ? 'light' : 'dark'} />{configuration ? <AuthProvider client={configuration.client} providers={configuration.providers} installGuard={installGuard}>
    <OnboardingApiProvider api={configuration.onboarding}>
      <RidesApiProvider api={configuration.rides}><AuthRoutes /></RidesApiProvider>
    </OnboardingApiProvider>
  </AuthProvider> : <View style={{ flex: 1, justifyContent: 'center', padding: spacing['space/24'], backgroundColor: t['bg/base'] }}>
    <Text accessibilityRole="header" style={{ ...typography.title2, color: t['label/primary'] }}>{strings.auth.configuration}</Text>
    <Text accessibilityRole="alert" style={{ ...typography.body, color: t['label/primary'] }}>{strings.auth.configurationBody}</Text>
  </View>}</>;
}
