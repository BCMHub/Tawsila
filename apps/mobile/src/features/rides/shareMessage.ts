import { formatRideDate, formatRideTime } from './format';
import { getShareLinkOrigin } from './shareLinkBase';

type ShareableRide = {
  from_name: string;
  to_name: string;
  ride_date: string;
  departure_time: string;
  seats_offered: number;
  repeat: string;
  share_code: string;
};

export function buildShareMessage(ride: ShareableRide, baseUrl?: string) {
  const origin = getShareLinkOrigin(baseUrl);
  const link = origin ? `${origin}/r/${ride.share_code}` : `tawsila://r/${ride.share_code}`;
  const seats = ride.seats_offered === 1 ? 'seat' : 'seats';
  const repeat = ride.repeat === 'weekdays' ? ' · weekdays' : '';

  return {
    developmentLink: origin === undefined,
    link,
    message: [
      'Tawsila · ride offer',
      `${ride.from_name} → ${ride.to_name}`,
      `${formatRideDate(ride.ride_date)} · leaves around ${formatRideTime(ride.departure_time)}${repeat}`,
      `${ride.seats_offered} ${seats} offered`,
      link,
    ].join('\n'),
  };
}
