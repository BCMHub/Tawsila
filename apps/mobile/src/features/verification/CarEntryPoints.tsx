import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useOnboardingApi } from '../onboarding/OnboardingApiProvider';
import type { Role, Verification } from '../onboarding/api';
import { ApprovalRow, CarButton } from './CarScreens';
import { Banner } from '../../components/Banner';
import { typography, useTheme } from '../../theme';
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
 return <View style={{ padding: 16, gap: 16 }}>
  {error && <><Banner text="We could not update your car information. Please try again." /><CarButton label="Try again" onPress={() => setReload(n => n + 1)} /></>}
  {profile && role === 'rider' && <CarButton label="I have a car" disabled={busy} busy={busy} onPress={() => void switchRole()} secondary />}
  {role && role !== 'rider' && verification && <>
   {(!item || item.status === 'rejected') && <View style={{ padding: 16, gap: 16, borderWidth: 1, borderColor: t.separator, borderRadius: 16, backgroundColor: t['bg/elevated'] }}><Text style={{ ...typography.headline, color: t['label/primary'] }}>Add your car to start offering rides</Text><CarButton label="Add your car" onPress={() => router.push('/(verify)')} /></View>}
   {profile && item && <Pressable accessibilityRole="button" accessibilityLabel={`Car owner approval, ${{ pending: 'Pending', approved: 'Verified', rejected: 'Declined' }[item.status]}`} onPress={() => router.push('/(verify)/status')}><ApprovalRow status={item.status} /></Pressable>}
  </>}
 </View>;
}
