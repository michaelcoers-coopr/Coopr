# COOPR 2.0 — milestone 1 status

Honest snapshot of this branch. Test counts below are filled after the suite that shipped with this commit.

## Done

- Clean tree on `coopr-2.0`. v1 is not in this tree. It remains on `claude/coopr-product-architecture-5h3cvg`.
- `docs/V1_LESSONS.md`. The 5-iron carry hypothesis is **confirmed**: v1 stored totals as carry. The median 162.05 is a total. 2.0 does not copy that label.
- Monorepo: domain, engine, seed, db, tokens, Expo app.
- Schema version 1 for SQLite, with a Postgres mirror that has the same tables. UUIDv7, `updated_at_ms`, `deleted_at_ms`, `sync_outbox`.
- Founder import from the verbatim transcript, raw text stored beside normalized rows, discrepancy flags for the known gaps.
- Founder decisions dated 2026-10-22, stored as their own `user_confirmed` source (`founder's master spec 2026-10-22`). The verbatim file is not rewritten.
- Caddie name is COOPR. Personality is Funny but Knowledgeable.
- Simulator session is TrackMan. The numbers stay on the verbatim source. The monitor confirmation is the master-spec source.
- Provisional in-play 14, editable in the app, status `provisional`. Rationale on the bag: these are the clubs he actually used on course. 4-wood ownership is confirmed. Putter is a PXG 211 blade (length, loft, and shaft still null).
- The founder is the default local profile on a dev build and on the Expo Go preview channel. `EXPO_PUBLIC_FOUNDER_TOOLS=0` swaps `@coopr/seed` for a stub so a production bundle does not contain that history. The public-demo guard still refuses a private account.
- Expo Go preview is on SDK 58 (React Native 0.88, React 19.3) and linked to EAS project `@mikecoers/coopr` (`998f1644-05ec-4980-a0b9-58e5703951d7`). The preview runtime is `exposdk:58.0.0`. `npm run preview:publish` republishes that preview channel when `EXPO_TOKEN` is set and does not create a new project. The update published before this upgrade is still SDK 54 and will not load in App Store Expo Go until Mike publishes again. `eas.json` profile `preview` is a store-distribution iOS build (`app.coopr.mobile.preview`, founder tools on) for TestFlight. Steps are in `docs/PREVIEW.md`. Apple was not signed in from this environment.
- Pure stats, caddie, and scoring. CSV and JSON export. Soft-delete of an account.
- Screens: Home, Play (High Cedars hole view), Bag with CSV import, Caddie, Scorecard, Practice, course quality, and private founder flows A–D.
- A round is one mark per shot and a score confirm. Ground distance is the phone to the open green. Wind, temperature, and pressure come from Open-Meteo when plays-like is on. The finish is read from the next mark when the polygon says so. Par and two putts stay grey until confirmed.
- Brand from the 22 Oct founder decision: navy `#0B1F3A`, white, and red `#C8102E` for a lay-up or a hazard. No green fill. Tagline "The smartest caddie you'll ever carry." The home screen uses the official Navy Fill crest raster. It is not redrawn. Phases are in `docs/ROADMAP.md`. Phase 1 is the round. Phase 1.5 reads a photo on a server. Phase 2 is the caddie layer: plays-like, a plan, a debrief, miss side, wedge carries, tone presets, and a satellite hole view. Phase 3 has not started.
- Null provider defaults. No secrets in the repo.

## Not done

- No cloud sync. The outbox is written and never pushed. Postgres is a file, not a database.
- No Supabase or other backend, no GHIN. Mike has an Apple Developer account; this environment did not sign into it. Republishing the preview channel still needs `EXPO_TOKEN` on the `@mikecoers` account.
- High Cedars (Orting) is the course-data pilot: OpenGolfAPI scorecard plus an OpenStreetMap extract. No hole is admin-verified. The hole screen still shows ground distance from the phone to the open green, and a long-press number only when the phone has no position. iGolf is not licensed. The commercial adapter is a stub. Detail is in `docs/COURSE_DATA.md`.
- No LLM rephrase. The language provider returns the deterministic text.
- No live launch-monitor connection. A TrackMan-style CSV can be pasted, and a photo of a screen can be sent to the extraction server in `docs/PHOTO_IMPORT.md`. Without `COOPR_VISION_API_KEY` the server does not read the photo. The founder transcript is an import, not a live session. A TrackMan partnership is not approved.
- No partial-swing model. A 41-yard pitch with no sample declines and asks for an outcome.
- Pricing, privacy copy, and App Store submission are not done. The navy, white, and red brand is in the app. The home screen uses the official Navy Fill crest raster. A vector redraw comes later.
- Bag edits in the app stay in on-device memory for this session. They are not a cloud write.
- The live scorecard starts empty. High Cedars stays on the founder route as history.
- Web bundle is the check that the app bundles on this Linux runner. It is not an iOS simulator run. Android is the same React Native project and has not had a device build. Phone GPS, Open-Meteo, and walking up to the next tee were checked with a simulated position in the browser, not on a course.
- Handicap is unknown for the founder. Nothing here computes an official index.

## Blockers

- `EXPO_TOKEN` from the Expo account Mike will use in Expo Go. Without it, `npm run preview:publish` stops. Since 12 May 2026 Expo Go only opens an update owned by that account.
- Apple sign-in on a machine Mike controls, the first time `eas build -p ios --profile preview` runs. The command and the submit step are in `docs/PREVIEW.md`. No certificate is in the repo.
- A commercial course license (iGolf, Golf Intelligence, or equivalent). The adapter is a stub and holds no vendor data. Open-data geometry for courses other than High Cedars. Admin verification of the High Cedars greens, which is still undone, so GPS yardages are not shown as playable.
- Backend accounts if sync should leave the device. The schema is ready; the project is not.
- GHIN, or any other official handicap service, before a number can be called a Handicap Index.
- Founder decisions still open, listed below. The in-play 14 is provisional, not a locked bag.

## Resolved 2026-10-22

- The founder is the primary test golfer. Default local profile when the dev/founder flag is on.
- Caddie name: COOPR. Personality: Funny but Knowledgeable.
- Simulator session: TrackMan, `user_confirmed`, source `founder's master spec 2026-10-22`.
- Provisional in-play 14: Callaway XR driver; Callaway Steelhead XR 4W; Cleveland Launcher 3H; Cleveland Launcher 4H; Steelhead XR 5i, 6i, 7i, 8i, 9i, PW 44; Miura 48; Callaway MD3 54/10; Miura 56; PXG 211 blade putter.
- Out of play, owned and testing: Cleveland 2H (felt poor), PXG 3i utility, Steelhead XR AW 49 (overlaps Miura 48), Callaway MD3 58/9.
- 4-wood ownership confirmed. The verbatim line still says "verify ownership".
- Putter identity confirmed: manufacturer PXG, model 211 blade.

## Open founder decisions

- 2-hybrid model and loft.
- 3-hybrid loft: 19 or 21. Neither is stored as the loft.
- 3-iron utility loft.
- Putter length, loft, and shaft. Identity is confirmed. Those specs stay null.
- PW and AW lines do not repeat "Callaway". Brand is null there rather than inherited.
- High Cedars white tee rating/slope: 69.1/113 or 70.1/115. Neither is selected.
- Displayed net 78. Stored as unverified. Not used as the score.
- Miura 48° usable-strike rule. The summary is kept and is not a stock distance.
- Driver shots 1 and 2. Absent. Not manufactured.
- 8-iron: 11 totals stored, note said 10. All 11 kept.
- Shaft models. Flex is stiff where the bag header says so. Shaft model is null. Putter flex is null.
- Simulator bias of +10 to +15 yards. Suspected, low confidence, not applied. Needs an outdoor comparison before anyone turns it on.
- Historical flex slot: existing 4-hybrid or a gapped fairway wood. Not stored as a club. The historical bag is not a shopping list.
- No handicap value was in the verbatim file. v1's 35 was not imported.
- Per-hole pars were not in the source.
- GPS to-center distances line up with the club-use list and are still stored as separate records. They are not shots.
- The in-play 14 is provisional. The founder can move clubs in the app. A 15th club is refused.

## Tests

`npm test` — 13 files, 84 tests, all passing. The schema tests start Node with `--experimental-sqlite`, so a process that disabled that builtin still has a database.

`npm run typecheck` — `tsc -b` for domain, tokens, engine, seed, and db, then the Expo app.

`npm run bundle` — `expo export --platform web` succeeds. With `EXPO_PUBLIC_FOUNDER_TOOLS=0`, the web bundle has none of the founder transcript, club names, or yardages. This runner did not launch an iOS simulator.
