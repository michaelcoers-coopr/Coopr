"""The four defensive playbooks: 4-4 ANVIL, 4-2-5 HAMMER, 6-2 WALL, 5-3 FORGE."""
from reportlab.platypus import Spacer, PageBreak
from reportlab.lib.units import inch
from .defense import build_call, TECH_TXT
from .layout import (P, section, bullets, numbered, grid, play_page, wristband, call_sheet, install_plan, notes_page,
                     toc_block, CONTENT_W)
from .diagram import Diagram

# ------------------------------------------------------------------ text
DL_STEPS = ["Align in your technique — strength is called to the tight end (or to the passing strength vs spread).",
            "Eyes on your key: the man you're aligned on. His helmet tells you the play.",
            "First step with your near foot into your gap, hands inside, pad level low.",
            "Read the block: BASE = hold the gap; DOWN = squeeze and spill; REACH = fight across his face; PULL = chase flat.",
            "Shed and pursue on an inside-out angle. Never run around a block."]
LB_STEPS = ["Align at your depth, key the near back through the guard.",
            "Run flow: downhill read step, fill your gap with your outside arm free.",
            "Pass (high hat from the OL): get to your zone drop or man assignment.",
            "Ball declared: pursue inside-out, take the near hip of the ball carrier."]
COV = {
    "c3": dict(name="Cover 3", steps=[("Corners", ["Align 7 yds off, outside eye of #1.", "Shuffle/bail at the snap, eyes on the QB.",
                                                   "Deep third: nothing gets behind you or outside you.", "Break on the throw; run support only after the ball crosses the LOS."]),
                                      ("Free safety", ["Align at 10–12 in the middle of the field.", "Read the QB — first steps are backpedal.",
                                                       "Deep middle third: play the deepest receiver in your zone.", "Run: fill the alley last, inside-out."]),
                                      ("Flat / hook players", ["Flat: collision #2, get width to the flat.", "Hook: wall off anything crossing at 8–10, eyes on the QB."])],
               points=["Four underneath, three deep, four rush.", "Eyes on the QB: break on his front shoulder.", "Rally to the ball — 3-deep tackles in space."]),
    "c1": dict(name="Cover 1", steps=[("Man defenders", ["Find your man pre-snap; communicate.", "Inside leverage: take away the slant and dig.",
                                                         "Trail technique: hip pocket, eyes on his hands at the catch point."]),
                                      ("Free safety", ["Align at 12 in the middle.", "Read the QB; help on all deep throws.", "Run support: alley fill."]),
                                      ("Rat/robber", ["Sit at 10 in the middle.", "Wall crossers; rob the dig."])],
               points=["Man coverage everywhere, one free player deep.", "Know your man before the snap — call it out.", "Squeeze inside leverage on every route."]),
    "c0": dict(name="Cover 0", steps=[("Man defenders", ["Press or 5-yd off with inside leverage.", "No help: play the man, not the ball, until he looks back.",
                                                         "Tackle on the catch — no yards after."]),
                                      ("Blitzers", ["Time the snap count from film.", "Get skinny through your gap.", "Hit the QB high, rip the ball arm."])],
               points=["Everyone has a man; everyone else blitzes.", "Ball must come out fast — sacks or incompletions.", "Only call it when you can win one-on-one."]),
    "c2": dict(name="Cover 2", steps=[("Corners", ["Press or 5-yd squat, outside leverage.", "Jam #1, re-route him inside.", "Sink to the flat; hit the hitch/out."]),
                                      ("Safeties", ["Align 12 deep, 2 yds outside the hash.", "Deep half: widest-deepest receiver in your half.", "Break on the throw."])],
               points=["Corners are the force on the run.", "Five under, two deep.", "Weak spot: the deep middle — mix with Cover 3."]),
    "c4": dict(name="Cover 4", steps=[("Corners", ["7 yds off, outside leverage on #1.", "Deep quarter: if #1 goes vertical, carry him."]),
                                      ("Safeties", ["10 yds deep, over #2.", "Read #2: vertical — carry him; out — help on #1; block — fill the run (quarters gives 9-man run fits)."])],
               points=["Safeties are run defenders until #2 releases vertically.", "Four deep, three under — great vs play-action and verticals."]),
}
STUNT = dict(steps=[("Stunting linemen", ["Same alignment as base — no tips pre-snap.", "On the snap: rip/step to the called gap, get skinny.",
                                          "Beat the block to the gap, then flatten down the line.", "Looper: jab, then loop tight behind the penetrator."]),
                    ("Linebackers", ["Know the stunt — your gap changes with it.", "Scrape opposite the slant: fill the gap the DL left."])],
             points=["Stunts are wasted if alignment tips them.", "Linebackers must fill the vacated gaps.", "Call stunts vs gap schemes and on obvious run downs."])
BLITZ = dict(steps=[("Blitzer", ["Disguise: show your normal alignment until the QB starts the cadence.", "Creep with the cadence; hit the gap on the snap.",
                                 "Get skinny through the gap — don't take on a blocker square.", "Run: take the RB/QB mesh. Pass: hit the QB's throwing arm."])],
             points=["Blitzer must be at full speed at the snap.", "Coverage behind must know who's covering the blitzer's man.", "Vary blitz timing — don't be predictable."])


def mod(front, **changes):
    f = dict(front)
    for k, v in changes.items():
        if v is None:
            f.pop(k, None)
        else:
            f[k] = v
    return f


def call(name, form, front, cov, kind, cov_key=None, ov=None, what="", best="", points_extra=(), tags=(), week=1, form_name="",
         steps_extra=()):
    if kind == "front":
        steps = [("Defensive line", DL_STEPS), ("Linebackers", LB_STEPS)]
        pts = ["Every gap has a name next to it — no free gaps.", "Squeeze down blocks, spill pullers to the alley.",
               "Pursuit angles: inside-out, never behind the ball."]
        show, fam = "run", "Front"
    elif kind == "stunt":
        steps, pts, show, fam = STUNT["steps"], STUNT["points"], "run", "Stunt"
    elif kind == "blitz":
        steps = BLITZ["steps"] + (COV[cov_key]["steps"][:1] if cov_key else [])
        pts, show, fam = BLITZ["points"], "pass", "Blitz"
    else:
        steps, pts, show, fam = COV[cov_key]["steps"], COV[cov_key]["points"], "pass", "Coverage"
    steps = list(steps_extra) + list(steps)
    p = build_call(name, form, front, cov, overrides=ov, show=show, title=(COV[cov_key]["name"].upper() if cov_key else kind.upper()),
                   family=fam, what=what, steps=steps, points=list(points_extra) + list(pts), best=best, tags=tags,
                   week=week, form_name=form_name)
    p._spec = dict(name=name, form=form, front=front, cov=cov, kind=kind, cov_key=cov_key, ov=ov, what=what, best=best,
                   points_extra=points_extra, tags=tags, week=week, form_name=form_name, steps_extra=steps_extra)
    return p


UNDER = ("hook_r", "hook_l", "mid", "rob", "curl_r", "curl_l")


def with_twins(calls, c1, c3):
    """Every Cover 1 blitz also gets a Cover 3 version (and vice versa), placed right after it."""
    from .defense import ZONES
    out = []
    for p in calls:
        out.append(p)
        sp = getattr(p, "_spec", None)
        if not sp or sp["kind"] != "blitz" or sp["cov_key"] not in ("c1", "c3"):
            continue
        other = "c3" if sp["cov_key"] == "c1" else "c1"
        ov = dict(sp["ov"] or {})
        blitzers = [k for k, v in ov.items() if v[0] == "blitz"]
        ov = {k: v for k, v in ov.items() if v[0] in ("blitz", "slant", "loop")}
        cov = dict(c3 if other == "c3" else c1)
        if other == "c3":
            for b in blitzers:
                z = cov.pop(b, None)
                if z in ZONES and z not in UNDER:
                    cands = [k for k, zz in cov.items() if isinstance(zz, str) and zz in UNDER and k not in blitzers]
                    cands.sort(key=lambda k: (ZONES[cov[k]][0] * ZONES[z][0] <= 0, abs(ZONES[cov[k]][0] - ZONES[z][0])))
                    if cands:
                        cov[cands[0]] = z
        else:
            for b in blitzers:
                tgt = cov.pop(b, None)
                if isinstance(tgt, tuple) and tgt[0] == "man":
                    free = [k for k, v in cov.items() if v in ("rob", "spy") and k not in blitzers]
                    if free:
                        cov[free[0]] = tgt
        old, new = ("COVER 1", "COVER 3") if other == "c3" else ("COVER 3", "COVER 1")
        p.call = f"{sp['name']} \u2013 {old}"
        what = sp["what"].replace("Cover 1", "Cover 3") if other == "c3" else sp["what"].replace("Cover 3", "Cover 1")
        what += (" This version rotates to a three-deep zone behind the pressure \u2014 safer vs quick throws and play-action."
                 if other == "c3" else " This version locks the secondary in man coverage with a free safety over the top.")
        out.append(call(f"{sp['name']} \u2013 {new}", sp["form"], sp["front"], cov, "blitz", other, ov=ov, what=what,
                        best=sp["best"], tags=sp["tags"], week=sp["week"], form_name=sp["form_name"]))
    return out


# =================================================================== 4-4
F44 = {
    "E": ("Strong End", ("tech", "s", "7"), ("gap", "C", "s")),
    "T": ("Strong Tackle", ("tech", "s", "3"), ("gap", "B", "s")),
    "N": ("Weak Tackle", ("tech", "w", "3"), ("gap", "B", "w")),
    "J": ("Weak End", ("tech", "w", "5"), ("gap", "C", "w")),
    "S": ("Sam (strong OLB)", ("lb", "s", 6.2, 3.0), ("gap", "E", "s")),
    "M": ("Mike (strong ILB)", ("lb", "s", 1.0, 4.5), ("gap", "A", "s")),
    "W": ("Will (weak ILB)", ("lb", "w", 1.0, 4.5), ("gap", "A", "w")),
    "B": ("Bandit (weak OLB)", ("lb", "w", 5.2, 3.0), ("gap", "E", "w")),
    "C": ("Strong Corner", ("cb", "s"), ("deep",)),
    "K": ("Weak Corner", ("cb", "w"), ("deep",)),
    "F": ("Free Safety", ("s", "c", 0.0, 10.5), ("fill",)),
}
C3_44 = {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "B": "flat_l", "M": "hook_r", "W": "hook_l"}
C1_44 = {"C": ("man", "s1"), "K": ("man", "w1"), "F": "deep_m", "S": ("man", "s2"), "M": ("man", "b"), "W": "rob", "B": "spy"}
F44_SPREAD = mod(F44, S=("Sam (apex)", ("apex", "s"), ("gap", "E", "s")), B=("Bandit (apex)", ("apex", "w"), ("gap", "E", "w")))
F44_TRIPS = mod(F44_SPREAD, W=("Will (bumps to trips)", ("lb", "s", 3.2, 5.0), ("gap", "A", "w")),
                B=("Bandit (walls #3)", ("lb", "w", 3.0, 4.5), ("gap", "E", "w")))
F44_GL = mod(F44, S=("Sam", ("lb", "s", 5.2, 2.0), ("gap", "D", "s")), M=("Mike", ("lb", "s", 1.0, 2.5), ("gap", "A", "s")),
             W=("Will", ("lb", "w", 1.0, 2.5), ("gap", "A", "w")), B=("Bandit", ("lb", "w", 4.4, 2.0), ("gap", "E", "w")),
             F=("Free Safety", ("s", "c", 0.0, 6.0), ("fill",)))


def _anvil_calls():
    PI, G2, G3 = "I_PRO", "GUN_2X2", "GUN_TRIPS"
    return [
        call("ANVIL BASE", PI, F44, C3_44, "front", what="The 4-4 base: eight in the box with a gap for every defender. Built to stop the run first.",
             best="Two-back power teams, Wing-T, Double Wing.", tags=["base", "run down"], form_name="vs Pro I"),
        call("ANVIL COVER 3", PI, F44, C3_44, "coverage", "c3", what="Base 4-4 with three-deep zone behind it. Outside linebackers take the flats.",
             best="Balanced offenses, play-action teams.", tags=["base", "pass down"], form_name="vs Pro I"),
        call("ANVIL COVER 1", PI, F44, C1_44, "coverage", "c1", what="Man-free: man on every receiver, one free safety deep, a robber in the middle.",
             best="Quick-game teams, timing routes.", tags=["pass down", "3rd down"], week=2, form_name="vs Pro I"),
        call("ANVIL SLANT STRONG", PI, F44, C3_44, "stunt", ov={"E": ("slant", "D", "s"), "T": ("slant", "C", "s"), "N": ("slant", "A", "w"),
                                                              "J": ("slant", "B", "w"), "M": ("gap", "B", "s"), "W": ("gap", "C", "w")},
             what="All four linemen slant one gap to the strength; linebackers scrape back to the vacated gaps.",
             best="Zone teams and down-block (gap) schemes to the strength.", tags=["run down", "stunt"], week=2, form_name="vs Pro I"),
        call("ANVIL SLANT WEAK", PI, F44, C3_44, "stunt", ov={"E": ("slant", "B", "s"), "T": ("slant", "A", "s"), "N": ("slant", "C", "w"),
                                                            "J": ("slant", "D", "w"), "M": ("gap", "C", "s"), "W": ("gap", "B", "w")},
             what="Mirror of Slant Strong: the line slants away from the tight end.", best="Teams that run weak-side counter and iso.",
             tags=["run down", "stunt"], week=2, form_name="vs Pro I"),
        call("ANVIL PINCH", PI, F44, C3_44, "stunt", ov={"E": ("slant", "B", "s"), "T": ("slant", "A", "s"), "N": ("slant", "A", "w"),
                                                       "J": ("slant", "B", "w"), "M": ("gap", "C", "s"), "W": ("gap", "C", "w")},
             what="The whole line pinches inside; linebackers bounce outside. Shuts down inside runs and wedge.",
             best="Wedge, dive and trap teams; short yardage.", tags=["short yardage", "stunt"], week=2, form_name="vs Pro I"),
        call("ANVIL TWIST", PI, F44, C3_44, "stunt", ov={"T": ("slant", "C", "s"), "E": ("loop", "B", "s")},
             what="Tackle-end twist to the strength: the tackle penetrates C gap, the end loops inside to B.",
             best="Pass-protection teams, zone runs.", tags=["pass down", "stunt"], week=3, form_name="vs Pro I"),
        call("ANVIL FIRE", PI, F44, C1_44, "blitz", "c1", ov={"S": ("blitz", "D", "s"), "B": ("man", "b2")},
             what="Sam off the edge with Cover 1 behind it. The fastest edge pressure in the book.",
             best="Boot/play-action teams, outside runs.", tags=["blitz", "3rd down"], week=2, form_name="vs Pro I"),
        call("ANVIL DOG", PI, F44, {**C1_44, "B": ("man", "b"), "S": ("man", "s2")}, "blitz", "c1",
             ov={"M": ("blitz", "A", "s"), "W": ("blitz", "A", "w")},
             what="Double-A-gap linebacker blitz. Bandit takes the back, Sam the tight end.",
             best="Inside run teams, slow-developing pass plays.", tags=["blitz", "short yardage"], week=2, form_name="vs Pro I"),
        call("ANVIL STORM", PI, F44, {"C": ("man", "s1"), "K": ("man", "w1"), "F": ("man", "s2"), "W": ("man", "b"), "B": "spy"}, "blitz", "c0",
             ov={"S": ("blitz", "D", "s"), "M": ("blitz", "B", "s")},
             what="Sam and Mike to the strength with zero coverage behind. All-out pressure.",
             best="Obvious passing downs vs a weak protection.", tags=["blitz", "3rd down"], week=3, form_name="vs Pro I"),
        call("ANVIL CAT", PI, F44, {"C": ("man", "s1"), "B": ("man", "w1"), "S": ("man", "s2"), "M": ("man", "b"), "W": "rob", "F": "deep_m"},
             "blitz", "c1", ov={"K": ("blitz", "E", "w")},
             what="Weak corner blitz off the boundary; Bandit bumps out to the split end.", best="Sprint-out and toss teams to the weak side.",
             tags=["blitz", "perimeter"], week=3, form_name="vs Pro I"),
        call("ANVIL vs SPREAD", G2, F44_SPREAD, C3_44, "coverage", "c3",
             what="Outside linebackers move to apex alignments vs 2x2; still Cover 3 with eight in the box vs the run.",
             best="Spread offenses with a running QB.", tags=["spread", "pass down"], week=2, form_name="vs Doubles"),
        call("ANVIL vs TRIPS", G3, F44_TRIPS, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "W": "curl_r", "M": "hook_r",
                                              "B": "hook_l"}, "coverage", "c3",
             what="Trips check: Will bumps to the trips side, Bandit walls #3. Keeps the box sound with 6.", best="3x1 formations.",
             tags=["spread", "pass down"], week=3, form_name="vs Trips"),
        call("ANVIL GOAL LINE", PI, F44_GL, C1_44, "front", what="Linebackers tighten to 2 yds, safety drops to 6. Every gap filled before the snap.",
             best="Inside the 5-yard line; 4th and short.", tags=["goal line", "short yardage"], week=3, form_name="vs Pro I"),
    ]


# =================================================================== 4-2-5
F425 = {
    "E": ("Strong End", ("tech", "s", "5"), ("gap", "C", "s")),
    "T": ("Tackle", ("tech", "s", "3"), ("gap", "B", "s")),
    "N": ("Nose", ("tech", "w", "1"), ("gap", "A", "w")),
    "J": ("Weak End", ("tech", "w", "5"), ("gap", "C", "w")),
    "M": ("Mike", ("lb", "s", 1.4, 4.8), ("gap", "A", "s")),
    "W": ("Will", ("lb", "w", 1.8, 4.8), ("gap", "B", "w")),
    "$": ("Spur (strong apex)", ("apex", "s"), ("gap", "E", "s")),
    "B": ("Bandit (weak apex)", ("apex", "w"), ("gap", "E", "w")),
    "C": ("Strong Corner", ("cb", "s"), ("deep",)),
    "K": ("Weak Corner", ("cb", "w"), ("deep",)),
    "F": ("Free Safety", ("s", "c", 0.0, 11.0), ("fill",)),
}
C3_425 = {"C": "deep_r", "K": "deep_l", "F": "deep_m", "$": "flat_r", "B": "flat_l", "M": "hook_r", "W": "hook_l"}
F425_2HI = mod(F425, **{"$": ("Spur (rolls to 2-high)", ("s", "s", 6.0, 11.0), ("deep",)),
                        "F": ("Free Safety", ("s", "w", 6.0, 11.0), ("deep",))})
C4_425 = {"C": "q4", "K": "q1", "F": "q2", "$": "q3", "B": "curl_l", "M": "hook_r", "W": "hook_l"}
C2_425 = {"C": "flat_r", "K": "flat_l", "F": "half_l", "$": "half_r", "B": "curl_l", "M": "hook_r", "W": "hook_l"}
C1_425 = {"C": ("man", "s1"), "K": ("man", "w1"), "F": "deep_m", "$": ("man", "s2"), "B": ("man", "w2"), "M": ("man", "b"), "W": "rob"}
F425_TRIPS = mod(F425, W=("Will (bumps)", ("lb", "s", 0.6, 4.8), ("gap", "A", "w")), M=("Mike (bumps)", ("lb", "s", 3.2, 4.6), ("gap", "B", "s")))
F425_PRO = mod(F425, **{"$": ("Spur (walks down)", ("lb", "s", 6.0, 3.5), ("gap", "E", "s")),
                        "B": ("Bandit", ("lb", "w", 5.0, 3.8), ("gap", "E", "w"))})


def _hammer_calls():
    G2, G3, PI = "GUN_2X2", "GUN_TRIPS", "I_PRO"
    return [
        call("HAMMER BASE", G2, F425, C3_425, "front", what="Four down, two backers, five DBs. Two apex players are the hammers: run fitters who also cover.",
             best="Spread offenses, RPO teams.", tags=["base", "run down"], form_name="vs Doubles"),
        call("HAMMER COVER 3", G2, F425, C3_425, "coverage", "c3", what="Single-high, three-deep. Apex players take the curl/flats.",
             best="Run-first spread, 2x2.", tags=["base", "pass down"], form_name="vs Doubles"),
        call("HAMMER COVER 4", G2, F425_2HI, C4_425, "coverage", "c4",
             what="Quarters: two-high shell with safeties reading #2. Nine-man run fits when #2 blocks.",
             best="Four verticals, play-action, RPO glance routes.", tags=["pass down", "shot"], week=2, form_name="vs Doubles"),
        call("HAMMER COVER 2", G2, F425_2HI, C2_425, "coverage", "c2", what="Two deep halves, corners squat in the flats.",
             best="Quick outs, hitches, bubble screens.", tags=["pass down", "3rd down"], week=2, form_name="vs Doubles"),
        call("HAMMER COVER 1 ROBBER", G2, F425, C1_425, "coverage", "c1", what="Man-free with Will robbing the middle at 10 yds.",
             best="Mesh, crossers, dig concepts.", tags=["3rd down", "pass down"], week=2, form_name="vs Doubles"),
        call("HAMMER SLANT", G2, F425, C3_425, "stunt", ov={"E": ("slant", "B", "s"), "T": ("slant", "A", "s"), "N": ("slant", "B", "w"),
                                                          "J": ("slant", "D", "w"), "M": ("gap", "C", "s"), "W": ("gap", "A", "w")},
             what="Line slants weak while Mike scrapes strong. Wrecks inside-zone double teams.", best="Inside zone teams.",
             tags=["run down", "stunt"], week=2, form_name="vs Doubles"),
        call("HAMMER TWIST", G2, F425, C3_425, "stunt", ov={"T": ("slant", "C", "s"), "E": ("loop", "B", "s")},
             what="T-E twist to the field: pressure without blitzing.", best="Obvious passing downs.", tags=["pass down", "stunt"], week=3,
             form_name="vs Doubles"),
        call("HAMMER BANDIT FIRE", G2, F425, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "$": "flat_r", "M": "hook_r", "W": "flat_l", "J": "hook_l"},
             "blitz", "c3", ov={"B": ("blitz", "D", "w")},
             what="Fire zone: Bandit blitzes off the edge, the weak end drops to the hook. Five rush, three deep, three under.",
             best="RPO and zone-read teams (Bandit takes the QB).", tags=["blitz", "rpo"], week=2, form_name="vs Doubles"),
        call("HAMMER SPUR BLITZ", G2, F425, C1_425, "blitz", "c1", ov={"$": ("blitz", "D", "s"), "M": ("man", "s2")},
             what="Spur blitzes from the field apex; Mike takes the slot. Cover 1 behind it.", best="Quick game, bubble RPOs.",
             tags=["blitz", "3rd down"], week=2, form_name="vs Doubles"),
        call("HAMMER THUNDER", G2, F425, {"C": ("man", "s1"), "K": ("man", "w1"), "$": ("man", "s2"), "B": ("man", "w2"), "F": ("man", "b")},
             "blitz", "c0", ov={"M": ("blitz", "A", "s"), "W": ("blitz", "A", "w")},
             what="Double-A-gap blitz with Cover 0. Six rushers vs five blockers.", best="Long-yardage, slow-developing pass plays.",
             tags=["blitz", "3rd down"], week=3, form_name="vs Doubles"),
        call("HAMMER vs TRIPS", G3, F425_TRIPS, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "$": "flat_r", "M": "curl_r", "W": "hook_r",
                                                 "B": "hook_l"}, "coverage", "c3",
             what="Trips check: linebackers bump to the trips side; Bandit plays the weak hook and the back out of the backfield.",
             best="3x1 formations.", tags=["spread", "pass down"], week=2, form_name="vs Trips"),
        call("HAMMER vs PRO", PI, F425_PRO, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "$": "flat_r", "B": "flat_l", "M": "hook_r", "W": "hook_l"},
             "front", what="Vs two backs: Spur walks down outside the tight end, Bandit tightens. Eight-man box.",
             best="I-formation and power teams.", tags=["run down", "base"], week=3, form_name="vs Pro I"),
    ]


# =================================================================== 6-2
F62 = {
    "E": ("Strong End", ("tech", "s", "9"), ("gap", "E", "s")),
    "T": ("Strong Tackle", ("tech", "s", "5"), ("gap", "C", "s")),
    "G": ("Strong Guard", ("tech", "s", "2i"), ("gap", "A", "s")),
    "N": ("Weak Guard", ("tech", "w", "2i"), ("gap", "A", "w")),
    "U": ("Weak Tackle", ("tech", "w", "5"), ("gap", "C", "w")),
    "J": ("Weak End", ("tech", "w", "w9"), ("gap", "E", "w")),
    "M": ("Mike (strong LB)", ("lb", "s", 2.2, 4.0), ("gap", "B", "s")),
    "W": ("Will (weak LB)", ("lb", "w", 2.2, 4.0), ("gap", "B", "w")),
    "C": ("Strong Corner", ("cb", "s"), ("deep",)),
    "K": ("Weak Corner", ("cb", "w"), ("deep",)),
    "F": ("Free Safety", ("s", "c", 0.0, 9.5), ("fill",)),
}
C3_62 = {"C": "deep_r", "K": "deep_l", "F": "deep_m", "M": "curl_r", "W": "curl_l", "E": "flat_r", "J": "flat_l"}
C1_62 = {"C": ("man", "s1"), "K": ("man", "w1"), "F": "deep_m", "M": ("man", "b"), "W": "rob", "E": ("man", "s2")}
F62_WT6 = mod(F62, T=("Strong Tackle", ("tech", "s", "6"), ("gap", "D", "s")), G=("Strong Guard", ("tech", "s", "3"), ("gap", "B", "s")),
              N=("Weak Guard", ("tech", "w", "3"), ("gap", "B", "w")), U=("Weak Tackle", ("tech", "w", "5"), ("gap", "C", "w")),
              E=("Strong End", ("tech", "s", "w9"), ("gap", "E", "s")),
              M=("Mike", ("lb", "s", 0.8, 4.0), ("gap", "A", "s")), W=("Will", ("lb", "w", 0.8, 4.0), ("gap", "A", "w")))
F62_SPREAD = mod(F62, E=("Strong End (stand-up)", ("apex", "s", 3.0), ("gap", "E", "s")), J=("Weak End (stand-up)", ("apex", "w", 3.0), ("gap", "E", "w")))
F62_GL = mod(F62, M=("Mike", ("lb", "s", 2.2, 2.0), ("gap", "B", "s")), W=("Will", ("lb", "w", 2.2, 2.0), ("gap", "B", "w")),
             F=("Free Safety", ("s", "c", 0.0, 5.5), ("fill",)), C=("Strong Corner", ("cb", "s", 2.0), ("deep",)),
             K=("Weak Corner", ("cb", "w", 2.0), ("deep",)))


def _wall_calls():
    PI, G2, DW = "I_PRO", "GUN_2X2", "DW"
    return [
        call("WALL BASE", PI, F62, C3_62, "front", what="Six on the line, two backers over the B gaps. The most run-dominant front in football.",
             best="Wing-T, Double Wing, power and option teams.", tags=["base", "run down"], form_name="vs Pro I"),
        call("WALL vs DOUBLE WING", DW, F62, C3_62, "front", what="Same rules vs tight splits and two wings: ends squeeze, guards stay in A gaps.",
             best="Double Wing and unbalanced power.", tags=["base", "goal line"], form_name="vs Double Wing"),
        call("WALL WIDE TACKLE 6", PI, F62_WT6, C3_62, "front", what="Tackles widen to 6-technique, guards to 3s, LBs stack in the A gaps.",
             best="Off-tackle power and sweep teams.", tags=["run down"], week=2, form_name="vs Pro I"),
        call("WALL COVER 3 (SINK)", PI, F62, C3_62, "coverage", "c3", what="Ends sink to the flats, LBs to the curls, three deep. Four rush.",
             best="Play-action and boot teams.", tags=["pass down"], week=2, form_name="vs Pro I"),
        call("WALL COVER 1", PI, F62, C1_62, "coverage", "c1", what="Man-free; strong end jams and covers the tight end.",
             best="Quick passes, TE pop passes.", tags=["pass down", "3rd down"], week=2, form_name="vs Pro I"),
        call("WALL SLANT STRONG", PI, F62, C3_62, "stunt", ov={"G": ("slant", "B", "s"), "T": ("slant", "D", "s"), "N": ("slant", "A", "s"),
                                                             "U": ("slant", "B", "w"), "M": ("gap", "C", "s"), "W": ("gap", "A", "w")},
             what="Interior four slant to the strength; LBs scrape.", best="Zone and down-block teams.", tags=["run down", "stunt"], week=2,
             form_name="vs Pro I"),
        call("WALL GUT", PI, F62, C3_62, "stunt", ov={"T": ("slant", "B", "s"), "U": ("slant", "B", "w"), "M": ("gap", "C", "s"), "W": ("gap", "C", "w")},
             what="Tackles pinch to the B gaps, linebackers bounce outside to C. Kills the trap and iso.", best="Trap, iso and dive teams.",
             tags=["short yardage", "stunt"], week=2, form_name="vs Pro I"),
        call("WALL LOOP", PI, F62, C3_62, "stunt", ov={"G": ("slant", "B", "s"), "M": ("gap", "A", "s"), "E": ("loop", "C", "s"), "T": ("slant", "D", "s")},
             what="Strong tackle and end exchange; guard slants out. Confuses down blocks.", best="Gap/power teams.", tags=["stunt"], week=3,
             form_name="vs Pro I"),
        call("WALL LB DOG", PI, F62, C1_62, "blitz", "c1", ov={"M": ("blitz", "B", "s"), "W": ("blitz", "B", "w"), "E": ("man", "s2"), "J": ("man", "b")},
             what="Both backers blitz B gaps; ends cover TE and back. Eight-man pressure.", best="Short yardage and 2nd & long.",
             tags=["blitz", "short yardage"], week=2, form_name="vs Pro I"),
        call("WALL ZERO", PI, F62, {"C": ("man", "s1"), "K": ("man", "w1"), "E": ("man", "s2"), "W": ("man", "b")}, "blitz", "c0",
             ov={"F": ("blitz", "A", "s"), "M": ("blitz", "B", "s")}, what="Safety and Mike blitz with Cover 0.",
             best="Obvious passing downs.", tags=["blitz", "3rd down"], week=3, form_name="vs Pro I"),
        call("WALL vs SPREAD", G2, F62_SPREAD, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "E": "flat_r", "J": "flat_l", "M": "hook_r", "W": "hook_l"},
             "coverage", "c3", what="Ends stand up and walk out to apex vs 2x2; still four down inside.", best="Spread teams in youth leagues.",
             tags=["spread"], week=3, form_name="vs Doubles"),
        call("WALL GOAL LINE", PI, F62_GL, C1_62, "front", what="Backers at 2 yds, corners pressed, safety at 5. Nothing inside.",
             best="Inside the 5; 4th and 1.", tags=["goal line", "short yardage"], week=3, form_name="vs Pro I"),
    ]


# =================================================================== 5-3
F53 = {
    "E": ("Strong End", ("tech", "s", "9"), ("gap", "D", "s")),
    "T": ("Strong Tackle", ("tech", "s", "4i"), ("gap", "B", "s")),
    "N": ("Nose", ("tech", "c", "0"), ("gap", "A", "s")),
    "U": ("Weak Tackle", ("tech", "w", "4i"), ("gap", "B", "w")),
    "J": ("Weak End", ("tech", "w", "5"), ("gap", "C", "w")),
    "S": ("Sam", ("lb", "s", 4.0, 4.0), ("gap", "C", "s")),
    "M": ("Mike", ("lb", "c", 0.0, 4.6), ("gap", "A", "w")),
    "W": ("Will", ("lb", "w", 4.6, 3.8), ("gap", "E", "w")),
    "C": ("Strong Corner", ("cb", "s"), ("deep",)),
    "K": ("Weak Corner", ("cb", "w"), ("deep",)),
    "F": ("Free Safety", ("s", "c", 0.0, 10.0), ("fill",)),
}
C3_53 = {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "W": "flat_l", "M": "mid"}
C1_53 = {"C": ("man", "s1"), "K": ("man", "w1"), "F": "deep_m", "S": ("man", "s2"), "M": ("man", "b"), "W": "rob"}
F53_SPREAD = mod(F53, S=("Sam (apex)", ("apex", "s"), ("gap", "E", "s")), W=("Will (apex)", ("apex", "w"), ("gap", "E", "w")),
                 E=("Strong End", ("tech", "s", "5"), ("gap", "C", "s")))
F53_GL = mod(F53, S=("Sam", ("lb", "s", 3.8, 2.2), ("gap", "C", "s")), M=("Mike", ("lb", "c", 0.0, 2.4), ("gap", "A", "w")),
             W=("Will", ("lb", "w", 4.4, 2.2), ("gap", "E", "w")), F=("Free Safety", ("s", "c", 0.0, 6.0), ("fill",)))


def _forge_calls():
    PI, G2, G3 = "I_PRO", "GUN_2X2", "GUN_TRIPS"
    return [
        call("FORGE BASE", PI, F53, C3_53, "front", what="Five down linemen, three linebackers, three deep. A nose on the center takes away the A gaps.",
             best="Inside run teams, power and iso.", tags=["base", "run down"], form_name="vs Pro I"),
        call("FORGE COVER 3", PI, F53, C3_53, "coverage", "c3", what="Three deep, three under (two flats + middle hook), five rush.",
             best="Play-action and balanced offenses.", tags=["base", "pass down"], form_name="vs Pro I"),
        call("FORGE COVER 1", PI, F53, C1_53, "coverage", "c1", what="Man-free with Will as the robber.", best="Quick game and crossers.",
             tags=["pass down", "3rd down"], week=2, form_name="vs Pro I"),
        call("FORGE SLANT STRONG", PI, F53, C3_53, "stunt", ov={"N": ("slant", "A", "s"), "T": ("slant", "C", "s"), "U": ("slant", "A", "w"),
                                                              "J": ("slant", "B", "w"), "S": ("gap", "D", "s"), "M": ("gap", "B", "s"), "W": ("gap", "C", "w")},
             what="The front slants to the tight end; backers scrape back.", best="Zone teams.", tags=["run down", "stunt"], week=2,
             form_name="vs Pro I"),
        call("FORGE PINCH", PI, F53, C3_53, "stunt", ov={"T": ("slant", "A", "s"), "U": ("slant", "A", "w"), "E": ("slant", "C", "s"),
                                                       "J": ("slant", "B", "w"), "S": ("gap", "D", "s"), "M": ("gap", "B", "s"), "W": ("gap", "C", "w")},
             what="Tackles and ends pinch inside; linebackers fill outside.", best="Wedge, trap and dive.", tags=["short yardage", "stunt"],
             week=2, form_name="vs Pro I"),
        call("FORGE TWIST", PI, F53, C3_53, "stunt", ov={"T": ("slant", "C", "s"), "E": ("loop", "B", "s")},
             what="Tackle-end exchange to the strength.", best="Passing downs, zone teams.", tags=["pass down", "stunt"], week=3, form_name="vs Pro I"),
        call("FORGE SAM FIRE", PI, F53, C1_53, "blitz", "c1", ov={"S": ("blitz", "C", "s"), "M": ("man", "s2"), "W": ("man", "b")},
             what="Sam blitzes C gap with man-free behind.", best="Power and boot teams.", tags=["blitz"], week=2, form_name="vs Pro I"),
        call("FORGE WILL FIRE", PI, F53, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "M": "hook_r", "J": "flat_l"}, "blitz", "c3",
             ov={"W": ("blitz", "D", "w")}, what="Will off the weak edge; the weak end drops to the flat (fire zone).",
             best="Weak-side runs and sprint-outs.", tags=["blitz", "perimeter"], week=2, form_name="vs Pro I"),
        call("FORGE MIKE DOG", PI, F53, C1_53, "blitz", "c1", ov={"M": ("blitz", "A", "w"), "W": ("man", "b")},
             what="Mike blitzes the weak A gap; Will takes the back.", best="Iso and inside zone.", tags=["blitz", "short yardage"], week=2,
             form_name="vs Pro I"),
        call("FORGE ZERO", PI, F53, {"C": ("man", "s1"), "K": ("man", "w1"), "F": ("man", "s2"), "M": ("man", "b")}, "blitz", "c0",
             ov={"S": ("blitz", "D", "s"), "W": ("blitz", "D", "w")}, what="Both outside backers blitz; Cover 0.", best="Must-have downs.",
             tags=["blitz", "3rd down"], week=3, form_name="vs Pro I"),
        call("FORGE vs SPREAD", G2, F53_SPREAD, {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "W": "flat_l", "M": "mid"},
             "coverage", "c3", what="Outside backers to apex vs 2x2; ends to 5-techniques.", best="Doubles / RPO teams.",
             tags=["spread"], week=2, form_name="vs Doubles"),
        call("FORGE vs TRIPS", G3, mod(F53_SPREAD, M=("Mike (bumps)", ("lb", "s", 2.0, 4.8), ("gap", "A", "s"))),
             {"C": "deep_r", "K": "deep_l", "F": "deep_m", "S": "flat_r", "M": "curl_r", "W": "hook_l"}, "coverage", "c3",
             what="Mike bumps to the trips side; Will plays the weak hook.", best="3x1 formations.", tags=["spread"], week=3, form_name="vs Trips"),
        call("FORGE GOAL LINE", PI, F53_GL, C1_53, "front", what="Backers to 2 yds, safety to 6. Gap-sound vs every goal-line run.",
             best="Inside the 5.", tags=["goal line", "short yardage"], week=3, form_name="vs Pro I"),
    ]


def anvil_calls():
    return with_twins(_anvil_calls(), C1_44, C3_44)


def hammer_calls():
    return with_twins(_hammer_calls(), C1_425, C3_425)


def wall_calls():
    return with_twins(_wall_calls(), C1_62, C3_62)


def forge_calls():
    return with_twins(_forge_calls(), C1_53, C3_53)


DBUCKETS = [("Base / 1st down", {"base"}), ("Run downs", {"run down"}), ("Passing downs", {"pass down"}),
            ("3rd down / pressure", {"3rd down", "blitz"}), ("Short yardage & goal line", {"short yardage", "goal line"}),
            ("Vs spread / trips", {"spread", "rpo"}), ("Stunts", {"stunt"}), ("Perimeter answers", {"perimeter"})]


def technique_page():
    out = section("Technique & Gap Chart", "Speak the language")
    D = Diagram(CONTENT_W, xmax=9, ymin=-2.4, ymax=3.0, hashes=False)
    for k, x in [("", -3.0), ("", -1.5), ("C", 0), ("", 1.5), ("", 3.0), ("Y", 4.5)]:
        D.o(x, -0.8, k, "center" if k == "C" else "o")
    from .defense import TECH_X
    for t, x in TECH_X.items():
        if t == "w9":
            continue
        D.text(x, 1.9 if t in ("1", "2i", "4i", "7") else 1.0, t, size=11)
    for g, x in [("A", 0.75), ("B", 2.25), ("C", 3.75), ("D", 5.3)]:
        D.text(x, -2.0, g, size=12, color=None)
        D.text(-x, -2.0, g, size=12, color=None)
    out += [D, Spacer(1, 6)]
    out.append(grid([["TECH", "ALIGNMENT"]] + [[k, v] for k, v in TECH_TXT.items()], [0.8 * inch, CONTENT_W - 0.8 * inch]))
    out.append(Spacer(1, 6))
    out += bullets(["<b>Gaps:</b> A = center–guard, B = guard–tackle, C = tackle–tight end, D = outside the tight end.",
                    "<b>Strength:</b> called to the tight end. No TE: to the passing strength (more receivers). Equal: to the field.",
                    "<b>Contain/force:</b> the outside-most defender keeps the ball inside; nobody outside him."])
    out.append(PageBreak())
    return out


def defense_book(spec):
    calls = spec["calls"]()
    story = toc_block()
    story += section("Start Here", "Defense")
    story.append(P(spec["hook"], "quote"))
    for para in spec["philosophy"]:
        story.append(P(para, "body"))
    story.append(P("Why it wins", "h3"))
    story += bullets(spec["why"])
    story.append(P("Defensive standards", "h3"))
    story += numbered(["Alignment, assignment, effort — in that order. Coach the first two every snap.",
                       "Eleven hats to the ball on every play. Grade pursuit, not just tackles.",
                       "Every gap has a name. If you can't name your gap, you're not ready to play.",
                       "Tackle with your near shoulder, head across, wrap and run your feet.",
                       "Take the ball away: strip, rake, scoop, score."])
    story.append(PageBreak())
    story += section("Personnel", "Who plays where")
    rows = [["POS", "NAME", "WHO PLAYS HERE"]] + [[k, v[0], spec["who"].get(k, "")] for k, v in spec["front"].items()]
    story.append(grid(rows, [0.5 * inch, 1.7 * inch, CONTENT_W - 2.2 * inch]))
    story.append(PageBreak())
    story += technique_page()
    story += section("The Calls", f"{len(calls)} calls • align / run / pass for all 11")
    rows = [["#", "CALL", "TYPE", "INSTALL"]] + [[f"{i:02d}", c.call, c.family, f"Week {c.week}"] for i, c in enumerate(calls, 1)]
    story.append(grid(rows, [0.45 * inch, CONTENT_W * 0.5, CONTENT_W * 0.28, CONTENT_W * 0.22 - 0.45 * inch]))
    story.append(Spacer(1, 10))
    story.append(P("Reading the diagrams", "h3"))
    story += bullets(["<b>Blue letters</b> = defenders. <b>Grey circles</b> = the offensive formation.",
                      "<b>Solid blue arrow</b> = gap responsibility. <b>Orange arrow / orange defender</b> = stunt or blitz.",
                      "<b>Dashed arrow + shaded oval</b> = zone drop. <b>Dotted line</b> = man assignment."])
    story.append(PageBreak())
    for i, c in enumerate(calls, 1):
        story += play_page(c, i)
    story += install_plan(calls, title="Installation Plan")
    story += call_sheet(calls, DBUCKETS, title="Defensive Call Sheet")
    story += wristband(calls, title="Defensive Wristband")
    story += notes_page()
    return story


WHO = {
    "E": "Edge player: long, tough, disciplined. Sets the edge every snap.", "J": "Weak end: quick get-off, chases from the backside.",
    "T": "Strong interior lineman: wins with leverage and hands.", "N": "Interior lineman: anchors double teams, never gets washed.",
    "G": "Interior lineman: quick, low, owns his A gap.", "U": "Tackle: strong at the point of attack, squeezes down blocks.",
    "S": "Strong outside backer: physical, sets the edge or plays the flat.", "M": "Mike: the quarterback of the defense — makes the calls.",
    "W": "Will: fast, run-and-chase backer.", "B": "Bandit: hybrid — blitzes, covers, tackles in space.",
    "$": "Spur: safety/linebacker hybrid; fits the run, covers the slot.", "C": "Best cover athlete; plays the field side.",
    "K": "Corner: physical, sure tackler on the boundary.", "F": "Free safety: last line of defense — smart, sure tackler, great angles.",
}

DEFENSE_BOOKS = [
    dict(key="anvil", title="4-4 Anvil Defense", category="Defense", calls=anvil_calls, front=F44, who=WHO,
         subtitle="Eight in the box, a gap for every defender, and the stunts, blitzes and coverages to take away anything.",
         hook="Eight hammers. One anvil. Nothing runs through it.",
         philosophy=["The Anvil is a 4-4: four down linemen, four linebackers and three defensive backs. It puts eight defenders within "
                     "five yards of the ball and assigns every one of them a gap. Against run-first offenses — which is most of football "
                     "below the varsity level — it is the most sound structure you can field.",
                     "From one base alignment you'll install three stunts, four blitzes, two coverages and checks for spread and trips. "
                     "Players learn one set of alignment rules and keep them all season."],
         why=["Eight-man box: always one more fitter than the offense has blockers.", "Outside backers are run defenders AND flat players.",
              "Stunts and blitzes come from the same look.", "Simple checks vs spread and trips keep the box sound."]),
    dict(key="hammer", title="4-2-5 Hammer Defense", category="Defense", calls=hammer_calls, front=F425, who=WHO,
         subtitle="The modern answer to the spread: two hybrid apex players, quarters and single-high coverage, and pressure from anywhere.",
         hook="Five defensive backs. Two hybrids who hit like linebackers. Built for the spread.",
         philosophy=["The Hammer is a 4-2-5: four down, two linebackers and five defensive backs. Two of those DBs — the Spur and the "
                     "Bandit — are hybrids who align in the apex between the offensive tackle and the slot. They are the hammers: "
                     "run fitters on run plays, coverage players on pass plays.",
                     "Single-high (Cover 3, Cover 1) and two-high (Cover 2, Cover 4) shells come from the same look, so the quarterback "
                     "can't read the coverage before the snap."],
         why=["Matches spread personnel without substituting.", "Apex players kill RPOs and bubble screens.",
              "Quarters gives nine-man run fits when #2 blocks.", "Pressure from five different launch points."]),
    dict(key="wall", title="6-2 Wall Defense", category="Defense", calls=wall_calls, front=F62, who=WHO,
         subtitle="Six on the line, two backers, three deep: the run-stopping front built for youth and small-school football.",
         hook="Six across. Two behind. Run into a wall.",
         philosophy=["The Wall is a 6-2: six defensive linemen, two linebackers and three deep. It takes away every interior gap at the "
                     "line of scrimmage and forces offenses to beat you on the perimeter or through the air — the two things most young "
                     "offenses can't do consistently.",
                     "The Wide Tackle 6 adjustment, gut and slant stunts, and a simple Cover 3 Sink give you everything needed to defend "
                     "power, option and the spread looks you'll see a few times a season."],
         why=["Every interior gap covered at the snap.", "Perfect vs Wing-T, Double Wing and wedge.",
              "Simple rules for young players.", "Ends drop into coverage to disguise four-man rushes."]),
    dict(key="forge", title="5-3 Forge Defense", category="Defense", calls=forge_calls, front=F53, who=WHO,
         subtitle="A nose on the center, five down, three backers: the balanced odd front with stunts, fire zones and spread checks.",
         hook="Heat the middle. Hammer the edges. Forge the pocket shut.",
         philosophy=["The Forge is a 5-3: a nose head-up on the center, two tackles in 4i alignments, two ends and three linebackers. "
                     "The nose and tackles eat the double teams; the linebackers run free.",
                     "It's balanced, so you don't need to set strength perfectly, and its fire-zone pressures bring five while dropping "
                     "a lineman — confusing young quarterbacks who expect the blitzer to be open."],
         why=["Nose kills the A gaps and the wedge.", "Three free-flowing linebackers.",
              "Fire zones bring pressure without man coverage.", "Easy apex adjustments vs spread."]),
]
