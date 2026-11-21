import appJson from './app.json';
import { getShareLinkOrigin } from './src/features/rides/shareLinkBase';

const origin = getShareLinkOrigin(process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL);

export default origin
  ? {
      expo: {
        ...appJson.expo,
        ios: {
          ...appJson.expo.ios,
          associatedDomains: [`applinks:${new URL(origin).host}`],
        },
      },
    }
  : appJson;
