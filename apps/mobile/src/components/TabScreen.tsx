import { Platform, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NavBar } from './NavBar';
import { strings } from '../strings';
import { typography, useTheme } from '../theme';
export function TabScreen({ title, profile = false }: { title: string; profile?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Native tabs supply iOS scroll insets and Android bottom safe area; only web needs inset + bar + gap.
  const paddingBottom = Platform.OS === 'ios' || Platform.OS === 'android' ? 0 : insets.bottom + 62 + 8;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t['bg/base'] }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom }}>
      <NavBar title={title} />
      {__DEV__ && profile && <Pressable accessibilityRole="button" accessibilityLabel={strings.debug} onPress={() => router.push('/debug')} style={{ minHeight: 44, padding: 16 }}><Text style={{ ...typography.body, color: t['brand/primary'] }}>{strings.debug}</Text></Pressable>}
    </ScrollView>
  </SafeAreaView>;
}
