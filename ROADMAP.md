# COOPR — Roadmap

Phases, the MVP boundary, and the deferred list. Risks live next to the phase they threaten.

## MVP boundary

The first commercially sellable COOPR does these extremely well: create profile + bag; import/manual club data; robust personal distributions; **bag gap & reliability analysis**; manual shot conditions; deterministic club + swing mode + strategic target + risk recommendation; explanation; "how to hit this"; full-round scorecard; offline core; improvement tracking.

**Cut from the spec's 12-item MVP list:** live equipment *research* (the current-market "what should I buy" pass). It is online-only, legally sensitive, non-deterministic, and not needed to prove the personalization thesis. The offline, data-driven half — bag gaps, overlap, reliability, keep/test/replace — stays in MVP. Research moves to P7.

**Scope note on "explain why":** MVP ships a deterministic template explanation from engine outputs (offline). The LLM personality layer is an online enhancement, never a gate.

Native GPS is not in the MVP.

## Phases

### P1 — Foundation *(current)*
Goal: working app shell + offline SQLite with migrations + sync model + profile/bag/clubs/shots + club-profile engine + deterministic recommendation engine + seed user 001 + quick caddie + first-run onboarding (guided baseline capture: connect/screenshot/CSV/manual, ~10 shots per club, categories kept in separate sessions) + deterministic Golf IQ assessment.
Exit: engine test suite passes with the 5-iron expressing short-miss variability (P50 ≈ 162 carry, not 185); onboarding produces a baseline that generates a Golf IQ; app runs on the iPhone simulator.
Risk: small contaminated samples produce a wrong stock number → robust median/quantiles, mishits kept for risk only. (Resolved: iron seed numbers are carry, founder-confirmed; per-metric modeling keeps the other metric null.)

### P2 — Bag intelligence
Goal: gaps, overlap, reliability, confidence, keep/test/replace/remove, ideal-14 engine.
Exit: seed bag surfaces the AW 49°/Miura 48° overlap, the 4H-over-3H reliability edge, the 5i short-miss floor, and the 8i/9i inverted-gap anomaly.
Risk: recommending bag changes from thin data → gate every suggestion on confidence and frame as "test," not "replace."

### P3 — Scorecard
Goal: fast full-round offline scoring (score/putts/penalties/fairway/GIR/bunker/notes).
Exit: a full 18 entered with a couple of taps per hole; nothing beyond strokes required to advance.

### P4 — Practice + launch-monitor ingestion
Goal: sessions, CSV + manual import, OCR-with-confirmation, statistics recompute, wedge matrix, simulator calibration, session trends.
Exit: an imported session updates profiles only after explicit confirmation; wedge matrix builds calibrated partial distances.
Risk: OCR silently polluting the model → staged extraction, confirmation required before write. Risk: unverified simulator bias leaking into numbers → calibration stored, never auto-applied; "possible outdoor" is display-only.

### P5 — Short game + "show me how"
Goal: chip/pitch/bump-and-run/bunker/punch/partial + setup templates + wedge-matrix integration, offline.
Exit: templated one-screen advice for the supported shot categories; no flop unless actually needed.

### P6 — Round analysis
Goal: "your caddie's take," score trends, club reliability, decision-making insight, practice priority, bag insight.
Exit: readable post-round summary from a scored round; first screen is prose, not a chart wall.

### P7 — Equipment lab + research *(online)*
Goal: `EquipmentResearchProvider`, keep/test/replace/remove, ideal-14 with real products, shaft-profile-to-test guidance, used bag builder — organic fit ranking strictly separate from any commercial layer.
Exit: toggling a sponsor flag leaves the organic ranking byte-identical (tested).
Risk: scraped price/spec ToS + accuracy liability → prefer official/affiliate feeds, timestamp + attribute, flag stale, never authoritative. Legal-review gate before enabling paid links.

### P8 — Subscriptions
Goal: Free/Pro entitlements via RevenueCat, remote-config pricing, restore purchases.
Exit: gated features respect cached entitlements offline; pricing not hardcoded.

### P9 — Vision / screenshot intelligence
Goal: GPS-screenshot and shot-photo extraction behind `VisionProvider`, with confirmation.
Exit: nothing extracted touches the model without user confirmation.

### P10 — Native GPS + licensed course data *(post-launch)*
Goal: licensed `CourseDataProvider`, offline course downloads, green/hazard distances, hole navigation, then the on-course GPS caddie.
Exit: a downloaded course runs a round fully offline.
Risk (launch-gating commercial dependency): course-map licensing cost/terms → start licensing conversations now, in parallel; scope GPS out of V1 so it never blocks launch. Risk (IP): never copy competitor maps — licensed data only.

### P11 — Brand implementation *(pauses for founder assets)*
Goal: replace the neutral wireframe tokens with the approved COOPR design system.
Exit: **STOP** — founder provides brand assets and approval; then implement. Accent stays a token; semantic colors stay independent.

### P12 — Production hardening
Goal: offline stress testing, accessibility, performance, analytics, crash reporting, security, sync-conflict testing, privacy, subscription restoration, account deletion, App Store metadata, TestFlight.
Exit: clean TestFlight build passing the hardening checklist.

### P13 — Release candidate *(pauses for founder approval)*
Goal: App Store release candidate.
Exit: **STOP** — do not submit until the founder approves brand, logo, icon, screenshots, copy, pricing, subscription offering, and privacy language.

## Explicitly deferred until after launch

Native GPS / licensed course maps, on-course GPS caddie, live equipment research at scale, vision/screenshot OCR, Apple Watch, Android public release, Wear OS, automatic shot detection, direct TrackMan/Garmin integrations, Arccos/GHIN import, coaches dashboard, OEM/aggregate analytics, leagues, tournament mode, merchandise/personalized colorways.

## Cross-cutting risks

- **Scope sprawl across 96 sections** starves the core caddie of polish → hard MVP boundary above; every later pillar behind a provider interface so it lands without touching the core.
- **Sync corrupting owned history** → local-authoritative SQLite, client UUIDv7 ids, per-row `updatedAt`/`deletedAt`, LWW + soft deletes, append-only shot/practice rows.
- **Founder brand/pricing approvals** are hard gates at P11 and P13 — planned, not surprises.
