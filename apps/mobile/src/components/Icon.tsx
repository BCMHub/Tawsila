import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';

export const icons = {
  more: require('../../assets/icons/nav-more.svg'),
  back: require('../../assets/icons/nav-chevron-left.svg'),
  empty: require('../../assets/icons/state-empty-car.svg'),
} as const;
export type IconName = keyof typeof icons | 'wifi';
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  if (name === 'wifi') {
    return <SymbolView name={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }} size={size} tintColor={color} accessible={false} />;
  }
  return <Image source={icons[name]} tintColor={color} contentFit="contain" style={{ width: size, height: size }} accessible={false} />;
}
