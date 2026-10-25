import { strings } from '../strings';
import { Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../theme';
import type { VerificationStatus } from '../features/onboarding/api';
export function StatusBadge({ status }: { status: VerificationStatus }) {
 const t = useTheme();
 const color = t[status === 'approved' ? 'system/green' : status === 'rejected' ? 'system/red' : 'system/orange'];
 const tint = status === 'approved' ? `${color}22` : t[status === 'rejected' ? 'system/red-tint' : 'system/orange-tint'];
 return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space/20'] / 4, paddingHorizontal: spacing['space/20'] / 2, paddingVertical: spacing['space/20'] / 4, borderRadius: radius['radius/full'], backgroundColor: tint }}><View accessible={false} style={{ width: 6, height: 6, borderRadius: radius['radius/12'] / 4, backgroundColor: color }} /><Text style={{ ...typography.footnoteSemibold, color: t['label/primary'] }}>{{ pending: strings.verification.pending, approved: strings.verification.approved, rejected: strings.verification.rejected }[status]}</Text></View>;
}
