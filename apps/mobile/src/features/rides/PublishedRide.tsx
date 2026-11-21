import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ErrorState, LoadingState } from '../../components/States';
import { strings } from '../../strings';
import { radius, spacing, useTheme } from '../../theme';
import { CarButton } from '../verification/CarScreens';
import type { RideProjection } from './api';
import { formatRideDate, formatRideTime } from './format';
import { RideDivider, RideSymbol, RouteTimeline } from './RidePresentation';
import { RideCard, RideScreen, RideText, rideStyles } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { buildShareMessage } from './shareMessage';
import { ShareRideSheet } from './ShareRideSheet';
import { usePostRideDraft } from './usePostRideDraft';
import { useRideResource } from './useRideResource';

const copy = strings.rides;

function PublishedRideHeader() {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.done}
      onPress={() => router.dismissTo('/')} style={styles.done}>
      <RideText kind="subheadlineSemibold" color="brand/primary">{copy.done}</RideText>
    </Pressable>
  </View>;
}

export function PublishedRide({ rideId, message, developmentLink = false, link, ride, children }: {
  rideId: string;
  message?: string;
  link?: string;
  developmentLink?: boolean;
  ride?: RideProjection;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const [shareOpen, setShareOpen] = useState(false);
  const routeName = ride && (ride.direction === 'b_to_a'
    ? copy.routeName(ride.to_name, ride.from_name)
    : copy.routeName(ride.from_name, ride.to_name));
  return <>
    <RideScreen header={<PublishedRideHeader />} footer={<>
      {message && <CarButton label={copy.share} onPress={() => setShareOpen(true)} />}
      <CarButton label={copy.viewPublished} secondary
        onPress={() => {
          router.dismissTo('/');
          router.push({ pathname: '/ride/[id]', params: { id: rideId, source: 'published' } });
        }} />
    </>}>
      <View style={styles.success}>
        <View style={[styles.halo, { backgroundColor: t['brand/tint'] }]}>
          <View style={[styles.check, { backgroundColor: t['brand/primary'] }]}>
            <RideSymbol name="check" size={spacing['space/32']} color="brand/on-primary" />
          </View>
        </View>
        <View style={rideStyles.stack}>
          <RideText kind="title1" header align="center">{copy.published}</RideText>
          <RideText muted align="center">{copy.publishedBody}</RideText>
        </View>
      </View>
      {ride && routeName && <RideCard>
        <RouteTimeline from={{
          name: ride.from_name,
          caption: [formatRideDate(ride.ride_date), formatRideTime(ride.departure_time),
            ride.repeat === 'weekdays' ? copy.weekdays : copy.once].join(' · '),
        }} to={{ name: ride.to_name, caption: copy.seatsOffered(ride.seats_offered) }} />
        <RideDivider />
        <View style={rideStyles.between}>
          <RideSymbol name="group" size={spacing['space/20']} />
          <View style={rideStyles.grow}><RideText kind="subheadline">{copy.visibleOn(routeName)}</RideText></View>
        </View>
      </RideCard>}
      {children}
    </RideScreen>
    {shareOpen && message && <ShareRideSheet message={message} developmentLink={developmentLink} link={link}
      onClose={() => setShareOpen(false)} />}
  </>;
}

export function PublishedRideRoute() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const api = useRidesApi();
  const { clear } = usePostRideDraft();
  const discardedDraft = useRef(false);
  useEffect(() => {
    if (rideId && !discardedDraft.current) {
      discardedDraft.current = true;
      clear();
    }
  }, [rideId, clear]);
  const load = useCallback(() => api.getRide(rideId, 'published'), [api, rideId]);
  const { result, retry } = useRideResource(load);
  if (!rideId) return <RideScreen header={<PublishedRideHeader />}>
    <RideText kind="headline" header align="center">{copy.published}</RideText>
    <CarButton label={copy.seeCurrent} onPress={() => router.dismissTo('/')} />
  </RideScreen>;
  const ride = result.status === 'ready' ? result.value : undefined;
  const share = ride && buildShareMessage(ride, process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL);
  return <PublishedRide rideId={rideId} ride={ride} {...share}>
    {result.status === 'loading' && <LoadingState />}
    {result.status === 'error' && <ErrorState onRetry={retry} />}
  </PublishedRide>;
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-end', paddingHorizontal: spacing['space/16'] },
  done: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  success: { paddingTop: spacing['space/40'], paddingBottom: spacing['space/8'], alignItems: 'center', gap: spacing['space/24'] },
  halo: { padding: spacing['space/20'], borderRadius: radius['radius/full'] },
  check: {
    padding: spacing['space/20'], borderRadius: radius['radius/full'],
    alignItems: 'center', justifyContent: 'center',
  },
});
