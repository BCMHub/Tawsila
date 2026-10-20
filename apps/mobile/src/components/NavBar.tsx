import { I18nManager, Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { typography, useTheme } from '../theme';
import { strings } from '../strings';

type Props = { title: string; variant?: 'large' | 'inline'; onBack?: () => void; onMore?: () => void };
export function NavBar({ title, variant = 'large', onBack, onMore = () => {} }: Props) {
  const t = useTheme();
  const button = (name: 'back' | 'more', label: string, onPress?: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'], alignItems: 'center', justifyContent: 'center' }}>
      <View style={name === 'back' && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}><Icon name={name} size={20} color={t['label/primary']} /></View>
    </Pressable>
  );
  return <View style={{ paddingHorizontal: 16, backgroundColor: t['bg/base'] }}>
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onBack && button('back', strings.back, onBack)}
      {variant === 'inline' && <Text accessibilityRole="header" style={{ ...typography.headline, color: t['label/primary'], flex: 1, textAlign: 'center', paddingVertical: 4 }}>{title}</Text>}
      <View style={{ marginStart: 'auto' }}>{button('more', strings.more, onMore)}</View>
    </View>
    {variant === 'large' && <Text accessibilityRole="header" style={{ ...typography.largeTitle, color: t['label/primary'], marginTop: 4, paddingBottom: 8, textAlign: 'auto' }}>{title}</Text>}
  </View>;
}
