import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '../../components/Banner';
import { strings } from '../../strings';
import { spacing } from '../../theme';
import type { RideProjection, SharedRideResult } from './api';
import { formatRideDate, formatRideTime } from './format';
import { RideAvatar, RideBadge, RideButton, RideNotice, RouteTimeline } from './RidePresentation';
import { RideCard, RideScreen, RideText, rideStyles } from './RideScreen';
import { buildShareMessage } from './shareMessage';
import { ShareRideSheet } from './ShareRideSheet';

const copy = strings.rides;
type DetailRide = Pick<RideProjection,
  'state' | 'from_name' | 'from_area' | 'to_name' | 'to_area' | 'duration_minutes' | 'ride_date' |
  'departure_time' | 'flex_minutes' | 'seats_left' | 'pickup_note' | 'notes' | 'owner_display' |
  'owner_initials' | 'owner_member_since' | 'owner_phone_verified' | 'car_label' | 'repeat'> &
  Partial<Pick<RideProjection, 'direction' | 'route_id'>>;

function AvailableRide({ ride }: { ride: DetailRide }) {
  const date = formatRideDate(ride.ride_date);
  const schedule = [
    ride.from_area, date, formatRideTime(ride.departure_time),
    ride.repeat === 'weekdays' ? copy.weekdays : copy.once,
    ride.flex_minutes > 0 ? `± ${copy.minutes(ride.flex_minutes)}` : null,
  ].filter(Boolean).join(' · ');
  const destination = [ride.to_area, ride.duration_minutes > 0 ? copy.aboutMinutes(ride.duration_minutes) : null]
    .filter(Boolean).join(' · ');

  return <>
    <RideCard>
      <RouteTimeline from={{ name: ride.from_name, caption: schedule }} to={{ name: ride.to_name, caption: destination }} />
      {(ride.pickup_note || ride.notes) && <View style={rideStyles.row}>
        {ride.pickup_note && <RideBadge icon="pin">
          {copy.pickup}{': '}<RideText kind="caption1" muted>{ride.pickup_note}</RideText>
        </RideBadge>}
        {ride.notes && <RideBadge icon="note">{ride.notes}</RideBadge>}
      </View>}
    </RideCard>
    <RideCard>
      <View style={rideStyles.between}>
        <RideAvatar large>{ride.owner_initials}</RideAvatar>
        <View style={rideStyles.grow}>
          <View style={[rideStyles.row, { rowGap: spacing['space/4'] }]}>
            <RideText kind="subheadlineSemibold">{ride.owner_display}</RideText>
            {ride.owner_phone_verified && <RideBadge icon="verified" tone="accent">{copy.phoneVerified}</RideBadge>}
          </View>
          <RideText kind="footnote" muted>{copy.memberSince(ride.owner_member_since)}</RideText>
          <RideText kind="footnote" muted>
            {ride.car_label && <><RideText kind="footnote" muted>{ride.car_label}</RideText>{' · '}</>}
            <RideText kind="footnote" muted>{copy.seatsLeft(ride.seats_left)}</RideText>
          </RideText>
        </View>
      </View>
    </RideCard>
    <RideNotice icon="lock">{copy.detailPrivacy}</RideNotice>
  </>;
}

export function RideDetail({ ride, onShare, onBack, shared = false }: {
  ride?: DetailRide;
  onShare: () => void;
  onBack?: () => void;
  shared?: boolean;
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

  if (available) return <RideScreen title={copy.detail} onBack={onBack} footer={<>
    <RideButton label={copy.requestASeat} disabled />
    <RideButton label={copy.share} variant="outline" onPress={onShare} />
  </>}>
    <AvailableRide ride={ride} />
  </RideScreen>;

  return <RideScreen title={shared ? copy.sharedRide : copy.detail} onBack={onBack} footer={<>
    <RideButton label={full && date ? copy.seeSameDay(date) : copy.seeCurrent} onPress={goToBoard} />
    <RideButton label={copy.post} variant="text" onPress={() => router.push('/post')} />
  </>}>
    <Banner tone="warning" text={full && date
      ? copy.full(ride.owner_display.replace(/\s+\p{L}\.$/u, ''), date)
      : copy.unavailable} />
    {ride && <RideCard>
      <View style={rideStyles.between}>
        <View style={rideStyles.grow}><RideText kind="subheadlineSemibold">{copy.toDestination(ride.to_name)}</RideText></View>
        <RideBadge tone="status">{full ? copy.fullStatus : copy.unavailableStatus}</RideBadge>
      </View>
      <RouteTimeline from={{
        name: ride.from_name, caption: `${date} · ${formatRideTime(ride.departure_time)} · ${ride.owner_display}`,
      }} to={{ name: ride.to_name, caption: full ? copy.noSeatsLeft : copy.cancelledOrDeparted }} />
    </RideCard>}
  </RideScreen>;
}

export function RideDetailWithShare({ detail, onBack, shared }: { detail: SharedRideResult; onBack: () => void; shared?: boolean }) {
  const [share, setShare] = useState<ReturnType<typeof buildShareMessage>>();
  const ride = detail.state === 'not_found' ? undefined : { ...detail.ride, state: detail.state };
  return <>
    <RideDetail ride={ride} onBack={onBack} shared={shared} onShare={() => {
      if (ride?.state === 'available') setShare(buildShareMessage(ride, process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL));
    }} />
    {share && <ShareRideSheet {...share} onClose={() => setShare(undefined)} />}
  </>;
}
