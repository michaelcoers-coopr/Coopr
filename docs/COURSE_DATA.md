# High Cedars course data

Pilot course: Cedars At High Cedars Golf Club, Orting, Washington. This is the 18-hole course. The executive nine is a separate OpenGolfAPI record and is not in the hole table.

Scorecard source: OpenGolfAPI `2d198fce-e499-4e5e-9372-5329346fa54d`, license ODbL-1.0. © OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI — https://opengolfapi.org/attribution

Geometry source: OpenStreetMap via Overpass (`https://overpass.openstreetmap.fr/api/interpreter`). Extract timestamp 2026-07-12T12:08:28Z. © OpenStreetMap contributors. ODbL 1.0. The main overpass-api.de endpoint returned HTTP 502 on the pull, so this is the mirror extract, not a claim the map was edited on the pull date.

## Aerial imagery (holes 1 and 2)

Holes 1 and 2 can draw a stylized aerial under the vector overlay (flight, yard pills, dispersion, tee, flag, and green marks). Holes 3–18 stay on the vector map. A GPS fix that falls outside the picture falls back to that vector map too.

Imagery: USDA National Agriculture Imagery Program (NAIP), 0.6 m, flown 2023-08-16, scene `wa_m_4712263_nw_10_060_20230816_20240209`, retrieved via the Microsoft Planetary Computer. NAIP is US federal public domain. The file in the app is stylized, not a true-colour photograph and not current conditions: dry August turf is recoloured, relief and a vignette are applied, and super-resolution adds texture without moving edges.

Registration is a local equirectangular affine. East and north use the same math as `localMeters()` in `apps/mobile/src/hole-fit.ts` (`R = 6371000`). The shipped `matrix_px_per_meter` is used verbatim. The image center is the lat/lng center. The top-left corner is pixel (0, 0).

Outlines on top of the picture are © OpenStreetMap contributors, ODbL. Greens on these holes remain unverified. Sample yardages stay labeled Sample.

Credit line: Imagery: USDA NAIP, stylized. Outlines © OpenStreetMap contributors

OpenGolfAPI returned par, stroke index, and tee yardages. Its tee coordinates, green polygons, fairway polygons, and hazard lists are null on every hole. Those nulls stay null. Geometry below is only what the OSM extract tags or what a stated rule derives from those tags.

Association rules, and nothing else:

- A championship hole way has `golf=hole`, ref 1–18, par equal to the OpenGolfAPI scorecard, and no `handicap` tag. The nine ways that do have `handicap` sum to par 29 and match the executive nine, including a par-3 hole 2 that would otherwise collide.
- A green counts only when the last node of that hole way is inside exactly one green polygon. Zero or several means the green is missing or ambiguous. No green is chosen by nearness.
- A tee counts when its geometry is within 25 m of the first node of the hole way. Tee features have no name or color tag, so they are not Blue, White, Gold, or Red.
- A fairway, bunker, or hazard counts for a hole only when its ring intersects the hole line or the associated green. No hole number is invented for an untagged polygon.
- Front, center, and back are derivable when that one green polygon exists. They are not surveyed, not verified, and not a carry. GPS play stays manual until an admin verifies the green. Nothing in this pull is verified.

## Hole quality

| Hole | Par | SI | White yd | Tees near start | Green polygon | F/C/B derivable | Fairways on line | Bunkers tagged / intersecting | Hazards tagged / intersecting | Pins in green | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 7 | 484 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 2 | 3 | 9 | 195 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 3 | 4 | 15 | 299 | 1 | one | yes | 2 | 0 / 0 | 0 / 0 | 1 | unverified |
| 4 | 4 | 3 | 399 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 5 | 5 | 5 | 524 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 6 | 4 | 11 | 314 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 7 | 4 | 13 | 333 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 8 | 3 | 17 | 170 | 1 | one | yes | 1 | 0 / 0 | 0 / 1 | 1 | unverified |
| 9 | 4 | 1 | 405 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 10 | 5 | 4 | 517 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 11 | 3 | 16 | 168 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 12 | 4 | 8 | 373 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 13 | 3 | 18 | 148 | 2 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 14 | 4 | 12 | 336 | 1 | one | yes | 1 | 0 / 0 | 0 / 0 | 1 | unverified |
| 15 | 4 | 14 | 306 | 2 | one | yes | 1 | 0 / 1 | 0 / 0 | 1 | unverified |
| 16 | 4 | 2 | 405 | 1 | one | yes | 1 | 0 / 0 | 0 / 1 | 1 | unverified |
| 17 | 4 | 10 | 370 | 1 | one | yes | 2 | 0 / 0 | 0 / 0 | 1 | unverified |
| 18 | 5 | 6 | 514 | 1 | one | yes | 1 | 0 / 1 | 0 / 2 | 1 | unverified |

## Gaps

- Gold Male tee set says 5579 yards. The hole yardages sum to 5577. The difference is left unresolved.
- Gold Female tee set says 5579 yards. The hole yardages sum to 5577. The difference is left unresolved.
- 9 OSM hole ways carry a handicap tag and are excluded as the executive nine.
- 22 bunker polygons and 5 water-hazard polygons are in the extract. Hole numbers on those features: none.
- OpenGolfAPI lists a White / Male tee at 6,260 yards, course rating 69.1, slope 113. That does not resolve the founder discrepancy between 69.1/113 and 70.1/115, and it is not written onto the founder round.
- No admin review has verified a green. The commercial adapter is a stub: iGolf and Golf Intelligence are not licensed and contribute no rows.

## Per-hole notes

- Hole 1: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 1: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 1: No water hazard is tagged with this hole number.
- Hole 1: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 1: GPS play stays on manual distance until an admin verifies this green.
- Hole 2: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 2: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 2: No water hazard is tagged with this hole number.
- Hole 2: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 2: GPS play stays on manual distance until an admin verifies this green.
- Hole 3: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 3: 2 fairway polygons intersect the hole line. The report does not pick one.
- Hole 3: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 3: No water hazard is tagged with this hole number.
- Hole 3: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 3: GPS play stays on manual distance until an admin verifies this green.
- Hole 4: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 4: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 4: No water hazard is tagged with this hole number.
- Hole 4: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 4: GPS play stays on manual distance until an admin verifies this green.
- Hole 5: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 5: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 5: No water hazard is tagged with this hole number.
- Hole 5: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 5: GPS play stays on manual distance until an admin verifies this green.
- Hole 6: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 6: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 6: No water hazard is tagged with this hole number.
- Hole 6: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 6: GPS play stays on manual distance until an admin verifies this green.
- Hole 7: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 7: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 7: No water hazard is tagged with this hole number.
- Hole 7: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 7: GPS play stays on manual distance until an admin verifies this green.
- Hole 8: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 8: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 8: 1 water-hazard polygon intersects the hole line or the associated green and is not tagged to this hole.
- Hole 8: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 8: GPS play stays on manual distance until an admin verifies this green.
- Hole 9: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 9: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 9: No water hazard is tagged with this hole number.
- Hole 9: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 9: GPS play stays on manual distance until an admin verifies this green.
- Hole 10: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 10: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 10: No water hazard is tagged with this hole number.
- Hole 10: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 10: GPS play stays on manual distance until an admin verifies this green.
- Hole 11: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 11: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 11: No water hazard is tagged with this hole number.
- Hole 11: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 11: GPS play stays on manual distance until an admin verifies this green.
- Hole 12: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 12: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 12: No water hazard is tagged with this hole number.
- Hole 12: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 12: GPS play stays on manual distance until an admin verifies this green.
- Hole 13: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 13: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 13: No water hazard is tagged with this hole number.
- Hole 13: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 13: GPS play stays on manual distance until an admin verifies this green.
- Hole 14: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 14: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 14: No water hazard is tagged with this hole number.
- Hole 14: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 14: GPS play stays on manual distance until an admin verifies this green.
- Hole 15: 2 tee geometries sit within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 15: 1 bunker polygon intersects the hole line or the associated green and is not tagged to this hole.
- Hole 15: No water hazard is tagged with this hole number.
- Hole 15: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 15: GPS play stays on manual distance until an admin verifies this green.
- Hole 16: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 16: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 16: 1 water-hazard polygon intersects the hole line or the associated green and is not tagged to this hole.
- Hole 16: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 16: GPS play stays on manual distance until an admin verifies this green.
- Hole 17: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 17: 2 fairway polygons intersect the hole line. The report does not pick one.
- Hole 17: No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.
- Hole 17: No water hazard is tagged with this hole number.
- Hole 17: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 17: GPS play stays on manual distance until an admin verifies this green.
- Hole 18: 1 tee geometry sits within 25 m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.
- Hole 18: 1 bunker polygon intersects the hole line or the associated green and is not tagged to this hole.
- Hole 18: 2 water-hazard polygons intersect the hole line or the associated green and are not tagged to this hole.
- Hole 18: Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.
- Hole 18: GPS play stays on manual distance until an admin verifies this green.

Proprietary corrections, when an admin adds them, are stored as reviews that point at an OSM id. They do not overwrite the open copy. A future commercial license uses the same proprietary side and does not require a new app.
