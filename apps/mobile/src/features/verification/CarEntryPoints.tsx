import { strings } from '../../strings';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useOnboardingApi } from '../onboarding/OnboardingApiProvider';
import type { Role, Verification } from '../onboarding/api';
import { ApprovalRow, CarButton } from './CarScreens';
import { Banner } from '../../components/Banner';
import { radius, spacing, typography, useTheme } from '../../theme';
export function CarEntryPoints({ profile = false }: { profile?: boolean }) {
 const api = useOnboardingApi(); const t = useTheme();
 const [role, setRole] = useState<Role | null>(null); const [verification, setVerification] = useState<Verification | null>(null); const [error, setError] = useState(false); const [busy, setBusy] = useState(false); const [reload, setReload] = useState(0);
 useFocusEffect(useCallback(() => {
  let active = true; void reload; setRole(null); setVerification(null); setError(false);
  void (async () => {
   try { const p = await api.myProfile(); const v = p && p.role !== 'rider' ? await api.myVerification() : null; if (active) { setRole(p?.role ?? null); setVerification(v); } }
   catch { if (active) setError(true); }
  })();
  return () => { active = false; };
 }, [api, reload]));
 async function switchRole() {
  if (busy) return; setBusy(true); setError(false);
  try { await api.setRole('both'); router.push('/(verify)'); }
  catch { setError(true); }
  finally { setBusy(false); }
 }
 const item = verification?.car_owner;
 return <View style={{ backgroundColor: t['bg/base'], padding: spacing['space/16'], gap: spacing['space/16'] }}>
  {error && <><Banner text={strings.verification.updateError} /><CarButton label={strings.retry} onPress={() => setReload(n => n + 1)} /></>}
  {profile && role === 'rider' && <CarButton label={strings.verification.haveCar} disabled={busy} busy={busy} onPress={() => void switchRole()} secondary />}
  {role && role !== 'rider' && verification && <>
   {(!item || item.status === 'rejected') && <View style={{ padding: spacing['space/16'], gap: spacing['space/16'], borderWidth: 1, borderColor: t.separator, borderRadius: radius['radius/16'], backgroundColor: t['bg/elevated'] }}><Text style={{ ...typography.headline, color: t['label/primary'] }}>{strings.verification.entryTitle}</Text><CarButton label={strings.verification.addCar} onPress={() => router.push('/(verify)')} /></View>}
   {profile && item && <Pressable accessibilityRole="button" accessibilityLabel={`${strings.verification.approval}, ${{ pending: strings.verification.pending, approved: strings.verification.approved, rejected: strings.verification.rejected }[item.status]}`} onPress={() => router.push('/(verify)/status')}><ApprovalRow status={item.status} /></Pressable>}
  </>}
 </View>;
}
