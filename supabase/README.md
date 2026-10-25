# Local accounts and authentication

TAW-7 revision 7 delivers Google sign-in on iOS. Use the local Supabase stack for development and database verification; do not substitute the hosted test project for these checks.

## Setup

Install the Supabase CLI and Docker. On macOS, Colima is one option: start it with `colima start`; another working Docker installation is equally suitable. Run these commands from the repository root with Docker running:

```sh
supabase start
supabase db reset
supabase test db
supabase/tests/concurrency/first-signin.sh
```

`db reset` rebuilds the local database and applies migrations; it discards local test data. The concurrency script uses the local `supabase_db_tawsila` container, inserts 20 distinct synthetic auth users concurrently, checks one account per user, and cleans up its own records. Its success message is `PASS 20 users, 20 account rows`.

Copy `apps/mobile/.env.example` to an ignored `apps/mobile/.env`. Set `EXPO_PUBLIC_SUPABASE_URL` to the local API URL and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the local publishable key reported by the CLI. For a physical iPhone, use a reachable development machine address rather than the phone's loopback address. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the owner's public OAuth client IDs. Export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` in the shell running the Supabase CLI, with the authorized Web client first and iOS client second, comma-separated. The mobile `.env` does not export server configuration into that shell. Keep all keys and environment files local; never commit or log them.

The team uses Node 24.22.0. Before Node/npm/npx commands, source `/Users/sherifehab/Developer/Tawsila/.clh/evidence/TAW-3/node24.env` and check `node -v`. This file also sets `EXPO_NO_DOTENV=1`: run `unset EXPO_NO_DOTENV` before Expo commands when using the mobile `.env`.

The owner created a separate Free-tier hosted test project and enabled Google with the Web client first and iOS client second, with nonce checking ON (`Skip nonce checks` OFF). Keys live only in local environment files. The earlier iOS spike verified that the ID token contains the SHA-256 nonce and Supabase accepts the raw nonce and rejects a wrong nonce. This batch uses no hosted project. Production-app first/returning sign-in, different-email account observations and reinstall/update behavior on the physical iPhone are **not yet verified: needs the owner's device**. Supabase's documented automatic identity linking is accepted; the app adds no linking or merging.

## Account contract

`public.accounts` contains:

| Column | Contract |
| --- | --- |
| `user_id` | UUID primary key referencing `auth.users(id)`, cascading on deletion |
| `phone_e164` | Nullable text; an E.164-format constraint applies when present |
| `phone_verified` | Boolean, not null, defaults to false |
| `profile_completed_at` | Nullable timestamp with time zone |
| `created_at` | Timestamp with time zone, not null, defaults to `now()` |

The minimal `public.handle_new_user()` trigger function runs after insertion into `auth.users` and inserts the account in the same transaction. It is a security-definer function with an empty search path and no client execute privilege. An insertion failure fails the whole sign-up. Returning authentication does not create another row.

RLS permits an authenticated user to select only their own row. Clients have no insert, update or delete privileges; unauthenticated clients have no access. A verified phone must be non-null, and a partial unique index enforces uniqueness among verified numbers. Provider tokens, email and name are not copied into a public profile or application logs.

TAW-4 owns profile, age 18+ and Terms/Privacy consent, and sets `profile_completed_at` through a trusted function. Until then, a new user stops at `needs_profile`; missing accounts fail closed to `account_provision_error`. Tabs require the server-confirmed completion timestamp. TAW-5 owns phone verification, ride-action gating, resuming the pending draft and duplicate-phone handling. None of these hand-offs is implemented by TAW-7.

`supabase/tests/seed/mark-profile-complete.sql` is a manual, database-side test fixture only. It is never called by the app or automatically applied by reset. To exercise completed-profile routing, open a psql session connected to the local stack from the repository root. Enter `\prompt 'Synthetic local test user UUID: ' test_user_id`, supply an existing synthetic local user's UUID, then enter `\i supabase/tests/seed/mark-profile-complete.sql`. There is no application control or flag that skips the server-confirmed completion requirement.

## Session contract

The Supabase SDK session is authoritative. Provider responses alone never open protected routes. Temporary network failures preserve an existing session; a genuine termination returns the app to `signed_out`. Every internal app sign-out uses `signOut({ scope: 'local' })` and verifies persisted session removal. R2 established that this call still uses the network and can return an error while retaining an expired session offline, without a `SIGNED_OUT` event. The code therefore clears the persisted session itself when needed, including its manifest and all chunks, and forces `signed_out`; the returned sign-out result is insufficient evidence.

The fresh-install guard uses `install-session-guard`, a marker file in the app's document directory, which is absent after uninstall/reinstall even if Keychain credentials survive. Before accepting a restored session, an absent or unreadable marker requires verified local session clearing. The marker is written only after successful clearing. A normal update retains the marker and can retain a valid session. This is an installation marker, not a profile-completion marker. Physical reinstall and update behavior is **not yet verified: needs the owner's device**.

## Native development build and hand-off

From `apps/mobile`, install dependencies with `npm ci`, then use `npx expo run:ios` for an iOS Simulator development build. Xcode with an installed Simulator runtime and CocoaPods are required; Expo's native build step generates the iOS project and installs pods. For iPhone, use `npx expo run:ios --device`, select the owner's connected device, and configure the owner's signing team for `com.designmasr.tawsila` in Xcode. The generated `.xcworkspace` can also be opened in Xcode to select the device and build. Rebuild after native dependency or plugin changes. No paid sign-in dependency is used.

Google sign-in requires this development build: Expo Go can render Welcome, but the Google button reports `unavailable` because its native module is absent. Client IDs are read from the public environment variables; the iOS callback URL scheme is configured in `apps/mobile/app.json`. Android bundles compile, but sign-in returns `unavailable`.

Android sign-in, Sign in with Apple, logout and account deletion are deferred to separate cards. Store-submission needs remain separate: settle the deferred provider requirement before App Store submission, deliver logout and account deletion, and address the Google Play web deletion-request resource and store declarations. TAW-7 does not establish store readiness.

The approved sign-in design is TAW-11, Figma section `174:365`. Approved deviations are the text wordmark, no Sign out, no Choose another option, and a profile hand-off screen that has not been designed. See `apps/mobile/DESIGN_NOTES.md` for the UI hand-off.
