# ADR: Phone verification provider and flow for TAW-5

Status: DRAFT for the TAW-5 spec gate (authoring card, branch spec/TAW-5). Not approved. Date: 2026-10-26.
Binds: TAW-5 scope revision 3 (AC1 to AC12). Does not authorize implementation, external changes or spending.

## 1. Context

TAW-5 requires a verified phone before a signed-in user's first ride offer or first ride request. Sign-up is Google (Apple later) and requests no phone (TAW-7). WhatsApp is the primary channel; the SMS fallback is deferred in the MVP. The owner has set up WhatsApp OTP on the hosted Supabase project `tawsila-dev`.

## 2. Evidence and its quality

| ID | Fact | Source | Quality |
|---|---|---|---|
| E1 | The Send SMS hook is Enabled and points to the Edge Function `send-otp-hook`, which sends the code through the WhatsApp Cloud API with the approved template `tawsila_otp`; the Twilio fields are empty | Owner report, relayed from a Claude Cowork session, 2026-10-26 | Reported, not verified by the authoring session |
| E2 | The Phone provider is Enabled (switched on 2026-10-26) and "Allow new users to sign up" is On; Email and Google are also enabled | Same | Reported, not verified |
| E3 | The Edge Function is not in the Tawsila repository (no `supabase/functions`); local `supabase/config.toml` has `[auth.sms] enable_signup = false` and no hook | Repository, main 63d0293 | Verified |
| E4 | `accounts` has `phone_e164` (E.164 check), `phone_verified`, a check "verified requires a phone", a partial unique index on verified phones, select-own RLS and no client write grants | Migration 20261024204100 | Verified |
| E5 | The hook receives `user` (including `user.phone`) and `sms.otp` (six digits); requests are verified with the `standardwebhooks` library using the hook secret (the `v1,whsec_` prefix removed); an empty 200 means success | Supabase docs, Send SMS hook page | Documented |
| E6 | A signed-in user changes or adds a phone with `updateUser({ phone })` and confirms with `verifyOtp` using type `phone_change`; the page states a 60-second verification window next to a 1-hour default expiry and a once-per-60-seconds request limit | Supabase docs, phone login page | Documented, internally ambiguous |
| E7 | Not stated in the docs: whether `phone_confirmed_at` changes on `phone_change`, whether "Allow new users to sign up" or `shouldCreateUser` affects `phone_change`, what happens when the number belongs to another user, whether the hook is used for `phone_change` | Same pages | Gap |

## 3. Decision

1. **Channel:** WhatsApp only. Delivery is the existing Send SMS hook (`send-otp-hook`) calling the WhatsApp Cloud API with the template `tawsila_otp`. The native Twilio route is not used. The SMS fallback is out of scope (separate PROPOSED card).
2. **Flow:** attach the phone to the already signed-in Google user with the documented phone-change flow (`updateUser({ phone })`, then `verifyOtp` with type `phone_change`). The phone sign-in endpoint (`signInWithOtp` with a phone) is not used by the app, because it can create a separate phone-only user, which TAW-7 forbids. If the verification items below show that the phone-change flow cannot meet TAW-5 AC4 to AC6, the fallback is a project-owned OTP table and Edge Function behind the same hook-free delivery path; that change returns to the owner as a scope decision.
3. **Trust boundary:** `accounts.phone_verified` and `accounts.phone_e164` are set only by trusted server code, driven by the state Supabase Auth confirms after a successful OTP validation, never by a client value and never by a delivery receipt. The exact mechanism (database trigger on `auth.users` or a trusted function called by an Edge Function) is chosen in the spec from the verification results.
4. **Phone sign-ups:** "Allow new users to sign up" for the Phone provider must be Off on tawsila-dev and on every future environment (owner action, recorded as a prerequisite). The Email provider stays off for sign-up as in `config.toml`.
5. **Hook security:** the function verifies the standard-webhooks signature before reading the body, rejects unsigned or invalid requests, never logs the OTP or the full phone number, and reads secrets only from environment variables (Supabase secrets locally and hosted).
6. **Repository:** the Edge Function moves under `supabase/functions/send-otp-hook` with tests and a local stub for sandbox use (AC11); this is implementation work of TAW-5 and is not done by this authoring card.
7. **Delivery webhooks:** Meta delivery webhooks, if used, set status only (sent, delivered, failed for the UI state) and never `phone_verified`.

## 4. Options considered

| Option | Result |
|---|---|
| Send SMS hook to WhatsApp Cloud API (current) | Chosen: already set up and approved by the owner, WhatsApp-first as decided |
| Native Twilio phone provider | Rejected: the owner uses the hook, Twilio is empty and unused |
| Phone sign-in endpoint for verification | Rejected: can create phone-only users, conflicts with TAW-7 |
| Project-owned OTP service | Fallback only if the phone-change flow fails the verification items; costs more code and abuse controls |
| SMS fallback | Deferred by the owner for the MVP |

## 5. Verification items (to settle before the spec is approved or in TAW-5 task 0)

These need the hosted test project and a real WhatsApp message to the owner's own number. Running them is an external action that this card does not authorize; the owner decides when.

- V1: with "Allow new users to sign up" Off for Phone, does `updateUser({ phone })` for a signed-in Google user still send the code through the hook and complete with `verifyOtp` type `phone_change`?
- V2: after a successful `phone_change`, which `auth.users` columns change (`phone`, `phone_confirmed_at`) and when, and what does the hook payload contain for this flow?
- V3: what error does Supabase return when the number already belongs to another auth user, and can the app map it to the non-disclosing outcome (AC6) without revealing the other account?
- V4: the real OTP expiry and the 60-second wording: what is the effective validity and resend limit with the current project settings, and can they be set to the limits the spec chooses?
- V5: what happens on a wrong code, an expired code and repeated attempts (error codes), so the UI states G4 to G6 map to real outcomes?
- V6: the Edge Function's current behaviour: signature check present, no OTP or phone in logs, failure response when WhatsApp rejects the message (UI state G7).
- V7: whether a code issued for one user can be confirmed by another user, without a session, or from a second session of the same user (AC4 binding).
- V8: the real privileges of `anon`, `authenticated` and `service_role` on `auth.users`.

## 6. Consequences

- The spec must define the server contract, the trusted function that sets `phone_verified`, the rate-limit and expiry values, the error-to-UI mapping and the tests, citing V1 to V6 results or listing each as an owner decision.
- Production prerequisites: the template `tawsila_otp` is reported approved (E1, not verified). Still unknown: Egypt rates, sender approval and the abuse-control budget; all are recorded as owner-tracked items before phone-gated ride functions are enabled in production, not built here.
- TAW-5 Android delivery stays blocked until an Android sign-in card exists (TAW-7 is iOS only).
- Known cost risk: every verification attempt sends a WhatsApp message; throttling is a requirement, not an option (AC5).

## 7. Not decided here

The re-verification rules (owner approval required, AC8), the SMS fallback, Apple sign-in, Egypt legal checks, and any change to the hosted project.
