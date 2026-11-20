import { router } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Banner } from '../../components/Banner';
import { ErrorState, LoadingState } from '../../components/States';
import { ProgressBar } from '../../components/ProgressBar';
import { TextField } from '../../components/TextField';
import { strings } from '../../strings';
import { spacing } from '../../theme';
import { normalizeDigits } from '../onboarding/validation';
import { RidesError, type PublishGate, type PublishRideInput, type RideDirection, type RidesErrorCode } from './api';
import { formatRideDate, formatRideTime } from './format';
import { NotVerifiedRide } from './NotVerifiedRide';
import type { PilotRoute, RideCar } from './rideConfig';
import { initialSchedule, isRideWeekday, timeOptions, windowDates, type RideWindow } from './rideDates';
import { RideButton, RideDivider, RideIconTile, RideNotice, RideSymbol, RouteTimeline, type RideGlyph } from './RidePresentation';
import { RideCard, RideChoice, RidePicker, RideScreen, RideSegments, RideText, rideStyles } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { PostRideDraftProvider, usePostRideDraft } from './usePostRideDraft';
import { useRideResource } from './useRideResource';

export type PostStep = 'schedule' | 'car' | 'review';
type Schedule = Pick<PublishRideInput, 'date' | 'time' | 'repeat' | 'flexMinutes'>;

const copy = strings.rides;
const flexibilityOptions = [0, 5, 10, 15, 30];
const pickupLimit = 80;
const notesLimit = 200;

export function carApproval() {
  // Expo resolves this group-qualified path from the root.
  router.replace('/(verify)/status');
}

export function leavePost() {
  router.dismissTo('/');
}

function repeatLabel(repeat: Schedule['repeat']) {
  return repeat === 'once' ? copy.once : copy.weekdays;
}

function endpoints(route: PilotRoute, direction: RideDirection) {
  return direction === 'a_to_b' ? [route.fromName, route.toName] : [route.toName, route.fromName];
}

function PostStepScreen({ step, onBack, footer, children }:
  PropsWithChildren<{ step: 1 | 2 | 3; onBack: () => void; footer: ReactNode }>) {
  return <RideScreen title={copy.post} onBack={onBack} footer={footer}
    header={<View style={styles.progress}><ProgressBar step={step} /></View>}>
    {children}
  </RideScreen>;
}

function ScheduleRow({ label, value, spokenValue = value, icon, expanded, onPress }: {
  label: string; value: string; spokenValue?: string; icon: RideGlyph; expanded: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label} · ${spokenValue}`}
    accessibilityState={{ expanded }} onPress={onPress} style={styles.scheduleRow}>
    <RideIconTile icon={icon} />
    <View style={rideStyles.grow}>
      <RideText kind="footnote" muted>{label}</RideText>
      <RideText>{value}</RideText>
    </View>
    <RideSymbol name="forward" size={spacing['space/12']} color="label/secondary" />
  </Pressable>;
}

function ScheduleStep({ route, routes, window, onNext, onBack }: {
  route: PilotRoute; routes: PilotRoute[]; window: RideWindow; onNext: () => void; onBack: () => void;
}) {
  const { draft, setRoute, setSchedule } = usePostRideDraft();
  const [selected, setSelected] = useState(() => routes.find(option => option.id === draft.route?.routeId) ?? route);
  const [direction, setDirection] = useState<RideDirection>(draft.route?.direction ?? 'a_to_b');
  const [schedule, setValue] = useState<Schedule>(() => draft.schedule ?? {
    ...initialSchedule(window), repeat: 'once', flexMinutes: 0,
  });
  const [picker, setPicker] = useState<'date' | 'time' | 'flex' | 'route' | null>(null);
  const [from, to] = endpoints(selected, direction);
  const dates = windowDates(window).filter(day => schedule.repeat === 'once' || isRideWeekday(day));
  const dateLabel = formatRideDate(schedule.date);
  const timeLabel = formatRideTime(schedule.time);
  const flexLabel = copy.minutes(schedule.flexMinutes);
  const routeLabel = copy.routeName(selected.fromName, selected.toName);

  const selectRepeat = (repeat: Schedule['repeat']) => {
    const permitted = windowDates(window).filter(day => repeat === 'once' || isRideWeekday(day));
    const date = permitted.includes(schedule.date)
      ? schedule.date : permitted.find(day => day >= schedule.date) ?? permitted[0];
    setValue({ ...schedule, repeat, date, time: date !== schedule.date ? '07:00' : schedule.time });
  };
  function choose(patch: Partial<Schedule>) {
    setValue(current => ({ ...current, ...patch }));
    setPicker(null);
  }
  function next() {
    setRoute({ routeId: selected.id, direction });
    setSchedule(schedule);
    onNext();
  }

  return <PostStepScreen step={1} onBack={onBack} footer={<RideButton label={copy.continue} onPress={next} />}>
    {routes.length > 1 && <RideChoice label={routeLabel} onPress={() => setPicker(picker === 'route' ? null : 'route')} />}
    {picker === 'route' && <RidePicker title={copy.route}>
      {routes.map(option => <RideChoice key={option.id} label={copy.routeName(option.fromName, option.toName)}
        radio selected={option.id === selected.id} onPress={() => { setSelected(option); setPicker(null); }} />)}
    </RidePicker>}
    <RideCard>
      <RouteTimeline spacious from={{
        name: from, label: copy.from,
        action: <RideButton label={copy.reverse} icon="reverse" variant="tint" compact
          onPress={() => setDirection(current => current === 'a_to_b' ? 'b_to_a' : 'a_to_b')} />,
      }} to={{ name: to, label: copy.to }} />
    </RideCard>
    <RideCard>
      <ScheduleRow label={copy.date} value={dateLabel.replace(' ', ', ')} spokenValue={dateLabel} icon="calendar" expanded={picker === 'date'}
        onPress={() => setPicker(picker === 'date' ? null : 'date')} />
      {picker === 'date' && <RidePicker title={copy.date}>
        {dates.map(day => <RideChoice key={day} radio label={formatRideDate(day)} selected={day === schedule.date}
          onPress={() => choose({ date: day })} />)}
      </RidePicker>}
      <RideDivider />
      <ScheduleRow label={copy.leavesAt} value={timeLabel} icon="clock" expanded={picker === 'time'}
        onPress={() => setPicker(picker === 'time' ? null : 'time')} />
      {picker === 'time' && <RidePicker title={copy.leavesAt}>
        {timeOptions.map(time => <RideChoice key={time} radio label={formatRideTime(time)} selected={time === schedule.time}
          onPress={() => choose({ time })} />)}
      </RidePicker>}
      <RideDivider />
      <ScheduleRow label={copy.flexibility} value={schedule.flexMinutes > 0 ? `± ${flexLabel}` : flexLabel} spokenValue={flexLabel} icon="clock" expanded={picker === 'flex'}
        onPress={() => setPicker(picker === 'flex' ? null : 'flex')} />
      {picker === 'flex' && <RidePicker title={copy.flexibility}>
        {flexibilityOptions.map(minutes => <RideChoice key={minutes} radio label={copy.minutes(minutes)}
          selected={minutes === schedule.flexMinutes} onPress={() => choose({ flexMinutes: minutes })} />)}
      </RidePicker>}
    </RideCard>
    <RideCard>
      <RideText kind="headline">{copy.repeat}</RideText>
      <RideSegments>
        {(['once', 'weekdays'] as const).map(repeat => <RideChoice key={repeat} radio variant="segment" label={repeatLabel(repeat)}
          selected={schedule.repeat === repeat} onPress={() => selectRepeat(repeat)} />)}
      </RideSegments>
      <RideText kind="footnote" muted>
        {routes.length === 1 ? `${copy.pilotRouteOnly(routeLabel)} ` : ''}{copy.repeatHelp}
      </RideText>
    </RideCard>
  </PostStepScreen>;
}

function hasPhonePattern(value: string) {
  return /[0-9]{7}/.test(normalizeDigits(value.normalize('NFKC')).replace(/[\s./()+ـ-]/g, ''));
}

function CarStep({ car, onNext, onBack }: { car: RideCar; onNext: () => void; onBack: () => void }) {
  const { draft, setCarDetails } = usePostRideDraft();
  const [seats, setSeats] = useState(() => Math.min(draft.carDetails?.seats ?? 1, car.passengerSeats));
  const [pickup, setPickup] = useState(draft.carDetails?.pickupNote ?? '');
  const [notes, setNotes] = useState(draft.carDetails?.notes ?? '');
  const pickupHasPhone = hasPhonePattern(pickup);
  const notesHavePhone = hasPhonePattern(notes);
  function next() {
    setCarDetails({ seats, pickupNote: pickup.trim() || null, notes: notes.trim() || null });
    onNext();
  }

  return <PostStepScreen step={2} onBack={onBack} footer={
    <RideButton label={copy.continue} disabled={pickupHasPhone || notesHavePhone} onPress={next} />
  }>
    <RideCard>
      <View style={rideStyles.between}>
        <RideIconTile icon="car" />
        <View style={rideStyles.grow}>
          <RideText kind="subheadlineSemibold">{car.label}</RideText>
          <RideText kind="caption1" muted>
            {car.typeName && `${car.typeName} · `}
            <RideText kind="caption1" muted>{copy.carCapacity(car.passengerSeats)}</RideText>
          </RideText>
        </View>
        <RideButton label={copy.change} variant="text" compact disabled />
      </View>
      <RideText kind="caption1" muted>{copy.changeCarHelp}</RideText>
    </RideCard>
    <RideCard>
      <View style={rideStyles.between}>
        <View style={rideStyles.grow}>
          <RideText kind="headline">{copy.seatsToOffer}</RideText>
          <RideText kind="footnote" muted>{copy.seatsCapacity(car.passengerSeats)}</RideText>
        </View>
        <View style={styles.stepper}>
          <RideButton label={copy.removeSeat} icon="minus" iconOnly compact variant="tint" disabled={seats <= 1}
            onPress={() => setSeats(current => Math.max(1, current - 1))} />
          <RideText kind="title3">{seats}</RideText>
          <RideButton label={copy.addSeat} icon="plus" iconOnly compact variant="tint" disabled={seats >= car.passengerSeats}
            onPress={() => setSeats(current => Math.min(car.passengerSeats, current + 1))} />
        </View>
      </View>
    </RideCard>
    <View style={rideStyles.stack}>
      <TextField label={copy.optionalPickup} value={pickup} maxLength={pickupLimit} onChangeText={value => setPickup(value.slice(0, pickupLimit))}
        error={pickupHasPhone ? copy.errors.contact_details_not_allowed : undefined} multiline />
      <FieldHelp help={copy.pickupHelp} length={pickup.length} limit={pickupLimit} />
    </View>
    <View style={rideStyles.stack}>
      <TextField label={copy.optionalNotes} value={notes} maxLength={notesLimit} onChangeText={value => setNotes(value.slice(0, notesLimit))}
        error={notesHavePhone ? copy.errors.contact_details_not_allowed : undefined} multiline />
      <FieldHelp help={copy.contactHelp} length={notes.length} limit={notesLimit} />
    </View>
  </PostStepScreen>;
}

function FieldHelp({ help, length, limit }: { help: string; length: number; limit: number }) {
  return <View style={styles.fieldHelp}>
    <View style={rideStyles.grow}><RideText kind="footnote" muted>{help}</RideText></View>
    <RideText kind="caption1" muted>{copy.counter(length, limit)}</RideText>
  </View>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}>
    <RideText kind="subheadline" muted>{label}</RideText>
    <View style={rideStyles.grow}><RideText kind="subheadlineSemibold" align="right">{value}</RideText></View>
  </View>;
}

function ReviewStep({ route, car, input, onBlocked, onBack }: {
  route: PilotRoute; car: RideCar; input: Omit<PublishRideInput, 'requestId'>;
  onBlocked: (gate: 'phone_unverified' | 'car_not_approved') => void; onBack: () => void;
}) {
  const api = useRidesApi();
  const { getOrCreateRequestId, clear } = usePostRideDraft();
  const visit = useId();
  const [error, setError] = useState<RidesErrorCode>();
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const [from, to] = endpoints(route, input.direction);

  async function publish() {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const { rideId } = await api.publishRide({ ...input, requestId: getOrCreateRequestId(visit) });
      router.replace({ pathname: '/post/published', params: { rideId } });
    } catch (failure) {
      const code = failure instanceof RidesError ? failure.code : 'uncertain';
      if (code === 'phone_unverified' || code === 'car_not_approved') {
        onBlocked(code);
        clear();
      } else {
        setError(code);
      }
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }

  const schedule = [
    formatRideDate(input.date), formatRideTime(input.time),
    input.flexMinutes > 0 ? `± ${copy.minutes(input.flexMinutes)}` : null,
  ].filter(Boolean).join(' · ');
  return <PostStepScreen step={3} onBack={onBack} footer={<>
    {error && <Banner text={copy.errors[error]} tone="warning" />}
    <RideButton label={error === 'uncertain' ? strings.retry : copy.publish} busy={busy} disabled={busy}
      onPress={() => void publish()} />
    <RideButton label={copy.saveDraft} disabled variant="text" compact />
    <RideText kind="caption1" muted align="center">{copy.draftsHelp}</RideText>
  </>}>
    <RideCard>
      <RideText kind="headline" header>{copy.review}</RideText>
      <RouteTimeline from={{ name: from, caption: schedule }} to={{
        name: to, caption: input.repeat === 'weekdays' ? copy.repeatSummary : copy.once,
      }} />
      <RideDivider />
      <View style={rideStyles.stack}>
        <SummaryRow label={copy.seatsOfferedLabel} value={copy.seatSummary(input.seats, car.passengerSeats)} />
        {input.pickupNote && <SummaryRow label={copy.pickup} value={input.pickupNote} />}
        {input.notes && <SummaryRow label={copy.notes} value={input.notes} />}
      </View>
    </RideCard>
    <RideNotice icon="info">{copy.postPrivacy}</RideNotice>
  </PostStepScreen>;
}

type PostProps = { route: PilotRoute; routes?: PilotRoute[]; car: RideCar; window: RideWindow };

type RoutedPostProps = PostProps & {
  step: PostStep; onNext: () => void; onBack: () => void;
  onBlocked: (gate: 'phone_unverified' | 'car_not_approved') => void;
  missingDraft?: React.ReactNode;
};

function PostRideForm({ step, route, routes = [route], car, window, onNext, onBack, onBlocked, missingDraft }: RoutedPostProps) {
  const { draft } = usePostRideDraft();
  if (step === 'schedule') return <ScheduleStep route={route} routes={routes} window={window} onNext={onNext} onBack={onBack} />;
  if (!draft.route || !draft.schedule) return missingDraft;
  if (step === 'car') return <CarStep car={car} onNext={onNext} onBack={onBack} />;
  if (!draft.carDetails) return missingDraft;
  const selected = routes.find(option => option.id === draft.route?.routeId) ?? route;
  return <ReviewStep route={selected} car={car} input={{ ...draft.route, ...draft.schedule, ...draft.carDetails }}
    onBack={onBack} onBlocked={onBlocked} />;
}

function StandalonePostRide({ route, routes, car, window }: PostProps) {
  const api = useRidesApi();
  const load = useCallback(() => api.canPublish(), [api]);
  const { result, retry } = useRideResource(load);
  const [step, setStep] = useState<PostStep>('schedule');
  const [blocked, setBlocked] = useState<PublishGate>();
  const gate = blocked ?? (result.status === 'ready' ? result.value : undefined);

  if (gate === 'phone_unverified') return <NotVerifiedRide onBack={() => router.back()} />;
  if (gate === 'ok') return <PostRideForm step={step} route={route} routes={routes} car={car} window={window}
    onNext={() => setStep(current => current === 'schedule' ? 'car' : 'review')}
    onBack={() => {
      if (step === 'schedule') router.back();
      else setStep(step === 'review' ? 'car' : 'schedule');
    }} onBlocked={setBlocked} />;
  return <PostEntryState gate={gate} failed={result.status === 'error'} retry={retry} onBack={() => router.back()} />;
}

export function PostRideFlow(props: PostProps | RoutedPostProps) {
  if ('step' in props) return <PostRideForm {...props} />;
  return <PostRideDraftProvider><StandalonePostRide {...props} /></PostRideDraftProvider>;
}

export function PostEntryState({ gate, failed, retry, onBack }: {
  gate?: PublishGate; failed: boolean; retry: () => void; onBack: () => void;
}) {
  if (gate === 'phone_unverified') return <NotVerifiedRide onBack={onBack} />;
  if (gate === 'car_not_approved') return <CarApprovalRedirect />;
  return <RideScreen title={copy.post} onBack={onBack}>
    {failed ? <ErrorState onRetry={retry} /> : gate === 'profile_incomplete'
      ? <Banner text={copy.errors.profile_incomplete} /> : <LoadingState />}
  </RideScreen>;
}

function CarApprovalRedirect() {
  useEffect(carApproval, []);
  return <RideScreen title={copy.post}><LoadingState /></RideScreen>;
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: spacing['space/16'], paddingTop: spacing['space/4'] },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing['space/12'] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'] },
  fieldHelp: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space/8'] },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space/12'] },
});
