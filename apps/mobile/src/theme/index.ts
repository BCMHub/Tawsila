import { useColorScheme, type TextStyle } from 'react-native';

export const light = {
  "label/primary": "#14201b",
  "label/secondary": "#5e6a65",
  "label/tertiary": "#8b958f",
  "label/quaternary": "#c5cbc7",
  "brand/primary": "#0b4d3b",
  "brand/primary-pressed": "#083a2d",
  "brand/on-primary": "#ffffff",
  "brand/tint": "#e3f0ea",
  "brand/sun": "#f3e3c3",
  "bg/base": "#fbfaf6",
  "bg/grouped": "#f4f2ec",
  "bg/elevated": "#ffffff",
  "bg/elevated-2": "#ffffff",
  "separator": "#e4e1d8",
  "fill/secondary": "#eeece5",
  "fill/tertiary": "#f4f2ec",
  "system/red": "#ff3b30",
  "system/red-tint": "#fde8e6",
  "system/orange": "#ff9500",
  "system/orange-tint": "#fff1dc",
  "system/yellow": "#ffb800",
  "system/green": "#34c759",
  "system/blue": "#007aff",
  "seat/free": "#e3f0ea",
  "seat/taken": "#dad7ce",
  "seat/mine": "#0b4d3b",
  "overlay/scrim": "#000000"
} as const;
export const dark = {
  "label/primary": "#ffffff",
  "label/secondary": "#a3aea9",
  "label/tertiary": "#6f7873",
  "label/quaternary": "#3f4643",
  "brand/primary": "#3dc796",
  "brand/primary-pressed": "#2fa97e",
  "brand/on-primary": "#04241b",
  "brand/tint": "#10312a",
  "brand/sun": "#3a3020",
  "bg/base": "#000000",
  "bg/grouped": "#000000",
  "bg/elevated": "#1c1c1e",
  "bg/elevated-2": "#2c2c2e",
  "separator": "#2c2c2e",
  "fill/secondary": "#2c2c2e",
  "fill/tertiary": "#1c1c1e",
  "system/red": "#ff453a",
  "system/red-tint": "#3a1512",
  "system/orange": "#ff9f0a",
  "system/orange-tint": "#3a2a10",
  "system/yellow": "#ffd60a",
  "system/green": "#30d158",
  "system/blue": "#0a84ff",
  "seat/free": "#10312a",
  "seat/taken": "#3a3a3c",
  "seat/mine": "#3dc796",
  "overlay/scrim": "#000000"
} as const;
export const sources = { light: "36:6", dark: "36:113", typography: "36:220", spacing: "36:262", radius: "36:288", elevation: "36:309" } as const;
export const spacing = { "space/4": 4, "space/8": 8, "space/12": 12, "space/16": 16, "space/20": 20, "space/24": 24, "space/32": 32, "space/40": 40 } as const;
export const radius = { "radius/8": 8, "radius/12": 12, "radius/16": 16, "radius/20": 20, "radius/28": 28, "radius/full": 999 } as const;
// System font: SF Pro on iOS, Roboto on Android. Each style inherits sources.typography.
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.43 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.31 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.23 },
  subheadlineSemibold: { fontSize: 15, lineHeight: 20, fontWeight: "600", letterSpacing: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  footnoteSemibold: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: "500", letterSpacing: 0.06 },
} satisfies Record<string, TextStyle>;
export const elevation = { card: { shadowColor: "#141f1a", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 12 }, tab: { shadowColor: "#141f1a", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 } } as const;
export function useTheme() { return useColorScheme() === "dark" ? dark : light; }
