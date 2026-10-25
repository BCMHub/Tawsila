import { View } from 'react-native';
import { radius, spacing, useTheme } from '../theme';
import { strings } from '../strings';
export function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
 const t = useTheme();
 return <View accessible accessibilityRole="progressbar" accessibilityLabel={strings.onboarding.progress} accessibilityValue={{ min: 1, max: 3, now: step }} style={{ flexDirection: 'row', gap: spacing['space/8'] }}>{[1, 2, 3].map(segment => <View key={segment} style={{ flex: 1, height: 4, borderRadius: radius['radius/full'], backgroundColor: t[segment <= step ? 'brand/primary' : 'separator'] }} />)}</View>;
}
