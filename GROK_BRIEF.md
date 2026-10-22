# COOPR — Build Brief for an AI Coding Agent

> **You are being handed a real product to continue building.** Read this file top to
> bottom before writing any code. It is the orientation layer; the four design docs
> (`ARCHITECTURE.md`, `DATA_MODEL.md`, `ENGINES.md`, `ROADMAP.md`) are the depth layer.
> The repository is the source of truth — this brief never overrides code that exists.

---

## 0. Mission

COOPR is a consumer golf-intelligence app (iOS-first, React Native / Expo). It already
has a working offline core: a pure deterministic recommendation engine, personal club
profiles, a Golf IQ assessment, bag intelligence, a grounded "Ask COOPR" coach, a
scorecard, onboarding, and a new-user demo (sample golfer + handicap quick-start).

Your job is to **extend it along the roadmap without breaking the invariants in §2.**
Every change ships with tests, keeps the engine pure, and preserves the product's one
non-negotiable idea: **the math decides; the language layer only explains.**

---

## 1. Get the code and prove it runs (do this first)

```bash
git clone https://github.com/michaelcoers-coopr/Coopr.git
cd Coopr
git checkout claude/coopr-product-architecture-5h3cvg   # active branch — most recent work
npm install                                              # npm workspaces; .npmrc sets legacy-peer-deps

# The validation gate — must pass before and after any change you make:
npm test            # vitest over packages/engine — 42 tests, all green
npm run typecheck   # tsc -b for packages/core + packages/engine

# Mobile app typecheck:
npm run -w apps/mobile typecheck
```

If you cannot clone the private repo, this brief plus the four design docs in the repo
root are a sufficient spec to rebuild from scratch — but **cloning and continuing is
strongly preferred**; do not re-implement what already works.

**Run the app** (needs macOS + Xcode for the iOS simulator, or Expo Go on a device):
```bash
cd apps/mobile
npx expo start        # then press i for simulator, or scan the QR in Expo Go
```

---

## 2. The ten invariants — NEVER violate these

These are enforced in code and tests, not by convention. They are the product. Breaking
one is a defect even if the feature "works."

1. **The recommendation engine is deterministic and pure.** No LLM ever selects club,
   target, or swing mode. The engine has no network, no I/O, no React-Native imports.
   An LLM may only *rephrase* text it is handed.
2. **Lowest expected score wins over maximum distance** whenever they conflict.
3. **`mechanicalMissPattern`, `strategicTarget`, and `recommendedAim` are separate
   fields.** A miss pattern is never folded into an aim offset. `recommendedAim` equals
   `strategicTarget` unless course geometry overrides it.
4. **Offline-first.** Local SQLite is authoritative. Sync enhances; it never gates play.
5. **No fabricated data.** Unknown stays `null`. Unverified corrections (e.g. the
   suspected simulator-vs-outdoor bias) are stored with confidence metadata and never
   auto-applied. OCR / vision output requires explicit user confirmation before it
   touches the model.
6. **Mishits are kept.** Only shots marked `invalid` are excluded. Robust stats set the
   stock distance; the full distribution (mishits included) sets risk.
7. **Commercial status never alters organic fit ranking.** Two strictly separate layers,
   always. A sponsor flag must leave the organic ranking byte-identical (there is a test).
8. **The golfer owns their history:** CSV + JSON export, account deletion, no
   data-hostage mechanics.
9. **Every external dependency sits behind an interface** (`packages/core/src/providers`).
   Features import interfaces, never vendor SDKs.
10. **Simulator / range / course contexts are never blindly merged.** Per-context
    profiles always exist; a caller may request a blend, but the raw contexts survive.

Full rationale: `ARCHITECTURE.md`.

---

## 3. Product thesis (the "why", so your choices match the spirit)

**Know your game. Play your game.** Generic "average golfer" advice is noise. COOPR is
built on *this golfer's own numbers*: their real distances, their real dispersion, their
real misses. The caddie's recommendation is always the lowest-expected-score play for
*them* — and it can explain why in plain language, with a personality, but it can never
invent a number or overrule the math.

Tone of the product voice: honest, a little dry and funny, never a hype machine, never
flattering the golfer with numbers that aren't real. "You carry your 7-iron 143, not the
160 you tell your buddies" is the energy.

---

## 4. Architecture in one screen (depth: `ARCHITECTURE.md`)

Monorepo, npm workspaces:

```
apps/mobile      Expo Router app. UI, navigation, SQLite wiring, provider registry, features.
packages/engine  PURE deterministic core: stats, club-profile, recommendation, golf-iq,
                 bag-intelligence, conditions, coach, club-order. No I/O, no RN. Tested in Node.
packages/core    Shared types, provider interfaces, Drizzle schema (schema-def only),
                 seed data (Seed User 001), caddie presets, handicap bands + averages.
packages/tokens  Design tokens. Accent is swappable; semantic colors independent.
```

- `engine` depends only on `core`'s **types**. That purity is what makes it testable and
  reusable on any future surface (Android, Watch, web). Protect it.
- **Providers** (interfaces in `core`, resolved through a registry with null/stub
  defaults so the app runs with nothing configured): `AuthProvider`, `SyncProvider`,
  `LanguageProvider`, `VisionProvider`, `CourseDataProvider`, `WeatherProvider`,
  `LaunchMonitorProvider`, `EquipmentResearchProvider`, `ScoringProvider`,
  `AnalyticsProvider`, `SubscriptionProvider`. Each has an integration-state enum
  (`available | manual_import | partner_required | planned | not_available`).
- **Offline/sync** (depth: `DATA_MODEL.md`): client-generated UUIDv7 ids; every synced
  row carries `updatedAt` (ms) + soft `deletedAt`; a `sync_outbox` queues changes;
  reconciliation is last-write-wins per row with soft-deletes winning over stale updates.
  Local SQLite is read/written through **raw parameterized SQL** (Drizzle is used only to
  *define* the schema, not at runtime). Shot/practice rows are append-only.
- **Explanation boundary:** the engine returns structured `reasons[]`. A deterministic
  templater renders them to text offline. `LanguageProvider` *optionally* rewrites that
  text in the caddie's personality when online. The model is never asked "which club" —
  only "say this nicely." The Anthropic call lives in a **Supabase edge function**
  (`supabase/functions/coach-narrate`) so the API key stays server-side.

---

## 5. The engines (depth: `ENGINES.md`)

All pure, in `packages/engine/src`:

- **`club-profile.ts`** — per (club, swingMode, environment): stock distance = **median
  (P50)**, never the mean; P20/P50/P80 via Hyndman–Fan **type-7** quantiles; dispersion
  via MAD/IQR; short-/long-miss rates; a 0–1 confidence that rises with sample size,
  falls with relative dispersion, decays with staleness. Records whether it is `carry`-
  or `total`-backed and never fabricates the missing metric.
- **`recommendation.ts`** — plays-like distance (additive, auditable conditions model:
  wind / elevation / temperature / lie, each a documented constant in `reasons[]`),
  candidate scoring that penalizes miss-zones overlapping hazards and low confidence,
  then picks **lowest expected score**. Emits separate `strategicTarget` /
  `recommendedAim` / `mechanicalMissPattern` (invariant 3).
- **`golf-iq.ts`** — deterministic baseline assessment: overall 0–100 + grade, five
  component sub-scores, gapping anomalies (inversion/overlap/large-gap by ordering clubs
  by loft and checking stock distances descend), ranked insights, practice priorities
  (leak score `0.6·shortMissRate + 0.4·(1−confidence)`), honest baseline coverage.
- **`bag-intelligence.ts`** — keep/test/replace/remove per club, gaps/overlaps/
  inversions, ideal-14, all gated on confidence and framed as "test," not "replace."
- **`conditions.ts`**, **`club-order.ts`**, **`stats.ts`** — the shared math primitives.
- **`coach.ts`** — "Ask COOPR": keyword intent routing → grounded answer built entirely
  from engine outputs. Never invents a number; `LanguageProvider` may rephrase it.

**The validation gate (there are tests for this — keep them green):** the founding
5-iron carry sample must model to **P50 ≈ 162, P20 ≈ 112, P80 ≈ 184** (a 70+ yд
P20–P80 spread) with a high short-miss rate. A 185 "stock" is a bug. The golden-rule
recommendation test must pick the safer, shorter club over a front hazard.

---

## 6. What already exists (don't rebuild it)

Working today, on the active branch:

- Monorepo + offline SQLite with a versioned migration runner + the sync data model.
- Seed User 001 (real TrackMan carry data — the "ultimate" fidelity example).
- All six engines above + the Ask-COOPR coach, with **42 passing tests**.
- First-run **hero fork** (`apps/mobile/app/index.tsx`): *Explore the sample golfer* /
  *Quick start — pick your handicap* / *Enter my own shots*, plus "hand it to someone
  new" reset for hand-to-hand demos.
- **Handicap quick-start** (`packages/core/src/handicap.ts`,
  `apps/mobile/src/features/quick-start.ts`): standard bag with per-band average carries
  (scratch→beginner); shots synthesized deterministically (seeded PRNG + antithetic
  gaussian pairs) so the estimated **stock reads exactly the band average**, with a
  realistic short-miss tail below the median. Every shot is `source='estimate'` and
  labeled in the UI.
- **Onboarding** (guided baseline capture + CSV import with confirmation), **Scorecard**
  (fast offline round scoring), assessment / Equipment Lab / bag / club / practice /
  profile screens, **caddie personalities** (Straight Shooter, Old School, Data Nerd,
  Dry Humor, Hype), CSV/JSON export, account-deletion edge function.
- Env-gated Supabase auth/sync adapters + `coach-narrate` edge function for the caddie
  voice (dormant until keys are set; app is fully functional offline without them).

---

## 7. What to build next (depth + rationale: `ROADMAP.md`)

The MVP boundary is already defined in `ROADMAP.md`. Phases P1–P3 are substantially done
(foundation, bag intelligence, scorecard). **Pick up here, in this order:**

1. **P4 — Practice + launch-monitor ingestion.** Sessions, richer CSV + manual import,
   OCR-with-confirmation, statistics recompute, the wedge matrix (calibrated partial
   distances), simulator calibration (stored, never auto-applied), session trends.
   *Risk to respect:* OCR must never silently write to the model — stage, confirm, then
   write (invariant 5).
2. **P5 — Short game + "show me how."** Chip / pitch / bump-and-run / bunker / punch /
   partial templates + setup guidance, wired to the wedge matrix, fully offline. One
   screen of advice per supported shot; no flop unless actually needed.
3. **P6 — Round analysis.** A readable post-round "your caddie's take" from a scored
   round: score trends, club reliability, decision-making insight, practice priority.
   First screen is prose, not a chart wall.
4. **P7 — Equipment lab + research (online).** `EquipmentResearchProvider` with real
   current-market products behind the organic/commercial two-layer rule (invariant 7).
   Legal-review gate before enabling any paid links.
5. Then P8 subscriptions, P9 vision, P10 native GPS + licensed course data — each already
   has a provider interface so it lands without reshaping the core.

**Do not touch without founder sign-off:** P11 brand implementation (keep the neutral
wireframe + swappable accent token until the founder delivers brand assets) and P13
release/App-Store submission. These are hard human gates — see §9.

---

## 8. Working agreement (how to be a good citizen in this repo)

- **Keep the engine pure.** No `fetch`, no `Date.now()` inside computation (pass `now`
  in), no randomness, no RN imports in `packages/engine`. Same inputs → same outputs.
- **Every behavior change gets a test** in `packages/engine/test` (vitest). Add golden
  values and invariant/property tests, not just happy-path.
- **Match the surrounding code**: TypeScript strict, existing naming, comment density,
  and file structure. Read neighboring files before adding one.
- **New external capability ⇒ new provider interface in `core`**, with a null/stub
  default so the app still runs unconfigured. Never import a vendor SDK into a feature.
- **Respect the data model**: UUIDv7 ids, `updatedAt`/`deletedAt`, append-only shot/
  practice rows, raw parameterized SQL for runtime access.
- **Branch discipline**: develop on `claude/coopr-product-architecture-5h3cvg` (or a new
  feature branch off the default branch). Clear commit messages. Do not open a PR unless
  the founder asks.
- **Definition of done for any change:** `npm test` green (42+), all three typechecks
  clean, Metro bundles, and no invariant in §2 weakened.

---

## 9. Handoff boundaries — what the agent must NOT do

- **Secrets.** The Anthropic `sk-ant-...` key goes **only** into
  `supabase secrets set ANTHROPIC_API_KEY=...` (server-side). Never put it in `.env`, the
  app bundle, the repo, a commit, a log, or any chat. Never commit the Supabase
  **service_role** key, the DB password, or any Apple private key. The Supabase
  publishable/anon key is public by design (protected by row-level security) and is the
  only key that belongs in `apps/mobile/.env`.
- **Third-party accounts.** Apple Developer enrollment, Supabase project creation,
  Expo/EAS setup, and the Anthropic key all require the founder's identity, payment, and
  OAuth — the agent cannot create them. The code is already wired to accept them; see
  `SETUP.md` for the drop-in steps.
- **Human-gated decisions (do not proceed without explicit founder approval):** the brand
  system (logo, wordmark, colors, typography), app icon and screenshots, store copy,
  pricing and subscription offering, privacy/terms language, and the App Store
  submission itself. Until brand is approved, stay on the neutral wireframe theme.
- **Live-market / legal-sensitive data.** Equipment prices/specs must be timestamped,
  attributed, flagged when stale, and never fabricated; paid links wait for a legal
  review. Course maps must be licensed data only — never copy a competitor's maps.

---

## 10. Pointers

- `README.md` — overview + quickstart.
- `ARCHITECTURE.md` — invariants, providers, offline/sync, security.
- `DATA_MODEL.md` — tables, ids, change tracking, reconciliation.
- `ENGINES.md` — full engine specs + the validation gate.
- `ROADMAP.md` — phases, MVP boundary, deferred list, risks.
- `SETUP.md` — accounts + the exact wiring to take it to a phone, cloud sync, and the
  App Store.

Build COOPR like the golfer is standing next to you and can tell when a number is made
up. Know their game. Help them play their game.
