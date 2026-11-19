# Tawsila

**Peer-to-peer, non-commercial carpooling for people travelling the same way.**

Tawsila replaces the WhatsApp and Facebook groups people use today to find a shared ride. A car owner offers empty seats on a trip they were already going to make. People going the same way ask to join. Nobody is hired and nobody profits. Tawsila never sets, calculates, shows or collects a fare or price; riders and car owners agree any contribution to fuel and tolls privately.

> Status: early build (iOS first). Sign-in with Google and onboarding are built. The ride flow is planned (cards TAW-29 to TAW-32). The designs still use SAR amounts and Saudi place names as placeholders, which are being replaced with Egyptian pounds and Egyptian cities. Arabic/RTL is planned (see Open decisions).

---

## 1. The idea in one minute

- A **car owner** posts a journey they already planned: from, to, when, how many seats.
- A **rider** browses trips from their own city, or posts a request for the ride they need.
- The owner **approves every rider**. After acceptance, both sides can use the in-app chat to agree the pickup.
- Riders and car owners agree any contribution to fuel and tolls **privately**. Tawsila never sets, calculates, shows or collects a fare or price, and no payment passes through the app.
- Tawsila's long-term model is a **Free plan with ads**, a **Pro subscription** and rewards, not rides. None of this is in the first release (see section 5).

It is built for shared trips between places, one-off or repeated (regular commutes). The trip type is open: daily commutes and/or intercity trips are both being considered (see Open decisions). It is not a taxi service and not Uber: posts are only shown to people in the same city.

## 2. Who it is for

| Role | What they do |
| --- | --- |
| **Owner** | Offers seats on a trip they are already making, approves riders, picks the pickup point, rates riders after a ride |
| **Rider** | Finds a matching trip or posts a ride request, asks to join, rates the driver after a ride |
| **Both** | Most users do both, depending on the day |

## 3. How it works

1. **Sign in** with Google (iOS first). Create a profile and set a **home area** (the city and area you live in). Only the area name is public. You can browse before verifying your phone. Your phone number is verified with a WhatsApp code before your first ride offer or ride request.
2. **Pick how you use Tawsila** (rider, owner or both) and add your car if you drive.
3. **Find or post.**
   - Rider: open a trip on the Board, tap **Request seat**.
   - Rider: no match? **Post a ride request** and share it with your area or specific people (not in the first release).
   - Owner: **Post a trip** (one-off or regular weekly) in three steps: route and time, seats, audience.
   - Owner who sees a request: tap **Offer a ride** (not in the first release).
4. **Owner approves** the request. The seat diagram and seat management tools are not in the first release.
5. **Trip agreement.** Both sides confirm that any contribution to fuel and tolls is agreed privately between them. Tawsila sets no price and handles no money.
6. **Travel.** The exact pickup point is shared only after acceptance. Phone numbers stay hidden; coordinate in the in-app chat.
7. **Rate** each other after the ride. The rider rates the driver and the driver rates the rider. Ratings are not tied to any payment question.

In an open ride chat, an owner can also tap **"+" → Offer a ride** to offer one of their upcoming rides; the other person accepts or declines (decision D11, in the first release). Later, riders will also be able to ask one person directly: **"+" → Ask for a ride**. That is not in the first release.

## 4. The cost-sharing model (why it is non-commercial)

- **Private.** Riders and car owners agree any contribution to fuel and tolls directly with each other. Tawsila is not part of that agreement.
- **Tawsila sets no price.** Tawsila never sets, calculates, shows or collects a fare or price. The app has no price fields, bids or counter offers, and it does not suggest a share.
- **No payments in the app.** No cards, wallets, fees, receipts, refunds or payouts. Riders and owners settle any agreed amount directly (for example in cash).
- **Wording:** do not use "price", "fare", "earnings" or "fee" for a ride's cost.

The legal reasoning (Egyptian traffic rules and Law No. 87 of 2018) is the product owner's reading and **needs confirmation from a lawyer before launch**.

## 5. Business model

This is the long-term model. **None of it is in the first release** (the pilot MVP, see section 11).

- **Free plan:** the full core flow, with ads on the Board and My trips, and one active regular trip.
- **Tawsila Pro:** no ads, higher or unlimited posting and request allowances, full trip history, priority support.
- **Free trial:** 7 days by default (1 month for campaigns, 6 months for early members). Billed through Apple or Google.
- **Founding Lifetime Pro:** the first 1,000 users who complete 100 validated rides and have an active Pro subscription when they qualify get Lifetime Pro. The number of places is under review and may be lower.
- Safety features are never limited by plan. No boosted or sponsored trips.
- Ads never appear in chat, safety tools or the trip agreement.

## 6. Rewards and badges

Long-term model. **Not in the first release.**

- **Monthly discount on Pro**, earned from **shared kilometres or number of rides**, whichever comes first (placeholder levels):

  | Level | Needs | Discount |
  | --- | --- | --- |
  | Bronze | 100 km or 3 rides | 10% |
  | Silver | 300 km or 8 rides | 25% |
  | Gold | 600 km or 15 rides | 50% |

- **Badges** for riders (First ride, 10 rides, Green rider, Reliable rider) and owners (First trip shared, 10 trips driven, Regular commuter, Trusted owner). No cash value.
- **Abuse rules** (in the Rewards terms screen): only completed trips of 10 km or more confirmed by both people count; daily and weekly caps; a limit on the same two people; confirmation 48 hours after the trip; misuse can remove kilometres and badges, cancel a discount or suspend an account.

## 7. Trust, privacy and safety

- **Owner approves each rider.** Verified badges, ratings and reliability history.
- **Area-only visibility.** Only the area name is public; the exact pickup point is shared after acceptance. Phone numbers stay hidden; people coordinate in the in-app chat.
- **Consent-based direct messages.** People who are not trip contacts can send one message or one ride offer as a request until accepted (message requests are not in the first release). Users choose who can message them and whether they are visible in their city.
- **One-time location sharing** in chat (not in the first release; a snapshot, never live), approximate or exact according to the user's setting.
- **Polls** in chat (not in the first release), **reporting and blocking**, emergency contacts, trip sharing and an emergency call shortcut.

## 8. Screens (summary of the Figma design)

iOS (iPhone, 393 × 852), built on Apple's Human Interface Guidelines with a floating tab bar: **Board · Trips · Messages · Profile**.

| Area | Screens |
| --- | --- |
| **Onboarding** | Launch, welcome, profile, home area, role, add car, location and notification permissions. (The phone and verification-code screens are shown at the first ride offer or request, not during onboarding.) |
| **Board and join** | Nearby board (Offers / Requests), filters, trip detail (seat diagram not in the first release), request a seat, request sent, request accepted, owner profile, trip agreement |
| **Post a trip or request** | Route and time, seats, audience and review, post a request, published, manage requests, request detail, pickup point, share with specific people |
| **Regular trips** | My regular trips, new regular trip, schedule, seat manager, join all days or pick days |
| **My trips** | Upcoming, trip detail, cancel, rate (two-way, with no payment question), past trips |
| **Messages** | Inbox, chat, notifications, "+" menu (offer a ride; ask for a ride, share location and poll are not in the first release), message requests (not in the first release) |
| **Profile and settings** | Profile, edit, verification, vehicles, report, privacy and location, safety, notifications and language, messages and visibility, help |
| **Plans, ads and rewards** (long-term) | Plan and subscription, choose your plan, trial started, trial ending, ads and privacy, Board with ad, Rewards, shared trips, rewards terms, badges |
| **States** | Empty, offline, loading, request declined, trip cancelled by owner |
| **Tooltip tour** | A nine-step first-time tour of the main areas (not in the first release) |

Design tokens: SF Pro, brand green `#0B4D3B`, light and dark modes, an Apple-style component set (buttons, tab bar, chips, cards, seat diagram, plan card, ad card, chat bubbles and more).

## 9. Design concept

> A calm, trustworthy iOS app: warm paper, one deep green, and a native Apple feel. The green marks every action that moves a trip forward.

**Theme:** light and dark (both supported). **Platform:** iPhone, 393 × 852, built on Apple's Human Interface Guidelines.

Tawsila should feel like a neighbourhood notice board that happens to be a good iOS app, not a ride-hailing machine. The canvas is warm off-white, text is deep green-black, and a single forest green (`brand/primary`) carries every primary action, selected state, selected seat and confirmation. Surfaces separate through luminance (paper, white cards, grouped fills) and a very soft shadow, never through heavy borders or gradients. Everything uses native iOS patterns (floating tab bar, bottom sheets, segmented controls, system alerts) so it is instantly familiar.

### Colour tokens

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `brand/primary` | `#0B4D3B` | `#3DC796` | Primary buttons, selected tab, selected seat, links, confirmations |
| `brand/primary-pressed` | `#083A2D` | `#2FA97E` | Pressed state of primary actions |
| `brand/on-primary` | `#FFFFFF` | `#04241B` | Text and icons on the primary colour |
| `brand/tint` | `#E3F0EA` | `#10312A` | Soft green wash: selected chips, free seats, info and success banners, hero cards |
| `brand/sun` | `#F3E3C3` | `#3A3020` | Warm accent surface (use sparingly) |
| `bg/base` | `#FBFAF6` | `#000000` | Screen background (warm paper) |
| `bg/grouped` | `#F4F2EC` | `#000000` | Grouped list backgrounds |
| `bg/elevated` / `bg/elevated-2` | `#FFFFFF` | `#1C1C1E` / `#2C2C2E` | Cards, sheets, inputs |
| `label/primary` | `#14201B` | `#FFFFFF` | Main text |
| `label/secondary` | `#5E6A65` | `#A3AEA9` | Supporting text |
| `label/tertiary` / `label/quaternary` | `#8B958F` / `#C5CBC7` | `#6F7873` / `#3F4643` | Hints, disabled |
| `separator` | `#E4E1D8` | `#2C2C2E` | Hairlines |
| `fill/secondary` / `fill/tertiary` | `#EEECE5` / `#F4F2EC` | `#2C2C2E` / `#1C1C1E` | Inactive controls, progress tracks |
| `seat/free` / `seat/taken` / `seat/mine` | `#E3F0EA` / `#DAD7CE` / `#0B4D3B` | `#10312A` / `#3A3A3C` / `#3DC796` | Seat diagram states |
| `system/red`, `orange`, `yellow`, `green`, `blue` | iOS system colours | iOS dark variants | Destructive, warning, status and links; each red and orange has a soft `-tint` |
| `overlay/scrim` | `#000000` at ~40% | same | Dimmed background behind sheets |

### Typography

**SF Pro** (system font) with the iOS type scale: Large Title 34 Bold, Title 1 28 Bold, Title 2 22 Bold, Title 3 20 Semibold, Headline 17 Semibold, Body 17, Callout 16, Subheadline 15 (Regular and Semibold), Footnote 13 (Regular and Semibold), Caption 1 12, Caption 2 11 Medium. Dynamic Type friendly. Arabic and right-to-left are planned, so layouts use auto layout and can flip.

### Spacing, shape and depth

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40. Screen side gutter 16, card padding 16, gap between cards 12.
- **Radii:** 8 (small), 12, 16 (cards), 20, 28 (bottom sheets), full (pills, avatars, chips).
- **Touch targets:** at least 44 pt (small 36 pt buttons get a 44 pt hit area).
- **Depth:** `Elevation/Card` (0 / 2 / 12 blur, 8% green-black) and `Elevation/Sheet` (0 / -4 / 24 blur, 16% black). No gradients, no heavy shadows.

### Core components

- **Buttons:** Primary, Secondary, Outline, Destructive, Plain, each in Default and Disabled; a Small version for card actions. 52 pt tall, fully rounded.
- **Floating tab bar:** Board · Trips · Messages · Profile, with the active tab in green.
- **Nav bar:** Inline and Large title styles. **Segmented control:** 2 or 3 segments (Offers / Requests, Upcoming / Regular / Past).
- **Post card:** avatar, name, verified badge, rating, route with times, date, seats left, tags, in Offer and Request versions.
- **Seat diagram:** top view of Sedan, SUV or Van with free, taken and "your pick" seats.
- **Chat:** message bubbles, ride cards (offer or request), one-time location message, poll, message-request banners.
- **Plan card and ad card:** the Free and Pro plans, and the sponsored card shown on the Free plan.
- **Also:** chips, tags, badges (Verified, Pending, Confirmed, Declined, Completed, Cancelled), banners (Info, Warning, Success), text fields (Default, Focused, Filled, Error), list rows, toggles, route block, map preview slot, tour tooltip with spotlight.

### Do

- Use the green only for actions, selected states and confirmations, so it stays a signal.
- Keep money out of the app: Tawsila shows no price, fare, fee, earnings or cost share.
- Separate surfaces by background and soft shadow; keep the paper background behind white cards.
- Use native iOS patterns: bottom sheets for tools, system alerts for permissions, a floating tab bar.
- Show trust everywhere decisions are made: verified badge, rating, area name, reliability.

### Don't

- Don't show a price field, counter offer, "open to offers" toggle, receipt or payment button.
- Don't use gradients or shadows heavier than the two elevation styles.
- Don't introduce new hues beyond the palette and iOS system colours.
- Don't put ads in chat, safety screens or the trip agreement.
- Don't show exact pickup points or phone numbers before the owner accepts.

### Imagery and tone

No photography or stock art. People appear as initials avatars (with photo optional), the car as a seat diagram, and the route as text with a quiet map preview slot (the live map is not in the first release). Success and empty states use a single flat icon in a tinted circle. Copy is short, warm and neighbourly, and avoids commercial wording.

### Layout rhythm

Large title, then a segmented control, then a vertical feed of white cards on warm paper. Forms are grouped cards with 16 pt padding. Tools (filters, agreement, chat tools, ads consent) open as bottom sheets over a dimmed screen. The first-time tour spotlights one element at a time with a tooltip.

## 10. Concept under consideration: city communities

To postpone paying for a maps API in the MVP, every user could join a **predefined city community** at registration (detected from their location and confirmed). Destinations would come from a **predefined list of places and stops**, so the app needs no routing service. Matching "a car going near my destination" would use a stored "near" relation between places. Current screens would not change. Open questions: how fine communities should be (cities or neighbourhoods), whether a user can have a second community, and who maintains the place table.

## 11. First release: pilot MVP

### In (pilot MVP)

- **One configurable route only.** First candidate: 10th of Ramadan ↔ New Cairo, loaded as configuration data (not final).
- Post and discover rides (a ride can be repeated on weekdays), request a seat for one day or every weekday, accept or decline, cancel one day, chosen days or the whole ride, and expire.
- Push notifications.
- Minimal in-app 1-to-1 chat after a request is accepted: text messages and in-chat ride offers (a driver offers one of their upcoming rides; a seat is confirmed only if still free; no price). Phone numbers stay hidden. No media, polls, location or ask-for-a-ride. Report and block from chat.
- WhatsApp is used only to share a ride link, not to coordinate.
- Completion confirmation and no-show handling.
- Two-way rating: the rider rates the driver and the driver rates the rider. Written reviews are not included.
- Report and block.
- Event logging for the pilot measures.
- Sign-in with Google (iOS), profile, and phone verification by WhatsApp code before the first ride offer or request.
- **Platforms:** iPhone first. Android follows once the iPhone build is finalised. The public launch happens on both together.

### Out (not in the first release)

- Subscriptions, ads, rewards and badges, Founding Lifetime Pro.
- Seat diagram, tooltip tour, admin console, maps.
- Full regular-trip management (schedules, seat manager). A posted ride can still be repeated on weekdays, and a rider can join one day or every weekday.
- Live route map and live location tracking, area group chats, any in-app payment between users, Arabic right-to-left layouts (layouts are built to flip later), SMS fallback for phone verification.
- Posting a standalone ride request as a rider (riders request a seat on a posted ride instead).

Subscriptions, ads, rewards and Founding Lifetime Pro remain the long-term model. Payments between users are never part of Tawsila.

## 12. Open decisions

- Legal confirmation of the non-commercial model in Egypt (cost share only, no fee, no in-app money, subscription revenue).
- Pro price, trial lengths and currency (placeholder EGP 99 a month).
- Founding Lifetime Pro: the number of places (1,000) is under review and may be lower.
- Free plan limits (one active regular trip is a proposal).
- Ad network, consent flow and local ad rules.
- Egypt localisation: EGP, Egyptian cities and routes, emergency numbers, Arabic and right-to-left.
- Trip type: daily commutes and/or intercity trips. The earlier 60–120 km target is not decided.
- Apple subscription discounts for the rewards levels (promotional offers).
- Rewards levels and limits (placeholders until real usage data exists).

## 13. Where the detail lives

- **Figma:** "Tawsila – iOS App Design" (pages: Cover, Foundations, Components, Onboarding, Board & Join, Post a Trip, Regular Trips, My Trips, Messages, Profile & Safety, States, Tooltip Tour, MVP (pilot screens, TAW-28)).
- **BRD:** "Tawsila · Business Requirements Document (screen-level)" with every screen specified (purpose, entry and exit, content, behaviour, states, requirements), business rules BR-01 to BR-32, open decisions OD-01 to OD-24, and a traceability matrix.
- **MVP definition:** [docs/product/mvp.md](docs/product/mvp.md)

## Run the app

The mobile app lives in `apps/mobile` (Expo SDK 58, React Native, TypeScript). It includes Google sign-in on iOS, a Supabase account/session layer, four placeholder tabs (Board, Trips, Messages, Profile), light and dark themes, and shared loading, empty and error states. New accounts then complete onboarding (profile, consent, community and car-owner details, from TAW-4); ride logic is not implemented. iOS is the first target; Android is only checked by a bundle build at this stage.

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24 LTS | `.nvmrc` pins `24`. Expo SDK 58 supports Node 22.13+, 24.3+ and 26+. Node 25 is not supported (it is end-of-life); use 24 LTS. |
| npm | Ships with Node | |
| Xcode and iOS Simulator | macOS only | Needed for iOS. Install an iOS Simulator runtime in Xcode. |

If your default `node` is not 24, use a version manager that reads `.nvmrc` (for example `nvm use` or `fnm use`), or put Node 24 first on your `PATH`.

### Run

From the repository root:

```bash
cd apps/mobile
npm ci
npx expo start
```

Google sign-in needs a native development build: run `npx expo run:ios` for the iOS Simulator, or `npx expo run:ios --device` for a connected iPhone with the owner's Xcode signing configured. Xcode, a Simulator runtime and CocoaPods are required. Expo Go can render Welcome, but Google reports `unavailable`.

### Checks

Run these inside `apps/mobile`:

```bash
npx tsc --noEmit
npx expo lint
npm test
npx expo export --platform ios
npx expo export --platform android
```

### Notes

- **Debug states:** a "Debug states" row on the Profile tab opens a screen showing the loading, empty and error states. It is for development only, is hidden and redirects to Board in production builds, and opens one state at a time via the links it shows.
- **Design reference:** the Figma file "Tawsila – iOS App Design" owns the approved design. Theme values live in `apps/mobile/src/theme`, and notes on design decisions are in [`apps/mobile/DESIGN_NOTES.md`](apps/mobile/DESIGN_NOTES.md).

## How work is governed

Development is governed by the CLH Mobile framework in [BCMHub/CLH-Mobile](https://github.com/BCMHub/CLH-Mobile).
Every change needs an approved Notion card. See [AGENTS.md](AGENTS.md).

## Sign-in and accounts

TAW-7 revision 7 delivers Google sign-in on iOS with an SDK-authoritative Supabase session and a trigger-created `public.accounts` row. New accounts start at `needs_profile`; tabs require the server-confirmed `profile_completed_at`. TAW-4 (merged) owns profile/consent and its trusted completion function. TAW-5 owns phone verification, ride gating and duplicate-phone handling. Clients can read only their own account and cannot write account fields.

[Local setup and the account/session contract](supabase/README.md) cover Docker or Colima, `supabase start`, `supabase db reset`, `supabase test db`, the concurrency script, every variable in `apps/mobile/.env.example`, and the database-side test-only profile seed. Copy that example to an ignored `.env` using local stack settings. The team's Node environment file sets `EXPO_NO_DOTENV=1`; unset it to let Expo load `.env`. The owner already created a Free-tier hosted test project with Google enabled (Web client first, iOS client second, nonce checking ON). Keys remain in local environment files only; this batch does not use the hosted project.

Every internal sign-out is local and verifies storage removal. An expired session offline can survive the SDK's local sign-out call (R2), so the app clears the stored manifest and chunks itself when needed. A document-directory marker distinguishes a fresh installation from an update and requires sign-in after reinstall even if Keychain credentials remain. Physical-device sign-in and reinstall/update verification is not yet verified: needs the owner's device.

Android sign-in, Sign in with Apple, logout, account deletion and store-submission needs are deferred to separate cards. The design source is TAW-11, Figma section `174:365`; approved deviations are a text wordmark, no Sign out, no Choose another option and a profile hand-off screen not yet designed. See [design notes](apps/mobile/DESIGN_NOTES.md).
