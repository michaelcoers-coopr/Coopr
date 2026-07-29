# COOPR

**Know your game. Play your game.** A personal golf operating system — GPS, scorecard,
shot tracking, a deterministic personal caddie, bag intelligence, and equipment
guidance — offline-first, with the golfer owning their data.

This repo is the Phase 1 foundation. Start with the four design docs:
[`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATA_MODEL.md`](./DATA_MODEL.md) ·
[`ENGINES.md`](./ENGINES.md) · [`ROADMAP.md`](./ROADMAP.md).

## Layout (npm workspaces)

```
apps/mobile        Expo Router app: navigation, offline SQLite, seed loader, screens.
packages/engine    PURE, deterministic: club-profile + recommendation engines. No I/O.
packages/core      Shared types, provider interfaces, Drizzle schema, Seed User 001.
packages/tokens    Design tokens (neutral wireframe; swappable accent).
```

The engine is the load-bearing, verifiable core. It has zero React-Native and zero
network dependencies, so it runs and is tested in plain Node.

## Run the engine tests (the validation gate)

```bash
npm install
npm test              # vitest over packages/engine — 22 tests
npm run typecheck     # tsc -b for core + engine
```

The gate: the founding 5-iron models to a **~162 stock with a ~72 yд P20–P80 spread**
and a high short-miss rate — never a 185 "stock" — and the golden-rule case picks the
safer club over a front hazard.

## Run the app

The mobile app is delivered as source; it needs macOS + Xcode to run on the iPhone
simulator (this build environment is Linux, so the app was authored but not
simulator-run here):

```bash
cd apps/mobile
npm install
npx expo run:ios      # or: npx expo start
```

On first launch it migrates the local SQLite store and loads Seed User 001, so the
bag, club profiles, and Quick Caddie are populated immediately.

## Non-negotiable invariants

The deterministic engine (no LLM picks clubs), lowest-expected-score over max distance,
separate `mechanicalMissPattern`/`strategicTarget`/`recommendedAim`, offline-first with
authoritative local SQLite, no fabricated data, mishits kept, commercial status never
altering organic ranking, data portability, provider interfaces for every external
dependency, and separated performance contexts. See `ARCHITECTURE.md`.

## Phase 1 status

Done: monorepo, offline SQLite + migrations, seed dataset, club-profile engine,
deterministic recommendation engine, **deterministic Golf IQ assessment engine**,
**Bag Intelligence + Equipment Lab engine** (gaps, overlap, keep/test/replace/remove,
ideal-14), full test suite (35 tests), Quick Caddie, **first-run onboarding** (guided
baseline capture + CSV import with confirmation), assessment + Equipment Lab screens,
bag/club/practice/profile screens, provider interfaces, local-only auth, **env-gated
Supabase auth/sync adapters**, sync data model + LWW reconciliation core, CSV/JSON
export builders, EAS build config. App typechecks and bundles clean via Metro.

To take it to your phone + cloud sync + the App Store, see **[`SETUP.md`](./SETUP.md)** —
the accounts to create (Apple Developer, Supabase, Expo/EAS) and the drop-in wiring.

Deferred (with rationale in `ROADMAP.md`): live equipment research, native GPS +
licensed course data, vision/OCR, subscriptions, and the brand system (pauses for
founder assets).
