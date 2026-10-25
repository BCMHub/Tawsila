import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InlineNotice } from '../../components/InlineNotice';
import { TextField } from '../../components/TextField';
import { CheckboxRow } from '../../components/CheckboxRow';
import { Dropdown } from '../../components/Dropdown';
import { RadioCard } from '../../components/RadioCard';
import { ProgressBar } from '../../components/ProgressBar';
import { LoadingState } from '../../components/States';
import { radius, spacing, typography, useTheme } from '../../theme';
import { strings } from '../../strings';
import { useAuth } from '../auth/AuthProvider';
import { OnboardingError, type Community, type ProfileInput, type Role } from './api';
import { useOnboardingApi } from './OnboardingApiProvider';
import { useSessionEmail } from './useSessionEmail';
import { normalizeName, validateName } from './validation';
type Legal = { terms: string; privacy: string };
const sameLegal = (a: Legal | null, b: Legal) => a?.terms === b.terms && a?.privacy === b.privacy;
export function OnboardingFlow() {
 const api = useOnboardingApi(); const { refresh } = useAuth(); const email = useSessionEmail();
 const t = useTheme(); const insets = useSafeAreaInsets(); const s = strings.onboarding;
 const [step, setStep] = useState(1);
 const [first, setFirst] = useState(''); const [last, setLast] = useState('');
 const [touched, setTouched] = useState({ first: false, last: false });
 const [age, setAge] = useState(false); const [consent, setConsent] = useState(false);
 const [legal, setLegal] = useState<Legal | null>(null); const legalRef = useRef<Legal | null>(null);
 const [legalBusy, setLegalBusy] = useState(false); const [legalError, setLegalError] = useState(false);
 const [communities, setCommunities] = useState<Community[]>([]); const [community, setCommunity] = useState('');
 const [communityState, setCommunityState] = useState<'loading' | 'ready' | 'error'>('loading');
 const [role, setRole] = useState<Role>(); const [busy, setBusy] = useState(false);
 const sending = useRef(false); const alive = useRef(true); const retryInput = useRef<ProfileInput | null>(null);
 const [banner, setBanner] = useState(''); const [uncertain, setUncertain] = useState(false);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const updateLegal = useCallback((value: Legal) => {
  if (legalRef.current && !sameLegal(legalRef.current, value)) { setAge(false); setConsent(false); }
  legalRef.current = value; setLegal(value);
 }, []);
 const loadLegal = useCallback(async () => {
  setLegalBusy(true); setLegalError(false); setBanner(current => current === s.loadError ? '' : current);
  try { const value = await api.currentLegalVersions(); if (alive.current) updateLegal(value); }
  catch { if (alive.current) { setLegalError(true); setBanner(s.loadError); } }
  finally { if (alive.current) setLegalBusy(false); }
 }, [api, updateLegal, s.loadError]);
 const loadCommunities = useCallback(async () => {
  setCommunityState('loading');
  try { const value = await api.listCommunities(); if (alive.current) { const active = value.filter(row => row.active).sort((a, b) => a.sort_order - b.sort_order); setCommunities(active); setCommunity(current => active.some(row => row.id === current) ? current : ''); setCommunityState('ready'); } }
  catch { if (alive.current) setCommunityState('error'); }
 }, [api]);
 const goToStep = useCallback((value: number) => { setStep(value); if (value === 2) void loadLegal(); if (value === 3) void loadCommunities(); }, [loadLegal, loadCommunities]);
 const back = useCallback(() => { if (!sending.current && step > 1) { retryInput.current = null; setUncertain(false); setBanner(''); goToStep(step - 1); return true; } return false; }, [step, goToStep]);
 useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', back); return () => subscription.remove(); }, [back]);
 async function drift(current?: Legal) {
  retryInput.current = null; setUncertain(false); setAge(false); setConsent(false); setBanner(s.stale);
  // Entering P2 loads again; a failed load cannot enable acceptance.
  if (current) updateLegal(current);
  else { legalRef.current = null; setLegal(null); }
  goToStep(2);
 }
 async function submit() {
  if (sending.current || !role || !legal || !age || !consent || !community || !validateName(first) || !validateName(last)) return;
  sending.current = true; setBusy(true); setBanner('');
  try {
   const current = await api.currentLegalVersions();
   if (!alive.current) return;
   if (!sameLegal(legal, current)) { await drift(current); return; }
   const input = retryInput.current ?? { firstName: normalizeName(first), lastName: normalizeName(last), communityId: community, role, ageConfirmed: true, termsVersion: current.terms, privacyVersion: current.privacy };
   retryInput.current = input;
   await api.completeProfile(input);
   if (alive.current) { setUncertain(false); retryInput.current = null; await refresh(); }
  } catch (error) {
   if (!alive.current) return;
   if (error instanceof OnboardingError && error.code === 'consent_version_stale') { await drift(); }
   else if (!(error instanceof OnboardingError) || error.classification === 'uncertain') { setUncertain(true); setBanner(s.uncertain); }
   else {
    retryInput.current = null; setUncertain(false); setBanner(s.rejected);
    if (error.code === 'invalid_name') { setTouched({ first: true, last: true }); goToStep(1); }
    if (error.code === 'invalid_community') { setCommunity(''); goToStep(3); }
   }
  } finally { sending.current = false; if (alive.current) setBusy(false); }
 }
 const enabled = step === 1 ? validateName(first) && validateName(last) : step === 2 ? age && consent && !!legal && !legalBusy && !legalError : step === 3 ? !!community && communityState === 'ready' : !!role;
 const next = () => { if (!enabled || busy) return; setBanner(''); if (step === 4) void submit(); else goToStep(step + 1); };
 return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t['bg/base'] }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <View style={{ paddingTop: insets.top, paddingHorizontal: spacing['space/16'] }}>
   <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 44 }}>{step > 1 && <Pressable accessibilityRole="button" accessibilityLabel={strings.back} accessibilityState={{ disabled: busy }} disabled={busy} onPress={back} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius['radius/full'], borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'] }}><SymbolView name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={t['label/primary']} accessible={false} /></Pressable>}</View>
    <Text style={{ ...typography.headline, flex: 1, textAlign: 'center', color: t['label/primary'] }}>{step === 4 ? s.welcome : s.nav}</Text><View style={{ width: 44 }} />
   </View><ProgressBar step={Math.min(step, 3) as 1 | 2 | 3} />
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: spacing['space/16'], gap: spacing['space/24'] }}>
   <View style={{ gap: spacing['space/8'] }}><Text accessibilityRole="header" style={{ ...typography.title1, color: t['label/primary'], textAlign: 'auto' }}>{s.titles[step - 1]}</Text><Text style={{ ...typography.body, color: t['label/secondary'], textAlign: 'auto' }}>{s.subtitles[step - 1]}</Text></View>
   {!!banner && <InlineNotice text={banner} style={{ ...typography.subheadline, color: t['label/primary'], backgroundColor: t['brand/tint'], padding: spacing['space/16'], borderRadius: radius['radius/16'] }} />}
   {step === 1 && <>
    <View accessible={false} style={{ alignSelf: 'center', width: 88, height: 88, borderRadius: radius['radius/full'], alignItems: 'center', justifyContent: 'center', backgroundColor: t['brand/tint'] }}>{first || last ? <Text style={{ ...typography.title1, color: t['brand/primary'] }}>{[first, last].map(name => Array.from(name.trim())[0] ?? '').join('').toUpperCase()}</Text> : <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} size={32} tintColor={t['brand/primary']} accessible={false} />}</View>
    <TextField label={s.firstName} placeholder={s.firstName} value={first} onChangeText={setFirst} onBlur={() => setTouched(value => ({ ...value, first: true }))} error={touched.first && !validateName(first) ? s.invalidName : undefined} autoComplete="given-name" />
    <TextField label={s.lastName} placeholder={s.lastName} value={last} onChangeText={setLast} onBlur={() => setTouched(value => ({ ...value, last: true }))} error={touched.last && !validateName(last) ? s.invalidName : undefined} autoComplete="family-name" />
    <TextField label={s.google} value={email} readOnly />
   </>}
   {step === 2 && <View style={{ gap: spacing['space/16'] }}>
    {legalBusy && <LoadingState />}
    {legalError && <Pressable accessibilityRole="button" accessibilityLabel={strings.retry} onPress={() => void loadLegal()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...typography.headline, color: t['brand/primary'] }}>{strings.retry}</Text></Pressable>}
    <CheckboxRow label={s.age} checked={age} disabled={legalBusy || legalError || !legal} onPress={() => setAge(value => !value)} />
    <CheckboxRow label={s.consent} checked={consent} disabled={legalBusy || legalError || !legal} onPress={() => setConsent(value => !value)}>{s.acceptPrefix}<Text style={{ color: t['brand/primary'] }}>{s.terms}</Text>{s.and}<Text style={{ color: t['brand/primary'] }}>{s.privacy}</Text>{s.period}</CheckboxRow>
   </View>}
   {step === 3 && <View style={{ gap: spacing['space/16'] }}>
    <Dropdown label={s.community} placeholder={s.selectCommunity} value={community} onSelect={setCommunity} options={communities.map(row => ({ value: row.id, label: row.name }))} disabled={communityState !== 'ready' || !communities.length} />
    {communityState === 'loading' && <LoadingState />}
    {communityState === 'ready' && !communities.length && <Text style={{ ...typography.body, color: t['label/secondary'] }}>{s.emptyCommunities}</Text>}
    {communityState === 'error' && <><InlineNotice text={s.loadError} style={{ ...typography.body, color: t['label/primary'] }} /><Pressable accessibilityRole="button" accessibilityLabel={strings.retry} onPress={() => void loadCommunities()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...typography.headline, color: t['brand/primary'] }}>{strings.retry}</Text></Pressable></>}
   </View>}
   {step === 4 && <View style={{ gap: spacing['space/12'] }} pointerEvents={busy ? 'none' : 'auto'}>{s.roles.map(option => <RadioCard key={option.value} label={option.label} description={option.description} icon={option.value === 'rider' ? 'people' : option.value === 'car_owner' ? 'car' : 'shield'} selected={role === option.value} disabled={busy} onPress={() => { retryInput.current = null; setUncertain(false); setRole(option.value); }} />)}</View>}
   <View style={{ flexGrow: 1 }} />
   <Pressable accessibilityRole="button" accessibilityLabel={busy ? s.sending : uncertain ? strings.retry : s.continue} accessibilityState={{ disabled: !enabled || busy, busy }} disabled={!enabled || busy} onPress={next} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: spacing['space/24'], paddingVertical: spacing['space/12'], justifyContent: 'center', borderRadius: radius['radius/full'], backgroundColor: t[pressed ? 'brand/primary-pressed' : 'brand/primary'], opacity: !enabled || busy ? 0.4 : 1, marginBottom: insets.bottom })}><Text style={{ ...typography.headline, textAlign: 'center', color: t['brand/on-primary'] }}>{busy ? s.sending : uncertain ? strings.retry : s.continue}</Text></Pressable>
  </ScrollView>
 </KeyboardAvoidingView>;
}
