# Tawsila

**Peer-to-peer, non-commercial carpooling for people travelling the same way.**

Tawsila replaces the WhatsApp and Facebook groups people use today to find a shared ride. A car owner offers empty seats on a trip they were already going to make. People going the same way ask to join and share the cost. Nobody is hired and nobody profits: the app calculates a fixed, fair cost share and the two people settle it directly.

> Status: design phase (iOS app, Figma designs and a screen-level BRD). The designs use SAR amounts and Saudi place names as placeholders. Egyptian pounds, Egyptian cities and Arabic/RTL are planned (see Open decisions).

---

## 1. The idea in one minute

- A **car owner** posts a journey they already planned: from, to, when, how many seats.
- A **rider** browses trips from their own city, or posts a request for the ride they need.
- The owner **approves every rider**. Either side can start a chat to agree the pickup.
- Tawsila shows one **suggested cost share** per person. It is a guide calculated from fuel and tolls, it cannot be edited or negotiated, and the two people pay each other directly. Tawsila never touches the money.
- Tawsila earns from an optional **Pro subscription**, not from rides.

It is built for long-distance trips between cities, one-off or repeated every week (regular commutes). It is not a taxi service and not Uber: posts are only shown to people in the same city.

## 2. Who it is for

| Role | What they do |
| --- | --- |
| **Owner** | Offers seats on a trip they are already making, approves riders, manages seats, picks the pickup point |
| **Rider** | Finds a matching trip or posts a ride request, asks to join, rates the trip |
| **Both** | Most users do both, depending on the day |

## 3. How it works

1. **Sign up** with a phone number, verify it, create a profile, and set a **home area** (the city and area you live in). Only the area name is public.
2. **Pick how you use Tawsila** (rider, owner or both) and add your car if you drive.
3. **Find or post.**
   - Rider: open a trip on the Board, tap **Request seat**.
   - Rider: no match? **Post a ride request** and share it with your area or specific people.
   - Owner: **Post a trip** (one-off or regular weekly) in three steps: route and time, seats, audience.
   - Owner who sees a request: tap **Offer a ride**.
4. **Owner approves** the request. Seats can be managed on a seat diagram, including seats taken outside the app.
5. **Trip agreement.** Both sides confirm: the share is a fair split, there is no negotiation, and they settle directly.
6. **Travel.** The exact pickup pin and phone number are shared only after acceptance.
7. **Rate** the trip and say whether the suggested share was settled.

Riders can also ask one person directly from a chat: **"+" → Ask for a ride** (and owners **Offer a ride**).

## 4. The cost-sharing model (why it is non-commercial)

```
Suggested share per person = (fuel cost of the trip + tolls) ÷ (people on board, driver included)
```

- **Locked.** Nobody can enter a price, bid, or counter. There are no price fields, "open to offers" toggles or counter offers.
- **Inputs are controlled by Tawsila:** route distance, a vehicle preset (sedan, SUV, van), the published fuel price and a toll table.
- **Recalculated** when seats change. It can fall as more people join, never rise for a rider who already agreed.
- **No payments in the app.** No cards, wallets, fees, receipts, refunds or payouts. Riders and owners settle directly (for example in cash).
- **Wording:** always "suggested share", never price, fare, earnings or fee.

The legal reasoning (Egyptian traffic rules and Law No. 87 of 2018) is the product owner's reading and **needs confirmation from a lawyer before launch**.

## 5. Business model

- **Free plan:** the full core flow, with ads on the Board and My trips, and one active regular trip.
- **Tawsila Pro:** no ads, unlimited regular trips, full trip history, priority support.
- **Free trial:** 7 days by default (1 month for campaigns, 6 months for early members). Billed by Apple.
- Safety features are never limited by plan. No boosted or sponsored trips.
- Ads never appear in chat, safety tools or the trip agreement.

## 6. Rewards and badges

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
- **Area-only visibility.** Only the area name is public; the exact pickup point and phone are shared after acceptance.
- **Consent-based direct messages.** People who are not trip contacts can send one message or one ride offer as a request until accepted. Users choose who can message them and whether they are visible in their city.
- **One-time location sharing** in chat (a snapshot, never live), approximate or exact according to the user's setting.
- **Polls** in chat, **reporting and blocking**, emergency contacts, trip sharing and an emergency call shortcut.

## 8. Screens (summary of the Figma design)

iOS (iPhone, 393 × 852), built on Apple's Human Interface Guidelines with a floating tab bar: **Board · Trips · Messages · Profile**.

| Area | Screens |
| --- | --- |
| **Onboarding** | Launch, welcome, phone, verification code, profile, home area, role, add car, location and notification permissions |
| **Board and join** | Nearby board (Offers / Requests), filters, trip detail with seat diagram, request a seat, request sent, request accepted, owner profile, trip agreement |
| **Post a trip or request** | Route and time, seats and cost share, audience and review, post a request, published, manage requests, request detail, pickup point, share with specific people |
| **Regular trips** | My regular trips, new regular trip, schedule, seat manager, join all days or pick days |
| **My trips** | Upcoming, trip detail, cancel, rate (with settled-share check), past trips |
| **Messages** | Inbox, chat, notifications, "+" menu (share location, offer or ask for a ride, poll), message requests |
| **Profile and settings** | Profile, edit, verification, vehicles, report, privacy and location, safety, notifications and language, messages and visibility, help |
| **Plans, ads and rewards** | Plan and subscription, choose your plan, trial started, trial ending, ads and privacy, Board with ad, Rewards, shared trips, rewards terms, badges |
| **States** | Empty, offline, loading, request declined, trip cancelled by owner |
| **Tooltip tour** | A nine-step first-time tour of the main areas |

Design tokens: SF Pro, brand green `#0B4D3B`, light and dark modes, an Apple-style component set (buttons, tab bar, chips, cards, seat diagram, cost share guide, plan card, ad card, chat bubbles and more).

## 9. Concept under consideration: city communities

To postpone paying for a maps API in the MVP, every user could join a **predefined city community** at registration (detected from their location and confirmed). Destinations would come from a **predefined list of places and stops**, with distances and tolls stored in a table, so the cost share needs no routing service. Matching "a car going near my destination" would use a stored "near" relation between places. Current screens would not change. Open questions: how fine communities should be (cities or neighbourhoods), whether a user can have a second community, and who maintains the place, distance and toll tables.

## 10. Phase 1 scope

**In:** onboarding and profile, nearby board, posting trips and requests, owner approval, locked cost share, trip agreement, pickup points, seat diagram, regular trips, ratings, cancellations, direct messages with message requests, one-time location sharing, ride offers and polls, notifications, verification, safety and reporting, privacy settings, Free and Pro subscription with ads and trial, rewards and badges, tooltip tour.

**Out:** live route map and live location tracking, area group chats, administrator web console, any in-app payment between users, Arabic right-to-left layouts (layouts are built to flip later).

## 11. Open decisions

- Legal confirmation of the non-commercial model in Egypt (cost share only, no fee, no in-app money, subscription revenue).
- Fuel price and toll data: who maintains it and how often.
- Pro price, trial lengths and currency (placeholder EGP 99 a month).
- Free plan limits (one active regular trip is a proposal).
- Ad network, consent flow and local ad rules.
- Egypt localisation: EGP, Egyptian cities and routes, emergency numbers, Arabic and right-to-left.
- Apple subscription discounts for the rewards levels (promotional offers).
- Rewards levels and limits (placeholders until real usage data exists).

## 12. Where the detail lives

- **Figma:** "Tawsila – iOS App Design" (pages: Cover, Foundations, Components, Onboarding, Board & Join, Post a Trip, Regular Trips, My Trips, Messages, Profile & Safety, States, Tooltip Tour).
- **BRD:** "Tawsila · Business Requirements Document (screen-level)" with every screen specified (purpose, entry and exit, content, behaviour, states, requirements), business rules BR-01 to BR-32, open decisions OD-01 to OD-24, and a traceability matrix.
