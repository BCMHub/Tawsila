import { NativeTabs } from 'expo-router/native-tabs';
import { strings } from '../../strings';
import { typography, useTheme } from '../../theme';
const tabs = [
  { name: 'index', active: require('../../../assets/icons/tab-home-active.png'), inactive: require('../../../assets/icons/tab-home-inactive.png') },
  { name: 'trips', active: require('../../../assets/icons/tab-car-active.png'), inactive: require('../../../assets/icons/tab-car-inactive.png') },
  { name: 'messages', active: require('../../../assets/icons/tab-msg-active.png'), inactive: require('../../../assets/icons/tab-msg-inactive.png') },
  { name: 'profile', active: require('../../../assets/icons/tab-user-active.png'), inactive: require('../../../assets/icons/tab-user-inactive.png') },
];
export default function TabsLayout() {
  const t = useTheme();
  return <NativeTabs minimizeBehavior="never" backgroundColor={t['bg/elevated']} indicatorColor={t['brand/tint']}
    iconColor={{ default: t['label/secondary'], selected: t['brand/primary'] }}
    labelStyle={{ default: { ...typography.caption2, color: t['label/secondary'] }, selected: { ...typography.caption2, color: t['brand/primary'] } }}>
    {tabs.map((tab, i) => <NativeTabs.Trigger key={tab.name} name={tab.name} accessibilityLabel={strings.tabs[i]} disableTransparentOnScrollEdge>
      <NativeTabs.Trigger.Label>{strings.tabs[i]}</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon src={{ default: tab.inactive, selected: tab.active }} renderingMode="template" />
    </NativeTabs.Trigger>)}
  </NativeTabs>;
}
