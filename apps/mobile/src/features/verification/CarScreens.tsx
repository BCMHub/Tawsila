import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../../components/Banner';
import { Dropdown } from '../../components/Dropdown';
import { TextField } from '../../components/TextField';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/States';
import { useOnboardingApi } from '../onboarding/OnboardingApiProvider';
import { OnboardingError, type CarBrand, type CarModel, type CarType, type CarInput, type Verification } from '../onboarding/api';
import { newSubmissionKey, validateCarSelection, validatePlate, validateYear } from '../onboarding/validation';
import { radius, typography, useTheme } from '../../theme';

export function CarButton({ label, onPress, disabled = false, busy = false, secondary = false }: { label: string; onPress(): void; disabled?: boolean; busy?: boolean; secondary?: boolean }) {
 const t = useTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, padding: 12, borderRadius: radius['radius/full'], justifyContent: 'center', backgroundColor: secondary ? undefined : t[pressed ? 'brand/primary-pressed' : 'brand/primary'], opacity: disabled ? 0.4 : 1 })}><View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }}>{busy && <ActivityIndicator color={t['brand/on-primary']} />}<Text style={{ ...typography.headline, textAlign: 'center', color: t[secondary ? 'brand/primary' : 'brand/on-primary'] }}>{label}</Text></View></Pressable>;
}
function Frame({ title, subtitle, children, back }: PropsWithChildren<{ title: string; subtitle: string; back?: () => void }>) {
 const t = useTheme(); const insets = useSafeAreaInsets();
 return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t['bg/base'], paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 44 }}>{back && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'] }}><SymbolView name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={t['label/primary']} /></Pressable>}</View><Text style={{ ...typography.headline, color: t['label/primary'], flex: 1, textAlign: 'center' }}>Add your car</Text><View style={{ width: 44 }} /></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: Math.max(16, insets.bottom), gap: 24 }}><View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ ...typography.title1, color: t['label/primary'] }}>{title}</Text><Text style={{ ...typography.body, color: t['label/secondary'] }}>{subtitle}</Text></View>{children}</ScrollView>
 </KeyboardAvoidingView>;
}
const browse = () => router.replace('/(tabs)');
export function CarIntro() {
 const t = useTheme();
 return <Frame title="Add your car" subtitle="To offer rides, tell us about your car. We review it before you can post rides.">
  <View style={{ padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'] }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><SymbolView name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }} size={24} tintColor={t['brand/primary']} /><Text style={{ ...typography.headline, color: t['label/primary'] }}>Your car</Text></View><Text style={{ ...typography.subheadline, color: t['label/secondary'] }}>Brand, model, type, year and plate number</Text><Text style={{ ...typography.footnoteSemibold, color: t['brand/primary'] }}>To offer rides</Text></View>
  <Text style={{ ...typography.footnote, color: t['label/secondary'] }}>Riders can request rides right away.</Text><View style={{ flexGrow: 1 }} /><CarButton label="Start" onPress={() => router.push('/(verify)/car')} /><CarButton label="Not now" secondary onPress={browse} />
 </Frame>;
}
const uncertainMessage = 'We could not confirm that your car was sent. Check your connection and try again.';
export function CarDetails() {
 const api = useOnboardingApi(); const t = useTheme();
 const [brands, setBrands] = useState<CarBrand[]>([]); const [models, setModels] = useState<CarModel[]>([]); const [types, setTypes] = useState<CarType[]>([]);
 const [brand, setBrand] = useState(''); const [model, setModel] = useState(''); const [brandOther, setBrandOther] = useState(''); const [modelOther, setModelOther] = useState(''); const [type, setType] = useState(''); const [year, setYear] = useState(''); const [plate, setPlate] = useState('');
 const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false); const [modelLoading, setModelLoading] = useState(false); const [modelError, setModelError] = useState(false);
 const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false); const [banner, setBanner] = useState(''); const [fieldError, setFieldError] = useState('');
 const retry = useRef<CarInput | null>(null); const sending = useRef(false); const alive = useRef(true); const modelRequest = useRef(0);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const loadModels = useCallback(async (brandId: string) => {
  const request = ++modelRequest.current;
  setModels([]); setModelError(false);
  if (!brandId || brandId === 'other') { setModelLoading(false); return; }
  setModelLoading(true);
  try { const rows = await api.listCarModels(brandId); if (alive.current && request === modelRequest.current) setModels(rows); }
  catch { if (alive.current && request === modelRequest.current) setModelError(true); }
  finally { if (alive.current && request === modelRequest.current) setModelLoading(false); }
 }, [api]);
 const load = useCallback(async () => {
  try {
   const [b, ty, saved] = await Promise.all([api.listCarBrands(), api.listCarTypes(), api.myVehicle()]);
   if (!alive.current) return; setBrands(b); setTypes(ty);
   if (saved) { setBrand(saved.brand_id ?? 'other'); setBrandOther(saved.brand_other ?? ''); setModel(saved.model_id ?? 'other'); setModelOther(saved.model_other ?? ''); setType(saved.type_id); setYear(String(saved.year)); setPlate(saved.plate_number); await loadModels(saved.brand_id ?? 'other'); }
  } catch { if (alive.current) setLoadError(true); }
  finally { if (alive.current) setLoading(false); }
 }, [api, loadModels]);
 // load updates state only after the asynchronous catalogue and saved-vehicle reads.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { void load(); }, [load]);
 const selection = { brandId: brand && brand !== 'other' ? brand : null, brandOther: brand === 'other' ? brandOther.trim() : null, modelId: model && model !== 'other' ? model : null, modelOther: brand === 'other' || model === 'other' ? modelOther.trim() : null, typeId: type || null };
 const valid = !loading && !loadError && !modelLoading && !modelError && validateCarSelection(selection, { brands, models, types }) && /^\d{4}$/.test(year) && validateYear(Number(year)) && validatePlate(plate);
 const edit = (update: () => void) => { if (sending.current || retry.current) return; retry.current = null; setUncertain(false); setBanner(''); setFieldError(''); update(); };
 async function submit() {
  if (sending.current || (!uncertain && !valid)) return;
  sending.current = true; setBusy(true); setBanner(''); setFieldError('');
  const input = retry.current ?? { ...selection, submissionKey: newSubmissionKey(), year: Number(year), plate };
  retry.current = input;
  try { await api.submitCar(input); if (alive.current) { retry.current = null; router.replace('/(verify)/status'); } }
  catch (error) {
   if (!alive.current) return;
   if (!(error instanceof OnboardingError) || error.classification === 'uncertain') { setUncertain(true); setBanner(uncertainMessage); }
   else {
    retry.current = null; setUncertain(false);
    if (error.code === 'already_approved') router.replace('/(verify)/status');
    else if (error.code === 'invalid_plate' || error.code === 'invalid_year') setFieldError(error.code);
    else setBanner(error.code === 'role_not_car_owner' ? 'Choose I have a car or Both in your profile first.' : error.code === 'invalid_car' ? 'Please check your car details and try again.' : 'We could not send your car. Please try again.');
   }
  } finally { sending.current = false; if (alive.current) setBusy(false); }
 }
 const locked = busy || uncertain || loading;
 return <Frame title="Your car" subtitle="Tell us about the car you will drive." back={busy ? undefined : () => router.back()}>
  {loading && <LoadingState />}{loadError && <><Banner text="We could not load your car details. Please try again." /><CarButton label="Try again" onPress={() => { setLoading(true); setLoadError(false); void load(); }} /></>}
  {!!banner && <Banner text={banner} />}
  {brand === 'other' ? <TextField label="Car brand" value={brandOther} placeholder="Car brand" editable={!locked} onChangeText={value => edit(() => setBrandOther(value))} /> : null}
  <Dropdown label={brand === 'other' ? 'Change car brand' : 'Car brand'} placeholder="Select brand" value={brand} options={[...brands.map(row => ({ value: row.id, label: row.name })), { value: 'other', label: 'Other' }]} disabled={locked || loadError} onSelect={value => edit(() => { setBrand(value); void loadModels(value); setBrandOther(''); setModel(value === 'other' ? 'other' : ''); setModelOther(''); })} />
  {(brand === 'other' || model === 'other') && <TextField label="Model" value={modelOther} placeholder="Model" editable={!locked} onChangeText={value => edit(() => setModelOther(value))} />}
  {brand !== 'other' && <Dropdown label={model === 'other' ? 'Change model' : 'Model'} placeholder="Select model" value={model} options={[...models.map(row => ({ value: row.id, label: row.name })), { value: 'other', label: 'Other' }]} disabled={locked || !brand || modelLoading || modelError} onSelect={value => edit(() => { setModel(value); setModelOther(''); })} />}
  {modelError && <><Banner text="We could not load models. Please try again." /><CarButton label="Reload models" onPress={() => void loadModels(brand)} /></>}
  <Dropdown label="Car type" placeholder="Select type" value={type} options={types.map(row => ({ value: row.id, label: row.name }))} disabled={locked || loadError} onSelect={value => edit(() => setType(value))} />
  <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 0.45 }}><TextField label="Year" placeholder="YYYY" keyboardType="number-pad" maxLength={4} value={year} editable={!locked} onChangeText={value => edit(() => setYear(value))} error={fieldError === 'invalid_year' ? 'Enter a valid car year.' : undefined} /></View><View style={{ flex: 1 }}><TextField label="Plate number" placeholder="Letters and numbers" autoCapitalize="none" value={plate} editable={!locked} onChangeText={value => edit(() => setPlate(value))} error={fieldError === 'invalid_plate' ? 'Enter a valid plate number.' : undefined} /></View></View>
  <Text style={{ ...typography.footnote, color: t['label/secondary'] }}>Plates: Arabic letters and numbers. Some plates have numbers only.</Text><View style={{ flexGrow: 1 }} />
  <CarButton label={busy ? 'Sending…' : uncertain ? 'Try again' : 'Submit for review'} busy={busy} disabled={busy || (!uncertain && !valid)} onPress={() => void submit()} />
 </Frame>;
}
export function ApprovalRow({ status }: { status: NonNullable<Verification['car_owner']>['status'] }) {
 const t = useTheme();
 return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderColor: t.separator, borderRadius: 12, backgroundColor: t['bg/elevated'] }}><Text style={{ ...typography.headline, color: t['label/primary'], flex: 1 }}>Car owner approval</Text><StatusBadge status={status} /></View>;
}
export function CarStatus() {
 const api = useOnboardingApi(); const t = useTheme(); const [value, setValue] = useState<Verification | null>(null); const [error, setError] = useState(false); const [reload, setReload] = useState(0);
 useFocusEffect(useCallback(() => {
  let active = true; void reload; setValue(null); setError(false);
  void (async () => {
   try {
    const profile = await api.myProfile();
    if (!active) return;
    if (!profile || profile.role === 'rider') { browse(); return; }
    const data = await api.myVerification(); if (active) setValue(data);
   } catch { if (active) setError(true); }
  })();
  return () => { active = false; };
 }, [api, reload]));
 const item = value?.car_owner;
 const status = item?.status;
 const title = status === 'approved' ? 'You are approved' : status === 'rejected' ? 'We need one more thing' : status === 'pending' ? 'Car sent for review' : 'Car owner approval';
 const subtitle = status === 'approved' ? 'Thank you. You can now post rides.' : status === 'rejected' ? 'Your car could not be approved. Please check the details and send them again.' : status === 'pending' ? 'We review your car before you can post rides. You can keep browsing and requesting rides.' : '';
 return <Frame title={title} subtitle={subtitle} back={browse}>
  {!value && !error && <LoadingState />}{error && <><Banner text="We could not load your car status. Please try again." /><CarButton label="Try again" onPress={() => setReload(n => n + 1)} /></>}
  {status === 'approved' && <Banner text="Your car was approved. You can now post rides." polite tone="success" />}
  {status === 'rejected' && <><Banner text="Your car needs another look before we can approve it." tone="warning" />{item?.reviewer_note && <View style={{ gap: 8 }}><Text style={{ ...typography.footnoteSemibold, color: t['label/secondary'] }}>Reviewer note</Text><Text style={{ ...typography.body, color: t['label/primary'] }}>{item.reviewer_note}</Text></View>}</>}
  {status && <ApprovalRow status={status} />}<View style={{ flexGrow: 1 }} />
  {status && <CarButton label={status === 'rejected' ? 'Fix and resubmit' : status === 'approved' ? 'Continue' : 'Back to browsing'} onPress={status === 'rejected' ? () => router.push('/(verify)/car') : browse} />}
  {value && !item && <CarButton label="Add your car" onPress={() => router.replace('/(verify)')} />}
 </Frame>;
}
