# ADR: Phone verification flow for TAW-5 (project-owned OTP, WhatsApp delivery)

Status: amended 2026-10-26 after the owner's review decisions; the technical gate history is in `docs/superpowers/gates/` and an amendment voids earlier gate PASS results until the gates are re-run. Option B was approved by the owner on 2026-10-26 ("go for option b"); the ADR and the spec as a whole are not owner-approved yet. Date: 2026-10-26.
Binds: TAW-5 scope revision 3 (AC1 to AC12). Does not authorize implementation, external changes or spending.

## 1. Context

TAW-5 requires a verified phone before a signed-in user's first ride offer or first ride request. Sign-up is Google (Apple later) and requests no phone (TAW-7). WhatsApp is the primary channel; the SMS fallback is deferred in the MVP. The owner set up WhatsApp delivery on the hosted Supabase project `tawsila-dev` (a Send SMS hook calling the WhatsApp Cloud API with the template `tawsila_otp`).

Revision history: the first draft of this ADR chose the Supabase phone-change flow (`updateUser({ phone })` and `verifyOtp` type `phone_change`) with the Send SMS hook. Two spec-gate rounds found it could not satisfy AC4 as written: Supabase binds a code to the user, not to a session; the Admin API can confirm a phone without a code and a trigger on `auth.users` cannot tell the difference; and a pending phone number may be persisted in the SDK session payload. The owner chose the project-owned OTP (option B).

## 2. Evidence and its quality

| ID | Fact | Source | Quality |
|---|---|---|---|
| E1 | A Send SMS hook (Edge Function `send-otp-hook`) sends codes through the WhatsApp Cloud API with the approved template `tawsila_otp`; Twilio fields are empty | Owner report, relayed from a Claude Cowork session, 2026-10-26 | Reported, not verified |
| E2 | The Phone provider is Enabled; "Allow new users to sign up" was On and the owner switched it Off on 2026-10-26; no phone-only users exist under Authentication | Owner, this session | Reported, not verified |
| E3 | The Edge Function is not in the Tawsila repository (no `supabase/functions`); local `supabase/config.toml` has `[auth.sms] enable_signup = false` and no hook | Repository, main 63d0293 | Verified |
| E4 | `accounts` has `phone_e164` (E.164 check), `phone_verified`, a check "verified requires a phone", a partial unique index on verified phones, select-own RLS and no client write grants; `service_role` is not revoked | Migration 20261024204100 | Verified |
| E5 | Supabase documents the phone-change flow with a user-bound code, an Admin API that can confirm a phone, and unclear behaviour for duplicates and `phone_confirmed_at` | Supabase docs | Documented, ambiguous |
| E6 | Access tokens carry a `session_id` claim that is stable across refresh; `/auth/v1/user` rejects a revoked session (403 `session_not_found`) and a deleted user (403 `user_not_found`) while PostgREST accepts the unexpired JWT of a revoked session | Local runtime test on GoTrue v2.197.0 with a throwaway user, 2026-10-26 | Verified locally; UNVERIFIED on the hosted project (spec V2) |

## 3. Decision

1. **Channel:** WhatsApp only, through the WhatsApp Cloud API with the template `tawsila_otp`. The SMS fallback is out of scope (separate PROPOSED card).
2. **Flow:** project-owned OTP. Two Edge Functions (`phone-otp-start`, `phone-otp-verify`) authenticate the caller, generate and hash a six-digit code, and call security-definer database functions that own the challenge table, expiry, attempt counter, rate limits and the only write path to `accounts.phone_verified`. The code is bound to `user_id` and the JWT `session_id`.
3. **Trust boundary:** `accounts.phone_verified` and `accounts.phone_e164` are set only by `verify_phone_challenge` after a matching code. No trigger reads Supabase Auth phone state; the Admin API, the Phone provider and `updateUser` cannot verify a phone. The service-role key remains the trust root of server code (residual risk, owner decision O9).
4. **Supabase Phone provider and Send SMS hook:** not used by the app. Phone sign-ups stay Off. The hosted `send-otp-hook` is neither changed nor deleted by TAW-5; switching the Phone provider and the hook Off is an optional owner action (O10).
5. **Secrets:** only environment variables (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `PHONE_HASH_PEPPER`); the repository holds `.env.example` names only; tests use a sandbox stub.
6. **Code and number handling:** the database never sees the plaintext code (HMAC with an environment pepper); the pending number lives in the challenge row, never in the Auth user or the SDK session storage.
7. **Session validity:** JWT validity, user existence and active-session validity are different checks (E6). The functions use `verify_jwt`, then `auth.getUser`, then a database recheck (`phone_session_active`, a definer reader of `auth.sessions`) under the account lock, so the protocol does not depend on hosted Auth behaviour alone. The guarantee is session validity at that check, not for the rest of the transaction (spec section 2, authorization point).
8. **Owner scope decisions (2026-10-26):** administrator revocation is deferred to a separate card; screens are English-only and Arabic and RTL are deferred to a separate card; five sends per user and five per phone number within a rolling 24 hours, failed deliveries count, no administrator reset in this scope. These approve no other numeric value (spec section 6).
9. **Delivery webhooks:** Meta delivery webhooks, if used later, set status only and never `phone_verified`.

## 4. Options considered

| Option | Result |
|---|---|
| A. Supabase phone-change flow plus the existing hook | Rejected by the gate findings and the owner's choice: user-only binding, an Admin API bypass, SDK persistence of the pending phone |
| B. Project-owned OTP, WhatsApp delivery | Chosen: satisfies AC4 literally, keeps all limits in our database, keeps the Phone provider off |
| Native Twilio phone provider | Rejected: not used by the owner |
| Phone sign-in endpoint for verification | Rejected: can create phone-only users, conflicts with TAW-7 |
| SMS fallback | Deferred by the owner for the MVP |

Costs of B: more code (generation, hashing, expiry, attempts, resend, idempotency, tests) and the existing hook becomes unused. One-way door: the app no longer depends on Supabase phone verification; reverting means a new design.

## 5. Verification items

Run only with owner authorization on `tawsila-dev` (the owner said the spike may happen today if needed; exact steps are confirmed first). They are listed as V1 to V6 in the spec, section 11: template delivery and provider errors; `session_id` claim and `getUser` behaviour; real grants; the phone sign-in endpoint creating no user; RPC access only through `service_role`; the content of the existing hook.

## 6. Consequences

- The spec defines the server contract, the limits, the error mapping, the privilege matrix and the tests.
- Production prerequisites: the template `tawsila_otp` is reported approved (E1, not verified). Still unknown: Egypt rates, sender approval and the abuse-control budget; all are recorded as owner-tracked items before phone-gated ride functions are enabled in production, not built here.
- TAW-5 Android delivery stays blocked until an Android sign-in card exists (TAW-7 is iOS only).
- Cost risk: every code is a WhatsApp message; the limiter (per user, per phone, project-wide) is a requirement, not an option (AC5).

## 7. Not decided here

Re-verification and administrator revocation (separate card), Arabic and RTL (separate card), the SMS fallback, Apple sign-in, Egypt legal checks, phone number change, and any change to the hosted project.
