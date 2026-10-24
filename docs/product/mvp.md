# Tawsila MVP Definition

## 1. Confirm the MVP

### 1.1 MVP Purpose

Tawsila is a community-based carpooling platform that connects people who are already planning to travel with other people going in the same direction.

Tawsila does not provide transportation, employ drivers, determine ride fares, or collect ride payments.

Tawsila charges users for access to the platform through a subscription model. Any contribution toward fuel, tolls, or other journey costs is agreed directly between the rider and the car owner outside the Tawsila platform.

The MVP must prove that Tawsila can safely and conveniently connect trusted users and enable them to arrange a successful shared journey.

---

## 1.2 First Users

### Car Owners

People who:

- Already intend to make a journey.
- Have one or more available passenger seats.
- Are willing to share the journey with verified Tawsila members.
- May travel regularly or occasionally.

Typical examples include:

- Employees commuting between cities.
- University students or staff.
- People making recurring weekend journeys.
- Residents of the same community travelling toward common destinations.

### Riders

People who:

- Need to travel in the same direction as an existing journey.
- Want to find a suitable car owner through their community.
- Are willing to coordinate directly with the car owner regarding pickup, drop-off, and cost sharing.

A user can act as both a car owner and rider depending on the journey.

---

## 1.3 Initial Launch Market

The MVP launches in **Egypt**.

Rather than attempting nationwide coverage immediately, Tawsila will initially focus on selected communities and commonly travelled intercity or commuter routes.

The platform should therefore be designed to support:

- Community-based membership.
- City or area-based origin and destination selection.
- Journeys approximately within the initial target range of **60–120 km**, without technically preventing shorter journeys where appropriate.

Communities, cities/areas, origins, destinations, and available routes are dynamic, administratively configurable data rather than a fixed list embedded in the app. The exact communities and routes seeded for the pilot may be chosen later; their selection does not block implementation of the configurable location model.

---

## 1.4 What Is a Successful Shared Ride?

For the MVP, a successful shared ride means:

1. A phone-verified car owner posts a planned journey.
2. Another phone-verified user discovers the journey.
3. The rider submits a request to join.
4. The car owner accepts the request.
5. A private in-app ride chat becomes available.
6. Both users coordinate pickup, timing, and journey logistics.
7. The journey takes place.
8. The journey is marked as completed.
9. Users can report or block the other party if a safety or conduct issue occurs.

The main MVP success flow is:

**Phone-Verified User → Ride Posted → Match Requested → Match Accepted → Private Ride Chat → Completion Confirmed**

Tawsila does not need to verify or process the financial cost-sharing arrangement between the two users.

---

## 1.5 Subscription Model

Tawsila's commercial model must remain clearly separated from individual rides.

### Tawsila charges for:

Access to the Tawsila platform and its services.

Possible subscription benefits can later include:

- Posting journeys.
- Requesting rides.
- Community access.
- Notifications.
- Enhanced matching.
- Additional trust or profile features.

### Tawsila does not:

- Determine the price of a journey.
- Display an official Tawsila ride fare.
- Collect passenger payments for journeys.
- Transfer money to car owners.
- Take a percentage of journey payments.
- Guarantee reimbursement of journey expenses.

Car owners and riders may privately agree on sharing journey-related expenses.

### Launch-Phase Subscription Policy

Tawsila's MVP architecture must support configurable subscription entitlements and usage counters from day one.

However, the initial launch objective is to build an active user base and create sufficient ride liquidity. Commercial limits must therefore not unnecessarily restrict early adoption.

During the launch and user-acquisition phase:

- Users may create accounts, complete profiles, join communities, browse rides, and participate in posting/requesting within their configured free-tier allowances. Accepted-ride chat and WhatsApp sharing are not commercially limited.
- Free users have configurable limits on both ride requests as Joiners and ride posts as Car Owners. Pro provides higher or unlimited allowances for each activity. Exact limits and reset periods can be finalized before public monetization.
- WhatsApp sharing and accepted-ride chat should not be commercially limited.
- Users should be allowed to act as both a Joiner and a Car Owner under the same account.
- Subscription entitlements and counters should still exist technically so commercial limits can be activated later without redesigning the application.

### Pro Subscription and Purchase Management

The MVP includes a Pro subscription representing ongoing access to platform capabilities. Its primary benefit is higher or unlimited role-specific allowances: ride-post limits as a Car Owner and ride-request limits as a Joiner. Free users have configurable limits in both roles. Exact counts and reset periods may be finalized before public monetization.

For store-distributed apps, use Apple In-App Purchase / StoreKit on iOS and Google Play Billing on Android unless a confirmed store-policy exception applies. RevenueCat is the recommended cross-platform entitlement layer; the final vendor decision belongs in technical architecture. Do not build a custom subscription state engine without a documented reason.

Before purchase, users must see the subscription name, benefits, price, billing period, renewal terms, whether a subscription is required for any feature, trial/promotion terms, and how to manage or cancel through the relevant store. Provide an in-app path explaining where subscriptions are managed.

Reference current platform rules during implementation: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/); [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) and [Google Play Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533).

Entitlement behavior:

- Active subscription: Pro entitlements are active.
- Store-reported grace period or billing retry with entitlement: preserve Pro access according to the store/provider state.
- Account hold or inactive entitlement: suspend Pro-only features.
- Expiration: return the user to the currently available Free/Launch tier. Do not delete the account, profile, ride/chat history, safety records, or completed-ride count because of expiration.

The subscription model should distinguish between:

- **Joiner activity:** free and Pro ride-request allowances, tracked separately.
- **Car Owner activity:** free and Pro ride-post allowances, tracked separately.
- **Ride capacity:** number of passengers who can join a specific ride, based on the vehicle's available seats.

Ride capacity is not a subscription limit.

Commercial usage limits and safety limits must also be treated separately:

- **Commercial limits** control plan entitlements and may be relaxed during launch.
- **Safety and anti-spam limits** remain active from launch to prevent abuse, excessive requests, automated spam, or suspicious behavior.

A suitable launch concept is **Founding Member / Launch Access**, where free-tier limits are configured generously while Tawsila builds network activity. Free users remain limited in both roles; Pro provides higher or unlimited role-specific allowances.

### Founding 1,000 Lifetime Pro Program

Tawsila will include a launch reward called **Founding 1,000 Lifetime Pro**.

The first 1,000 Pro users who reach **100 validated completed Tawsila rides** receive Lifetime Pro access.

Qualification rules:

- Rides completed as a **Joiner**, **Car Owner**, or a combination of both count toward the target.
- The user must be an active Pro subscriber when qualifying.
- Only validated rides in the `COMPLETED` state count.
- Cancelled, rejected, duplicated, fraudulent, manipulated, or suspicious rides do not count.
- A ride counts at most once for each accepted participant: once for its Car Owner and once for each accepted Joiner.
- At 100 eligible rides, the user becomes `FOUNDER_ELIGIBLE`; anti-abuse validation runs before an award.
- Founder-slot allocation must be atomic so no more than 1,000 users receive the award. Once all slots are awarded, the program closes.

The MVP should support:

- A completed-ride counter per user.
- Founding progress display, such as `63 / 100 rides completed`.
- Remaining Founding places display where appropriate.
- Automatic eligibility detection and progress display.
- Lifetime Pro entitlement after successful validation and slot allocation.
- Administrative review of suspicious qualification cases, with an audit trail for decisions and overrides.

The Founding 1,000 program is separate from promo codes.

Promo codes may later be used for:

- Discounts.
- Trial extensions.
- Referral campaigns.
- Partner/community campaigns.

Promo codes are not required to qualify for Founding 1,000 Lifetime Pro.

---

# 2. Key User Journeys

## Journey 1 — Account Creation

User:

1. Installs Tawsila.
2. Signs in with Google or Apple (Apple on iOS only). Signing in is required before browsing; there is no guest or anonymous access.
3. Accepts Terms of Use and Privacy Policy.
4. Creates their basic profile.
5. Selects or confirms their community.
6. Confirms they are at least 18 years old.
7. After signing in and completing basic onboarding, can browse available rides and explore the platform without completing phone OTP verification.
8. Phone OTP verification (WhatsApp first, with a controlled SMS fallback) becomes mandatory before the user submits their first ride request or publishes their first ride.
9. Once verified, the user remains verified unless security rules require re-verification.

Minimum profile information should include:

- First and last name.
- Profile photo.
- Basic location/community.
- Mobile number, collected and verified only at the first ride request or publish (not at sign-in or onboarding).
- Precise verification status, such as `Phone Verified`; do not use a generic `Verified` label unless the scope of verification is clear.

Sensitive information must not automatically be visible to other users.

---

## Journey 2 — Safety and Trust Verification

Before a user can participate in shared journeys, Tawsila should establish a minimum trust level.

### Deferred Phone OTP Rule

Phone OTP verification is intentionally deferred until the user attempts their first trust-sensitive action.

Users may complete the following before phone verification:

- Install and open the app.
- Sign in with Google or Apple.
- Accept Terms of Use and Privacy Policy.
- Create a basic profile.
- Select or confirm their community.
- Browse available rides.
- Explore ride details.

Phone OTP verification becomes mandatory before either of the following actions:

- Submitting the user's first ride request as a Joiner.
- Publishing the user's first ride as a Car Owner.

Whichever action happens first triggers phone verification.

Once successfully verified, the user remains verified unless Tawsila's security rules require re-verification.

The purpose of this approach is to:

- Reduce onboarding friction.
- Avoid OTP cost for users who install but never actively use the platform.
- Verify only users who are about to participate in an actual ride transaction or matching process.
- Maintain trust and accountability for active participants.

For the smallest pilot, phone verification is the minimum active-participant identity check. Do not require government ID or selfie verification unless legal/safety review establishes that it is necessary. Keep the verification model extensible for future levels.

Users must confirm they are at least 18 years old during onboarding. A Car Owner must provide vehicle make, model, type, colour, and passenger-seat capacity before publishing. A vehicle photo is optional for the initial pilot. Do not display the plate number publicly. Whether Tawsila must privately validate vehicle ownership/registration remains subject to local legal and safety review.

Possible car-owner information includes:

- Vehicle make.
- Vehicle model.
- Vehicle type.
- Vehicle colour.
- Passenger seat capacity.
- Optional vehicle photograph.

Vehicle plate numbers must not be publicly exposed. Define the visibility of profile, community, vehicle, and contact details before the corresponding cards are marked `READY`.

---

## Journey 3 — Post a Ride

A car owner creates a planned journey by providing:

- Origin.
- Destination.
- Date.
- Departure time.
- Available seats.
- Vehicle.
- Optional pickup information.
- Optional journey notes.

The journey represents a trip the car owner already intends to make.

The car owner publishes the ride and waits for requests.

After publishing, the car owner can also share the ride externally through WhatsApp.

---

## Journey 4 — Discover a Ride

A rider:

1. Selects origin.
2. Selects destination.
3. Selects travel date.
4. Searches available journeys.
5. Views matching rides.
6. Opens a ride.
7. Reviews the car owner profile and journey information.
8. Requests to join.

Search results should initially prioritize:

- Relevant destination.
- Relevant origin/community.
- Travel date and time.
- Available seats.

Advanced route optimization is outside the MVP.

---

## Journey 5 — Create or Share a Ride Request

If a rider cannot find a suitable ride, the rider can create a ride request containing:

- Origin.
- Destination.
- Travel date.
- Preferred time or time range.
- Number of seats required.
- Optional journey notes.

The rider can share the request through WhatsApp.

The shared content should include a concise journey summary and a Tawsila deep link without exposing sensitive personal information.

---

## Journey 6 — Request a Ride

The rider selects an available journey and submits a request.

The request may include:

- Number of seats required.
- Pickup preference.
- Optional short message.

The car owner receives a notification.

The request remains pending until accepted, declined, cancelled, or expired.

---

## Journey 7 — Accept or Decline

The car owner reviews:

- Rider profile.
- Verification status.
- Community.
- Requested number of seats.
- Optional message.

The car owner can:

- Accept.
- Decline.

If accepted:

- The server checks remaining capacity and accepts the request and decrements available seats atomically. If seats have already been allocated, acceptance fails safely and the user receives updated availability.
- Both users receive confirmation.
- A private ride chat becomes available.

---

## Journey 8 — Private Ride Chat

The MVP includes basic in-app 1-to-1 messaging between the accepted rider and car owner.

Chat is available only after a ride request has been accepted.

### MVP chat capabilities

- Text messages only.
- One-to-one conversation.
- Conversation linked to a specific ride.
- Push notification for new messages.
- Access to report/block functions.
- Conversation archived or closed after the ride is completed or cancelled.

### Out of scope for MVP chat

- Group chat.
- Voice notes.
- Photos or file attachments.
- Reactions.
- Read receipts.
- Typing indicators.
- Voice or video calling.
- Public usernames or open messaging.

Phone numbers are not automatically exposed through the chat.

The chat is intended for coordination of:

- Pickup point.
- Pickup time.
- Drop-off point.
- Delays.
- Landmarks.
- Journey logistics.

Users may privately agree on journey-cost sharing, but Tawsila does not process or guarantee those arrangements.

Tawsila does not set fares, collect or transfer ride payments, guarantee reimbursement, enforce cost-sharing agreements, issue ride-cost refunds, or arbitrate ordinary expense-sharing disagreements. Safety or misconduct connected to a cost discussion may still be reported, but an ordinary difference in expected contribution is not a Tawsila fare dispute. A review of whether a ride qualifies for Founding 1,000 is separate from any ride-cost arrangement.

---

## Journey 9 — Journey Completion

Passing the planned journey time does not by itself mean the journey was completed. Use the following lifecycle:

`PUBLISHED → REQUESTED → ACCEPTED → SCHEDULED → AWAITING_CONFIRMATION → COMPLETED`

Terminal or review states include `CANCELLED`, `NO_SHOW`, `COMPLETION_REVIEW`, and `EXPIRED`. After the scheduled journey time, ask each accepted Joiner first whether the ride took place: Yes, No, or Report issue. The Car Owner must also confirm; both sides' confirmations are required. `COMPLETION_REVIEW` concerns conflicting or missing completion confirmations, not a disagreement about ride costs.

- If the Car Owner and every accepted Joiner confirm Yes, mark the ride `COMPLETED` and count it once for each eligible participant.
- If a participant reports No, a no-show, or a safety issue, do not complete or count the ride automatically; route it to the corresponding cancellation/no-show/completion-review flow and create a separate safety report if requested.
- If some participants confirm Yes and others do not respond, keep it pending through a configurable reminder/response window. Do not count it toward Founding 1,000 unless all participants confirm or an authorized Trust & Safety review validates completion.
- Preserve a unique participation record so a ride cannot count more than once for the same user.

Cancellation is available to the Car Owner and Joiner before completion and records actor, time, and reason. There are no financial penalties in the MVP. Ride requests expire when the ride departs, is cancelled or full, the Car Owner declines, or the requester cancels. A published ride is no longer available after departure, cancellation, or allocation of all seats.

Ratings and reviews are outside the agreed MVP. Later versions may introduce:

- Reliability scores.
- No-show records.

These are not required for the first MVP release unless later approved.

---

## Journey 10 — Report a User

At any appropriate stage, a user must be able to report another user.

Initial report categories may include:

- Unsafe behaviour.
- Harassment.
- Fraud or misleading information.
- Inappropriate communication.
- Fake identity.
- No-show.
- Spam.
- Other.

The report should create an internal case with a case ID for the **Trust & Safety team**, which owns moderation. At launch, the team must review evidence, record decisions, apply immediate restrictions where warranted for serious safety concerns, and notify users of an appropriate outcome. Admin tools must support warnings, temporary suspension, permanent bans, and restrictions on posting or requesting rides. Chat evidence may be reviewed only by authorized personnel where permitted by the applicable privacy rules and published policy.

---

## Journey 11 — Block a User

A user can block another user.

After blocking:

- The blocked user cannot directly interact with the blocker.
- New chat messages and direct interactions are prevented, and future matching between the two is prevented.
- Existing safety reports remain available to administrators.

Blocking should be private.

The blocked user should not be told who blocked them.

---

## Journey 12 — Share on WhatsApp

WhatsApp sharing is an explicit MVP acquisition and marketing capability.

Users can share:

- A published ride.
- A ride request.

The shared message should contain:

- Tawsila branding/name.
- Origin.
- Destination.
- Date.
- General departure time or time range.
- Number of available/requested seats where appropriate.
- A Tawsila deep link.

The shared message must not expose:

- Mobile number.
- Home address.
- Sensitive profile information.
- Identity-document information.

If the recipient already has Tawsila, the deep link should open the relevant ride or request.

If the recipient does not have Tawsila, the link should lead to the appropriate app-download or landing experience.

After installation or registration, return the user to the originally shared content if it is still valid. Resolve each link against the current server state. If the ride is full, cancelled, or expired, explain that state and offer current alternatives. Shared links must not expose phone numbers, exact home addresses, private profile details, chat content, or identity documents.

This creates an MVP growth loop:

**Post or Request → Share on WhatsApp → New User Opens Tawsila → Registers → Participates**

WhatsApp is used for **sharing and acquisition**. In-app Tawsila chat is used for **coordination after acceptance**.

### Link state handling

- Available ride/request: show it and allow the appropriate action.
- Full ride: explain it is full and offer similar rides or creating a ride request.
- Cancelled ride: explain it is unavailable and offer available rides or creating a request.
- Expired ride: explain it has departed/expired and offer current alternatives.
- New user: allow install/open and basic onboarding, then return to the shared content if it remains valid.

Resolve link state from current server data, not from the original share payload. Do not expose phone numbers, exact home addresses, private profile details, or chat through deep links.

---

# 3. Safety and Privacy Decisions Required Before Implementation

These questions must be resolved before the relevant cards are marked `READY`.

The hardening recommendations resolve the default MVP behavior, while these launch-specific details remain open and must not be silently assumed:

- How community membership is confirmed for community-restricted participation. The specific pilot communities/routes are dynamic admin-configured data and can be selected later.
- The exact configurable response/reminder window and final rule when a ride participant does not respond. Completion requires confirmation by the Car Owner and each accepted Joiner; the Joiner is prompted first.
- The numeric Free and Pro limits and reset periods for Car Owner ride posts and Joiner ride requests. The benefit structure is agreed: Pro provides higher or unlimited allowances in both roles.
- Whether vehicle ownership/registration needs private validation after local safety/legal review.
- Retention periods, account-deletion exceptions, hosting/transfer review, and any other details required by Egypt-specific legal review.
- The user contact channel and escalation coverage for urgent reports. The Trust & Safety team owns moderation.
- Whether the first release includes a non-binding estimated cost-share guidance feature. Any future estimate must be clearly optional, informational, and not a Tawsila fare or required payment; users remain responsible for agreeing directly. Automated fuel/toll calculations are outside the current MVP scope pending an approved product card.

## Identity

For the smallest pilot, phone verification is required before a user's first ride post or request. Government ID and selfie checks are deferred unless local legal/safety review requires them. Model verification levels explicitly and label them precisely; do not imply a full identity check when only a phone number was verified.

Users must confirm they are at least 18 years old during onboarding.

---

## Community Verification

Define how Tawsila confirms community membership before community-restricted participation. The initial pilot may use an administratively configured community selection, but the method must be decided before those implementation cards are `READY`.

Home addresses should never be exposed to other users.

The platform should store only the minimum location information required for matching and verification.

Community should be treated as a first-class product/database entity rather than only a location field.

---

## Contact Information

Recommended MVP rule:

**No direct contact details before a ride request has been accepted.**

Even after acceptance, phone numbers should not be automatically disclosed because users can coordinate through Tawsila chat.

---

## Messaging

Confirmed MVP decision:

**Tawsila includes basic in-app 1-to-1 chat after a ride request is accepted.**

This provides:

- Better privacy.
- Controlled communication.
- Reporting capability.
- Blocking capability.
- Better evidence for safety reports and conduct incidents.

At launch, users can report from chat and block the other participant. Limit chat access to participants and authorized moderation staff when needed for safety/support and allowed by published policy and applicable law.

---

## Moderation and Safety Operations

Before a public pilot, the Trust & Safety team must have a basic case workflow: report submission, case ID and assignment, evidence review, urgent restrictions for serious concerns, recorded outcome, and appropriate user notification. Admin capabilities must include warning, temporary suspension, permanent ban, and disabling ride posting or requesting. Response-time SLAs may be set later, but the user contact channel and urgent-report escalation must be defined before launch.

---

## Privacy and Data Handling

Collect only data needed for account operation, matching, safety, subscription management, support, and fraud prevention. Define what is visible to the public, matched users, accepted participants, and authorized administrators. Do not expose phone numbers or exact home addresses to other users.

Before public launch, define retention periods for accounts, chat, rides, reports, and safety records; account-deletion behavior; and which records are deleted, anonymized, or retained for a documented legal, fraud, or safety reason. Enforce sensitive access in backend authorization (including Supabase Row Level Security if Supabase is selected), not only in the mobile UI. Review data handling, hosting, and transfer arrangements for each production vendor, including backend, subscription, OTP, push, and analytics services.

Obtain Egypt-specific privacy and regulatory legal review before privacy-sensitive implementation cards are treated as launch-ready.

---

## Location

Confirmed MVP decision:

**Google Maps services are not included in the MVP.**

The MVP will use structured location data such as:

- Community.
- City.
- Area.
- Predefined origins.
- Predefined destinations.
- Optional pickup/drop-off text notes.

The database should still support latitude and longitude fields for future use.

### Out of scope for MVP

- Google Maps integration.
- Live maps.
- Route drawing.
- Navigation.
- Real-time location tracking.
- Automatic route optimization.
- Google-powered distance calculations.
- Live location sharing.

Core principle:

**Location data: yes. Google Maps dependency: no.**

---

## Emergency Support

The platform must clearly distinguish between:

- Reporting something to Tawsila.
- Contacting emergency services.

Tawsila should not imply that it operates an emergency response centre.

---

# 4. Explicitly Out of Scope for MVP

To prevent scope creep, the following remain outside the MVP:

- Tawsila processing ride payments.
- Tawsila determining ride prices.
- Driver earnings.
- Commission per ride.
- Full ride-hailing functionality.
- On-demand taxi matching.
- Google Maps services.
- Live maps.
- Real-time driver tracking.
- Live location sharing.
- Automatic route optimization.
- Dynamic pricing.
- Fuel-cost calculations.
- AI matching.
- Corporate transport management.
- Loyalty programmes.
- Advanced ratings algorithms.
- Wallets.
- Escrow.
- International expansion.
- Advertising platform.
- Advanced gamification.
- Carbon-credit marketplace.
- Complex referral programmes.
- Advanced promo-code campaign management.
- Group chat.
- Voice/video calls.
- Media attachments in chat.
- Restrictive commercial usage caps that materially reduce launch adoption.

Features may be added later only through approved Notion product cards.

The current MVP does not calculate ride expenses. If a later approved card adds optional cost-share guidance, it must be clearly identified as an estimate for information only; it must not become an official fare, payment request, guarantee, or arbitration mechanism.

## MVP Scope Priority

### Launch blockers for a public pilot

- Account creation, Terms and Privacy acceptance, basic profile, community selection, and 18+ confirmation.
- Phone OTP before the first ride post or request.
- Vehicle information before a Car Owner publishes.
- Ride posting/discovery/request, accept/decline, server-protected seat allocation, cancellation, expiry, and completion confirmation/no-show handling.
- Report, block, admin review, suspension/ban capability, and a basic moderation process.
- Privacy notice, account deletion, and basic backend data access controls.
- Subscription entitlement architecture, including configurable Free limits and higher Pro limits for both roles.

### Launch required for the public MVP

- Basic accepted-ride text chat and push notifications.
- WhatsApp sharing and deep links for rides and ride requests, including full/cancelled/expired states.
- Store subscription purchase flow, Free Launch Access configuration, Pro entitlement, and Founding 1,000 progress/slot tracking.
- Basic admin review of Founding 1,000 eligibility.

These items are not blockers for the first internal technical slice unless the slice specifically depends on them.

### Post-launch

- Government ID or selfie verification unless required by legal/safety review.
- Advanced vehicle verification, ratings, reviews, reliability scores, maps, route optimization, live tracking, AI matching, rich/group chat, loyalty, advanced referrals/promotions, and corporate transport features.

## Smallest First Pilot

Begin with 1–2 communities and a small set of predefined routes loaded through the admin-configurable location model, for users aged 18+, with phone verification before first participation, and no ride payments or Tawsila-set fares. These pilot locations are seed data, not fixed application configuration. The pilot should validate:

- Discover/post → request → accept → coordinate → ride → confirm completion.
- Whether users understand that expense sharing is private between participants.
- Whether WhatsApp sharing brings new users and whether in-app chat is sufficient.
- Whether reporting and blocking work operationally and users return for repeat rides.

Public launch remains gated on Egypt-specific privacy/legal review, store subscription setup and entitlement validation, and an operating safety/moderation process.

---

# 5. Product Requirement Handoff

Approved MVP requirements will be converted into implementation cards using the existing approved orchestration framework.

This MVP document defines **product scope and product requirements only**.

Implementation governance, repository workflow, context management, worktree strategy, validation harnesses, Notion card workflow, and agent orchestration are governed by the existing orchestration framework and are intentionally not duplicated here.

---

# 6. Technical Product Foundation

Only technical decisions that directly affect the Tawsila product are included in this MVP.

## Mobile Application

Recommended direction:

**React Native + Expo**

This supports:

- iOS.
- Android.
- Fast device testing.
- Shared codebase.

---

## Backend Product Capabilities

The backend must support:

- Authentication.
- User profiles.
- Communities.
- Vehicles.
- Rides.
- Ride requests.
- Ride-request sharing.
- Chat conversations.
- Chat messages.
- Notifications.
- Reports.
- Blocking.
- Report cases, moderation decisions, user warnings/suspensions/bans, and ride-post/request restrictions.
- Explicit ride lifecycle, participant completion confirmations, cancellation/no-show/expiry states, and unique per-user ride participation records.
- Atomic server-side seat allocation so concurrent acceptances cannot exceed vehicle capacity.
- Account deletion and retention/anonymization rules for user data.
- Subscription status.
- Subscription entitlements.
- Store purchase state integration for Apple and Google, with RevenueCat recommended as an abstraction subject to technical architecture approval.
- Configurable usage counters for Joiner requests and Car Owner ride posts.
- Configurable Free-tier limits and Pro allowances/overrides for both Joiner requests and Car Owner posts.
- Completed-ride counters for Founding 1,000 qualification.
- Founding 1,000 progress and remaining-place tracking.
- Lifetime Pro entitlement.
- Transactional Founding 1,000 slot allocation and auditable qualification review.
- Separate safety and anti-spam rate limits.

The final backend technology should be confirmed separately within the technical architecture work.

---

## Authentication

MVP requires **sign-in with Google or Apple** (Apple on iOS only) before browsing. This is separate from **mobile-number verification with OTP** (WhatsApp first, with a controlled SMS fallback), which is deferred until the user's first trust-sensitive action.

After signing in, the user can browse, complete basic onboarding, and create a profile before OTP verification.

OTP is required before:

- The first ride request is submitted.
- The first ride is published.

Whichever action occurs first triggers verification.

After successful verification, the account remains verified unless security rules require re-verification.

Optional authentication methods can be introduced later.

---

## Maps and Locations

Google Maps is not required for MVP.

The initial product should use:

- Defined communities.
- Defined cities/areas.
- Predefined origins and destinations.
- Optional text pickup/drop-off notes.
- Coordinates stored where useful for future expansion.

The product architecture should allow future map integration without redesigning the core ride model.

---

## Notifications

Push notifications are required for important events including:

- Ride request received.
- Request accepted.
- Request declined.
- New chat message.
- Ride cancelled.
- Important journey updates.

---

## Deep Links and WhatsApp Sharing

The MVP requires deep-link support.

Deep links should allow shared WhatsApp content to open:

- A specific ride.
- A specific ride request.

The link target must be validated against current server state and handle available, full, cancelled, and expired content. After install/registration, return to the original content when it is still valid.

The system must handle:

- Existing registered users.
- Existing unauthenticated users.
- New users who need to install or register before viewing the relevant content.

---

## Subscription Provider and Entitlements

Subscription payments are separate from ride arrangements.

The MVP must support plan-based entitlements even if commercial usage restrictions are relaxed during launch.

The entitlement model should support configurable values for:

- Joiner ride-request allowance.
- Car Owner ride-post allowance.
- Trial or launch-access status.
- Subscription status.
- Plan start and renewal dates.
- Usage-counter reset period.
- Configurable temporary launch allowances, while preserving finite Free limits and separate Pro allowances.

During launch, Free limits should be generous but finite; Pro limits should be higher or configurable as unlimited. The exact values and reset periods are set before public monetization.

WhatsApp sharing and accepted-ride chat should not be commercially limited.

The subscription architecture must also support the **Founding 1,000 Lifetime Pro** entitlement.

A user who is among the first 1,000 Pro members to complete 100 eligible rides should be upgraded to Lifetime Pro after anti-abuse validation.

At 100 validated completed rides, mark the user `FOUNDER_ELIGIBLE`, run anti-abuse validation, and allocate a remaining founder slot transactionally before granting Lifetime Pro. A ride counts at most once per accepted participant. Promo-code functionality, if introduced, must remain separate from the Founding 1,000 qualification logic.

Users retain accounts and historical data if their subscription expires; Pro-only features follow store/provider entitlement state. The store implementation should use StoreKit / Apple In-App Purchase on iOS and Google Play Billing on Android unless a confirmed exception applies. RevenueCat is recommended to normalize entitlement state across platforms. Confirm the provider and finalize the paid-versus-Free feature split as technical/commercial architecture work before public monetization.

---

# 7. Delivery Governance Reference

Tawsila implementation will follow the existing approved orchestration framework.

This MVP document does not redefine:

- Notion workflow.
- Development card lifecycle.
- CLH automation.
- Context budgeting.
- Graph-first context.
- Git worktree strategy.
- Agent orchestration.
- Repository workflow.
- Validation harnesses.

Those controls remain governed by the existing orchestration framework.

---

# 8. Suggested MVP Product Build Sequence

The sequence below is product guidance only. Execution and orchestration are controlled by the existing approved framework.


The first complete vertical slice should be:

## Authentication + Profile Setup

This slice proves the complete development process before more complex ride functionality is introduced.

### Suggested cards

- **TAW-001 — Application Shell**
- **TAW-002 — User Sign-Up**
- **TAW-003 — Mobile OTP Verification**
- **TAW-004 — User Profile Setup**
- **TAW-005 — Community Selection**
- **TAW-006 — Profile Validation**
- **TAW-007 — Authentication Session Management**
- **TAW-008 — Device Validation**

Each card should be independently implementable and testable.

TAW-003 implements the OTP capability and its trust-sensitive action gate. It must not make phone verification mandatory just to browse or finish basic profile setup; OTP is required before the first ride post or ride request.

Once this slice passes validation, development can move to:

## Slice 2 — Ride Posting

Vehicle → Journey Creation → Available Seats → Publish → WhatsApp Share → Manage Ride

## Slice 3 — Ride Discovery and Requests

Search → Results → Ride Details → Request Seat → Create Ride Request → WhatsApp Share

## Slice 4 — Matching and Coordination

Request → Accept/Decline → Confirmation → Private Ride Chat → Coordination

## Slice 5 — Trust and Safety

Report → Block → Administrative Review

---

# 9. MVP Product Principles

Tawsila should resist becoming a ride-hailing application during MVP development.

The core product loop is:

**Community → Planned Journey → Discovery → Request → Acceptance → Private Chat → Shared Journey → Completion Confirmation**

The rider-demand loop is:

**Ride Request → WhatsApp Share → Discovery → Match**

The acquisition loop is:

**Ride/Request → Share on WhatsApp → New User → Registration → Participation**

The commercial loop is separate:

**User → Tawsila Subscription → Platform Access**

The journey-cost arrangement remains:

**Rider ↔ Car Owner**

Tawsila facilitates the connection but does not become the transportation provider or payment intermediary.

---

# 10. Confirmed MVP Decisions

| Decision | MVP Position |
|---|---|
| Launch market | Egypt |
| Business model | Subscription for access to Tawsila |
| Ride payments | Outside Tawsila |
| Ride fares | Agreed directly by rider and car owner |
| Google Maps | Not included |
| Location model | Predefined communities/areas/origins/destinations |
| Latitude/longitude support | Designed into data model for future use |
| In-app chat | Included |
| Chat availability | Only after ride request acceptance |
| WhatsApp sharing | Included |
| Shareable content | Published rides and ride requests |
| Deep links | Required |
| Launch growth objective | Maximize active users and marketplace liquidity |
| Joiner request limits | Configurable finite Free allowance; higher or unlimited Pro allowance |
| Car Owner post limits | Configurable finite Free allowance; higher or unlimited Pro allowance |
| WhatsApp sharing limits | Unlimited |
| Chat limits | Unlimited after acceptance |
| Subscription entitlements | Built into MVP architecture, with separate configurable Free/Pro limits for Joiner requests and Car Owner posts |
| Commercial limits | Configurable and activatable later |
| Safety/anti-spam limits | Active from launch |
| User roles | Same user may act as Joiner and Car Owner |
| Phone OTP timing | Deferred until first ride request or first ride post |
| Browsing before OTP | Allowed |
| OTP re-verification | Only when required by security rules |
| Minimum age | 18+, confirmed during onboarding |
| Initial verification | Phone verification before first post/request; government ID and selfie deferred unless legal/safety review requires them |
| Verification labels | State precisely what was verified, e.g. Phone Verified |
| Car Owner vehicle details | Make, model, type, colour, and seat capacity required before publishing; photo optional; plate hidden |
| Ride capacity | Based on available vehicle seats, not subscription tier |
| Seat allocation | Atomic server-side capacity check when accepting requests |
| Ride completion | Confirmed by participants; planned time passing alone does not mark complete |
| Cancellation / expiry | Supported with actor/time/reason and explicit unavailable ride/request states |
| Ride cost | No fares, ride payments, reimbursement guarantees, enforcement, or ordinary cost-dispute arbitration by Tawsila |
| Cost-share estimates | Not in current MVP; optional informational guidance requires an approved card and must never be represented as a fare |
| Launch pilot | 1–2 communities and a small set of predefined routes, dynamically configured; seed selection later |
| Moderation ownership | Trust & Safety team |
| Moderation | Report/block and Trust & Safety review/suspend/ban capability required before public pilot |
| Account deletion | Required for public pilot, with documented deletion/anonymization/retention behavior |
| Ride completion | Each accepted Joiner is prompted first and the Car Owner must also confirm; ratings are outside MVP |
| Free/Pro limits | Separate configurable limits for Car Owner posts and Joiner requests; Free finite, Pro higher or unlimited; exact values later |
| Launch access concept | Founding Member / Launch Access |
| Founding 1,000 reward | First 1,000 Pro users completing 100 eligible rides receive Lifetime Pro |
| Eligible ride roles | Joiner, Car Owner, or combination of both |
| Founding qualification | Completed legitimate rides only |
| Founding award | `FOUNDER_ELIGIBLE` after 100 validated completed rides; active Pro at qualification; atomic allocation of up to 1,000 slots |
| Subscription stores | StoreKit / Apple In-App Purchase on iOS and Google Play Billing on Android unless a confirmed exception applies |
| Entitlement provider | RevenueCat recommended; final vendor decision in technical architecture |
| Promo code requirement | Not required for Founding 1,000 |
| Live location | Not included |
| Route optimization | Not included |
| Ride-hailing | Not included |
| Community | First-class product/data entity |
| Notion | Source of truth for implementation cards |
| Development start | Only from approved `READY` cards |
