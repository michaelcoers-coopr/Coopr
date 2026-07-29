# COOPR — Data Model

Schema, migrations, seed data. The Drizzle schema in `packages/core/src/db/schema.ts` is canonical; this document explains intent and the rules that aren't visible in column types.

## Conventions

- **IDs** are UUIDv7 strings, generated client-side.
- **Every synced table** has `createdAt`, `updatedAt` (ms epoch), and nullable `deletedAt` (soft delete).
- **Units are canonical and explicit:** distances in yards, speed in mph, spin in rpm, angles in degrees. Never store mixed units. Convert at the display edge only.
- **Unknown is `null`.** No sentinel zeros, no fabricated fills.
- **Enums** are stored as text with a Zod-validated union in `core`.

## Entities

**User** — auth identity. May be a local-only anonymous user before sign-in.

**GolferProfile** — one per user. Handicap, skill notes, risk preference, `caddieProfileId`, unit preferences, partial-wedge system preference (percent / clock / words). Attributes are mutable and evolve; nothing about the founding golfer is hardcoded.

**Bag** — a named set of clubs for a user (supports multiple bags later). One is `isActive`.

**Club** — a physical club in a bag: `type` (driver/wood/hybrid/utility/iron/wedge/putter), label (e.g. "7i"), `loftDeg` (nullable), shaft fields (nullable — never invent), and free-text. Subjective feedback lives in **ClubFeedback** (separate from measured data, per §11): confidence, strike-quality notes, timestamped.

**Shot** — the atomic performance record. Fields per §13: club ref, loft, session ref, shot number, `environment` (simulator/range/outdoor_launch_monitor/course), `swingMode` (controlled/stock/aggressive/partial), `carryYards`, `totalYards`, `offlineYards`, `side`, full launch-monitor block (club/ball speed, smash, launch, spin, spin axis, peak height, landing angle, attack/path/face/face-to-path/dynamic loft, impact height/offset), `qualityLabel` (representative_stock/good_strike/mishit/invalid), `qualityReason`, `source`, `sourceImage`, `notes`. **All nullable.** For the seed irons, only `totalYards` is populated; carry stays `null` (the source is total distance — see Seed rules).

**PracticeSession / CalibrationSession** — a grouping of shots by date, environment, and intent (full bag / mini / wedge matrix / driver / custom). Carries `validationRequired` when a source had a count discrepancy.

**ClubProfile** — *derived*, recomputed by the engine, keyed by (club, swingMode, environment). Stores sample size, P20/P50/P80 carry and total, median total, good-strike distance, left/right dispersion, short-/long-miss rate, mishit rate, confidence, recency, and per-context calibration offset + calibration confidence. Never authoritative; always reproducible from shots. Which metric backs it (carry vs total) is recorded explicitly.

**CalibrationProfile** — per club/category simulator↔outdoor offset with `status` (suspected/verified), delta range, confidence, and `applyAutomatically` (default false). The suspected 10–15 yd bias lives here and is never auto-applied.

**Recommendation** — a logged engine output (input snapshot + result) for audit and improvement tracking.

**EquipmentProduct** — current-market gear per §39: manufacturer, model, modelYear, type, loft options, adjustability, head/forgiveness/launch/spin profiles, shaft options, msrp, currentPrice, usedPriceRange, `sourceUrls`, `lastVerifiedAt`. Online-sourced, timestamped, flagged stale when old.

**EquipmentRecommendation** — organic fit result (score + reasons). The commercial layer (partner/affiliate) is a *separate* table joined for display only and never feeds the score.

**CaddieProfile** — name, voice, personality, humorLevel, detailLevel, coachingStyle, avatar. COOPR is the platform; the caddie is user-named.

**Course / Hole** — geometry placeholders behind `CourseDataProvider`; unpopulated until licensed data exists.

**Round / Scorecard** — a played round: course ref (nullable for a manual round), tees, date. **HoleScore** rows: hole, par, strokes, putts, penalties, fairway result, GIR, bunker, notes, optional clubs used. Scoring is append/update-fast; nothing beyond strokes is required to advance a hole.

**CourseShot** — optional on-course shot tracking per §28 (start/end location, lie start/end, strategic target, result, penalty). Becomes the strongest real-world performance source over time.

**CourseDownload** — offline bundle metadata per §27.

**IntegrationConnection** — a connected third-party service with its state enum and last-sync metadata.

**AnalyticsEvent** — locally buffered event with name + props + ts, flushed by `AnalyticsProvider`.

## Migrations

Drizzle migrations live in `packages/core/src/db/migrations`. Migration `0000_init` creates the full schema above. Migrations are forward-only and versioned; the app runs pending migrations on launch before any read. A `schema_version` row gates engine/DB compatibility.

## Seed data plan — Seed User 001 ("Mike")

Seed data is pure TypeScript in `packages/core/src/seed` so the engine test suite consumes it without a database. A DB seeder inserts the same records on first run of a dev/demo build.

Seed rules that must hold:

- **Profile:** recreational, historically ~35 handicap, strike consistency the limiter (not speed). Attributes are mutable.
- **Bag:** the founding bag exactly as specified (Callaway XR driver; Cleveland Launcher 2H/3H/4H; PXG 3-iron utility; Callaway Steelhead XR 5i–9i/PW/AW with PW=44° AW=49°; Miura 48°; Mack Daddy 3 54°/10 and 58°/9; Miura 56°; putter user-entered). Shaft = stiff where stated; Miura wedges steel stiff; everything else `null`. Subjective hybrid feedback (2H low, 3H moderate, 4H highest) stored in ClubFeedback, not as measured data.
- **Shots:** the founding TrackMan numbers (§14–22) imported as `simulator` shots. **Irons (5i–9i, AW) are total distance** — populate `totalYards`, leave `carryYards` null. Miura 48°/56° and driver carry the carry/total pairs given. The 8-iron session carries `validationRequired = true` (count discrepancy). No shot is dropped; short mishits are kept as `mishit`, not `invalid`.
- **Miura 48° summary values** (§20) and **driver averages** (§22) are stored as provided; where only aggregates exist and individual shots don't, the aggregate is recorded without inventing per-shot rows.
- **Calibration:** one `CalibrationProfile` row for the suspected simulator bias, `status: suspected`, delta 10–15, `confidence: low`, `applyAutomatically: false`.

The seed is the first validation case: after profile computation the 5-iron must model to roughly P20≈112 / P50≈162 / P80≈184 (total) with a high short-miss rate — never a 185 stock. See ENGINES.md.
