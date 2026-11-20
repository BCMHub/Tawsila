import { formatRideDate, formatRideTime } from './format';

type ShareableRide = {
  from_name: string;
  to_name: string;
  ride_date: string;
  departure_time: string;
  seats_offered: number;
  repeat: string;
  share_code: string;
};

function httpsBase(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) {
      return url.href.replace(/\/+$/, '');
    }
  } catch {
    // Use the development link when the supplied base URL is invalid.
  }
  return null;
}

export function buildShareMessage(ride: ShareableRide, baseUrl?: string) {
  const base = httpsBase(baseUrl);
  const link = base ? `${base}/r/${ride.share_code}` : `tawsila://r/${ride.share_code}`;
  const seats = ride.seats_offered === 1 ? 'seat' : 'seats';
  const repeat = ride.repeat === 'weekdays' ? ' · weekdays' : '';

  return {
    developmentLink: base === null,
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
