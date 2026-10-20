import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useTheme } from '../theme';
export default function RootLayout() {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  return <><StatusBar style={dark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t['bg/base'] } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="debug" /></Stack></>;
}
