import { afterEach, expect, jest, test } from '@jest/globals';
import appJson from '../../../app.json';
import { shareLinkBaseCases } from './shareLinkBaseCases';

const original = process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL;
type AppConfig = typeof appJson & { expo: typeof appJson.expo & { ios: typeof appJson.expo.ios & { associatedDomains?: string[] } } };
function load(value?: string): AppConfig { if (value === undefined) delete process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL; else process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL = value; jest.resetModules(); return (jest.requireActual('../../../app.config') as { default: AppConfig }).default; }
afterEach(() => { if (original === undefined) delete process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL; else process.env.EXPO_PUBLIC_SHARE_LINK_BASE_URL = original; });
test('unset variable preserves app.json exactly and adds no associated domains', () => { expect(load()).toEqual(appJson); expect(load().expo.ios.associatedDomains).toBeUndefined(); });
test('https base adds only the host as an applinks domain', () => { expect(load('https://example.invalid').expo).toEqual({ ...appJson.expo, ios: { ...appJson.expo.ios, associatedDomains: ['applinks:example.invalid'] } }); });
test.each(['http://example.invalid', 'not a url', 'https://'])('invalid or non-https base %s adds no domain', value => { expect(load(value)).toEqual(appJson); });

test.each(shareLinkBaseCases)('adds an associated domain for HTTPS origin input %j only when valid', (value, valid) => {
  expect(load(value).expo.ios.associatedDomains).toEqual(valid ? ['applinks:example.invalid'] : undefined);
});
