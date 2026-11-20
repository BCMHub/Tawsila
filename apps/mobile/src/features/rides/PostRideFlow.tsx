import { router } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { View } from 'react-native';
import { Banner } from '../../components/Banner';
import { ErrorState, LoadingState } from '../../components/States';
import { TextField } from '../../components/TextField';
import { strings } from '../../strings';
import { normalizeDigits } from '../onboarding/validation';
import { CarButton } from '../verification/CarScreens';
import { RidesError, type PublishGate, type PublishRideInput, type RideDirection, type RidesErrorCode } from './api';
import { formatRideDate, formatRideTime } from './format';
import { NotVerifiedRide } from './NotVerifiedRide';
import type { PilotRoute, RideCar } from './rideConfig';
import { initialSchedule, isRideWeekday, timeOptions, windowDates, type RideWindow } from './rideDates';
import { RideCard, RideChoice, RidePicker, RideScreen, RideText, rideStyles } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { PostRideDraftProvider, usePostRideDraft } from './usePostRideDraft';
import { useRideResource } from './useRideResource';

export type PostStep = 'schedule' | 'car' | 'review';
type Schedule = Pick<PublishRideInput, 'date' | 'time' | 'repeat' | 'flexMinutes'>;

const copy = strings.rides;
const flexibilityOptions = [0, 5, 10, 15, 30];
const pickupLimit = 80;
const notesLimit = 200;
const disabledAction = () => undefined;

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

function ScheduleStep({ route, routes, window, onNext }: {
  route: PilotRoute; routes: PilotRoute[]; window: RideWindow; onNext: () => void;
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

  return <>
    <RideText kind="title1" header>{copy.routeAndTime}</RideText>
    {routes.length > 1 && <RideChoice label={routeLabel} onPress={() => setPicker(picker === 'route' ? null : 'route')} />}
    {picker === 'route' && <RidePicker title={copy.route}>
      {routes.map(option => <RideChoice key={option.id} label={copy.routeName(option.fromName, option.toName)}
        radio selected={option.id === selected.id} onPress={() => { setSelected(option); setPicker(null); }} />)}
    </RidePicker>}
    <RideCard>
      <View style={rideStyles.between}>
        <View style={[rideStyles.grow, rideStyles.stack]}>
          <RideText kind="footnote" muted>{copy.from}</RideText>
          <RideText kind="headline">{from}</RideText>
          <RideText kind="footnote" muted>{copy.to}</RideText>
          <RideText kind="headline">{to}</RideText>
        </View>
        <CarButton label={copy.reverse} secondary onPress={() => setDirection(current => current === 'a_to_b' ? 'b_to_a' : 'a_to_b')} />
      </View>
    </RideCard>
    <RideChoice label={`${copy.date} · ${dateLabel}`} onPress={() => setPicker(picker === 'date' ? null : 'date')} />
    {picker === 'date' && <RidePicker title={copy.date}>
      {dates.map(day => <RideChoice key={day} radio label={formatRideDate(day)} selected={day === schedule.date}
        onPress={() => choose({ date: day })} />)}
    </RidePicker>}
    <RideChoice label={`${copy.leavesAt} · ${timeLabel}`} onPress={() => setPicker(picker === 'time' ? null : 'time')} />
    {picker === 'time' && <RidePicker title={copy.leavesAt}>
      {timeOptions.map(time => <RideChoice key={time} radio label={formatRideTime(time)} selected={time === schedule.time}
        onPress={() => choose({ time })} />)}
    </RidePicker>}
    <RideChoice label={`${copy.flexibility} · ${flexLabel}`} onPress={() => setPicker(picker === 'flex' ? null : 'flex')} />
    {picker === 'flex' && <RidePicker title={copy.flexibility}>
      {flexibilityOptions.map(minutes => <RideChoice key={minutes} radio label={copy.minutes(minutes)}
        selected={minutes === schedule.flexMinutes} onPress={() => choose({ flexMinutes: minutes })} />)}
    </RidePicker>}
    <RideCard>
      <RideText kind="headline">{copy.repeat}</RideText>
      <View style={rideStyles.row}>
        {(['once', 'weekdays'] as const).map(repeat => <RideChoice key={repeat} radio label={repeatLabel(repeat)}
          selected={schedule.repeat === repeat} onPress={() => selectRepeat(repeat)} />)}
      </View>
      <RideText kind="footnote" muted>
        {routes.length === 1 ? `${copy.pilotRouteOnly(routeLabel)} ` : ''}{copy.repeatHelp}
      </RideText>
    </RideCard>
    <CarButton label={copy.continue} onPress={next} />
  </>;
}

function hasPhonePattern(value: string) {
  return /[0-9]{7}/.test(normalizeDigits(value.normalize('NFKC')).replace(/[\s./()+ـ-]/g, ''));
}

function CarStep({ car, onNext }: { car: RideCar; onNext: () => void }) {
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

  return <>
    <RideText kind="title1" header>{copy.carAndSeats}</RideText>
    <RideCard>
      <View style={rideStyles.between}>
        <View style={[rideStyles.stack, rideStyles.grow]}>
          <RideText kind="headline">{car.label}</RideText>
          <RideText kind="footnote" muted>{copy.carCapacity(car.passengerSeats)}</RideText>
        </View>
        <CarButton label={copy.change} disabled secondary onPress={disabledAction} />
      </View>
      <RideText kind="footnote" muted>{copy.changeCarHelp}</RideText>
    </RideCard>
    <RideCard>
      <RideText kind="headline">{copy.seatsToOffer}</RideText>
      <RideText kind="footnote" muted>{copy.seatsCapacity(car.passengerSeats)}</RideText>
      <View style={rideStyles.between}>
        <CarButton label={copy.removeSeat} disabled={seats <= 1} secondary onPress={() => setSeats(current => Math.max(1, current - 1))} />
        <RideText kind="title2">{seats}</RideText>
        <CarButton label={copy.addSeat} disabled={seats >= car.passengerSeats} secondary
          onPress={() => setSeats(current => Math.min(car.passengerSeats, current + 1))} />
      </View>
    </RideCard>
    <View style={rideStyles.stack}>
      <TextField label={copy.optionalPickup} value={pickup} maxLength={pickupLimit} onChangeText={value => setPickup(value.slice(0, pickupLimit))}
        error={pickupHasPhone ? copy.errors.contact_details_not_allowed : undefined} multiline />
      <RideText kind="footnote" muted>{copy.counter(pickup.length, pickupLimit)}</RideText>
      <RideText kind="footnote" muted>{copy.pickupHelp}</RideText>
    </View>
    <View style={rideStyles.stack}>
      <TextField label={copy.optionalNotes} value={notes} maxLength={notesLimit} onChangeText={value => setNotes(value.slice(0, notesLimit))}
        error={notesHavePhone ? copy.errors.contact_details_not_allowed : undefined} multiline />
      <RideText kind="footnote" muted>{copy.counter(notes.length, notesLimit)}</RideText>
      <RideText kind="footnote" muted>{copy.contactHelp}</RideText>
    </View>
    <CarButton label={copy.continue} disabled={pickupHasPhone || notesHavePhone} onPress={next} />
  </>;
}

function ReviewStep({ route, car, input, onBlocked }: {
  route: PilotRoute; car: RideCar; input: Omit<PublishRideInput, 'requestId'>;
  onBlocked: (gate: 'phone_unverified' | 'car_not_approved') => void;
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

  return <>
    <RideText kind="title1" header>{copy.review}</RideText>
    <RideCard>
      <RideText kind="title3">{from}</RideText>
      <View style={rideStyles.row}>
        <RideText kind="subheadlineSemibold">{formatRideDate(input.date)} · {formatRideTime(input.time)}</RideText>
        {input.flexMinutes > 0 && <RideText kind="subheadline" muted>± {copy.minutes(input.flexMinutes)}</RideText>}
      </View>
      <RideText kind="title3">{to}</RideText>
      <RideText kind="footnote" muted>{input.repeat === 'weekdays' ? copy.repeatSummary : copy.once}</RideText>
    </RideCard>
    <RideCard>
      <View style={rideStyles.between}>
        <RideText kind="headline">{copy.seatsOfferedLabel}</RideText>
        <RideText>{copy.seatSummary(input.seats, car.passengerSeats)}</RideText>
      </View>
      {input.pickupNote && <><RideText kind="headline">{copy.pickup}</RideText><RideText>{input.pickupNote}</RideText></>}
      {input.notes && <><RideText kind="headline">{copy.notes}</RideText><RideText>{input.notes}</RideText></>}
    </RideCard>
    <RideText kind="footnote" muted>{copy.postPrivacy}</RideText>
    {error && <Banner text={copy.errors[error]} tone="warning" />}
    <CarButton label={error === 'uncertain' ? strings.retry : copy.publish} busy={busy} disabled={busy}
      onPress={() => void publish()} />
    <CarButton label={copy.saveDraft} disabled secondary onPress={disabledAction} />
    <RideText kind="footnote" muted>{copy.draftsHelp}</RideText>
  </>;
}

type PostProps = { route: PilotRoute; routes?: PilotRoute[]; car: RideCar; window: RideWindow };

type RoutedPostProps = PostProps & {
  step: PostStep; onNext: () => void; onBack: () => void;
  onBlocked: (gate: 'phone_unverified' | 'car_not_approved') => void;
  missingDraft?: React.ReactNode;
};

function PostRideForm({ step, route, routes = [route], car, window, onNext, onBack, onBlocked, missingDraft }: RoutedPostProps) {
  const { draft } = usePostRideDraft();
  if (step !== 'schedule' && (!draft.route || !draft.schedule)) return missingDraft;
  if (step === 'review' && !draft.carDetails) return missingDraft;
  const selected = routes.find(option => option.id === draft.route?.routeId) ?? route;
  return <RideScreen title={copy.post} onBack={onBack}>
    {step === 'schedule' && <ScheduleStep route={route} routes={routes} window={window} onNext={onNext} />}
    {step === 'car' && <CarStep car={car} onNext={onNext} />}
    {step === 'review' && draft.route && draft.schedule && draft.carDetails &&
      <ReviewStep route={selected} car={car} input={{ ...draft.route, ...draft.schedule, ...draft.carDetails }} onBlocked={onBlocked} />}
  </RideScreen>;
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
