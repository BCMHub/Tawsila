import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { strings } from '../../strings';
import { elevation, radius, spacing, useTheme } from '../../theme';
import { CarEntryPoints } from '../verification/CarEntryPoints';
import { CarButton } from '../verification/CarScreens';
import type { RideDirection, RideProjection } from './api';
import { formatPostedAt, formatRideDate, formatRideTime } from './format';
import { loadPilotRoutes, type PilotRoute } from './rideConfig';
import { addRideDays, rideWindow, windowDates } from './rideDates';
import { RideCard, RideChoice, RidePicker, RideSegments, RideText, rideStyles } from './RideScreen';
import { RideAvatar, RideBadge, RideButton, RideSymbol, RouteTimeline } from './RidePresentation';
import { useRidesApi } from './RidesApiProvider';
import { useRideResource } from './useRideResource';

const copy = strings.rides;
const pageSize = 30;

type BoardProps = {
  route: PilotRoute;
  routes?: PilotRoute[];
  initialDirection?: RideDirection;
  initialDay?: string;
  carEntries?: ReactNode;
};

function BoardCard({ ride }: { ride: RideProjection }) {
  const date = formatRideDate(ride.ride_date);
  const time = formatRideTime(ride.departure_time);
  return <RideCard raised>
    <View style={styles.owner}>
      <RideAvatar>{ride.owner_initials}</RideAvatar>
      <View style={rideStyles.grow}>
        <View style={rideStyles.row}>
          <RideText kind="subheadlineSemibold">{ride.owner_display}</RideText>
          {ride.owner_phone_verified && <RideBadge icon="verified" tone="accent">{copy.phoneVerified}</RideBadge>}
        </View>
        <RideText kind="footnote" muted>{copy.noRatings}</RideText>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.openRide(ride.from_name, ride.to_name, date, time)}
      onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.ride_id } })}
      style={rideStyles.stack}>
      <RouteTimeline
        from={{ name: ride.from_name, caption: <>
          {copy.leavesAtTime(time)}{' · '}<RideText kind="footnote" muted>{ride.pickup_note ?? copy.pickupByAgreement}</RideText>
        </> }}
        to={{ name: ride.to_name, caption: <>
          {ride.to_area && `${ride.to_area} · `}
          <RideText kind="footnote" muted>{copy.aboutMinutes(ride.duration_minutes)}</RideText>
        </> }} />
      <View style={rideStyles.between}>
        <View style={[rideStyles.row, rideStyles.grow]}>
          <RideSymbol name="calendar" color="label/secondary" />
          <RideText kind="subheadline">{date} · {time}</RideText>
        </View>
        <RideText kind="subheadlineSemibold" color="brand/primary">{copy.seatsLeft(ride.seats_left)}</RideText>
      </View>
    </Pressable>
    <RideBadge icon={ride.repeat === 'weekdays' ? 'repeat' : 'calendar'}>
      {ride.repeat === 'weekdays' ? copy.weekdays : copy.once}
    </RideBadge>
    <View style={rideStyles.between}>
      <RideText kind="caption1" muted>{formatPostedAt(ride.created_at)}</RideText>
      <RideButton label={copy.requestSeat} disabled compact />
    </View>
  </RideCard>;
}

function boardDay(selection: string, first: string, last: string) {
  if (selection === 'today') return first;
  if (selection === 'tomorrow') return addRideDays(first, 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(selection) && selection >= first && selection <= last ? selection : null;
}

function useBoardRides(routeId: string, direction: RideDirection, day: string | null) {
  const api = useRidesApi();
  const load = useCallback(() => api.listRides({ routeId, direction, day, limit: pageSize }), [api, routeId, direction, day]);
  return useRideResource(load);
}

export function RideBoard({ route, routes = [route], initialDirection = 'a_to_b', initialDay, carEntries }: BoardProps) {
  const t = useTheme();
  const api = useRidesApi();
  const [selectedRoute, setSelectedRoute] = useState(route);
  const [direction, setDirection] = useState(initialDirection);
  const [selection, setSelection] = useState(initialDay ?? 'all');
  const [picker, setPicker] = useState<'date' | 'route' | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const window = rideWindow();
  const day = boardDay(selection, window.first, window.last);
  const destination = direction === 'a_to_b' ? selectedRoute.toName : selectedRoute.fromName;
  const routeLabel = copy.routeName(selectedRoute.fromName, selectedRoute.toName);
  const routeId = selectedRoute.id;
  const { result, retry } = useBoardRides(routeId, direction, day);
  const firstPage = result.status === 'ready' ? result.value : undefined;
  const hasRides = !!firstPage?.length;
  const [paging, setPaging] = useState<{
    firstPage: RideProjection[]; extra: RideProjection[]; hasMore: boolean; busy?: boolean; failed?: boolean;
  }>();
  const inFlight = useRef<RideProjection[] | undefined>(undefined);
  const currentPage = paging?.firstPage === firstPage ? paging : undefined;
  const rows = [...(firstPage ?? []), ...(currentPage?.extra ?? [])];

  async function loadMore() {
    const last = rows.at(-1);
    if (!firstPage || !last || inFlight.current === firstPage) return;
    const extra = currentPage?.extra ?? [];
    inFlight.current = firstPage;
    setPaging({ firstPage, extra, busy: true, hasMore: true });
    try {
      const page = await api.listRides({ routeId, direction, day, limit: pageSize,
        after: { departsAt: last.departs_at, rideId: last.ride_id } });
      if (inFlight.current === firstPage) setPaging({ firstPage, extra: [...extra, ...page], hasMore: page.length === pageSize });
    } catch {
      if (inFlight.current === firstPage) setPaging({ firstPage, extra, failed: true, hasMore: true });
    } finally {
      if (inFlight.current === firstPage) inFlight.current = undefined;
    }
  }

  function chooseDay(next: string) {
    setHasRefreshed(false);
    setSelection(next);
    setPicker(null);
  }
  function post() {
    setPicker(null);
    if (routes.length === 1) router.push('/post');
    else router.push({ pathname: '/post', params: { routeId: selectedRoute.id } });
  }
  const routePill = <View style={[styles.routePill, { backgroundColor: t['bg/elevated'], borderColor: t.separator }]}>
    <RideSymbol name="pin" />
    <View style={styles.shrink}><RideText kind="footnoteSemibold">{routeLabel}</RideText></View>
    <RideSymbol name="down" size={spacing['space/12']} color="label/secondary" />
  </View>;
  const header = <>
    <View style={styles.header}>
      <View style={rideStyles.between}>
        {routes.length > 1
          ? <Pressable accessibilityRole="button" accessibilityLabel={routeLabel}
            accessibilityState={{ expanded: picker === 'route' }} style={styles.shrink}
            onPress={() => setPicker(current => current === 'route' ? null : 'route')}>{routePill}</Pressable>
          : routePill}
        <RideButton label={copy.notifications} icon="bell" iconOnly variant="surface" disabled />
      </View>
      <RideText kind="largeTitle" header>{copy.title}</RideText>
      {picker === 'route' && <RidePicker title={copy.route}>
        {routes.map(option => <RideChoice key={option.id} label={copy.routeName(option.fromName, option.toName)}
          radio selected={option.id === selectedRoute.id} onPress={() => { setHasRefreshed(false); setSelectedRoute(option); setPicker(null); }} />)}
      </RidePicker>}
      <RideSegments>
        <RideChoice variant="segment" label={copy.toDestination(selectedRoute.toName)} selected={direction === 'a_to_b'}
          onPress={() => { setHasRefreshed(false); setDirection('a_to_b'); }} />
        <RideChoice variant="segment" label={copy.toDestination(selectedRoute.fromName)} selected={direction === 'b_to_a'}
          onPress={() => { setHasRefreshed(false); setDirection('b_to_a'); }} />
      </RideSegments>
      {(result.status !== 'ready' || hasRides || day || picker === 'date') && <View style={rideStyles.row}>
        <RideChoice variant="pill" label={copy.all} selected={!day} onPress={() => chooseDay('all')} />
        <RideChoice variant="pill" label={copy.today} selected={selection === 'today'} onPress={() => chooseDay('today')} />
        <RideChoice variant="pill" label={copy.tomorrow} selected={selection === 'tomorrow'} onPress={() => chooseDay('tomorrow')} />
        <RideChoice variant="pill" label={day && selection === day ? formatRideDate(day) : copy.pickDate} accessibilityLabel={copy.pickDate}
          selected={day !== null && selection === day} onPress={() => setPicker(current => current === 'date' ? null : 'date')} />
      </View>}
      {picker === 'date' && <RidePicker title={copy.pickDate}>
        {windowDates(window).map(date => <RideChoice key={date} radio label={formatRideDate(date)} selected={date === day}
          onPress={() => chooseDay(date)} />)}
      </RidePicker>}
    </View>
    {carEntries ? <View style={styles.carEntries}>{carEntries}</View> :
      <CarButton label={strings.verification.approval} secondary onPress={() => router.push('/(verify)/status')} />}
  </>;

  const empty = result.status === 'loading' ? <LoadingState /> :
    result.status === 'error' ? <ErrorState onRetry={retry} /> :
      <EmptyState title={copy.emptyTitle(destination)} body={copy.emptyBody}
        primaryAction={{ label: copy.tryAnotherDay, onPress: () => setPicker('date') }}
        secondaryAction={{ label: copy.post, onPress: post }} />;

  return <SafeAreaView edges={['top']} style={[rideStyles.grow, { backgroundColor: t['bg/base'] }]}>
    <FlatList testID="rides-list" data={rows} keyExtractor={ride => ride.ride_id}
      renderItem={({ item }) => <View style={{ paddingHorizontal: spacing['space/16'], paddingBottom: spacing['space/12'] }}>
        <BoardCard ride={item} />
      </View>}
      ListHeaderComponent={header} ListEmptyComponent={empty}
      ListFooterComponent={hasRides && (currentPage?.hasMore ?? firstPage.length === pageSize)
        ? <View style={rideStyles.content}>{currentPage?.failed ? <ErrorState onRetry={() => void loadMore()} /> :
          <CarButton label={copy.loadMore} disabled={currentPage?.busy} busy={currentPage?.busy}
            secondary onPress={() => void loadMore()} />}</View> : undefined}
      contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{
        flexGrow: 1, paddingBottom: hasRides ? spacing['space/40'] * 3 : spacing['space/16'],
      }}
      refreshing={hasRefreshed && result.status === 'loading'}
      onRefresh={() => { setHasRefreshed(true); retry(); }} />
    {hasRides && <SafeAreaView edges={Platform.OS === 'android' ? [] : ['bottom']}
      style={{ position: 'absolute', end: spacing['space/16'], bottom: spacing['space/24'] }}>
      <View style={{ ...elevation.card, borderRadius: radius['radius/full'], backgroundColor: t['brand/primary'] }}>
        <RideButton label={copy.post} icon="plus" onPress={post} />
      </View>
    </SafeAreaView>}
  </SafeAreaView>;
}

export function RideBoardRoute() {
  const t = useTheme();
  const params = useLocalSearchParams<{ direction?: string; day?: string; routeId?: string }>();
  const { result, retry } = useRideResource(loadPilotRoutes);
  if (result.status === 'ready' && result.value.length > 0) {
    const route = result.value.find(option => option.id === params.routeId) ?? result.value[0];
    return <RideBoard key={JSON.stringify([route.id, params.direction, params.day])} route={route} routes={result.value}
      initialDirection={params.direction === 'b_to_a' ? 'b_to_a' : 'a_to_b'} initialDay={params.day}
      carEntries={<CarEntryPoints />} />;
  }
  return <SafeAreaView edges={['top']} style={[rideStyles.grow, { backgroundColor: t['bg/base'] }]}>
    <View style={rideStyles.content}>
      <RideText kind="largeTitle" header>{copy.title}</RideText>
      <CarEntryPoints />
    </View>
    {result.status === 'loading' ? <LoadingState fill /> : result.status === 'error' ? <ErrorState fill onRetry={retry} /> :
      <EmptyState fill title={copy.routesUnavailable} body={copy.routesUnavailableBody} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing['space/12'] },
  header: { paddingHorizontal: spacing['space/16'], paddingBottom: spacing['space/16'], gap: spacing['space/12'] },
  // CarEntryPoints supplies its own padding, including when it has no visible action.
  carEntries: { marginVertical: -spacing['space/16'] },
  shrink: { flexShrink: 1 },
  routePill: {
    flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing['space/4'],
    borderWidth: 1, borderRadius: radius['radius/full'],
    paddingHorizontal: spacing['space/8'], paddingVertical: spacing['space/8'],
  },
});
