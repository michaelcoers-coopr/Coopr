# Playbook Factory

Generates a complete, sellable football playbook bundle — **22 PDFs (523 pages) + a Start Here guide, zipped** — from code. Every
diagram, assignment table and step-by-step instruction is generated, so you can rebrand, add plays, or spin up a new product
in minutes.

```
python3 build.py               # build everything -> dist/  (~10 s)
python3 build.py --print       # portrait coaching-manual edition instead of slides
python3 build.py wingt anvil   # rebuild just those books (keys below)
```

## Two editions

**Slides (default, `STYLE = "slides"` in `brand.py`)** — landscape 16:9 decks in the presentation-playbook style:
photo cover (or built-in art), Benefits, Philosophy, technique/gap chart, terminology legend, then for every call
a **diagram slide** (big shapes — circles = offense, triangles = defense, square = center; RED = blitz/ball
carrier/deep middle/man box, YELLOW = twist/motion/zone, dashed = drop, blue = spy), a **breakdown slide**
(boxed call + pitch line, two boxed columns of 3-line position blocks) and a **step-by-step slide**; ends with a
1:1 strategy-call CTA with a discount code. Every blitz ships as both a Cover 1 and a Cover 3 version.

**Print (`--print`)** — portrait manual, one page per play with field diagrams and the full assignment grid.

Artwork & CTA live in `brand.py`: drop AI-generated or real photos into `art/` and set `COVER_IMAGE`,
`HERO_IMAGE`, `COACH_PHOTO`; set `CTA_URL`, `CTA_CODE`, `CTA_OFFER`.

Output: `dist/00_*_Start_Here.pdf`, `dist/01..22_*.pdf`, `dist/README.txt` and the bundle ZIP
`dist/IRONCLAD_The_Forge_Collection_Complete_System.zip`. A ready-made 1600×1600 store image is in `release/store_thumbnail.png`,
and sales copy is in `STORE_LISTING.md`.

Requires Python 3 with `reportlab` and `pypdf` (`pip install reportlab pypdf`). Fonts are bundled in `fonts/`.

## Make it yours

Edit **`factory/brand.py`** — brand name, collection name, your name, website, price, colors — and rebuild. Covers, page headers,
footers, license line, README and ZIP name all follow it.

## What's in the box

| # | Key | Book | Plays/calls |
|---|-----|------|------|
| 01 | `diamond` | Diamond Offense | 15 |
| 02–04 | `power1` `power2` `power3` | Power I Vol. 1 / 2 (unbalanced) / 3 (pistol) | 15–16 each |
| 05 | `rpo` | RPO Offense | 15 |
| 06–07 | `airraid` `airraid2` | Air Raid Attack / Air Raid 2.0 Tempo | 16 / 15 |
| 08 | `maryland` | Maryland I | 14 |
| 09 | `tform` | T Formation (Full House + Wishbone) | 14 |
| 10 | `singleback` | Single Back | 16 |
| 11 | `singlewing` | Single Wing | 13 |
| 12–13 | `wingt` `gunt` | Wing-T / Gun-T | 14 each |
| 14 | `dw` | Double Wing | 13 |
| 15–18 | `anvil` `hammer` `wall` `forge` | 4-4 / 4-2-5 / 6-2 / 5-3 defenses | 12–14 calls each |
| 19 | `7v7` | 7v7 Playbook | 15 + 4 coverages |
| 20 | `training` | Forged: Offseason Training | 12-week program |
| 21 | `blocking` | Blocking Drillbook | 20 drills |
| 22 | `parents` | The Parent Playbook | — |

Every offensive book: philosophy, personnel, terminology & hole numbering, formation gallery with alignment rules, one page per
play (diagram + all-11 assignments + step-by-step + coaching points), install plan, call sheet, wristband, notes. Defensive
books add a technique/gap chart, and every call lists ALIGN / RUN / PASS for all 11.

## How it works

```
factory/
  brand.py           <- edit me
  diagram.py         play-diagram renderer (yards -> PDF vectors)
  formations.py      ~40 formations, strength-right, auto-mirrored
  offense.py         run schemes (power, counter, zone, trap, buck sweep, option…), pass concepts, RPOs
  defense.py         fronts by technique, stunts, blitzes, zone/man coverages
  layout.py          covers, page chrome, play page, install plan, call sheet, wristband
  books_offense.py   the 14 offensive books (philosophy + play lists)
  books_defense.py   the 4 defensive books
  books_special.py   7v7, drillbook, training, parent playbook
build.py             builds, numbers and zips everything
```

### Add a play

Plays are one line each in `factory/books_offense.py`:

```python
R("I RT 24 POWER", "I_PRO", "power", d=1, carrier="T", kick="F", tags=["base run"], form_name="I Right")
PASS("TRIPS SNAG", "GUN_TRIPS", "snag", tags=["quick game"], form_name="Gun Trips")
RPO("DOUBLES 22 ZONE BUBBLE", "GUN_2X2", "zone", {"Y": "bubble", "Z": "stalk"}, "bubble", d=-1, read_label="S")
```

The engine derives the blocking for all five linemen from the scheme, draws the diagram, and writes every player's assignment.
New run schemes go in `SCHEMES`, new pass concepts via `concept(...)` and new formations in `FORMATIONS`.

### Add a defensive call

```python
call("ANVIL FIRE", "I_PRO", F44, C1_44, "blitz", "c1", ov={"S": ("blitz", "D", "s")})
```

## Licensing notes

All play content, text and art is original. Fonts: Oswald, Barlow and Barlow Condensed (SIL Open Font License) and DejaVu Sans
(symbol fallback, free license) — licenses in `fonts/`. Plays and schemes are standard football concepts; names and branding are
yours to set in `brand.py`.
