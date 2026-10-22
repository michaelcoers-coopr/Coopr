# COOPR 2.0 — milestone 1 status

Honest snapshot of this branch. Test counts below are filled after the suite that shipped with this commit.

## Done

- Clean tree on `coopr-2.0`. v1 is not in this tree. It remains on `claude/coopr-product-architecture-5h3cvg`.
- `docs/V1_LESSONS.md`. The 5-iron carry hypothesis is **confirmed**: v1 stored totals as carry. The median 162.05 is a total. 2.0 does not copy that label.
- Monorepo: domain, engine, seed, db, tokens, Expo app.
- Schema version 1 for SQLite, with a Postgres mirror that has the same tables. UUIDv7, `updated_at_ms`, `deleted_at_ms`, `sync_outbox`.
- Founder import from the verbatim transcript, raw text stored beside normalized rows, discrepancy flags for the known gaps.
- Pure stats, caddie, and scoring. CSV and JSON export. Soft-delete of an account.
- Screens: Home (Play golf / Practice & calibrate), Bag, Caddie with manual distance, Scorecard, and private founder flows A–D plus founder bag and High Cedars.
- Neutral wireframe. Accent token `#8AC926` on `#0B0D0F` / `#FFFFFF`.
- Null provider defaults. No secrets in the repo.

## Not done

- No cloud sync. The outbox is written and never pushed. Postgres is a file, not a database.
- No accounts: no Apple Developer, no Expo/EAS project, no Supabase or other backend, no GHIN.
- No licensed course map or GPS yardages. Manual distance only.
- No LLM rephrase. The language provider returns the deterministic text.
- No launch-monitor connection. Practice entry is manual. The founder transcript is an import, not a live session.
- No partial-swing model. A 41-yard pitch with no sample declines and asks for an outcome.
- No final brand, pricing, privacy copy, screenshots, or App Store submission.
- The in-play bag is empty. The founder has not chosen 14 clubs.
- The caddie has no name yet.
- Founder verification is compiled into this milestone build and gated as a private route. A public store build must not ship `packages/seed` founder data.
- Web bundle is the check that the app bundles on this Linux runner. It is not an iOS simulator run. Android is the same React Native project and has not had a device build.
- Handicap is unknown for the founder. Nothing here computes an official index.

## Blockers

- Apple Developer account (identity and payment) for TestFlight or the App Store.
- Licensed course and GPS data. Nothing in this repo is a course map.
- Backend accounts if sync should leave the device. The schema is ready; the project is not.
- GHIN, or any other official handicap service, before a number can be called a Handicap Index.
- Founder decisions listed below, before the in-play bag or any calibration correction is filled in.

## Open founder decisions

- Which 14 clubs are actually in play. Owned plus unverified is more than 14, so the in-play bag is empty.
- Whether the 4-wood is owned.
- 2-hybrid model and loft.
- 3-hybrid loft: 19 or 21. Neither is stored as the loft.
- 3-iron utility loft.
- Putter identity.
- PW and AW lines do not repeat "Callaway". Brand is null there rather than inherited.
- High Cedars white tee rating/slope: 69.1/113 or 70.1/115. Neither is selected.
- Displayed net 78. Stored as unverified. Not used as the score.
- Miura 48° usable-strike rule. The summary is kept and is not a stock distance.
- Driver shots 1 and 2. Absent. Not manufactured.
- 8-iron: 11 totals stored, note said 10. All 11 kept.
- Shaft models. Flex is stiff where the bag header says so. Shaft model is null. Putter flex is null.
- Simulator bias of +10 to +15 yards. Suspected, low confidence, not applied. Needs an outdoor comparison before anyone turns it on.
- Historical flex slot: existing 4-hybrid or a gapped fairway wood. Not stored as a club. The historical bag is not a shopping list.
- Caddie name.
- No handicap value was in the verbatim file. v1's 35 was not imported.
- The import brief calls the session TrackMan. The transcript does not name the monitor, so the row does not either.
- Per-hole pars were not in the source.
- GPS to-center distances line up with the club-use list and are still stored as separate records. They are not shots.

## Tests

`npm test` — 4 files, 31 tests, all passing.

`npm run typecheck` — `tsc -b` for domain, tokens, engine, seed, and db, then the Expo app. Clean.

`npm run bundle` — `expo export --platform web` succeeds. The web preview does not load `expo-sqlite` (the wa-sqlite worker is not in this export). iOS and Android use `boot-db.ts` and the same migration text. Node tests apply that migration with SQLite. This runner did not launch an iOS simulator.

The suite covers: total never becomes carry, hole scores 105 (52/53), 17 club uses none calibration-eligible, the 357-yard GPS estimate is not a shot, driver stock carry is not 220, no aim offset for a miss pattern, hazard clearance uses a carry percentile, and a too-small sample declines.
