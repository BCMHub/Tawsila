import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Text, type StyleProp, type TextStyle } from 'react-native';
import { typography, useTheme } from '../theme';
export function InlineNotice({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
 const t = useTheme();
 useEffect(() => {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: false });
 }, [text]);
 return <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[{ ...typography.footnote, color: t['system/red'], textAlign: 'auto' }, style]}>{text}</Text>;
}
