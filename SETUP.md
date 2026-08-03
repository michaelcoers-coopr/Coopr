# COOPR — Setup & accounts checklist

What the founder needs to provide to take this from "runs on a simulator" to "on your
phone, syncing, and submittable to the App Store." Nothing here is needed for the
offline core or the engine — those already work. Ordered by what unblocks the most.

## The short answer

Three accounts get you to a real, installable, syncing app **without needing a Mac**:

1. **Apple Developer Program** — $99/year, at developer.apple.com. Required for
   TestFlight and the App Store. This is the one hard paid dependency and only you can
   create it (your identity + payment).
2. **Supabase project** — free tier is fine to start, at supabase.com. Gives cloud
   auth + sync. You provide the project URL and anon key; a service-role key stays
   server-side for account deletion.
3. **Expo/EAS account** — free tier to start, at expo.dev. Lets us build iOS in the
   cloud (EAS Build) and push to TestFlight, so **no local Mac/Xcode is required**.

I can't create these for you from here — they need your identity, payment, and OAuth
sign-in, and this session is non-interactive. But the code is already wired to drop
them in: `apps/mobile/.env.example`, `apps/mobile/eas.json`, `supabase/schema.sql`, and
the Supabase auth/sync adapters activate automatically once the keys are present.

## Step by step

### 1. Supabase (auth + sync) — ~20 min
- Create a project; copy the **Project URL** and **anon public key**.
- Put them in `apps/mobile/.env` (copy from `.env.example`):
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- In the SQL editor, run `supabase/schema.sql` (tables + row-level security +
  the `changes_since` pull function).
- The app then uses `SupabaseAuthProvider` + `SupabaseSyncProvider` automatically;
  with no keys it stays offline/local-only. One integration pass is needed to verify
  sync end-to-end and to finish Apple Sign In wiring.

### 2. Expo / EAS (build without a Mac) — ~15 min
- Create an Expo account; `npm i -g eas-cli`, then `eas login`.
- `cd apps/mobile && eas build --platform ios --profile preview` builds in the cloud.
- EAS will prompt to create/manage the iOS credentials against your Apple Developer
  account — no local Xcode needed.

### 3. Apple Developer — required for TestFlight/App Store
- Enroll at developer.apple.com ($99/yr). Have your legal entity / D-U-N-S ready if
  enrolling as an organization.
- Create the App ID `app.coopr.mobile` and an App Store Connect app record.
- `eas submit --platform ios` ships the build to TestFlight.

## Caddie voice (Anthropic) — turns Ask COOPR conversational

The chat and caddie already work offline with grounded, deterministic answers. Adding an
Anthropic key rewrites those answers in the caddie's chosen personality — the model only
rephrases; it never changes a number or picks a club. The key lives **server-side** (a
Supabase secret), never in the app bundle, the repo, or a chat message.

1. **Get the key.** console.anthropic.com → sign in → **API Keys → Create Key**. Add a
   little credit under **Billing** (usage is pennies for this rephrase task on Haiku).
   Copy the `sk-ant-...` key.
2. **Store it as a Supabase secret** (needs the Supabase CLI: `npm i -g supabase`, then
   `supabase login` and `supabase link --project-ref snybvxrnhslfnxzsxtio`):
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional model override (default is claude-haiku-4-5-20251001):
   # supabase secrets set COACH_MODEL=claude-sonnet-5
   ```
3. **Deploy the function:**
   ```
   supabase functions deploy coach-narrate
   ```
4. Make sure the two `EXPO_PUBLIC_SUPABASE_*` values are in `apps/mobile/.env` (same as
   the sync setup). With those present, the app auto-uses the caddie voice; without them
   it stays deterministic. If the function is missing or errors, the chat silently falls
   back to the grounded answer — it never breaks.

Personality is chosen in-app under **Profile → Customize caddie** (name + preset:
Straight Shooter, Old School, Data Nerd, Dry Humor, Hype).
- **Subscriptions.** A RevenueCat account when we build Free/Pro (pricing stays
  remote-configurable; nothing hardcoded).
- **TrackMan / launch-monitor direct connect.** A commercial API arrangement with
  TrackMan (and later Foresight/FlightScope/Garmin). Until then, CSV + screenshot +
  manual entry cover ingestion, and they're already in the onboarding flow.
- **Course data licensing.** Required only for native GPS (a post-launch phase). This
  is a real commercial contract and cost — worth starting conversations early, but it
  does not gate the first release.

## What only you can approve (brand & submission gates)

Per the spec, these pause for you: the brand system (logo, wordmark, colors,
typography), app icon and screenshots, store copy, pricing, and the privacy/terms
language. Until the brand is approved the app uses a neutral wireframe theme with a
swappable accent, so none of the feature work is blocked.

## Connect it now (accounts already created)

The code activates the cloud layer automatically once these values are present. Nothing
sensitive goes in the repo — `.env` is gitignored, and the anon key is public by design
(protected by row-level security). Never commit or paste the **service_role** key or any
Apple private key.

1. **Supabase → Project Settings → API.** Copy the **Project URL** and **anon public**
   key into `apps/mobile/.env` (copy from `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
2. **Supabase → SQL Editor.** Paste and run `supabase/schema.sql` (tables + RLS +
   `changes_since`). Safe to re-run.
2b. **Supabase → Authentication → Sign In / Providers → enable "Anonymous sign-ins."**
   The app creates an anonymous user on first launch (so it works offline before a real
   account) and later upgrades that same user — same uid, data preserved — when they
   Sign in with Apple. Without this, the first cloud launch can't create a user.
   *(Apple provider config — Service ID + key — is a separate pre-submission step in the
   same Providers screen; the app-side Apple Sign In is already wired.)*
3. **Account deletion function** (optional now, required before store submission):
   ```
   supabase functions deploy delete-account
   ```
   It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the function's env —
   set those in the Supabase dashboard, not in the app.
4. **Build to your phone (no Mac):**
   ```
   cd apps/mobile && npm install
   eas login
   eas build --platform ios --profile preview
   ```
   For a device build EAS will ask to manage iOS credentials against your Apple
   Developer account. For EAS builds, also add the two `EXPO_PUBLIC_SUPABASE_*` values
   as EAS environment variables (dashboard or `eas env:create`) so the cloud build
   picks them up.

Once step 1 is done, the app switches from local-only auth to Supabase auth + sync on
next launch; with the values absent it stays fully offline. After you've run steps 1–2,
tell me and I'll do the end-to-end sync verification pass and tighten anything the live
schema surfaces.

## On "engaging Cowork to sign it up"

I can walk you through each signup live and pre-fill everything on the code side, but I
can't complete third-party account creation, payment, or OAuth on your behalf from this
environment. The fastest path: you create the three accounts above (Apple, Supabase,
Expo), drop the keys into `.env`, and I finish the sync/auth integration pass and the
first EAS build.
