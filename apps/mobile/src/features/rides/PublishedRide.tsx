import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, LoadingState } from '../../components/States';
import { strings } from '../../strings';
import { CarButton } from '../verification/CarScreens';
import type { RideProjection } from './api';
import { formatRideDate, formatRideTime } from './format';
import { RideCard, RideChip, RideScreen, RideText, rideStyles } from './RideScreen';
import { useRidesApi } from './RidesApiProvider';
import { buildShareMessage } from './shareMessage';
import { ShareRideSheet } from './ShareRideSheet';
import { usePostRideDraft } from './usePostRideDraft';
import { useRideResource } from './useRideResource';

const copy = strings.rides;

export function PublishedRide({ rideId, message, developmentLink = false, ride, children }: {
  rideId: string;
  message?: string;
  developmentLink?: boolean;
  ride?: RideProjection;
  children?: React.ReactNode;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  return <RideScreen title={copy.published} onBack={() => router.dismissTo('/')}>
    <RideText kind="title1" header>{copy.published}</RideText>
    <RideText muted>{copy.publishedBody}</RideText>
    {ride && <RideCard>
      <RideText kind="title3">{ride.from_name}</RideText>
      <RideText kind="subheadlineSemibold">
        {formatRideDate(ride.ride_date)} · {formatRideTime(ride.departure_time)}
      </RideText>
      <RideText kind="title3">{ride.to_name}</RideText>
      <View style={rideStyles.row}>
        <RideChip>{copy.seatsOffered(ride.seats_offered)}</RideChip>
        <RideChip>{ride.repeat === 'weekdays' ? copy.weekdays : copy.once}</RideChip>
      </View>
    </RideCard>}
    {children}
    {message && <CarButton label={copy.share} onPress={() => setShareOpen(true)} />}
    <CarButton label={copy.viewPublished} secondary
      onPress={() => router.push({ pathname: '/ride/[id]', params: { id: rideId, source: 'published' } })} />
    {shareOpen && message && <ShareRideSheet message={message} developmentLink={developmentLink}
      onClose={() => setShareOpen(false)} />}
  </RideScreen>;
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
  if (!rideId) return <RideScreen title={copy.published} onBack={() => router.dismissTo('/')}>
    <CarButton label={copy.seeCurrent} onPress={() => router.dismissTo('/')} />
  </RideScreen>;
  const ride = result.status === 'ready' ? result.value : undefined;
  const share = ride && buildShareMessage(ride, process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL);
  return <PublishedRide rideId={rideId} ride={ride} {...share}>
    {result.status === 'loading' && <LoadingState />}
    {result.status === 'error' && <ErrorState onRetry={retry} />}
  </PublishedRide>;
}
