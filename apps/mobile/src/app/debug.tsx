import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '../components/NavBar';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { strings } from '../strings';
import { typography, useTheme } from '../theme';
export default function DebugScreen() {
  const t = useTheme();
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const acknowledge = () => Alert.alert(strings.debug, strings.emptyBody);
  return <SafeAreaView style={{ flex: 1, backgroundColor: t['bg/base'] }}>
    <NavBar title={strings.debug} variant="inline" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      {state === 'loading' ? <LoadingState fill /> :
        state === 'empty' ? <EmptyState fill title={strings.emptyTitle} body={strings.emptyBody} primaryAction={{ label: strings.primary, onPress: acknowledge }} secondaryAction={{ label: strings.secondary, onPress: acknowledge }} /> :
          state === 'error' ? <ErrorState fill onRetry={acknowledge} /> :
            (['loading', 'empty', 'error'] as const).map(name => <Link key={name} href={`/debug?state=${name}`} style={{ ...typography.body, color: t['brand/primary'], padding: 16, minHeight: 44 }}>{strings.debugStates[name]}</Link>)}
    </ScrollView>
  </SafeAreaView>;
}
