import { Text, View } from 'react-native';
import { typography, useTheme } from '../theme';
import type { VerificationStatus } from '../features/onboarding/api';
export function StatusBadge({ status }: { status: VerificationStatus }) {
 const t = useTheme();
 const color = t[status === 'approved' ? 'system/green' : status === 'rejected' ? 'system/red' : 'system/orange'];
 const tint = status === 'approved' ? `${color}22` : t[status === 'rejected' ? 'system/red-tint' : 'system/orange-tint'];
 return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: tint }}><View accessible={false} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /><Text style={{ ...typography.footnoteSemibold, color: t['label/primary'] }}>{{ pending: 'Pending', approved: 'Verified', rejected: 'Declined' }[status]}</Text></View>;
}
