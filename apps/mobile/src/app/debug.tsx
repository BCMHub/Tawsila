import { Redirect, router } from 'expo-router';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '../components/NavBar';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { strings } from '../strings';
import { useTheme } from '../theme';
export default function DebugScreen() {
  const t = useTheme();
  if (!__DEV__) return <Redirect href="/" />;
  const acknowledge = () => Alert.alert(strings.debug, strings.emptyBody);
  return <SafeAreaView style={{ flex: 1, backgroundColor: t['bg/base'] }}><ScrollView>
    <NavBar title={strings.debug} variant="inline" onBack={() => router.back()} onMore={acknowledge} />
    <LoadingState />
    <EmptyState title={strings.emptyTitle} body={strings.emptyBody} primaryAction={{ label: strings.primary, onPress: acknowledge }} secondaryAction={{ label: strings.secondary, onPress: acknowledge }} />
    <ErrorState onRetry={acknowledge} />
  </ScrollView></SafeAreaView>;
}
