import { strings } from '../../strings';
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
import { newSubmissionKey, normalizeDigits, validateCarSelection, validatePlate, validateYear } from '../onboarding/validation';
import { radius, spacing, typography, useTheme } from '../../theme';

export function CarButton({ label, onPress, disabled = false, busy = false, secondary = false }: { label: string; onPress(): void; disabled?: boolean; busy?: boolean; secondary?: boolean }) {
 const t = useTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, padding: spacing['space/12'], borderRadius: radius['radius/full'], justifyContent: 'center', backgroundColor: secondary ? undefined : t[pressed ? 'brand/primary-pressed' : 'brand/primary'], opacity: disabled ? 0.4 : 1 })}><View style={{ flexDirection: 'row', gap: spacing['space/8'], justifyContent: 'center', alignItems: 'center' }}>{busy && <ActivityIndicator color={t['brand/on-primary']} />}<Text style={{ ...typography.headline, textAlign: 'center', color: t[secondary ? 'brand/primary' : 'brand/on-primary'] }}>{label}</Text></View></Pressable>;
}
function Frame({ title, subtitle, children, back }: PropsWithChildren<{ title: string; subtitle: string; back?: () => void }>) {
 const t = useTheme(); const insets = useSafeAreaInsets();
 return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t['bg/base'], paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <View style={{ minHeight: 48, paddingHorizontal: spacing['space/16'], flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 44 }}>{back && <Pressable accessibilityRole="button" accessibilityLabel={strings.back} onPress={back} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius['radius/full'], borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'] }}><SymbolView name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={t['label/primary']} accessible={false} /></Pressable>}</View><Text style={{ ...typography.headline, color: t['label/primary'], flex: 1, textAlign: 'center' }}>{strings.verification.addCar}</Text><View style={{ width: 44 }} /></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: spacing['space/16'], paddingBottom: Math.max(spacing['space/16'], insets.bottom), gap: spacing['space/24'] }}><View style={{ gap: spacing['space/8'] }}><Text accessibilityRole="header" style={{ ...typography.title1, color: t['label/primary'] }}>{title}</Text><Text style={{ ...typography.body, color: t['label/secondary'] }}>{subtitle}</Text></View>{children}</ScrollView>
 </KeyboardAvoidingView>;
}
const browse = () => router.replace('/(tabs)');
export function CarIntro() {
 const t = useTheme();
 return <Frame title={strings.verification.addCar} subtitle={strings.verification.intro}>
  <View style={{ padding: spacing['space/16'], gap: spacing['space/12'], borderRadius: radius['radius/16'], borderWidth: 1, borderColor: t.separator, backgroundColor: t['bg/elevated'] }}><View style={{ flexDirection: 'row', gap: spacing['space/12'], alignItems: 'center' }}><SymbolView name={{ ios: 'car', android: 'directions_car', web: 'directions_car' }} size={24} tintColor={t['brand/primary']} accessible={false} /><Text style={{ ...typography.headline, color: t['label/primary'] }}>{strings.verification.yourCar}</Text></View><Text style={{ ...typography.subheadline, color: t['label/secondary'] }}>{strings.verification.carFields}</Text><Text style={{ ...typography.footnoteSemibold, color: t['brand/primary'] }}>{strings.verification.offerRides}</Text></View>
  <Text style={{ ...typography.footnote, color: t['label/secondary'] }}>{strings.verification.riders}</Text><View style={{ flexGrow: 1 }} /><CarButton label={strings.verification.start} onPress={() => router.push('/(verify)/car')} /><CarButton label={strings.verification.notNow} secondary onPress={browse} />
 </Frame>;
}
const uncertainMessage = strings.verification.uncertain;
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
 const asciiYear = normalizeDigits(year);
 const valid = !loading && !loadError && !modelLoading && !modelError && validateCarSelection(selection, { brands, models, types }) && /^\d{4}$/.test(asciiYear) && validateYear(Number(asciiYear)) && validatePlate(plate);
 const edit = (update: () => void) => { if (sending.current || retry.current) return; retry.current = null; setUncertain(false); setBanner(''); setFieldError(''); update(); };
 async function submit() {
  if (sending.current || (!uncertain && !valid)) return;
  sending.current = true; setBusy(true); setBanner(''); setFieldError('');
  const input = retry.current ?? { ...selection, submissionKey: newSubmissionKey(), year: Number(asciiYear), plate };
  retry.current = input;
  try { await api.submitCar(input); if (alive.current) { retry.current = null; router.replace('/(verify)/status'); } }
  catch (error) {
   if (!alive.current) return;
   if (!(error instanceof OnboardingError) || error.classification === 'uncertain') { setUncertain(true); setBanner(uncertainMessage); }
   else {
    retry.current = null; setUncertain(false);
    if (error.code === 'already_approved') router.replace('/(verify)/status');
    else if (error.code === 'invalid_plate' || error.code === 'invalid_year') setFieldError(error.code);
    else setBanner(error.code === 'role_not_car_owner' ? strings.verification.chooseRole : error.code === 'invalid_car' ? strings.verification.invalidCar : strings.verification.sendError);
   }
  } finally { sending.current = false; if (alive.current) setBusy(false); }
 }
 const locked = busy || uncertain || loading;
 return <Frame title={strings.verification.yourCar} subtitle={strings.verification.detailsSubtitle} back={busy ? undefined : () => router.back()}>
  {loading && <LoadingState />}{loadError && <><Banner text={strings.verification.loadDetailsError} /><CarButton label={strings.retry} onPress={() => { setLoading(true); setLoadError(false); void load(); }} /></>}
  {!!banner && <Banner text={banner} />}
  {brand === 'other' ? <TextField label={strings.verification.brand} value={brandOther} placeholder={strings.verification.brand} editable={!locked} onChangeText={value => edit(() => setBrandOther(value))} /> : null}
  <Dropdown label={brand === 'other' ? strings.verification.changeBrand : strings.verification.brand} placeholder={strings.verification.selectBrand} value={brand} options={[...brands.map(row => ({ value: row.id, label: row.name })), { value: 'other', label: strings.verification.other }]} disabled={locked || loadError} onSelect={value => edit(() => { setBrand(value); void loadModels(value); setBrandOther(''); setModel(value === 'other' ? 'other' : ''); setModelOther(''); })} />
  {(brand === 'other' || model === 'other') && <TextField label={strings.verification.model} value={modelOther} placeholder={strings.verification.model} editable={!locked} onChangeText={value => edit(() => setModelOther(value))} />}
  {brand !== 'other' && <Dropdown label={model === 'other' ? strings.verification.changeModel : strings.verification.model} placeholder={strings.verification.selectModel} value={model} options={[...models.map(row => ({ value: row.id, label: row.name })), { value: 'other', label: strings.verification.other }]} disabled={locked || !brand || modelLoading || modelError} onSelect={value => edit(() => { setModel(value); setModelOther(''); })} />}
  {modelError && <><Banner text={strings.verification.modelsError} /><CarButton label={strings.verification.reloadModels} onPress={() => void loadModels(brand)} /></>}
  <Dropdown label={strings.verification.type} placeholder={strings.verification.selectType} value={type} options={types.map(row => ({ value: row.id, label: row.name }))} disabled={locked || loadError} onSelect={value => edit(() => setType(value))} />
  <View style={{ flexDirection: 'row', gap: spacing['space/12'] }}><View style={{ flex: 0.45 }}><TextField label={strings.verification.year} placeholder={strings.verification.yearPlaceholder} keyboardType="number-pad" maxLength={4} value={year} editable={!locked} onChangeText={value => edit(() => setYear(value))} error={fieldError === 'invalid_year' ? strings.verification.invalidYear : undefined} /></View><View style={{ flex: 1 }}><TextField label={strings.verification.plate} placeholder={strings.verification.platePlaceholder} autoCapitalize="none" value={plate} editable={!locked} onChangeText={value => edit(() => setPlate(value))} error={fieldError === 'invalid_plate' ? strings.verification.invalidPlate : undefined} /></View></View>
  <Text style={{ ...typography.footnote, color: t['label/secondary'] }}>{strings.verification.plateHelp}</Text><View style={{ flexGrow: 1 }} />
  <CarButton label={busy ? strings.verification.sending : uncertain ? strings.retry : strings.verification.submit} busy={busy} disabled={busy || (!uncertain && !valid)} onPress={() => void submit()} />
 </Frame>;
}
export function ApprovalRow({ status }: { status: NonNullable<Verification['car_owner']>['status'] }) {
 const t = useTheme();
 return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'], padding: spacing['space/16'], borderWidth: 1, borderColor: t.separator, borderRadius: radius['radius/12'], backgroundColor: t['bg/elevated'] }}><Text style={{ ...typography.headline, color: t['label/primary'], flex: 1 }}>{strings.verification.approval}</Text><StatusBadge status={status} /></View>;
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
 const title = status === 'approved' ? strings.verification.approvedTitle : status === 'rejected' ? strings.verification.rejectedTitle : status === 'pending' ? strings.verification.pendingTitle : strings.verification.approval;
 const subtitle = status === 'approved' ? strings.verification.approvedSubtitle : status === 'rejected' ? strings.verification.rejectedSubtitle : status === 'pending' ? strings.verification.pendingSubtitle : '';
 return <Frame title={title} subtitle={subtitle} back={browse}>
  {!value && !error && <LoadingState />}{error && <><Banner text={strings.verification.statusError} /><CarButton label={strings.retry} onPress={() => setReload(n => n + 1)} /></>}
  {status === 'approved' && <Banner text={strings.verification.approvedBanner} polite tone="success" />}
  {status === 'rejected' && <><Banner text={strings.verification.rejectedBanner} tone="warning" />{item?.reviewer_note && <View style={{ gap: spacing['space/8'] }}><Text style={{ ...typography.footnoteSemibold, color: t['label/secondary'] }}>{strings.verification.reviewerNote}</Text><Text style={{ ...typography.body, color: t['label/primary'] }}>{item.reviewer_note}</Text></View>}</>}
  {status && <ApprovalRow status={status} />}<View style={{ flexGrow: 1 }} />
  {status && <CarButton label={status === 'rejected' ? strings.verification.resubmit : status === 'approved' ? strings.verification.continue : strings.verification.browse} onPress={status === 'rejected' ? () => router.push('/(verify)/car') : browse} />}
  {value && !item && <CarButton label={strings.verification.addCar} onPress={() => router.replace('/(verify)')} />}
 </Frame>;
}
