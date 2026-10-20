import { expect, test } from '@jest/globals';
import { dark, light, typography, spacing, radius, sources, elevation } from '../theme';
import expected from './colors.expected.json';

test('all approved color values and keys match both foundations', () => {
  expect(Object.keys(light).sort()).toEqual(Object.keys(expected).sort());
  expect(Object.keys(dark).sort()).toEqual(Object.keys(expected).sort());
  for (const key of Object.keys(expected) as (keyof typeof light)[]) {
    expect(light[key]).toBe(expected[key][0]); expect(dark[key]).toBe(expected[key][1]);
  }
});
test('scales and provenance are complete', () => {
  expect(sources).toEqual({ light: '36:6', dark: '36:113', typography: '36:220', spacing: '36:262', radius: '36:288', elevation: '36:309' });
  expect(Object.values(spacing)).toEqual([4,8,12,16,20,24,32,40]);
  expect(Object.values(radius)).toEqual([8,12,16,20,28,999]);
  expect(Object.values(typography).map(s => [s.fontSize,s.lineHeight,s.fontWeight,s.letterSpacing])).toEqual([
    [34,41,'700',.4],[28,34,'700',.36],[22,28,'700',.35],[20,25,'600',.38],
    [17,22,'600',-.43],[17,22,'400',-.43],[16,21,'400',-.31],[15,20,'400',-.23],
    [15,20,'600',-.23],[13,18,'400',-.08],[13,18,'600',-.08],[12,16,'400',0],[11,13,'500',.06],
  ]);
  expect(elevation.card.shadowRadius).toBe(12); expect(elevation.tab.shadowRadius).toBe(6);
});
function luminance(hex: string) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a: string,b: string) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
type Key = keyof typeof light;
// Every application text pair; icons share these colors. Decorative skeletons and separators carry no information.
const pairs: [Key,Key][] = [
 ['label/primary','bg/base'],['label/secondary','bg/base'],['label/secondary','bg/elevated'],
 ['brand/primary','brand/tint'],['brand/primary','bg/base'],['brand/on-primary','brand/primary'],
 ['brand/on-primary','brand/primary-pressed'],['label/primary','bg/elevated'],
 ['brand/primary','bg/elevated'],['label/secondary','fill/secondary'],
];
for (const [name,t] of [['light',light],['dark',dark]] as const) {
 test.each(pairs)(`${name}: %s on %s meets AA`, (fg,bg) => { expect(contrast(t[fg],t[bg])).toBeGreaterThanOrEqual(4.5); });
}
