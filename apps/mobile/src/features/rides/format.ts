const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The RPC supplies effective Cairo wall-clock fields. UTC preserves those
// fields when passing them through Date and Intl on devices in other zones.
export function formatRideDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).formatToParts(value);
    const weekday = parts.find(part => part.type === 'weekday')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    if (weekday && day && month) return `${weekday} ${day} ${month.slice(0, 3)}`;
  } catch {
    // Use the effective fields if Intl is unavailable.
  }
  return `${weekdays[value.getUTCDay()]} ${value.getUTCDate()} ${months[value.getUTCMonth()]}`;
}

export function formatRideTime(time: string): string {
  const [hourText, minute] = time.split(':');
  const hour = Number(hourText);
  try {
    const value = new Date(`1970-01-01T${hourText}:${minute}:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(value).replace(/\s+/g, ' ');
  } catch {
    return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
  }
}

export function formatPostedAt(createdAt: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(createdAt)) / 60_000);
  if (minutes < 1) return 'Posted just now';
  if (minutes < 60) return `Posted ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Posted ${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `Posted ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
