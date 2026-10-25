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

## TAW-4 onboarding and car-owner review

`communities`, `legal_documents`, `car_brands`, `car_models` and `car_types` are configurable lists readable by authenticated users. The migration supplies only the `other` car type; communities, legal versions and the catalogue are loaded separately. `legal_documents` allows at most one current version per kind.

`profiles` holds names, community and role; append-only `consents` records age 18+ and the accepted Terms and Privacy versions. `vehicles` holds one current car per user. `verification_items` holds the current `car_owner` revision and decision, and immutable `verification_submissions` records every accepted key and revision. RLS limits these user tables to the caller's own rows. Authenticated clients and the service role have no direct write grants on these five user tables; writes go through the security-definer RPCs.

`complete_profile` validates all inputs and current legal versions, records the profile and three consents atomically, and sets `accounts.profile_completed_at` only if unset. Repeating the same inputs changes nothing. `set_role` retains existing car details and review state. `plate_normalized` and `plate_is_valid` implement the confirmed G4 rule. `submit_car` validates the car, serializes submissions using the item row lock and records a new pending revision. A repeated submission key returns its recorded revision and whether it was superseded (with the current status when it is still the current revision) without changing any stored state, even after review. A new key after approval raises `already_approved`.

`my_verification` returns only the car-owner status, revision, reviewer note and a boolean indicating car details exist. `can_request_rides` checks profile completion; `can_post_rides` requires the owner/both role and approval bound to the current revision. `review_item` is executable only by the service role (and the database owner); triggers block direct decision changes, including by the service role, and prevent changes to submission history.

Run the database checks from the repository root against the local stack:

```sh
supabase db reset
supabase test db
```

The review suite’s single-session lock probe proves lock acquisition and item/history consistency, not scheduling between two backends. A real two-session car-submission check remains a verification gap; it could not be validated in the sandbox with Docker access denied. The separate first-signin concurrency script covers account creation only.

Reset discards local test data and applies both migrations. The pgTAP suites include configuration access, profile/consent atomicity, car validation, replay, revision-bound review, eligibility and plate normalization.

### Owner review procedure

Verification itself happens outside the app. Only the outcome and reviewer note are stored as the review record. Use the local dashboard SQL editor for this procedure, running the statements as `service_role`. If the editor connection uses the database owner, wrap the chosen statements in `begin; set local role service_role;` and `commit;`. Never put service credentials in the app.

List pending items:

```sql
select user_id, revision, status, submitted_at from public.verification_items where status = 'pending';
```

Inspect the car details for the selected user and keep the revision shown with the item. Replace `<user id>` with that user's UUID:

```sql
select * from public.vehicles where user_id = '<user id>';
```

To read the item and its car details from one consistent statement:

```sql
select i.user_id, i.revision, i.status, i.submitted_at, v.*
from public.verification_items i
join public.vehicles v on v.user_id = i.user_id
where i.user_id = '<user id>' and i.kind = 'car_owner';
```

Approve with the revision you inspected (replace `<revision shown>` with the integer):

```sql
select public.review_item('<user id>', 'car_owner', <revision shown>, 'approved', '<note>');
```

Or reject:

```sql
select public.review_item('<user id>', 'car_owner', <revision shown>, 'rejected', '<note>');
```

A stale revision is refused with `stale_revision`: a decision on an older submission cannot approve a replacement. Reload and inspect the current item and vehicle before making a fresh decision. Do not update `verification_items` directly. A rejected user may submit a new key, producing a new pending revision; an approved user cannot replace their car in this implementation.

## Car catalogue seed

The one-time catalogue under `supabase/seed/catalogue/` adapts `abhionlyone/us-car-models-data` at the pinned commit below, under CC BY 4.0. See [NOTICE.md](seed/catalogue/NOTICE.md) for attribution, licence link and changes, and [COVERAGE.md](seed/catalogue/COVERAGE.md) for the fixed Egypt-market brand coverage. The separate `egypt-extension.csv` is proposed-unverified: the owner reviews it before real use. `types.csv` is also a separate unverified proposal. Brands and models are configuration the owner can change in the dashboard.

Use Node v24.22.0, with no dependencies or network required by these scripts. From the repository root, rebuild from an independently obtained read-only copy of the pinned source (CSV data only):

```sh
. /Users/sherifehab/Developer/Tawsila/.clh/evidence/TAW-3/node24.env
node -v # must print v24.22.0
node supabase/seed/catalogue/build-catalogue.mjs --source /path/to/us-car-models-data --source-commit 79018e2dbcc03899bf3434d959b445644fb49b76 --out supabase/seed/catalogue/catalogue-base.csv
. /Users/sherifehab/Developer/Tawsila/.clh/evidence/TAW-3/node24.env
node -v # must print v24.22.0
node supabase/seed/catalogue/coverage.mjs
. /Users/sherifehab/Developer/Tawsila/.clh/evidence/TAW-3/node24.env
node -v # must print v24.22.0
node --test supabase/seed/catalogue/catalogue.test.mjs
```

`--source-commit` records the declared provenance in the build summary; it does not authenticate the input directory. Obtain the pinned revision before rebuilding. Files are read in sorted filename order and rows in file order, preserving the first display spelling for each normalized name. Invalid control characters or names over 80 characters abort with a file/row diagnostic; empty makes/models are dropped. No source program is executed. No year is included in the emitted catalogue or SQL.

After migrations, apply manually to the LOCAL database only:

```sh
. /Users/sherifehab/Developer/Tawsila/.clh/evidence/TAW-3/node24.env
node -v # must print v24.22.0
set -o pipefail
node supabase/seed/catalogue/load-catalogue.mjs | docker exec -i supabase_db_tawsila psql -U postgres -X -v ON_ERROR_STOP=1
```

The loader prints one transaction containing only inserts with `on conflict do nothing` for types, brands and models. Models resolve their parent by brand name. Repeating the command leaves existing records, including inactive entries, unchanged; it never reactivates or updates them. There are no automatic reset seeds; `[db.seed]` stays disabled. Nothing is loaded on the hosted project in this implementation.

Check locally, then repeat the load and check that counts remain unchanged:

```sh
docker exec -i supabase_db_tawsila psql -U postgres -X -v ON_ERROR_STOP=1 <<'SQL'
select count(*) as brands from public.car_brands;
select count(*) as models from public.car_models;
select count(*) as types from public.car_types;
select count(*) as orphan_models from public.car_models m left join public.car_brands b on b.id = m.brand_id where b.id is null;
select code from public.car_types where code = 'other';
SQL
```

Generated input counts: 11,543 source rows, 66 base brands and 1,456 normalized base pairs; 156 extension rows; merged 85 brands and 1,583 models; six types including `other`. On a database with only the migration's `other` row, expect 85 brands, 1,583 models, six types and zero orphan models. Existing configuration or test fixtures can increase totals. The normalized base count is three below the raw 1,459 distinct pairs because case variants collapse. Coverage is 21 of 40 fixed-list brands before the extension and 40 of 40 after; model completeness is unverified.

### Hands-on test fixtures (TAW-4, local stack only)
`supabase/tests/seed/taw4-dev-fixtures.sql` adds three clearly named test communities and the current test Terms and Privacy versions (`test-v1`) so the onboarding screens can be tried by hand: `docker exec -i supabase_db_tawsila psql -U postgres -X -v load_taw4_fixtures=1 < supabase/tests/seed/taw4-dev-fixtures.sql`. It is idempotent, never runs by itself, and is not for the hosted project. Real communities and the real legal versions are the owner's content.
