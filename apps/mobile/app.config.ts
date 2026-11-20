import appJson from './app.json';

function getShareLinkHost(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.host ? url.host : undefined;
  } catch {
    return undefined;
  }
}

const host = getShareLinkHost(process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL);

export default host
  ? {
      expo: {
        ...appJson.expo,
        ios: {
          ...appJson.expo.ios,
          associatedDomains: [`applinks:${host}`],
        },
      },
    }
  : appJson;
