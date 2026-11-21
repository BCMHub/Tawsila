import 'react-native-url-polyfill/auto';
import { storePendingSharedRide } from '../features/rides/pendingSharedRide';

// Accept the ambiguous characters that the server normalizes on lookup.
const ridePath = /^\/r\/([0-9A-TV-Z]{8})$/i;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  let pathname = path;
  if (!path.startsWith('/')) {
    try {
      const url = new URL(path);
      if (/^https:\/\//i.test(path) && url.hostname && !url.username && !url.password) {
        pathname = url.pathname;
      } else if (/^tawsila:\/\//i.test(path) && url.host === 'r' && !url.username && !url.password) {
        pathname = `/r${url.pathname}`;
      } else {
        return '/';
      }
    } catch {
      return '/';
    }
  }

  const code = ridePath.exec(pathname)?.[1];
  if (!code) return '/';

  storePendingSharedRide(code);
  return `/r/${code}`;
}
