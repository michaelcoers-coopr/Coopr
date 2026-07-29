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

## Later (not blocking a TestFlight build)

- **Language provider (caddie voice + Golf IQ narration).** An Anthropic (or other)
  API key, called from a Supabase edge function — never bundled in the app. The
  deterministic engine already produces the numbers and reasons; this only adds
  personality. Provide the key when you want the narration layer on.
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

## On "engaging Cowork to sign it up"

I can walk you through each signup live and pre-fill everything on the code side, but I
can't complete third-party account creation, payment, or OAuth on your behalf from this
environment. The fastest path: you create the three accounts above (Apple, Supabase,
Expo), drop the keys into `.env`, and I finish the sync/auth integration pass and the
first EAS build.
