# COOPR 2.0

Personal golf caddie. iOS-first React Native (Expo) and TypeScript. Android-compatible. Offline SQLite first. A Postgres schema is in the repo for a later cloud.

v1 remains on `claude/coopr-product-architecture-5h3cvg`. This branch is a new tree. Read `docs/V1_LESSONS.md` before treating any v1 number as a fact.

## Run

```bash
npm install
npm test
npm run typecheck
npm run bundle
```

The app:

```bash
npm run start -w @coopr/mobile
```

Home is **Play golf** and **Practice & calibrate**. On a dev build and on the Expo Go preview the first-run local profile is the founder (caddie name COOPR). The production EAS profile sets `EXPO_PUBLIC_FOUNDER_TOOLS=0` so that history is not bundled. The public demo path still refuses a private account.

iPhone preview and the TestFlight command are in `docs/PREVIEW.md`. Publish the Expo Go channel with `npm run preview:publish` after `EXPO_TOKEN` is set in the environment. Do not commit the token.

Course data for the High Cedars pilot is open: OpenGolfAPI for the scorecard and OpenStreetMap for geometry. The quality table, the gaps, and the ODbL attribution are in `docs/COURSE_DATA.md`. GPS distances wait until a green is admin-verified. Until then the scorecard, a manual distance, and the caddie still work. No iGolf license is required to run that path.

## Layout

- `packages/domain` — types, UUIDv7, provider interfaces, null defaults
- `packages/engine` — stats, profiles, caddie, scoring, export
- `packages/seed` — verbatim founder transcript and the importer
- `packages/db` — SQLite migration, Postgres mirror, repository
- `apps/mobile` — Expo Router screens
- `packages/tokens` — navy, white, and red. No green fill.

## Product rules that are tested

Carry and total stay distinct. A same-metric blend is labeled and is not a conversion. Hazard clearance uses carry. The longest shot is not the stock distance. A miss pattern is not an aim offset. Thin data declines. No percent-chance probabilities. GPS is not a shot. Scores are strokes, and the caddie does not edit them. An estimate is not a GHIN index. Organic order ignores a sponsor flag. Export and account deletion exist.

The phase plan is `docs/ROADMAP.md`. Phase 1 is the High Cedars round. Phase 1.5 reads photos through a server and a review screen. `docs/PHOTO_IMPORT.md` is the deploy note. Later phases are not built. The vision key is not in this repo.

See `STATUS.md` for what this milestone does not do.
