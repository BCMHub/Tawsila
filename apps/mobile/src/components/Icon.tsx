import { Image } from 'expo-image';

export const icons = {
  more: require('../../assets/icons/nav-more.svg'),
  back: require('../../assets/icons/nav-chevron-left.svg'),
  wifi: require('../../assets/icons/state-wifi-off.svg'),
  empty: require('../../assets/icons/state-empty-car.svg'),
} as const;
export type IconName = keyof typeof icons;
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return <Image source={icons[name]} tintColor={color} contentFit="contain" style={{ width: size, height: size }} accessible={false} />;
}
