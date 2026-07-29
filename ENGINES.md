# COOPR — Engines

The recommendation engine, the club-profile engine, and the equipment-research architecture. Everything here except equipment research lives in `packages/engine` and is pure, deterministic, and offline.

## Design rules

- Pure functions. No clock reads inside computation (recency uses a caller-supplied `now`), no randomness, no I/O.
- Same inputs → same outputs, byte for byte. This is what makes the engine testable and auditable.
- Mishits are inputs to risk, never to stock distance.
- The engine emits structured data and `reasons[]`. Prose is someone else's job.

## Club-profile engine

**Input:** a club's shots (optionally filtered by swing mode and environment) plus a `now` for recency.

**Statistics (robust, nonparametric):**

- **Stock distance = median (P50).** Never the mean — the seed samples are skewed and bimodal (a good-strike cluster plus a short-miss tail); a mean is dragged toward neither reality.
- **P20 / P50 / P80** via Hyndman–Fan **type-7** quantiles (linear interpolation, the R/NumPy default) so results are reproducible and library-independent.
- **Dispersion** via MAD and IQR, not standard deviation (outlier-robust).
- **Good-strike distance:** median of shots labeled `good_strike`/`representative_stock` when labels exist; otherwise the P80 of distance, explicitly marked *distance-derived, not strike-verified* (avoids the circularity of "good = long").
- **Short-miss / long-miss rate:** fraction of shots falling a robust margin below / above the stock band.
- **Left/right dispersion:** from `side`/`offlineYards` when present; `null` otherwise.
- **Confidence:** a 0–1 score that rises with sample size (saturating), falls with high relative dispersion (IQR/median), and decays with staleness (recency vs `now`). Low n or wild spread ⇒ low confidence, surfaced everywhere the number is shown.

**Metric handling (critical):** each profile records whether it is backed by `carry` or `total`. The seed irons are total-only, so their profiles are total-backed and carry stays `null`. The engine prefers carry when both exist and never fabricates carry from total.

**Output:** a `ClubProfile` per (club, swingMode, environment) with all of the above plus which metric backs it. Contexts are never merged; a caller may request a specific environment or a weighted blend, but the raw per-context profiles always exist.

**Seed validation gate:** the 5-iron total distances (132.8, 80.6, 171.9, 184.7, 119.9, 184.5, 152.2, 184.4, 74.4, 183.0) must yield P50 ≈ 162, P20 ≈ 112, P80 ≈ 184 — a 70+ yard P20–P80 spread — and a high short-miss rate. A 185 stock is a bug. Tests assert this.

## Recommendation engine

**Inputs**

- Target distance and the metric it is stated in (carry or total).
- Conditions: lie, wind (head/tail/cross + speed), elevation delta, temperature.
- Hazards: presence/side/distance for front, back, left, right.
- Strategic intent (attack pin / play safe / lay up) and risk preference (conservative / neutral / aggressive).
- The player's `ClubProfile` set.

**Computation (deterministic)**

1. **Plays-like distance.** Adjust the raw target by an additive conditions model: headwind lengthens, tailwind shortens, uphill lengthens, downhill shortens, cold lengthens, lie adjusts expected distance and inflates dispersion. Each adjustment is a documented constant and appears in `reasons[]`. Wind and elevation are separated so their contributions are auditable.
2. **Candidate scoring.** For each club × swing mode, compare the plays-like distance to that club's distance distribution. Build an expected-outcome score that (a) rewards landing near target, (b) **penalizes miss zones that overlap a hazard** (short-miss into a front bunker, right-miss into water), (c) penalizes low confidence, and (d) reflects risk preference. Distances use the metric that matches the target; if a club is total-backed and the target is carry, that mismatch lowers confidence and is stated.
3. **Selection.** Choose the **lowest expected score** option. When a longer club would reach on a good strike but its short-miss distribution overlaps a hazard, a shorter, safer club wins — this is invariant 2, and there is a test for exactly this case.
4. **Targeting.** `strategicTarget` from geometry (center green / fat side / safe zone / pin when appropriate — default is *not* pin-hunting). `recommendedAim = strategicTarget`. `mechanicalMissPattern` is computed from dispersion for awareness and populates risk fields and practice priorities — it is **never** folded into `recommendedAim`.

**Outputs**

`club`, `swingMode`, `strategicTarget`, `recommendedAim`, expected carry/total band, `shortRisk` / `longRisk` / `leftRisk` / `rightRisk`, `missZoneWarning`, `mechanicalMissPattern`, `confidence`, and `reasons[]`. The explanation layer renders `reasons[]`; the LLM never sees the candidate math as a decision to make.

**Testing**

- **Golden values** on the seed dataset (the 5-iron gate above; profiles for 6i–9i, AW, driver).
- **Invariants as property tests:** adding a `mishit` never increases stock distance; identical input yields identical output; lowest-expected-score beats a longer club across a hazard; `recommendedAim` never diverges from `strategicTarget` due to a miss pattern; unknown fields stay `null`.
- **Conditions monotonicity:** more headwind never shortens plays-like distance; colder never shortens it; etc.

Tests run in plain Node via vitest — no simulator, no network — which is the whole point of the purity rule.

## Equipment-research architecture (online, not in the pure engine)

Equipment research is explicitly **not** part of the deterministic engine. It is an online, cached, provider-backed feature.

- `EquipmentResearchProvider` fetches current products/specs/prices when the device is online. Results are cached as `EquipmentProduct` rows with `lastVerifiedAt` and shown with a freshness indicator; stale data is flagged, never silently trusted, never fabricated.
- Source priority per §39: manufacturer pages → independent testing → pro fitting sources → retailers (price) → used marketplaces → recent model-year coverage. Prices are timestamped and attributed.
- **Two strictly separate layers (invariant 7):** the *organic fit ranking* is computed only from the golfer's data (speed, launch, spin, attack, carry/total, dispersion, impact consistency, mishit type, gaps above/below, confidence, budget). The *commercial layer* (partner/affiliate/sponsored) is joined for display only. A sponsor cannot change a rank; a test toggles a sponsor flag and asserts the ranking is byte-identical.
- Output always explains *why* a category or product fits, recommends **shaft profiles to test** rather than claiming an exact fitted shaft, and labels professional fitting as the final validation step.
- Runs online only; its absence never blocks core play.
