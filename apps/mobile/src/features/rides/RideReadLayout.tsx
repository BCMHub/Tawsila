import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export function RideReadLayout() {
  const t = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t['bg/base'] } }} />;
}
