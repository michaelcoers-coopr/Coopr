# Try COOPR 2.0 on an iPhone

Two paths. Neither one commits a token or an Apple password.

The app is on **Expo SDK 58** (React Native 0.88, React 19.3). App Store Expo Go is SDK 58.0.0. A project on any other SDK is rejected by that Expo Go build. `runtimeVersion` uses policy `sdkVersion`, which publishes as `exposdk:58.0.0`.

`expo-sqlite` is included in that Expo Go build. The app does not use `expo-dev-client` or any other native module outside Expo Go. If SQLite fails to open, Home still runs and the bag stays in memory.

Founder history is on for Expo Go and for the preview iOS build (`EXPO_PUBLIC_FOUNDER_TOOLS=1`). A production build sets it to `0` and Metro drops the transcript from the bundle.

## 1. Expo Go, no TestFlight

Mike installs **Expo Go** from the App Store, then opens a published preview update.

Since 12 May 2026, Expo Go only loads an EAS Update for a project the signed-in Expo account owns, or an organization that account belongs to. The token below has to be from that account.

1. Create an access token at https://expo.dev/settings/access-tokens
2. From the repo root:

```bash
export EXPO_TOKEN='paste-token-here'
npm run preview:publish
```

Do not commit the token. `.env` is gitignored.

The app is linked to EAS project `@mikecoers/coopr` (`998f1644-05ec-4980-a0b9-58e5703951d7`). `preview:publish` uses that id and does not create another project. It publishes the `preview` channel with founder tools on, and prints:

- a QR image: `https://qr.expo.dev/eas-update?projectId=...&runtimeVersion=exposdk:58.0.0&channel=preview&slug=exp`
- the same link with `&format=url` for the `exp://` address

Open the QR with the iPhone camera. `slug=exp` targets Expo Go rather than a custom dev client. The update that was published while this app was still on SDK 54 will not load in Expo Go SDK 58. Run `npm run preview:publish` again after this upgrade so the preview channel carries an `exposdk:58.0.0` bundle.

The stable QR for this project is:

https://qr.expo.dev/eas-update?projectId=998f1644-05ec-4980-a0b9-58e5703951d7&runtimeVersion=exposdk:58.0.0&channel=preview&slug=exp

## 2. TestFlight-ready iOS build

`eas.json` profile `preview` is what `eas build -p ios --profile preview` uses.

- Distribution is **store**, which is the kind of binary App Store Connect / TestFlight accepts. EAS “internal” distribution is ad hoc and cannot be uploaded to TestFlight.
- Channel `preview`, so later `npm run preview:publish` updates that install.
- `EXPO_PUBLIC_FOUNDER_TOOLS=1` and `APP_VARIANT=preview`.
- Bundle id `app.coopr.mobile.preview` (Android package matches). The store app stays `app.coopr.mobile`.
- Display name `COOPR Preview`.
- `ITSAppUsesNonExemptEncryption` is false, so the export-compliance question is already answered.
- No Apple id, team id, certificate, or API key is stored here.

Mike runs this on his own machine after `export EXPO_TOKEN=...` or `npx eas-cli login`. The first build asks him to sign in with the Apple Developer account. Let EAS create the distribution certificate and the provisioning profile for `app.coopr.mobile.preview`. Do not paste those into the repo.

```bash
cd apps/mobile
npx eas-cli@latest build -p ios --profile preview
npx eas-cli@latest submit -p ios --profile preview --latest
```

`submit` uploads the newest preview build to App Store Connect. TestFlight processing happens there. The first time, Apple will also ask him to pick the team. This repo does not run either command.

Production, when there is a store build later:

```bash
npx eas-cli@latest build -p ios --profile production
```

That profile sets `EXPO_PUBLIC_FOUNDER_TOOLS=0` and bundle id `app.coopr.mobile`.
