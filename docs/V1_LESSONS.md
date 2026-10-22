# What v1 taught COOPR 2.0

v1 lives on `claude/coopr-product-architecture-5h3cvg`. This branch does not patch it. The ideas below were kept on purpose. The algorithms were written again, except the type-7 quantile, which is the published Hyndman–Fan definition (`h = (n − 1) p`) and is labeled as such in `packages/engine/src/stats.ts`.

## What v1 got right

- The recommendation is a pure function. An LLM may rephrase a finished card. It does not pick a club, a target, or a swing.
- `mechanicalMissPattern`, `strategicTarget`, and `recommendedAim` are different facts. A miss is not an aim instruction.
- External systems sit behind provider interfaces. Null providers are the default, so the app runs with nothing configured.
- Identity is client-generated UUIDv7. Synced rows carry `updatedAt` and `deletedAt`. A `sync_outbox` records pending writes. Local SQLite is the source of truth.
- Mishits stay in the sample. Only an explicit `invalid` mark drops a shot. Stock distance is a median, not a mean and not the longest shot.
- Organic fit and sponsored placement are separate. A sponsor flag must not change the organic order.
- The golfer can export CSV and JSON and can soft-delete the account.
- Simulator, range, and course are different environments.
- A suspected simulator bias is stored and not applied.
- The first wireframe used one accent token (`#8AC926` on `#0B0D0F` / `#FFFFFF`). The 22 Oct founder brand replaces it with navy, white, and red. Pricing and store submission still wait.

## What was wrong or risky

### The 5-iron carry label is a fabrication. Confirmed.

v1's validation gate, `ENGINES.md`, `GROK_BRIEF.md`, `ROADMAP.md`, the seed comment, and `packages/core/src/seed/seed-user-001.ts` treat this list as carry:

`132.8, 80.6, 171.9, 184.7, 119.9, 184.5, 152.2, 184.4, 74.4, 183.0`

The type-7 median of that list is **162.05**. v1 required P50 ≈ 162 **carry**.

The verbatim transcript says the opposite, in the heading: `Iron/wedge TOTAL distances (not carry)`. The same list is the 5-iron **total** sample. v1 wrote those yards into `carryYards` and left `totalYards` null. That is a made-up carry.

v1's own `DATA_MODEL.md` contradicts itself: the shot section says the seed irons are total-only, and the seed-rules section says they are carry and "founder-confirmed." The code followed the second paragraph. The transcript supports the first.

The same mislabel covers the 6-iron, 7-iron, 8-iron, 9-iron, and AW 49°. Driver shots and the Miura 56° already had separate carry and total pairs, which shows the model knew the difference and then ignored it for the irons.

### Other risks

- The seed invented a swing mode (`stock`) and a mishit label the transcript does not state. 2.0 leaves those `unknown` and still keeps every shot.
- v1 stored a historical handicap of 35. That number is not in the verbatim file. 2.0 leaves handicap null.
- v1's quick-start synthesized distances for a handicap band. Useful as a sketch, dangerous if those rows can be mistaken for measurements. The 2.0 public demo has no synthesized golfer.
- v1 turned three quantiles into a smooth probability (`cdfFromQuantiles`) and showed that as risk. That is fake precision. 2.0 reports the sample (counts, median, P20/P80, a confidence band) and does not print a percent chance.
- v1's caddie personalities (Straight Shooter, Old School, Data Nerd, Dry Humor, Hype) are not the set the product uses now.
- Drizzle defined a schema that runtime code did not execute. Two sources of truth. 2.0 has one SQL migration, embedded for the app and checked against the file.
- The in-play bag was not capped at 14. The founder owns more clubs than that. v1 marked them all `inBag`.
- Founder shots were the default demo user. 2.0 refuses a private account on the public-demo path.
- v1 did not store the round, the GPS observations, or the 17 club-use rows, so "keep the history" was only partly true.
- `SETUP.md` named a hosted project ref. 2.0 does not copy accounts, keys, or that ref.

## What 2.0 does differently

- Carry and total are different metrics. A check constraint rejects `converted_from_metric`. There is no function that turns one into the other; the only function throws.
- Hazard clearance uses carry P20. A total-only club cannot clear a front hazard. The 174-yard par 3 therefore declines.
- Stock distance is the median. The driver carry median is about 186, not 220. The 220.8 shot stays in the sample as the longest, not the normal.
- Thin samples decline. The 41-yard 54° has no shots, so the card asks for a recorded carry and a recorded total and invents neither.
- GPS rows are not shots (`is_shot` must be 0). The 357-yard figure is an unverified tee estimate.
- Club-use rows are user-confirmed, outcome unknown, and `calibration_eligible` must be 0. All 17 are stored that way.
- Profiles are per club, swing mode, and environment. Blending throws.
- The in-play bag is a provisional 14 the founder can edit. The limit is enforced on insert.
- Scoring reads strokes only. Narrative text cannot change a gross. An estimate is labeled "not an official GHIN Handicap Index." The founder handicap is unknown.
- Replacement advice is brand-neutral. The historical ideal bag is stored as history and is not an input to that advice.
- The founder is the default local golfer when `EXPO_PUBLIC_FOUNDER_TOOLS` is unset or `1`. A public or store build sets it to `0`. Metro then loads a stub with none of the founder history.

## Hypothesis

**Confirmed.** v1 labels the founder's 5-iron totals as carry. The median 162.05 is the median of the total-distance list. 2.0 stores that list as `total` and has no 5-iron carry profile.
