# COOPR 2.0 roadmap

Founder decision, 22 Oct 2026. Scope is the competitive audit and the Tiger-lens audit: everything in Must, Next, and Later. It ships in phases. Mike tests each phase on his iPhone and approves it before the next one starts.

Brand for these phases: navy, white, and red. The Navy Fill crest. Tagline: "The smartest caddie you'll ever carry." No green fills. The voice on screen is dry and does not invent a number. The full caddie stays on. Tournament mode stays off until the Later phase is approved.

The crest drawn in the app is a stand-in: a navy shield, white "NF", and a red bar. It is not the official artwork. That file still has to come from Mike.

## Why this order

Phase 1 is the round a golfer can play at High Cedars inside Expo Go. Voice, Apple Music, and the Watch need native modules Expo Go does not include, so they wait even though both audits mark them Must. The caddie layer in Phase 2 sits on a round that already scores. German and Spanish ship with the Watch, after the English hole screen is one Mike will actually use.

Course data is the provider-independent path already on this branch: OpenGolfAPI for the scorecard, OpenStreetMap for geometry, an admin check, an offline cache, quality flags, a manual fallback, and a commercial stub. The pilot is High Cedars. No hole is admin-verified, so GPS yardages stay off until Mike verifies a green.

## Phase 1 — Core round

Status: built on this branch. Waiting on Mike's iPhone pass. Do not start Phase 2 before that.

Scope:

- High Cedars scorecard and open geometry, with the quality flags and ODbL attribution already in `docs/COURSE_DATA.md`.
- Hole view: one large playing number, front and back beside it, yards or meters.
- Front, center, and back come from the phone only after that green is admin-verified and a position exists. Otherwise the large number is the yardage the golfer types, and front and back stay blank.
- Bag of 14, manual add, and a TrackMan-style CSV paste. Carry and total stay separate. A blank cell stays unknown.
- Same-metric blend: simulator is the prior, course samples count double, range counts 1.5. The blend is labeled. It is not a new measurement. Carry is never turned into total.
- Club call from the measured sample, plus a go or lay-up call from carry P20 and P80. No percentage is invented. An unknown carry-to-clear stays "unsure." The hole screen states the reason without a personality prefix. The saved personality is still Funny but Knowledgeable. Presets that change it are Phase 2.
- Two-tap shot tag: club, then fairway, left, right, short, or hazard. The on-screen yardage is not stored as the shot. An optional measured carry and total can update the model.
- Scorecard for the High Cedars pars. Gross counts entered holes only.
- Offline for the bundled course and for anything typed on the phone. Large type, high contrast, 48-point targets.

Acceptance:

- Home shows the crest, the tagline, and Play High Cedars. No green fill.
- Hole 1 shows a blank front and back, the white-tee card yardage labeled as metadata, and a typed distance that drives the club call.
- A CSV with `Club,Carry,Total` imports. A blank carry stays blank. A meter header converts to yards and says so.
- Two environment samples of the same club, swing, and metric produce a blended median. A carry sample and a total sample do not.
- With a known carry line, P20 past the line says go, and a pattern that straddles the line says lay up and says it is not a percentage.
- Tagging a shot without a measured carry or total does not change the distance model.
- The scorecard gross is the sum of entered strokes and starts as "No strokes entered."
- `npm test` and `npm run typecheck` pass. The web export boots in Expo Go's SDK 58 runtime. No `expo-dev-client`.

What Mike tests on the iPhone, after `npm run preview:publish` with `EXPO_TOKEN`:

1. Open the preview. Confirm the navy, white, and red screen, the tagline, and that nothing is green.
2. Play High Cedars, hole 1. Type a yardage. Read the club and the reason. Confirm front and back are blank.
3. Verify one green you trust, then Measure from this phone. Front, center, and back should appear and be labeled ground distance, not a shot.
4. Paste a small CSV in the bag. Confirm carry and total land on separate lines.
5. Tag a club and a result in two taps. Enter a measured carry and total on a second shot and confirm the bag grows a course line.
6. Enter a few scores. Leave a hole blank. Confirm the blank hole is not a zero.
7. Turn on airplane mode and repeat a typed yardage and a score. The course text should still be there.

Known gaps inside Phase 1, left honest:

- No hole is verified in the data. GPS stays manual until Mike verifies.
- There is no tappable hole map. A map SDK is not in this Expo Go build, and no golf-app map was copied.
- In-play verify and the round itself live in the phone session. Killing the app drops the round. The open course cache in SQLite remains.
- The OSM extract is 2026-07-12. Holes 8, 11, and 16 have a mapped start that is not a surveyed tee. Gold is 5,577 on the holes and 5,579 on the tee set.
- The blend joins a course result to a sim sample only when the swing mode matches. If a club has more than one swing on file, the result stays separate.
- The commercial course adapter is still an empty stub.

## Phase 2 — Caddie

Not started. Starts only after Phase 1 is approved.

Scope:

- Caddie name and tone presets. The default stays COOPR, Funny but Knowledgeable, until Mike picks another.
- Plays-like for wind, elevation, and temperature, shown beside the raw yardage. Both numbers visible.
- Pre-round plan: tee club and target per hole, chosen before the round.
- Post-round debrief: one question on a bad hole, plan or swing. About two minutes.
- Miss side per hole, and an aim offset taken from the measured pattern. Today the engine does not turn a miss pattern into an aim offset. Phase 2 adds that as its own labeled number.
- Wedge matrix: three swing lengths per wedge, each carry stored from the sim session.
- Dispersion drawn on the open hole shape. Tap a point for a distance, still from open geometry only.
- Haptics: one tap for a club call, two for a lay-up. No alarm.

Acceptance: Mike can set a tone, see a plays-like number next to the raw number with the inputs named, build a plan, finish a debrief that does not change the score, and read a miss side that says how many shots it came from.

iPhone test: play one hole with a made-up wind and elevation, confirm both numbers, then finish the debrief and confirm the gross did not move.

## Phase 3 — Voice and music

Not started. This phase needs an EAS development build. Expo Go cannot host the ElevenLabs React Native SDK or MusicKit. The development profile is added when this phase is approved, not before.

Scope:

- Spoken club calls through ElevenLabs, via a server-side proxy. The key is never in the app.
- On-device speech as the offline fallback.
- Apple Music through MusicKit. Music ducks under the caddie and comes back after. Earbuds, push-to-talk, short lines.
- Spotify behind a flag for Mike's test builds only. Development mode is capped, and public quota is not assumed.
- Amazon Music is a link out. There is no playback SDK to ship.

Acceptance: a club call is spoken on a development build with no key in the binary. Airplane mode uses the on-device voice. Apple Music gets quieter while the caddie talks and returns after. Spotify is absent from a production build.

Founder approval before any API key, MusicKit entitlement, or Spotify allowlist.

## Phase 4 — Watch and languages

Not started. The Watch app is its own target and is not Expo Go.

Scope:

- Apple Watch yardages and the same two-tap shot mark.
- German and Spanish, including the dry voice. Yards and meters are already in Phase 1.
- A Dynamic Type and VoiceOver pass on the hole screen.

Acceptance: the watch shows the same front, center, and back rules as the phone. A German and a Spanish string pass has no translated number that the English screen does not have.

iPhone test: change the phone to German, read hole 1, then mark a shot from the watch and see it on the phone.

## Phase 5 — After the round

Not started. This is the audit's Next list, plus strokes gained.

Scope:

- Strokes gained from the rounds on the phone. Thin samples say the sample is thin.
- Practice plans from the top two leaks. A plan is a suggestion, not a claim about a tour drill the golfer did not hit.
- Coach sharing. A coach sees what the golfer sends. Nothing is public by default.
- Score-state strategy: match play, protecting a number, chasing. The risk shift is labeled.
- Routine prompts the golfer can turn off.
- Firmness. Roll changes the total. Carry and total stay separate.
- Handicap posting. An estimate is still not a GHIN index. Posting waits on a license Mike approves.

Acceptance: a practice plan names the rounds it came from. A shared round is invisible to a second person until the golfer sends it. Handicap stays "unknown" until a real index is supplied.

## Later — design only

Not built. No screens, no payments, no partners. Approved as ideas, blocked until Mike says to build one.

- Tournament mode. Distances only, enforcement still to be decided. The full caddie stays on for every round until this exists. Rule 4.3 is the reason it has to be a mode and not the default.
- Swing video and a phone stand at a fixed distance and angle.
- A club marketplace. Equipment advice stays unsponsored until this is a separate, labeled place.
- Apparel.
- Sponsorships.
- A junior pathway.
- Green-reading maps. No Strackaline or other green book is licensed.
- Trajectory as a variable: high, medium, low.
- Licensed voice packs. No celebrity voice without a contract.
- A TrackMan partnership. CSV import is the path until then. A partnership is a data-partnership approval.
- A commercial course license through the existing adapter. iGolf and Golf Intelligence are not assumed.

## Gates that always stop the work

Mike approves brand changes, pricing, legal copy, App Store submission, and any data partnership. That includes TrackMan, GHIN, a course vendor, a music entitlement, and a voice vendor. Publishing the Expo Go preview still needs `EXPO_TOKEN` on the `@mikecoers` account. This environment does not publish it.
