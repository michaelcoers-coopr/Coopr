# COOPR Analysis: "NASA-level insights you can actually use"

Status: **spec + tested engine, nothing wired into the app yet.** Needs Mike's approval before it goes anywhere near the repo.
Files: `src/` (engine), `test/` (64 tests), `fixtures/synthetic.ts` (synthetic data), `strip.png` (6 mockups), `WOW_LIST.md`, `sample_output.json` (engine output on the synthetic season).
Run: `PATH=/tmp/node-v22.11.0-linux-x64/bin:$PATH npm test` (and `npm run typecheck`).

## 0. The promise, and the honest version of it

"NASA-level" here means **rigor, not volume**: every number is traceable to rows the player logged, every insight says how sure it is, and every insight ends in one thing to do. We do not show a number we cannot defend. When we cannot, we show an invitation.

Three things we will not do:
1. **No invented numbers.** Unknown is `null`. Below the sample gate an insight returns `status: needs_more` with an invitation ("Needs 2 more rounds"), never a placeholder figure, never a faded one.
2. **No fake strokes gained.** True strokes gained needs a baseline dataset and shot positions. COOPR collects neither today (section 1). Until then the ranking runs on an exact, scorecard-only ledger against a *stated rule* (par's own allowance), and says so.
3. **No claim the data cannot carry.** Correlation is not blame; "your back nine is worse" is not "you are tired". The take says what the numbers show and suggests a test.

## 1. What COOPR collects today, and what Analysis needs

Source of truth for the current model: `coopr2/docs/DATA_MODEL.md` and `packages/domain/src/types.ts` (schema 2).

| Input | Collected today? | Where | Notes |
|---|---|---|---|
| Strokes, par per hole | **Yes** | `hole_scores` | |
| Putts, penalties per hole | **Yes (columns exist, nullable)** | `hole_scores` | Null means "not logged". We never read null as 0. |
| Round date, course, tee, rating/slope | Yes | `rounds` | |
| Measured carry / total per club (monitor, range, sim) | **Yes** | `shot_measurements` (`aggregation='shot'` only) | The only trustworthy distance source today. |
| Club used + distance to center on course | Yes, but **not usable as carry** | `club_use_observations` | `calibration_eligible = 0`: a GPS distance-to-center is not a shot. |
| GPS distance to center | Yes, **not a shot** | `gps_observations` | `is_shot = 0` by constraint. |
| Fairway result (hit / left / right / short / long) | **No** | | One tap after the tee shot. |
| GIR flag | **No** | | One tap per hole (or derived once shots exist). |
| First-putt distance | **No** | | Optional tap or voice ("twenty footer"). |
| **Shot start / end position and lie** | **No** | | The big one. Unlocks real strokes gained, dispersion on course, proximity, shot trails. Needs tap-to-mark or watch/phone GPS shot detection. Today's rule says a GPS point is not a shot, so this is a new capture feature, not a reinterpretation. |
| Target line / aim point per shot | **No** | | Needed for left/right dispersion on course. Monitors give it free (`carry_side`). |
| Target score for the round ("break 90") | **No** | | One field at round start. Enables break-target pressure holes. |
| Round format (solo / game / tournament), am/pm | Partly (games live in Foursome) | | `foursome` knows if a game was played. |
| Per-hole Birdie Bucks result | **Skins only** | Foursome ledger | Stableford and Nassau settle at game level, so their per-hole BB is `null`. BB are points; Foursome stores integer hundredths. |

**Capture asks, cheapest first (all taps or voice):** (1) putts + penalties every hole (already in the model), (2) GIR + fairway after each hole, (3) target score at round start, (4) first-putt distance, (5) tap-to-mark shots with lie. Each ask unlocks named insights below, and the "Needs" copy tells the player exactly which ask unlocks what.

## 2. Ground rules (apply to every insight)

### 2.1 Envelope
Every insight returns the same shape (`Insight<T>` in `src/types.ts`):

`status` (`ready` / `needs_more` / `not_collected`), `value` (null unless ready), `n` + `nUnit` + `nNeeded`, `confidence`, `sample`, `quality`, `baseline`, `invitation`, `take`, `numbers`, `missingInputs`.

- `needs_more`: we have the field, not enough of it. Copy: **"Needs N more rounds"** (or holes/shots), N = shortfall to the minimum.
- `not_collected`: the field does not exist for this player. Copy: the exact tap that unlocks it. No amount of rounds helps.
- A number only ever lives in `value` when `ready`. UI must not render `value` otherwise, and must not draw a grayed placeholder number.

### 2.2 Confidence bands
Same four names as `ConfidenceBand` in the app domain: `insufficient`, `limited`, `moderate`, `solid`. Each insight has `[limited, moderate, solid]` thresholds in its own unit (config `gate`, proposed defaults, not facts; to be tuned against real player data and a PGA professional's review).

| Insight | Unit | limited (shows) | moderate | solid |
|---|---|---|---|---|
| `loss_ledger`, `blowups`, `penalty_leaks` | complete holes | 54 (3 rounds) | 90 | 180 |
| `three_putt` | holes with putts | 36 | 72 | 144 |
| `fairways` | par 4/5 tee shots with a result | 30 | 60 | 120 |
| `gir` | holes with GIR | 36 | 72 | 144 |
| `scrambling` | holes where the green was missed | 15 | 30 | 60 |
| `scoring_by_hole_type` | holes per bucket | 8 | 20 | 45 |
| `back_nine_fade` | complete 18-hole rounds | 5 | 8 | 12 |
| `pressure` | pressure holes (plus 36 non-pressure) | 12 | 24 | 48 |
| `time_splits` | rounds in each group (2x for the insight) | 5 | 8 | 12 |
| `nemesis_holes` | plays of one hole | 3 | 5 | 8 |
| `club_gapping` | measured carries per club (and 3+ clubs) | 3 ("Learning") | 10 ("Yours") | 25 |
| `dispersion` | tracked shots per club | 10 | 20 | 40 |
| `strokes_gained` | fully tracked holes (and 25 shots per category) | 90 (5 rounds) | 180 | 360 |

Confidence copy: *Early read* (limited), *Solid read* (moderate), *Locked in* (solid). A card never says "Locked in" below `solid`.

### 2.3 Sample labeling
- Any insight touching **any** sample / synthetic / demo row carries `sample: true` and the UI shows the red dashed `SAMPLE` chip, on the screen and on every share card made from it. A card made from sample data can never lose the chip.
- Mixed real + sample = sample. Real rows never inherit a label from a prior sample session (rows carry their own `isSample`).
- Mockups and fixtures are labeled **"Sample"**. Engine fixtures live in `fixtures/synthetic.ts`, are marked `SYNTHETIC TEST DATA`, and every row has `isSample: true` (a test enforces it).

### 2.4 Data quality
`quality` is the weakest of the contributing inputs, using the app's six-value scale (`measured`, `user_confirmed`, `derived`, `estimated`, `provisional`, `unknown`). Carry and total never blend. Gapping only accepts `measured` or `user_confirmed` carries; an `estimated` or `unknown` carry never enters a gap (tests enforce it). Range, simulator and course carries are **never pooled**: per club we use the one environment with the most shots (course wins ties), and the row says which.

### 2.5 No-invented-numbers, enforced
1. Every sentence about the player is built from engine values. Each `take` passes through a formatter that whitelists the numbers it prints (`Insight.numbers`).
2. `ungroundedNumbers(text, allowed)` is the guard: any digit string that is neither engine-computed nor structural vocabulary (hole/putt/par/club words: 1-5, 9, 14, 18, "7-iron") is a failure. Tests run it over every take and every share card.
3. Prescriptions (drills) may contain parameters ("3 balls from 20, 30 and 40 feet"). Those are coaching instructions, not claims about the player, and live in a separate field.
4. A `shareTake` strips course names. Cards never carry course, date or playing partners unless the player turns that on (`includesLocation` is typed `false`).

### 2.6 Tone
Plain, irreverent, honest. Roast the **behavior**, never the player's body, age or ability. One idea per take, and every take ends in something to do. No guarantees ("you will save 3 strokes"); we say what the data shows and what to try.

## 3. Baselines: what "lose strokes" is measured against

Three baselines. Each result names its baseline in `baseline` and on screen.

1. **`par_allotment` (ships first; exact).** A par is 2 putts plus (par - 2) strokes to reach the green. This is a *stated rule*, not a statistic. Per hole: `strokes - par = penalties + putting + tee_to_green`, where `putting = putts - 2` (holed-out holes put the whole excess in tee-to-green) and `tee_to_green = strokes - penalties - putting - par`. The buckets **add up exactly** to strokes over par (test enforced). Weakness: it does not know a 30-foot putt from a 3-footer, and a chip-in reads as tee-to-green. We say so.
2. **`own_average` ("vs your own average").** Expected strokes from a lie/distance bucket = the mean strokes the player actually needed from that bucket in their own fully tracked holes (bucket needs 15+ samples; gaps stay null). It nets to about zero by construction, so it shows the *shape* of the game (relative strengths), **never a verdict of what you lose to anybody**. It is shown as "Profile", and the engine **refuses** to use it to rank losses (test enforced).
3. **`handicap_band` / `tour` (true strokes gained; not shipped).** Needs a baseline table. Facts we have verified:
   - Strokes gained as "baseline expected strokes from the start minus from the end, minus one" is Mark Broadie's method, built on PGA Tour ShotLink data (Columbia, *Putts Gained*: https://columbia.edu/~mnb2/broadie/Assets/putting_strokes_gained_20110113.pdf, which also gives the worked examples: from 33 ft the Tour average is 2.0 putts, from 8 ft it is 1.5). The book is *Every Shot Counts* (2014).
   - The published tables are **PGA Tour values**; amateurs will read negative everywhere (https://strokesgain.com/blog/strokes-gained-putting-explained says the same).
   - A community dataset on Kaggle (https://www.kaggle.com/datasets/evancallaghan/pga-tour-strokes-gained-baseline-values) re-keys the book's table with spline interpolation and some naive extrapolation, and its license is "Other (specified in description)". **We do not bundle it.**
   - **We ship no tour or band numbers.** Open items: (a) license for any table we would bundle (book table vs a licensed provider), (b) an amateur-appropriate baseline by handicap (Broadie's book discusses amateur levels; *not verified here*, do not cite until checked), (c) a PGA professional's sign-off. The engine takes a pluggable `Baseline` object; a baseline flagged `synthetic` throws unless `allowSyntheticBaseline` is set, so test baselines can never reach a screen.
   - A future **crew baseline** (your Foursome crew's anonymized averages, opt-in) is a natural fit and lands in `own_average`'s slot with its own label.

Definitions we follow (verified): GIR = any part of the ball on the green in par minus 2 strokes or fewer; scrambling = par or better on a hole where the green was missed in regulation (https://rotogrinders.com/pages/pga-golf-stats-legend-743522, https://golf.com/news/a-new-stat-for-the-pga-tour-strokes-gained-scrambling/, https://www.golfcompendium.com/2021/09/pga-tour-scrambling-leaders-by-year.html). The scorecard cannot give a true up-and-down (that needs the shot sequence), so the insight is labeled **scrambling (proxy)**.

## 4. Insight catalog

Legend: **In** inputs, **Min** gate (section 2.2), **Method**, **Take** (the actionable line). Examples are either real engine output on the synthetic season (so Sample) or marked *illustrative*, meaning wording only, with numbers that the engine did not produce on that fixture.

### 4.1 `loss_ledger`: Where you lose strokes (ranked)
- **In:** strokes, par, putts, penalties per hole (all four, else the hole is skipped and counted). Optional: GIR, fairway.
- **Min:** 54 holes (3 rounds).
- **Method:** the exact decomposition in 3.1, per 18 holes. Normalized on **all** holes so buckets add to the round. Two splits, chosen automatically:
  - `by_outcome` (when GIR and fairway are logged on every hole): penalties, putting, *missed green after missing the fairway*, *missed green from the fairway or a par 3*, *holes where you hit the green*.
  - `by_par_type` (fallback): penalties, putting, par 3 / par 4 / par 5 tee-to-green. Par 4 looks big partly because there are more of them; the take does not hide that.
  Outcome buckets describe *what happened*, not whose fault it was.
- **Output:** items ranked loss-first; gains (negative) listed as strengths.
- **Take:** "Biggest leak: Missed green from the fairway (or a par 3) at 7.2 strokes a round against par's own allowance. That's where your next shot comes from, not your driver ego." *(Sample)*

### 4.2 `ranking`: the headline list
Uses `strokes_gained` only if the baseline is `tour`/`handicap_band` and at least 3 categories have 25+ shots; otherwise `loss_ledger`. Always shows its caveat line ("Measured against par's allowance, not against Tour players...").

### 4.3 `blowups`: Blow-up holes
- **In:** strokes, par. **Min:** 54 holes. **Method:** holes at +2 or worse; `bogeyCapSaving = sum(overPar - 1)` over them, per 18. Overlaps the ledger (it is a different cut, not an additive one) and is marked as such.
- **Take:** "You make a double or worse 3.3 times a round. Cap every one at bogey and you save 4.1 strokes. Bogey is a fine score. Take the medicine, get back in play."

### 4.4 `three_putt`: 3-putt rate
- **In:** putts per hole (holes with putts >= 1); optional first-putt feet. **Min:** 36 holes.
- **Method:** 3-putt-or-worse per 18; gross excess `sum(max(0, putts - 2))` per 18; 1/2/3+ shares. With first-putt distance (36+ holes) it adds a by-distance cut (under 10 ft, 10-25, over 25), each cell needs 8 holes.
- **Take:** "2.8 three-putts a round, costing 3 strokes. Those are pure giveaways. The fix is the first putt: get it inside three feet, forget about holing it."

### 4.5 `fairways`: Fairways and miss pattern
- **In:** fairway result on par 4/5. **Min:** 30 tee shots. Not collected today.
- **Method:** hit rate; left/right/short/long counts; a **dominant miss side** is only called with 8+ misses, a 65%+ share of left+right, and an exact sign-test p < 0.1 (otherwise "misses don't favor a side").
- **Take:** "You hit 51% of fairways and your misses don't favor a side, so aiming isn't your fix. Dispersion width is." or "...65% of the side misses go right. Aim a couple of paces left..."

### 4.6 `gir` and `scrambling`
- **`gir`:** GIR flag, min 36 holes; rate and putts per GIR (10+ GIR holes). **`scrambling`:** missed-green holes, min 15; par-or-better rate **and** bogey-or-better rate (the second matters more for 15+ handicaps). Both not collected today.
- **Take (scrambling):** "You save par on 28% of the holes where you miss the green, and bogey-or-better on 71%. Missing the green isn't the crime. Turning it into a double is..."

### 4.7 `penalty_leaks`: Penalty-stroke leaks
- **In:** penalties per hole. **Min:** 54 holes.
- **Method:** penalties per round; split by par type; **repeat-offender holes** (same course + hole number, 3+ plays, 2+ with a penalty), ranked.
- **Take:** "1.8 penalty strokes a round. ... Hole 11 at {course} has bitten you in 6 of 12 rounds. Leave the driver in the bag there." (`shareTake` drops the course.)

### 4.8 `scoring_by_hole_type`: Scoring by par / yardage / difficulty
- **In:** strokes, par; yards; stroke index. **Min:** 8 holes **per bucket**.
- **Method:** buckets by par, by par x yardage band (config `yardageBands`: par 3 under 140 / 140-175 / over 175; par 4 under 350 / 350-420 / over 420; par 5 under 500 / 500-550 / over 550, **product defaults, not facts**), and by stroke-index third (1-6, 7-12, 13-18). Each: average to par, double-or-worse rate, birdie-or-better rate. A bucket under 8 holes shows its invitation, no average. The headline is only as confident as the weaker of the best and worst bucket it names.
- **Take:** "Worst spot: Hardest 6 (SI 1-6) at 0.99 over par a hole. Best: Easiest 6 (SI 13-18) at 0.44. Play the first like it hates you and the second like you own it."

### 4.9 `back_nine_fade`: Back-nine fade
- **In:** strokes and par on complete 18-hole rounds. **Min:** 5 such rounds.
- **Method:** per round `back - front` (to par). Report mean, rounds worse on the back, exact sign-test p. **Verdict `fade`** needs mean >= +1.0 stroke **and** worse in >= 70% of rounds (config; one bad finish never makes a "fade"); symmetric `strong_finish`; else `no_meaningful_difference`. When putts + penalties exist, the fade is decomposed into penalties / putting / tee-to-green per round, so the take names *what* falls apart.
- **Take (fade, illustrative):** "Your back nine runs 2.1 strokes worse than your front, and it's worse in 9 of 11 rounds. That's a pattern, not bad luck. Most of it is putting (1.2 strokes a round). Eat something at the turn, hit five warm-up wedges on 10 tee, and note what falls apart." *(the fixture season shows no fade and says so)*
- We do not claim fatigue. The cause is unknown from scores, and the take proposes a test.

### 4.10 `pressure`: Pressure holes
- **Pressure tags:** `break_target` (computed), `game_on_the_line` (from Foursome: skins carry on the line, match dormie, Nassau press; set by the capture layer), `closing_hole`.
  - **`break_target`:** with `bank = target - strokesSoFar - sum(par of holes still to play)`, hole 2+ is a pressure hole when `-1 <= bank <= 3` (you can afford at most 3 strokes over par from here; or you now need a birdie). Config `bankMin/bankMax`. Hand-worked test: all bogeys, target 90 on par 72, pressure on holes 16-18.
- **Min:** 12 pressure holes and 36 others.
- **Method:** for each pressure hole, `delta = scoreToPar - your own average to-par on non-pressure holes of the same par type` (so a pressure par 5 is compared to your par 5s). Report mean delta and its standard error. **`pressure_tax`** only if `mean > 0` and `mean >= 2 x SE`; `pressure_player` mirror; else "no detectable effect" (the common honest answer). Regression to the mean and tiny samples are why the bar is 2 SE.
- **Take (illustrative):** "When it matters you give 0.4 strokes back per hole versus your normal. Same swing, tighter grip. Pick the boring target and commit to it before you walk to the ball." or the no-effect line "Don't blame nerves yet."

### 4.11 `time_splits`: Your Tuesday vs your Saturday
- **In:** complete 18-hole rounds, date (weekday/weekend), am/pm, format (game vs solo). **Min:** 5 rounds in each group of a pair.
- **Method:** mean to-par per round per group; Welch standard error; **detectable** only if `|diff| >= 2 x SE`. Returns the single biggest detectable split, or says none beats noise.
- **Take (illustrative):** "Weekend you beats Weekday you by 2.4 strokes a round (6 vs 6 rounds). Book your tee times like you mean it." Course, wind and playing partners are confounds; the take never claims cause.

### 4.12 `nemesis_holes`: Nemesis holes
- **In:** same course + hole, 3+ plays. **Method:** hole's average to par minus your average on same-par holes at that course; flagged at >= 1.0 stroke worse. Top 3.
- **Take (illustrative):** "Hole 7 at {course} is your nemesis: 3.0 over par on average, 2.6 worse than your usual for that kind of hole. Write a different plan for it: take the safe club off the tee and play to the fat side."

### 4.13 `club_gapping`: Club gapping, real vs default
- **In:** measured carries per club (`measured`/`user_confirmed` only), optional bag, optional default-carry function (club-distances). **Min:** 3 carries per club to appear (label **Learning**), 10 for **Yours**; 3+ clubs to compute any gap.
- **Method:** per club P20/P50/P80 (Hyndman-Fan type 7, same as `@coopr/engine`), spread = P80 - P20, short-miss share (carries under 90% of P50, shown at 10+). **Gaps** between neighbors sorted by P50, **driver excluded** (driver-to-3-wood is naturally big). `big` = gap >= max(15 yd, 1.5 x median gap); `overlap` = gap <= max(3 yd, 0.4 x median gap) (config, from the fitter spec's "multiple of the bag's median gap", threshold still to be tuned against real bags and a certified fitter). **Real vs default:** `deltaVsDefault = measured P50 - default carry` for the player's flex, shown only once the club has 3+ shots; defaults never fill a gap as if measured.
- **Take:** "Pitching wedge to sand wedge is a 31-yard hole in your bag. You have no club for that number. Tap the gap to see what fills it. Hybrid and 5-iron carry only 1 yard apart. One of them is a spare. Your driver actually carries 13 yards shorter than the chart says. Play your number, not the chart."

### 4.14 `dispersion`: Dispersion and miss pattern
- **In:** per shot landing offset: lateral (+right of target) and longitudinal (+long of intended carry). From a launch monitor (`carry_side`, carry vs target) today; on course only after shot tracking with a target line. **Min:** 10 shots per club.
- **Method:** mean offsets (bias), sample SDs, 2-D **covariance ellipse** at chi-square 3.219 (80% coverage under a bivariate normal model; 2.279 gives 68%, 5.991 gives 95%), plus 80% band width/depth. **Aim offset** = minus the lateral bias, only when `|bias| >= 3 yd` **and** `|bias| / SE >= 1.5` (otherwise the "bias" is noise and we say none). The ellipse is a *model*; we label it "80% of shots" and test that real data covers about that.
- **Take:** "Your 7-iron lands about 4 yards right of where you aim. Aim 4 yards left and you've just bought free accuracy." or, without a stubborn side (illustrative), "Your widest pattern is the driver: about 49 yards wide. Pick targets with that much room, not a flag tucked behind a bunker."

### 4.15 `strokes_gained`: Strokes gained (and the profile)
- **In:** on-course shots with start lie + distance to pin and end lie + distance, penalty strokes; a `Baseline`.
- **Integrity gate:** a hole is used only if its shots **reproduce the scorecard** (shots + penalties = strokes, seq 1..k, last shot holed, and each shot's end spot is the next shot's start spot within 0.5 yd). Otherwise it is rejected and counted, never "fixed".
- **Method:** `SG(shot) = E(start) - E(end) - 1 - penaltyStrokes`, `E(holed) = 0`. Per hole SG telescopes to `E(tee) - strokes` (test enforced). Categories: off the tee (tee shot on par 4/5), approach (par 3 tee shots and non-tee shots > 30 yd from the hole off the green), around the green (<= 30 yd, not on green), putting. The 30-yd cut follows the common convention; not verified against any official definition. A position the baseline does not cover is skipped, never interpolated silently.
- **Min:** 5 fully tracked rounds; 25 shots per category to show it.
- **Take:** `own_average`: "Against your own average, putting is your weakest link (-0.55 strokes a round). That's relative to you, not a verdict..." `tour`/`handicap_band` (future): "Biggest loss against {baseline}: ..."
- Not collected today: shot positions and lies.

### 4.16 `one_fix`: One thing to fix next round
See section 5.

## 5. "Where you lose strokes" and "One thing to fix"

### 5.1 Candidates
From `loss_ledger` / `blowups` / `three_putt` / `penalty_leaks`:
`penalties`, `three_putts` (gross excess), `blowups` (bogey-cap saving), and either `tee_trouble` (missed green after missing the fairway) + `approach_short_game` (missed green from the fairway or a par 3) when GIR and fairway are logged, or `ttg_par3/4/5` otherwise. A candidate must lose at least **0.5 strokes per 18** (below that: "No single leak is big enough to lecture you about").

### 5.2 Score
`score = strokesPer18 x fixability x confidenceWeight`, where
- `fixability` = COOPR coaching weight (config, **a product judgment, not a measurement**): penalties 1.0, 3-putts 0.9, blow-ups 0.8, par 5 0.6, `tee_trouble` 0.6, `approach_short_game` 0.6, par 3/4 tee-to-green 0.5;
- `confidenceWeight` = 0 / 0.4 / 0.7 / 1.0 for insufficient / limited / moderate / solid.

Highest score wins; ties break by id. The runner-up is returned for "also on the radar".

### 5.3 Anti-nag rotation
If the same fix was shown last round, its score is multiplied by 0.6, so a close runner-up takes over; a fix that is still far ahead stays. `rotatedAwayFrom` is returned so the UI can say "You worked on 3-putts last time; here's the next biggest leak." The cooldown constant is a proposal.

### 5.4 Prescription (what the player sees)
`headline` (one sentence for next round, built from the player's own data: hole number, miss side), `strategy` (why it works, on-course), and a short `drill` (title + steps). Drills are COOPR-written starting points, not guarantees. Catalog (`src/fix.ts`):
| Fix | Next-round move | Drill |
|---|---|---|
| Penalties | Name the trouble, take the club that stays short of it; safe club on any hole that has already cost you | "Find your safe club": 10 balls each with driver, 3-wood, hybrid at one corridor; the one that stays in most is the trouble club |
| 3-putts | First putt is a lag, inside three feet | "Lag ladder": 3 balls each from 20, 30, 40 ft into a dinner-plate circle |
| Blow-ups | After trouble, get back in play; bogey is a win | "Bogey-is-fine ledger": tick each safe choice |
| Tee trouble | Safer club off the tee, aim away from the miss (if a side is proven) | "Fairway finder" |
| Approach / short game | Middle of the green; chip to the fat side | "Up-and-down ladder": 9 balls around a green |
| Par 3 / 4 / 5 | Middle of the green; fairway first; layup to a favorite wedge number | Center-of-the-green habit / Fairway finder / Pick your number |

### 5.5 Cold start
Before 54 holes (or without putts/penalties) `one_fix` is `needs_more`, and its invitation is the fix: **"Until then, the one thing is: log putts and penalties on every hole."** That is honest and useful.

### 5.6 Close the loop (next phase)
Store the shown fix and its per-18 value; after the next 3 rounds show **"Did it work?"** with the same metric, labeled *Early read* until the sample is moderate. Never claim causation.

## 6. Integration with the rest of COOPR

### 6.1 Club fitter (bag gap)
`toFitterBagGap(gap, dispersion)` returns **measured clubs only**: carry P20/P50/P80, shots, environment, label (Learning/Yours), dispersion width, aim offset. **Defaults never feed gap analysis as if measured** (matches FITTER_SPEC section 2 and 4.4). Each gap carries a fitter `category` (wedges / fairway_hybrid / irons / driver) and a `targetCarryYds` (midpoint of a `big` gap). The payload has no price, brand or commission field: ranking stays brand-neutral by shape. Dispersion width is the raw input for the fitter's `forgiveness_need`; the 0-1 transform stays the fitter's decision. Overlap (`HY`/`5I` within 3 yd) feeds the "one is a spare" card.

### 6.2 Distance defaults to measured (club-distances)
`toPlayerShots(shots, club)` produces club-distances `PlayerShot[]` (carry and total kept apart, null stays null). Pace matches: **3 shots = "Learning", 10 shots = "Yours"** (tested against the real engine). Analysis owns the measured P20/P50/P80 and the delta vs default; club-distances owns the default and the blend. The gap view shows the default only as a ghost marker until the club is "Yours".

### 6.3 Foursome (Birdie Bucks)
- **Hustler of the Week is untouched** (it is BB net, per Foursome SPEC 5.5). Analysis adds **"Why you hustled"**: `hustlerExplainer(rounds)` splits a player's BB by par type and pressure holes, names the biggest single-hole swing, gated at 9 holes with a BB result. Per-hole BB exists for skins only; other games return null for per-hole BB, and the explainer only counts holes that have one. It always carries "Birdie Bucks are game points with no real-world value. They can't be bought, sold or redeemed." It never prints a dollar sign or a payment word.
- **Cosmetic crew badges** (`crewBadges`): *Closer* (last 3 holes vs first 15, must be better), *Clean Card* (fewest penalties per round), *Ice* (best pressure delta, only `pressure_player` verdicts), *No Doubles* (lowest blow-up rate). Rules: opted-in players only (a player who does not share stats never appears, even as a runner-up), a badge needs at least 2 eligible players, ties are shared, each uses its own insight gate, season window not weekly. No prize, no BB, no effect on Hustler or any ranking. Copy: "Cosmetic badges for bragging rights. No prize, no Birdie Bucks, no effect on Hustler of the Week."
- **Pressure feed:** Foursome tags `game_on_the_line` holes (skins carrying 2+, dormie, press) so `pressure` can compare "money holes" to normal holes. Tags are points-on-the-line, not dollars.

### 6.4 Shareable insight cards
`buildCards(analysis)` -> `InsightCard`: eyebrow, oversized Bebas number + unit, headline, grounded take, **"Based on N {unit}"**, confidence label, `sample` chip, footer. Rules: no card for a non-ready insight; `includesLocation: false` (course/date/partners off unless the player turns it on, per-share, same as Foursome recap); every number grounded (tested); the SAMPLE chip is non-removable on sample data. Kinds: `one_fix`, `loss_ranking`, `gap`, `three_putt`, `fade` (only when the verdict is `fade`), `pressure` (only when a verdict is called). A fix card might share as "ONE THING TO FIX / 4.8 STROKES / ROUND / 3-putts".

## 7. Privacy and consent
Analysis runs **on device** on the player's own rows. Crew badges and any benchmark need opt-in per stat and send only aggregates (no rows, no positions). Share cards leave the device only when the player taps share. Account deletion removes derived caches (insights are recomputable and not stored as facts).

## 8. What needs real data we do not collect yet
- Fairway, GIR, first-putt distance, target score, round format: one-tap captures (section 1). Without them, `fairways`, `gir`, `scrambling`, `pressure` (partly) are `not_collected`.
- **Shot positions, lies, target lines:** real strokes gained, on-course dispersion, proximity, shot trails.
- **A licensed or verified baseline** by handicap: required before any "vs players like you" claim.
- **True up-and-down and sand-save:** need the shot sequence around the green.
- Weather, wind, elevation, turf: confounds for `time_splits` and dispersion. Not collected; the takes never claim cause.
- A real-player validation set: all thresholds are config defaults to be tuned on real rounds and reviewed by a PGA professional / certified fitter.

## 9. Test coverage (64 tests, all passing)
Stats (type-7 quantile, exact sign test, ellipse hand case) / ledger identity (hand-computed hole, holed-out hole, exact sum on both splits) / gating (thin player gets zero numbers; shortfall math; null putts skipped; not_collected states; empty input) / confidence bands / SAMPLE labeling (sample, real, mixed) / back-nine fade (consistent, too few, inconsistent) / break-target pressure tags (hand-worked) / pressure verdicts / 3-putt and blow-up arithmetic / time-split noise bar / nemesis holes / gapping (flags, driver excluded, P50 vs raw type-7, labels at 3/10 shots, default delta vs the **real club-distances engine**, estimated/unknown carry excluded, environments not pooled) / dispersion (aim offset, no-bias, under-gate, ellipse coverage) / strokes gained (telescoping identity on hand and fixture holes, penalty shot, scorecard reconciliation, broken chain rejected, own-average cannot rank, synthetic baseline refused, no on-course shots) / one-fix (score = strokes x fixability x confidence, rotation, clean card) / grounding guard over every take and card / share cards (sample chip, no location, no card when not ready) / fitter payload (measured-only, brand-neutral) / crew badges (opt-out invisible, 2+ eligible, ties shared) / Hustler explainer / determinism / doc drift (every insight id appears in this file).

## 10. Open questions (defaults in the report)
1. Ship the scorecard ledger first and ask for GIR + fairway taps, or hold Analysis until shot tracking exists? *Default: ship the ledger first.*
2. Where does the true strokes-gained baseline come from (license the book table, a data provider, or build our own from the opt-in crew data)? *Default: no baseline claim until a license and a PGA-pro review; use "vs your own average" as a labeled Profile.*
3. How loud is the roast? *Default: roast the behavior, never the person; a "Serious mode" toggle drops the jokes and keeps the numbers.*
