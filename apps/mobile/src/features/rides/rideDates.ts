export type RideWindow = { first: string; last: string };

function cairoNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function addRideDays(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function rideWindow(): RideWindow {
  const first = cairoNow().date;
  return { first, last: addRideDays(first, 13) };
}

export function isRideWeekday(day: string) {
  return new Date(`${day}T00:00:00Z`).getUTCDay() < 5;
}

export function windowDates(window: RideWindow) {
  const dates: string[] = [];
  for (let day = window.first; day <= window.last; day = addRideDays(day, 1)) dates.push(day);
  return dates;
}

const clockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const timeOptions = Array.from({ length: 24 * 12 }, (_, index) => clockTime(index * 5));

export function initialSchedule(window: RideWindow) {
  const now = cairoNow();
  const next = (Math.floor(now.minutes / 5) + 1) * 5;
  if (window.first !== now.date || next < 7 * 60) return { date: window.first, time: '07:00' };
  if (next < 24 * 60 || window.first === window.last) {
    return { date: window.first, time: clockTime(Math.min(next, 23 * 60 + 55)) };
  }
  return { date: addRideDays(window.first, 1), time: '07:00' };
}
