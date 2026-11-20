import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '../../components/Banner';
import { strings } from '../../strings';
import { CarButton } from '../verification/CarScreens';
import type { RideProjection, SharedRideResult } from './api';
import { formatRideDate, formatRideTime } from './format';
import { RideCard, RideChip, RideScreen, RideText, rideStyles } from './RideScreen';
import { buildShareMessage } from './shareMessage';
import { ShareRideSheet } from './ShareRideSheet';

const copy = strings.rides;
type DetailRide = Pick<RideProjection,
  'state' | 'from_name' | 'from_area' | 'to_name' | 'to_area' | 'duration_minutes' | 'ride_date' |
  'departure_time' | 'flex_minutes' | 'seats_left' | 'pickup_note' | 'notes' | 'owner_display' |
  'owner_initials' | 'owner_member_since' | 'owner_phone_verified' | 'car_label' | 'repeat'> &
  Partial<Pick<RideProjection, 'direction' | 'route_id'>>;

export function RideDetail({ ride, onShare, onBack }: {
  ride?: DetailRide;
  onShare: () => void;
  onBack?: () => void;
}) {
  const date = ride && formatRideDate(ride.ride_date);
  const full = ride?.state === 'full';
  const available = ride?.state === 'available';
  const goToBoard = () => router.push({
    pathname: '/',
    params: {
      day: full && ride ? ride.ride_date : 'all',
      ...(ride?.direction && { direction: ride.direction }),
      ...(ride?.route_id && { routeId: ride.route_id }),
    },
  });

  return <RideScreen title={copy.detail} onBack={onBack}>
    {!available && <Banner tone="warning" text={full && date
      ? copy.full(ride.owner_display.replace(/\s+\p{L}\.$/u, ''), date)
      : copy.unavailable} />}
    {ride && <>
      <RideCard>
        <RideText kind="title3">{ride.from_name}</RideText>
        {ride.from_area && <RideText kind="footnote" muted>{ride.from_area}</RideText>}
        <View style={rideStyles.row}>
          <RideText kind="subheadlineSemibold">{date} · {formatRideTime(ride.departure_time)}</RideText>
          {ride.flex_minutes > 0 && <RideText kind="footnote" muted>± {copy.minutes(ride.flex_minutes)}</RideText>}
          <RideChip>{ride.repeat === 'weekdays' ? copy.weekdays : copy.once}</RideChip>
        </View>
        <RideText kind="title3">{ride.to_name}</RideText>
        <View style={rideStyles.row}>
          {ride.to_area && <RideText kind="footnote" muted>{ride.to_area}</RideText>}
          {ride.duration_minutes > 0 && <RideText kind="footnote" muted>{copy.aboutMinutes(ride.duration_minutes)}</RideText>}
        </View>
        {(ride.pickup_note || ride.notes) && <View style={rideStyles.row}>
          {ride.pickup_note && <RideChip>{ride.pickup_note}</RideChip>}
          {ride.notes && <RideChip>{ride.notes}</RideChip>}
        </View>}
      </RideCard>
      <RideCard>
        <View style={rideStyles.row}>
          <RideChip>{ride.owner_initials}</RideChip>
          <View style={rideStyles.grow}>
            <RideText kind="headline">{ride.owner_display}</RideText>
            <RideText kind="footnote" muted>{copy.memberSince(ride.owner_member_since)}</RideText>
          </View>
          {ride.owner_phone_verified && <RideChip>{copy.phoneVerified}</RideChip>}
        </View>
        {ride.car_label && <RideText>{ride.car_label}</RideText>}
        {available && <RideText kind="headline">{copy.seatsLeft(ride.seats_left)}</RideText>}
      </RideCard>
    </>}
    {available ? <>
      <RideText kind="footnote" muted>{copy.detailPrivacy}</RideText>
      <CarButton label={copy.requestASeat} disabled onPress={() => undefined} />
      <CarButton label={copy.share} secondary onPress={onShare} />
    </> : <>
      <CarButton label={full && date ? copy.seeSameDay(date) : copy.seeCurrent} onPress={goToBoard} />
      <CarButton label={copy.post} secondary onPress={() => router.push('/post')} />
    </>}
  </RideScreen>;
}

export function RideDetailWithShare({ detail, onBack }: { detail: SharedRideResult; onBack: () => void }) {
  const [share, setShare] = useState<ReturnType<typeof buildShareMessage>>();
  const ride = detail.state === 'not_found' ? undefined : { ...detail.ride, state: detail.state };
  return <>
    <RideDetail ride={ride} onBack={onBack} onShare={() => {
      if (ride?.state === 'available') setShare(buildShareMessage(ride, process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL));
    }} />
    {share && <ShareRideSheet {...share} onClose={() => setShare(undefined)} />}
  </>;
}
