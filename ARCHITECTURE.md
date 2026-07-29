# COOPR — Architecture

Decisions, provider interfaces, offline and sync. Read this before touching cross-cutting code.

## Non-negotiable invariants (enforced in code, not convention)

1. The recommendation engine is deterministic and pure. No LLM ever selects club, target, or swing mode. Engine has no network, no I/O, no RN imports.
2. Lowest expected score wins over maximum distance whenever they conflict.
3. `mechanicalMissPattern`, `strategicTarget`, and `recommendedAim` are separate fields. A miss pattern never becomes an aim offset. `recommendedAim` equals `strategicTarget` unless geometry overrides it.
4. Offline-first. Local SQLite is authoritative. Sync enhances, never gates play.
5. No fabricated data. Unknown stays `null`. Unverified corrections (e.g. the suspected simulator bias) are stored with confidence metadata and never auto-applied. OCR/vision output requires explicit user confirmation.
6. Mishits are kept. Only `invalid` is excluded. Robust stats for stock distance, full distribution for risk.
7. Commercial status never alters organic fit ranking. Two layers, always.
8. The golfer owns their history: CSV + JSON export, account deletion, no data-hostage mechanics.
9. Every external dependency sits behind an interface.
10. Simulator / range / course contexts are never blindly merged.

## Stack

React Native + Expo (Expo Router) + TypeScript. `expo-sqlite` + Drizzle ORM for the local store. TanStack Query for server-state/sync orchestration, Zustand for ephemeral UI state, React Hook Form + Zod for forms and validation. Backend: Supabase (Postgres + Auth + object storage + edge functions). Subscriptions via RevenueCat. Analytics via a provider interface (PostHog first adapter).

Apple ships first; the architecture is platform-neutral so Android and later Watch/web reuse `engine` and `core` unchanged.

## Monorepo layout (npm workspaces)

```
apps/mobile        Expo Router app. UI, navigation, SQLite wiring, provider registry.
packages/engine    PURE. Stats, club-profile engine, recommendation engine. No I/O, no RN.
packages/core      Shared types, Drizzle schema + migrations, seed data, provider interfaces.
packages/tokens    Design tokens. Accent is swappable; semantic colors are independent.
```

`engine` depends on nothing but `core`'s types. `core` depends on nothing app-specific. This is what makes the engine testable in plain Node and reusable on any future surface. npm workspaces (not pnpm) so the repo installs with the toolchain already present; pnpm/yarn work equally if preferred.

## Provider abstraction

Every external capability is a TS interface in `packages/core/src/providers`, resolved through a registry (`ProviderRegistry`) with null/stub defaults so the app runs with nothing configured. Features import interfaces, never vendor SDKs.

```
AuthProvider              sign-in, session, account deletion. Local-only mode is valid.
SyncProvider              push/pull row deltas. Offline is the default state.
LanguageProvider          explanation/personality text. Never selects golf actions.
VisionProvider            OCR/screenshot extraction. Output is staged, not applied.
CourseDataProvider        licensed course geometry. No supplier chosen yet.
WeatherProvider           conditions. Manual entry always available as fallback.
LaunchMonitorProvider     TrackMan/Foresight/etc. ingestion adapters.
EquipmentResearchProvider current-market equipment data. Online-only, cached, timestamped.
ScoringProvider           import from Hole19/18Birdies/GHIN/etc. Each has a state enum.
AnalyticsProvider         event bus. Local buffer, flush when online. No-op default.
SubscriptionProvider      entitlements + remote-config pricing. Cached locally.
```

Integration state enum (per §51): `available | manual_import | partner_required | planned | not_available`.

## Offline & sync

**Local SQLite is the source of truth.** The app reads and writes SQLite for everything; the UI never blocks on the network. Sync is a background reconciliation between the local DB and Supabase Postgres.

- **IDs:** client-generated UUIDv7 (time-ordered) so rows created offline never collide on sync.
- **Change tracking:** every synced table carries `updatedAt` (ms epoch) and soft `deletedAt`. A local `sync_outbox` records pending row changes.
- **Reconciliation:** last-write-wins per row by `updatedAt`. Deletes are soft and win over stale updates. The engine and all core play read only local state, so a failed or absent sync is invisible to gameplay.
- **Conflict policy:** LWW is sufficient because rows are single-owner; there is no shared multi-writer document. Practice/shot rows are append-only, which sidesteps most conflicts. Profiles are recomputed from shots, not hand-edited concurrently.
- **What syncs vs stays local:** all user-owned rows sync. Derived data (club profiles, recommendations) is recomputed locally and cached; it may sync for cross-device convenience but is never authoritative.

## Explanation layer boundary

The engine returns structured `reasons[]`. A deterministic templater renders them to text offline (MVP). `LanguageProvider` optionally rewrites that text in the caddie's personality when online. The personality may joke; the numbers it is handed are fixed. The model is never asked "which club" — only "say this nicely."

## Security & privacy

Secure device storage (`expo-secure-store`) for tokens. Location/camera/photo permissions requested lazily at point of use. Account deletion and CSV/JSON export are first-class. No identifiable golfer data leaves the device without explicit consent.

## What is deliberately deferred

Native GPS/licensed course maps, on-course GPS caddie, vision OCR at scale, live equipment research, Apple Watch, Android release, coaches dashboard, OEM analytics. Each already has its interface so it lands without reshaping the core. See ROADMAP.md.
