# Tawsila shell design decisions

Created with `create-expo-app@5.0.0`, official `expo-template-default@sdk-58`. The initial shell used template dependencies only; TAW-7 adds the session/storage modules and native Google development-build integration described below. The repository pins Node 24; validation used 24.22.0.

## Native tabs — Components 6:22

Checked installed expo-router 58.0.24 before choosing: `build/native-tabs/NativeTabs.d.ts`, `types.d.ts`, `common/elements.d.ts`, and both platform `utils/optionsIconConverter` implementations. SDK 58 exposes the stable `expo-router/native-tabs` API; the official template itself uses it. NativeTabs is used for Board, Trips, Messages, Profile in that exact order. UIKit/Android supply tab role and selected-state semantics; explicit accessibility labels are supplied. The tab root nav bars implement Large 8:130 / 8:131; the reusable Inline 8:118 variant is demonstrated on the development states screen.

NativeTabsLabelStyle in the installed types supports font size, weight and colour but excludes line height and letter spacing; those metrics are a known native-tab limitation and are omitted from labelStyle.

The native choice prioritizes the actual iOS 26 floating system tab bar. Native APIs control tab dimensions, safe-area placement, item spacing, typography scaling and visual effects. The exact 361 × 64 pill, 84 × 52 items, border and shadow cannot be forced with NativeTabs. Its `backgroundColor` is explicitly documented as ignored on iOS 26, where UIKit draws the background. Theme tint/label colors and Android selection indicator are configured. Older iOS versions and Android use their platform tab presentation. These are deliberate native adaptations, not a pixel-exact drawn Figma pill. Native tab text can adopt platform accessibility presentation rather than the exact Figma caption metrics.

## Supplied icons

The unused tab SVG files remain as source-only assets; the native tabs load the derived PNGs.

All twelve original local SVGs are preserved in assets/icons. State/nav images use the template's expo-image with `tintColor`, so baked-in SVG colors are replaced by theme colors. Installed source confirms iOS SDWebImageSVGCoder (ExpoImage.podspec), bitmap decoding when tint is set (ImageView.swift), and Android SVGStyler.applyTintColor. expo-image includes SVG decoders on iOS and Android; no react-native-svg dependency is needed. NativeTabs instead passes image sources directly to react-native-screens/native image loading, so SVG support there is not assumed. Eight tab SVGs were rasterized to transparent PNG at 1×/2×/3× using temporary build tooling (`@resvg/resvg-js` outside the app dependency tree). The exact supplied path geometry and active/inactive stroke weights are retained. NativeTabs template rendering on iOS and configured icon colors on Android tint their alpha masks. No URL is a runtime asset. Export checks verify bundling for both platforms; device rendering, screen-reader semantics and Dynamic Type still require the separate simulator/device gate.

## Foundations

src/theme/index.ts records the complete light (36:6), dark (36:113), type (36:220), spacing (36:262), radius (36:288) and elevation (36:309) sets. Each exported category inherits its `sources` node ID, including all entries within that category. All color literals used by application components live in this module. System appearance is followed with useColorScheme. No custom font files: system SF Pro on iOS and Roboto on Android. Figma weights 590 and 510 map to supported 600 and 500. Start/end or symmetric padding is used throughout. Strings are centralized for future translation; only English is shipped.

## States and accessibility

States follow 34:2, 34:155 and 34:181. State containers and text have no fixed height, no line limits and no font-scale cap. Buttons have minimum 52 pt height and expand with wrapped text. Each debug state is selected by the state query parameter and fills and centres within the available screen; its content scrolls at the largest accessibility font sizes; tab roots scroll as well. The 361 pt content width is a maximum that shrinks on narrow viewports. Loading skeletons are decorative under one busy progress announcement; no animation is used. Contrast tests assert at least 4.5:1 for every application text/background pair and the icon pairs. Low-contrast separators and skeleton fills are decorative, not interactive boundaries or text.

The debug route redirects to Board outside __DEV__; the Profile debug entry is also guarded by __DEV__. It is never a fifth tab. Retry invokes its supplied callback; the debug demonstration only acknowledges it locally. No network or persistence behavior is implemented.

## Deviations and open questions

Deviation: offline icon — Figma 34:155's icon is fragmented. iOS uses SF Symbols `wifi.slash` (Apple's licence limits SF Symbols to Apple-platform apps, hence iOS only); Android uses Material Symbols `wifi_off` (Apache 2.0). Designer follow-up: update the icon in Figma. The original `state-wifi-off.svg` is retained as a source-only asset. Installed expo-symbols 58.0.4 supports platform-specific names and loads its bundled Material Symbols regular font through the already-installed expo-font; no new dependency or config plugin is required. Both symbols use the existing 60 × 60 size and label/secondary tint inside the unchanged 140 pt circle, and remain decorative for accessibility.

No supplied application text/icon pair failed contrast tests in either theme. Native tab layout and system background are the adaptations described above. The separate iOS simulator gate remains outstanding as assigned; exports do not prove native rendering. The template generated nested AGENTS.md, .claude settings and a demo README; these newly generated files were removed so the handoff contains no instruction/config or README changes. The repository root AGENTS.md and README.md were untouched.

Expo Router 58.0.24 native-tabs iOS 26 colour limitation (Figma 6:22): after checking `tintColor` (selected foreground, already correct), `iconColor` and `labelStyle.color` (already forwarded to native normal/selected item appearances, but inactive colours differ in the simulator), `indicatorColor` (Android/web only), `backgroundColor` and `blurEffect` (no effect on iOS 26), and `disableTransparentOnScrollEdge` (scroll-edge appearance only), no supported prop was found to set the active glass highlight to `brand/tint` or further enforce inactive `label/secondary`, so the native layout is unchanged.

## TAW-7 sign-in and account hand-off

The approved design source is TAW-11 in “Tawsila – iOS App Design”, Figma section `174:365`. Welcome exposes Google on iOS, with progress, cancellation, offline and failure handling. Approved deviations: the wordmark is text; there is no Sign out or Choose another option; the profile hand-off screen has not been designed. New accounts remain at `needs_profile` until TAW-4 provides profile, age and consent with a trusted completion function. A provider response cannot open tabs; only a valid SDK session and server-confirmed completion can. TAW-5 owns phone verification, ride gating and duplicate-phone handling.

Native integration pins `react-native-nitro-google-signin` 2.3.0 and `react-native-nitro-modules` 0.37.1, with Expo-selected `expo-dev-client`. The lazy import lets Expo Go render Welcome while the Google button reports `unavailable`. Use a development build for sign-in: `npx expo run:ios` on Simulator or `npx expo run:ios --device` on the owner's iPhone. Xcode, a Simulator runtime, CocoaPods and device signing are required. Rebuild when native plugins change. Android sign-in returns `unavailable`.

[The Supabase hand-off](../../supabase/README.md) documents local Docker/Colima setup, database checks and concurrency script, `.env.example` variables, the Node environment's `EXPO_NO_DOTENV=1` setting (unset it to load `.env`), the owner's existing Free-tier hosted test configuration, and the database-side test-only seed. The SDK is the session authority. Internal sign-outs verify local storage removal and clear all chunks and the manifest when R2's expired/offline failure retains a session. A marker file in the document directory requires sign-in on fresh installation while allowing updates to retain valid sessions.

The earlier iOS spike verified the nonce flow; it does not verify this production UI on a physical iPhone. Physical sign-in, cancellation, accessibility and reinstall/update behavior are not yet verified: needs the owner's device. Android sign-in, Sign in with Apple, logout, account deletion and store-submission work belong to separate cards; TAW-7 does not implement them.
