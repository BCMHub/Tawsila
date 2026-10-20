import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NavBar } from './NavBar';
import { strings } from '../strings';
import { typography, useTheme } from '../theme';
export function TabScreen({ title, profile = false }: { title: string; profile?: boolean }) {
  const t = useTheme();
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t['bg/base'] }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <NavBar title={title} onMore={() => Alert.alert(strings.more, strings.emptyBody)} />
      {__DEV__ && profile && <Pressable accessibilityRole="button" accessibilityLabel={strings.debug} onPress={() => router.push('/debug')} style={{ minHeight: 44, padding: 16 }}><Text style={{ ...typography.body, color: t['brand/primary'] }}>{strings.debug}</Text></Pressable>}
    </ScrollView>
  </SafeAreaView>;
}
