# Tawsila shell design decisions

Created with `create-expo-app@5.0.0`, official `expo-template-default@sdk-58`. Production dependencies are the template dependencies only. No extra native module was added. The repository pins Node 24; validation used 24.22.0.

## Native tabs — Components 6:22

Checked installed expo-router 58.0.24 before choosing: `build/native-tabs/NativeTabs.d.ts`, `types.d.ts`, `common/elements.d.ts`, and both platform `utils/optionsIconConverter` implementations. SDK 58 exposes the stable `expo-router/native-tabs` API; the official template itself uses it. NativeTabs is used for Board, Trips, Messages, Profile in that exact order. UIKit/Android supply tab role and selected-state semantics; explicit accessibility labels are supplied. The tab root nav bars implement Large 8:130 / 8:131; the reusable Inline 8:118 variant is demonstrated on the development states screen.

The native choice prioritizes the actual iOS 26 floating system tab bar. Native APIs control tab dimensions, safe-area placement, item spacing, typography scaling and visual effects. The exact 361 × 64 pill, 84 × 52 items, border and shadow cannot be forced with NativeTabs. Its `backgroundColor` is explicitly documented as ignored on iOS 26, where UIKit draws the background. Theme tint/label colors and Android selection indicator are configured. Older iOS versions and Android use their platform tab presentation. These are deliberate native adaptations, not a pixel-exact drawn Figma pill. Native tab text can adopt platform accessibility presentation rather than the exact Figma caption metrics.

## Supplied icons

All twelve original local SVGs are preserved in assets/icons. State/nav images use the template's expo-image with `tintColor`, so baked-in SVG colors are replaced by theme colors. Installed source confirms iOS SDWebImageSVGCoder (ExpoImage.podspec), bitmap decoding when tint is set (ImageView.swift), and Android SVGStyler.applyTintColor. expo-image includes SVG decoders on iOS and Android; no react-native-svg dependency is needed. NativeTabs instead passes image sources directly to react-native-screens/native image loading, so SVG support there is not assumed. Eight tab SVGs were rasterized to transparent PNG at 1×/2×/3× using temporary build tooling (`@resvg/resvg-js` outside the app dependency tree). The exact supplied path geometry and active/inactive stroke weights are retained. NativeTabs template rendering on iOS and configured icon colors on Android tint their alpha masks. No URL is a runtime asset. Export checks verify bundling for both platforms; device rendering, screen-reader semantics and Dynamic Type still require the separate simulator/device gate.

## Foundations

src/theme/index.ts records the complete light (36:6), dark (36:113), type (36:220), spacing (36:262), radius (36:288) and elevation (36:309) sets. Each exported category inherits its `sources` node ID, including all entries within that category. All color literals used by application components live in this module. System appearance is followed with useColorScheme. No custom font files: system SF Pro on iOS and Roboto on Android. Figma weights 590 and 510 map to supported 600 and 500. Start/end or symmetric padding is used throughout. Strings are centralized for future translation; only English is shipped.

## States and accessibility

States follow 34:2, 34:155 and 34:181. State containers and text have no fixed height, no line limits and no font-scale cap. Buttons have minimum 52 pt height and expand with wrapped text. Debug content scrolls at the largest accessibility font sizes; tab roots scroll as well. The 361 pt content width is a maximum that shrinks on narrow viewports. Loading skeletons are decorative under one busy progress announcement; no animation is used. Contrast tests assert at least 4.5:1 for every application text/background pair and the icon pairs. Low-contrast separators and skeleton fills are decorative, not interactive boundaries or text.

The debug route redirects to Board outside __DEV__; the Profile debug entry is also guarded by __DEV__. It is never a fifth tab. Retry invokes its supplied callback; the debug demonstration only acknowledges it locally. No network or persistence behavior is implemented.

## Deviations and open questions

No supplied application text/icon pair failed contrast tests in either theme. Native tab layout and system background are the adaptations described above. The separate iOS simulator gate remains outstanding as assigned; exports do not prove native rendering. The template generated nested AGENTS.md, .claude settings and a demo README; these newly generated files were removed so the handoff contains no instruction/config or README changes. The repository root AGENTS.md and README.md were untouched.
