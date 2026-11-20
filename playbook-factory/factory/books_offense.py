"""The 14 offensive playbooks. Each book = philosophy + formations + a play list.

Numbering system used in every book (taught on the Terminology page):
  Holes: even to the right, odd to the left — 0/1 A gap, 2/3 B gap, 4/5 C gap
         (off tackle), 6/7 D gap (outside the TE), 8/9 the edge.
  Backs: 1 = QB, 2 = tailback/primary back, 3 = fullback, 4 = wing/halfback.
  So "24 Power" = the 2-back through the 4 hole (right C gap) on Power.
"""
from reportlab.platypus import Spacer, PageBreak, Table, TableStyle
from reportlab.lib.units import inch
from . import offense as O
from . import formations as FM
from .layout import (P, ST, section, bullets, numbered, grid, play_page, wristband, call_sheet, install_plan,
                     notes_page, toc_block, CONTENT_W, Bar, chips)
from .diagram import Diagram

R, PASS, RPO = O.run_play, O.pass_play, O.rpo_play

ROLE_WHO = {
    "OL": "Your five best blockers. Center = smartest lineman (makes the calls). Guards = quickest feet (they pull). Tackles = longest arms.",
    "TE": "Big enough to block a defensive end, athletic enough to catch on play-action.",
    "WR": "Best hands and speed on the team — and a willing blocker, or he doesn't play.",
    "SLOT": "Quick and tough. Blocks the overhang defender and runs option routes underneath.",
    "WING": "Versatile and physical: blocks down, carries reverses, catches the boot.",
    "QB": "Your leader. Ball handling and decisions first, arm strength second.",
    "RB": "Vision, toughness and ball security. Fullbacks: your most physical player.",
}

BUCKETS = [("Openers / base runs", {"base run", "opener"}), ("Short yardage & goal line", {"short yardage", "goal line"}),
           ("Perimeter & constraint", {"perimeter", "constraint"}), ("Play-action & shots", {"play-action", "shot"}),
           ("Quick game / 3rd & medium", {"quick game", "3rd down"}), ("Screens & pressure beaters", {"screen", "pressure"}),
           ("Two-minute / long yardage", {"2-minute", "long yardage"}), ("RPO / option", {"rpo", "option"})]


def formation_diagram(key, left=False, width=CONTENT_W * 0.55):
    f = FM.get(key, left)
    D = Diagram(width, xmax=17.5, ymin=-8.4, ymax=2.5, hashes=False)
    for k, (x, y, r) in f.items():
        D.o(x, y, "" if r == "OL" else k, "center" if k == "C" else "o")
    return D


def align_rule(k, x, y, r, f):
    if r == "OL":
        return "On the ball. 2-ft splits (tighten to 1 ft in short yardage)." if k != "C" else "Snaps the ball; makes the line call."
    depth = abs(y) - 0.8
    side = "right" if x > 0 else "left"
    if r == "TE":
        return f"On the line, {side} side, 2–3 ft outside the tackle." if abs(x) < 7 else f"Split {abs(x):.0f} yds, on the line."
    if r == "WR":
        return (f"Wide {side}: top of the numbers, " + ("ON the line." if y > -1.2 else "OFF the line (1 yd back)."))
    if r == "SLOT":
        return f"Slot {side}: off the line, split the difference between the end man and the wide-out (~{abs(x):.0f} yds)."
    if r == "WING":
        return f"Wing {side}: 1 yd outside and 1 yd behind the end man, inside foot back."
    if r == "QB":
        if depth < 2:
            return "Under center." if k == "Q" else "Blocking back: 1 yd behind the strong guard–tackle gap."
        return f"Shotgun at {depth + 0.5:.0f} yds." if depth > 4 else f"Pistol at {depth + 0.5:.0f} yds."
    if r == "RB":
        where = "directly behind the QB" if abs(x) < 0.5 else f"offset {side} ({abs(x):.0f} yd)"
        return f"Heels at ~{depth + 0.5:.0f} yds, {where}."
    return ""


def terminology_pages(book):
    out = section("Terminology & Numbering", "Speak the language")
    out.append(P("Every play in this book is called the same way, so players learn one language for the whole season.", "body"))
    out.append(P("Play call structure", "h3"))
    out.append(grid([["FORMATION", "(MOTION)", "BACK + HOLE", "SCHEME"],
                     [book.get("example", ["I RT", "—", "24", "POWER"])[0], book.get("example", ["", "—"])[1],
                      book.get("example", ["", "", "24"])[2], book.get("example", ["", "", "", "POWER"])[3]]],
                    [CONTENT_W / 4] * 4))
    out.append(Spacer(1, 8))
    out.append(P("Hole numbering", "h3"))
    D = Diagram(CONTENT_W, xmax=13, ymin=-3.2, ymax=2.6, hashes=False)
    f = FM.get("I_TIGHT")
    for k, (x, y, r) in f.items():
        if r in ("OL", "TE"):
            D.o(x, y, "" if r == "OL" else k, "center" if k == "C" else "o")
    D.o(0, -2.0, "Q")
    for n, x in [(0, 0.75), (1, -0.75), (2, 2.25), (3, -2.25), (4, 3.75), (5, -3.75), (6, 5.4), (7, -5.4), (8, 8.5), (9, -8.5)]:
        D.text(x, 1.0, str(n), size=13)
    out += [D, Spacer(1, 4)]
    out += bullets(["<b>Even numbers go right, odd numbers go left.</b>",
                    "<b>0/1</b> A gap (center–guard) • <b>2/3</b> B gap (guard–tackle) • <b>4/5</b> C gap / off tackle • "
                    "<b>6/7</b> D gap, outside the tight end • <b>8/9</b> the edge / sweep.",
                    "<b>Backs:</b> 1 = quarterback, 2 = tailback, 3 = fullback, 4 = wing/halfback. First digit = ball carrier, second = hole.",
                    "<b>Pass series:</b> 60s = quick game, 70s = drop-back, 80s = play-action, 90s = sprint/boot. Concepts are named (STICK, SMASH...)."])
    out.append(P("Cadence", "h3"))
    out += bullets([book.get("cadence", "“READY... SET... GO!” — snap on the first GO unless the huddle call changes it "
                                       "(“on two”). Use a sharp, consistent rhythm; never snap on a sound that isn't GO.")])
    out.append(P("Line splits & stance", "h3"))
    out += bullets(["2-ft splits base; tighten to 1 ft on wedge, goal line and short yardage.",
                    "Linemen: 3-point stance, weight balanced so you can pull, pass set or fire out without tipping it.",
                    "Backs: 2-point (pistol/gun) or 3-point (I/T); identical stance every play."])
    out.append(PageBreak())
    return out


def offense_book(spec):
    plays = spec["plays"]()
    story = toc_block()
    # --- start here
    story += section("Start Here", spec["category"])
    story.append(P(spec["hook"], "quote"))
    for para in spec["philosophy"]:
        story.append(P(para, "body"))
    story.append(P("Why it wins", "h3"))
    story += bullets(spec["why"])
    story.append(P("How to use this book", "h3"))
    story += numbered(["Read the philosophy and terminology pages with your whole staff before the first practice.",
                       "Install the formations on day one — alignment is the first thing that breaks down under pressure.",
                       "Follow the week-by-week installation plan; don't add a play until the last one is clean.",
                       "Every play page has an assignment for all 11 players plus step-by-step instructions for the key player(s). "
                       "Copy those pages for position meetings.",
                       "Use the call sheet and wristband at the back on game day."])
    story.append(PageBreak())
    # --- personnel
    story += section("Personnel", "Who plays where")
    f = FM.get(spec["formations"][0][0])
    rows = [["POS", "ROLE", "WHO PLAYS HERE"]]
    seen = set()
    for k in ["Q", "B", "T", "F", "H", "W", "Y", "X", "Z", "S", "C"]:
        if k in f and k not in seen:
            seen.add(k)
            role = f[k][2]
            name = O.Build(spec["formations"][0][0]).name(k).split(" – ")[1]
            rows.append([k, name, spec.get("personnel", {}).get(k, ROLE_WHO.get(role, ""))])
    rows.append(["OL", "Offensive line", spec.get("personnel", {}).get("OL", ROLE_WHO["OL"])])
    story.append(grid(rows, [0.5 * inch, 1.5 * inch, CONTENT_W - 2.0 * inch]))
    story.append(PageBreak())
    story += terminology_pages(spec)
    # --- formations
    story += section("Formations", "Alignment")
    story.append(P("Strength is called to the tight end/passing strength. Every formation can be flipped "
                   "(RT/LT) — players mirror their alignment.", "body"))
    for key, name in spec["formations"]:
        fm = FM.get(key)
        dia = formation_diagram(key)
        rules = [P(name.upper(), "h3")]
        for k in ["Q", "B", "T", "F", "H", "W", "Y", "X", "Z", "S"]:
            if k in fm:
                rules.append(P(f"<b>{k}:</b> {align_rule(k, *fm[k], fm)}", "small"))
        t = Table([[dia, rules]], colWidths=[CONTENT_W * 0.57, CONTENT_W * 0.43])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
        story.append(t)
    story.append(PageBreak())
    # --- plays
    story += section("The Plays", f"{len(plays)} plays • full assignments")
    rows = [["#", "CALL", "FAMILY", "INSTALL"]] + [[f"{i:02d}", p.call, p.family, f"Week {p.week}"] for i, p in enumerate(plays, 1)]
    story.append(grid(rows, [0.45 * inch, CONTENT_W * 0.5, CONTENT_W * 0.28, CONTENT_W * 0.22 - 0.45 * inch]))
    story.append(Spacer(1, 10))
    story.append(P("Reading the diagrams", "h3"))
    story += bullets(["<b>Orange path</b> = ball carrier. <b>Orange circle</b> = primary/key player. <b>Numbers</b> on pass plays = QB progression.",
                      "<b>Line with a T</b> = block. <b>Arrow</b> = route or run path. <b>Dotted</b> = fake or ball-handling action. "
                      "<b>Dashed</b> = option/pitch path. <b>Zig-zag</b> = pre-snap motion.",
                      "<b>Grey letters</b> = a typical defensive look (E/T = linemen, S/M/W = linebackers, N = nickel, C = corner, $/F = safeties). "
                      "Ringed defenders are <b>read</b>, not blocked."])
    story.append(PageBreak())
    for i, p in enumerate(plays, 1):
        story += play_page(p, i)
    story += install_plan(plays)
    story += call_sheet(plays, BUCKETS)
    story += wristband(plays)
    story += notes_page()
    return story


# =========================================================================
# BOOK DEFINITIONS
# =========================================================================

def diamond_plays():
    F = "Diamond"
    return [
        R("DIAMOND 24 POWER", "PISTOL_DIAMOND", "power", d=1, carrier="T", kick="F", lead="H", tags=["base run", "opener"], form_name=F),
        R("DIAMOND 25 POWER", "PISTOL_DIAMOND", "power", d=-1, carrier="T", kick="H", lead="F", tags=["base run"], form_name=F),
        R("DIAMOND 22 ISO", "PISTOL_DIAMOND", "iso", d=1, carrier="T", lead="F", fakes=("H",), tags=["base run", "short yardage"], form_name=F),
        R("DIAMOND 28 TOSS", "PISTOL_DIAMOND", "toss", d=1, carrier="T", lead="F", tags=["perimeter"], form_name=F),
        R("DIAMOND 25 COUNTER", "PISTOL_DIAMOND", "counter", d=-1, carrier="T", fakes=("F",), tags=["constraint"], week=2, form_name=F),
        R("DIAMOND 22 ZONE READ", "PISTOL_DIAMOND", "zone_read", d=1, carrier="T", lead="F", tags=["option", "base run"], week=2, form_name=F),
        R("DIAMOND 29 POWER READ", "PISTOL_DIAMOND", "power_read", d=-1, carrier="T", lead="H", tags=["option"], week=2, form_name=F),
        R("DIAMOND 14 QB POWER", "PISTOL_DIAMOND", "qb_power", d=1, carrier="Q", kick="F", lead="H", tags=["short yardage", "goal line"], week=1, form_name=F),
        R("DIAMOND 20 WEDGE", "PISTOL_DIAMOND", "wedge", d=1, carrier="T", tags=["goal line", "short yardage"], form_name=F),
        R("DIAMOND 22 TRAP", "PISTOL_DIAMOND", "trap", d=1, carrier="T", fakes=("H",), tags=["constraint"], week=3, form_name=F),
        R("DIAMOND 26 STRETCH", "PISTOL_DIAMOND", "stretch", d=1, carrier="T", lead="F", tags=["perimeter"], week=3, form_name=F),
        PASS("DIAMOND 95 BOOT", "PISTOL_DIAMOND", "boot", run_fake="T", tags=["play-action", "3rd down"], week=2, form_name=F),
        PASS("DIAMOND 84 POP", "PISTOL_DIAMOND", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=3, form_name=F),
        PASS("DIAMOND 60 SLANT-FLAT", "PISTOL_DIAMOND", "slant_flat", tags=["quick game", "3rd down"], week=2, form_name=F),
        PASS("DIAMOND 76 RB SCREEN", "PISTOL_DIAMOND", "rb_screen", tags=["screen", "pressure"], week=3, form_name=F),
    ]


def power1_plays():
    return [
        R("I RT 24 POWER", "I_PRO", "power", d=1, carrier="T", kick="F", tags=["base run", "opener"], form_name="I Right"),
        R("I RT 25 POWER", "I_PRO", "power", d=-1, carrier="T", kick="F", tags=["base run"], form_name="I Right"),
        R("I RT 22 ISO", "I_PRO", "iso", d=1, carrier="T", lead="F", tags=["base run", "short yardage"], form_name="I Right"),
        R("I RT 30 DIVE", "I_PRO", "dive", d=1, carrier="F", hole="A", tags=["short yardage"], form_name="I Right"),
        R("I RT 28 TOSS", "I_PRO", "toss", d=1, carrier="T", lead="F", tags=["perimeter"], form_name="I Right"),
        R("I RT 25 COUNTER", "I_PRO", "counter", d=-1, carrier="T", fakes=("F",), tags=["constraint"], week=2, form_name="I Right"),
        R("I TIGHT 24 POWER", "I_TIGHT", "power", d=1, carrier="T", kick="F", tags=["short yardage", "goal line"], week=2, form_name="I Tight"),
        R("I RT 26 STRETCH", "I_PRO", "stretch", d=1, carrier="T", lead="F", tags=["perimeter"], week=2, form_name="I Right"),
        R("I RT 22 TRAP", "I_PRO", "trap", d=1, carrier="T", fakes=("F",), tags=["constraint"], week=3, form_name="I Right"),
        R("OFFSET 24 POWER", "OFFSET_I", "power", d=1, carrier="T", kick="F", tags=["base run"], week=2, form_name="Offset I"),
        R("I TIGHT 20 WEDGE", "I_TIGHT", "wedge", d=1, carrier="T", tags=["goal line", "short yardage"], form_name="I Tight"),
        PASS("I RT 95 BOOT", "I_PRO", "boot", run_fake="T", tags=["play-action", "3rd down"], week=2, form_name="I Right"),
        PASS("I RT 84 POP", "I_PRO", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=3, form_name="I Right"),
        PASS("I RT 60 SLANT-FLAT", "I_PRO", "slant_flat", tags=["quick game", "3rd down"], week=2, form_name="I Right"),
        PASS("SPLIT 70 SMASH", "PRO_SPLIT", "smash", tags=["long yardage", "3rd down"], week=3, form_name="Pro Split"),
        PASS("I RT 76 RB SCREEN", "I_PRO", "rb_screen", tags=["screen", "pressure"], week=3, form_name="I Right"),
    ]


def power2_plays():
    U = "Unbalanced Wing"
    return [
        R("UNB 24 POWER", "UNB_WING", "power", d=1, carrier="T", kick="F", tags=["base run", "opener"], form_name=U),
        R("UNB 26 POWER", "UNB_WING", "power", d=1, carrier="T", kick="F", hole="D", tags=["base run"], form_name=U),
        R("UNB 22 ISO", "UNB_WING", "iso", d=1, carrier="T", lead="F", tags=["base run"], form_name=U),
        R("UNB 28 TOSS", "UNB_WING", "toss", d=1, carrier="T", lead="F", tags=["perimeter"], form_name=U),
        R("UNB 25 COUNTER", "UNB_WING", "counter", d=-1, carrier="T", fakes=("F",), tags=["constraint"], week=2, form_name=U),
        R("UNB 24 COUNTER", "UNB_WING", "counter", d=1, carrier="T", fakes=("F",), tags=["base run"], week=2, form_name=U),
        R("UNB 20 WEDGE", "UNB_WING", "wedge", d=1, carrier="T", tags=["goal line", "short yardage"], form_name=U),
        R("UNB 30 DIVE", "UNB_WING", "dive", d=1, carrier="F", hole="A", tags=["short yardage"], form_name=U),
        R("UNB 26 STRETCH", "UNB_WING", "stretch", d=1, carrier="T", lead="F", tags=["perimeter"], week=2, form_name=U),
        R("UNB 49 REVERSE", "UNB_WING", "jet", d=-1, carrier="W", tags=["constraint"], week=3, form_name=U),
        R("WING 24 POWER", "I_WING", "power", d=1, carrier="T", kick="F", tags=["base run"], week=2, form_name="I Wing"),
        R("WING 28 TOSS", "I_WING", "toss", d=1, carrier="T", lead="F", tags=["perimeter"], week=2, form_name="I Wing"),
        PASS("UNB 95 BOOT", "UNB_WING", "boot", run_fake="T", tags=["play-action"], week=2, form_name=U),
        PASS("UNB 84 POP", "UNB_WING", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=3, form_name=U),
        PASS("WING 90 FLOOD", "I_WING", "flood", tags=["3rd down", "long yardage"], week=3, form_name="I Wing"),
    ]


def power3_plays():
    PH, PT = "Pistol H", "Pistol Trips"
    return [
        R("PISTOL 24 POWER", "PISTOL_H", "power", d=1, carrier="T", kick="H", tags=["base run", "opener"], form_name=PH),
        R("PISTOL 25 COUNTER", "PISTOL_H", "counter", d=-1, carrier="T", tags=["constraint"], form_name=PH),
        R("PISTOL 22 ZONE", "PISTOL_H", "zone", d=1, carrier="T", tags=["base run"], form_name=PH),
        R("PISTOL 23 ZONE READ", "PISTOL_H", "zone_read", d=-1, carrier="T", tags=["option"], week=2, form_name=PH),
        R("PISTOL 29 POWER READ", "PISTOL_H", "power_read", d=-1, carrier="T", tags=["option"], week=2, form_name=PH),
        R("PISTOL 14 QB POWER", "PISTOL_H", "qb_power", d=1, carrier="Q", kick="H", lead="T", tags=["short yardage", "goal line"], form_name=PH),
        R("PISTOL 22 ISO", "PISTOL_H", "iso", d=1, carrier="T", lead="H", tags=["short yardage"], week=2, form_name=PH),
        R("PISTOL 28 TOSS", "PISTOL_H", "toss", d=1, carrier="T", lead="H", tags=["perimeter"], week=2, form_name=PH),
        R("TRIPS 25 POWER", "PISTOL_TRIPS", "power", d=-1, carrier="T", tags=["base run"], week=2, form_name=PT),
        RPO("TRIPS 23 ZONE BUBBLE", "PISTOL_TRIPS", "zone", {"S": "bubble", "Z": "stalk", "Y": "seal_lb"}, "bubble", d=-1, read_label="S", tags=["rpo"], week=2, form_name=PT),
        PASS("PISTOL 84 POP", "PISTOL_H", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=2, form_name=PH),
        PASS("PISTOL 95 BOOT", "PISTOL_H", "boot", run_fake="T", tags=["play-action", "3rd down"], week=2, form_name=PH),
        PASS("TRIPS 60 STICK", "PISTOL_TRIPS", "stick", tags=["quick game", "3rd down"], week=3, form_name=PT),
        PASS("TRIPS 70 FLOOD", "PISTOL_TRIPS", "flood", tags=["long yardage"], week=3, form_name=PT),
        PASS("TRIPS 60 BUBBLE", "PISTOL_TRIPS", "bubble", tags=["screen", "perimeter"], week=1, form_name=PT),
    ]


def rpo_plays():
    G2, G3, G11 = "Gun Doubles", "Gun Trips", "Gun Ace (11)"
    return [
        RPO("DOUBLES 22 ZONE BUBBLE", "GUN_2X2", "zone", {"Y": "bubble", "Z": "stalk"}, "bubble", d=-1, read_label="S", tags=["rpo", "opener"], form_name=G2),
        RPO("DOUBLES 23 ZONE GLANCE", "GUN_2X2", "zone", {"Z": "skinny", "Y": "seam"}, "glance", d=-1, read_label="$", tags=["rpo", "shot"], week=2, form_name=G2),
        RPO("TRIPS 23 ZONE NOW", "GUN_TRIPS", "zone", {"Z": "now", "S": "stalk", "Y": "stalk"}, "now", d=-1, read_label="N", tags=["rpo", "perimeter"], form_name=G3),
        RPO("TRIPS 25 POWER STICK", "GUN_TRIPS", "power", {"Y": "stick", "S": "flat", "Z": "fade"}, "stick", d=-1, read_label="N", tags=["rpo"], week=2, form_name=G3),
        RPO("ACE 22 DUO SLANT", "GUN_11", "iso", {"X": "slant", "S": "seam"}, "slant", d=1, read_label="W", tags=["rpo"], week=2, form_name=G11),
        RPO("DOUBLES 25 COUNTER BUBBLE", "GUN_2X2", "counter", {"Y": "bubble", "Z": "stalk"}, "bubble", d=-1, read_label="S", tags=["rpo", "constraint"], week=3, form_name=G2),
        R("DOUBLES 22 ZONE READ", "GUN_2X2", "zone_read", d=1, carrier="T", tags=["option", "base run"], form_name=G2),
        R("TRIPS 29 POWER READ", "GUN_TRIPS", "power_read", d=-1, carrier="T", tags=["option"], week=2, form_name=G3),
        R("ACE 14 QB POWER", "GUN_11", "qb_power", d=1, carrier="Q", lead="T", tags=["short yardage", "goal line"], week=2, form_name=G11),
        PASS("DOUBLES 60 STICK", "GUN_2X2", "stick", tags=["quick game", "3rd down"], form_name=G2),
        PASS("TRIPS 60 SNAG", "GUN_TRIPS", "snag", tags=["quick game"], week=2, form_name=G3),
        PASS("DOUBLES 70 SMASH", "GUN_2X2", "smash", tags=["3rd down"], week=2, form_name=G2),
        PASS("DOUBLES 70 FOUR VERTS", "GUN_2X2", "verts", tags=["shot", "2-minute"], week=3, form_name=G2),
        PASS("TRIPS 60 TUNNEL", "GUN_TRIPS", "tunnel", tags=["screen", "pressure"], week=3, form_name=G3),
        PASS("DOUBLES 76 RB SCREEN", "GUN_2X2", "rb_screen", tags=["screen", "pressure"], week=3, form_name=G2),
    ]


def airraid_plays():
    G2, G3, GE = "Gun Doubles", "Gun Trips", "Gun Empty"
    return [
        PASS("DOUBLES MESH", "GUN_2X2", "mesh", tags=["opener", "3rd down"], form_name=G2),
        PASS("TRIPS Y-CROSS", "GUN_TRIPS", "y_cross", tags=["3rd down", "long yardage"], form_name=G3),
        PASS("DOUBLES STICK", "GUN_2X2", "stick", tags=["quick game"], form_name=G2),
        PASS("TRIPS SNAG", "GUN_TRIPS", "snag", tags=["quick game"], form_name=G3),
        PASS("DOUBLES FOUR VERTS", "GUN_2X2", "verts", tags=["shot", "2-minute"], form_name=G2),
        PASS("DOUBLES SHALLOW", "GUN_2X2", "drive", tags=["3rd down"], week=2, form_name=G2),
        PASS("DOUBLES SMASH", "GUN_2X2", "smash", tags=["3rd down"], week=2, form_name=G2),
        PASS("TRIPS CURL-FLAT", "GUN_TRIPS", "curl_flat", tags=["quick game"], week=2, form_name=G3),
        PASS("TRIPS LEVELS", "GUN_TRIPS", "levels", tags=["3rd down"], week=2, form_name=G3),
        PASS("DOUBLES HITCH-SEAM", "GUN_2X2", "hitch_seam", tags=["quick game", "2-minute"], week=2, form_name=G2),
        PASS("EMPTY STICK", "GUN_EMPTY", "stick", tags=["quick game", "pressure"], week=3, form_name=GE),
        PASS("DOUBLES RB SCREEN", "GUN_2X2", "rb_screen", tags=["screen", "pressure"], week=2, form_name=G2),
        PASS("TRIPS TUNNEL", "GUN_TRIPS", "tunnel", tags=["screen"], week=3, form_name=G3),
        PASS("TRIPS BUBBLE", "GUN_TRIPS", "bubble", tags=["screen", "perimeter"], form_name=G3),
        R("DOUBLES 22 ZONE", "GUN_2X2", "zone", d=1, carrier="T", tags=["base run"], form_name=G2),
        R("TRIPS 23 DRAW", "GUN_TRIPS", "iso", d=-1, carrier="T", tags=["constraint", "long yardage"], week=3, form_name=G3),
    ]


def airraid2_plays():
    G2, G3, GE = "Gun Doubles", "Gun Trips", "Gun Empty"
    return [
        PASS("TRIPS DAGGER", "GUN_TRIPS", "dagger", tags=["shot", "3rd down"], form_name=G3),
        PASS("DOUBLES POST-WHEEL", "GUN_2X2", "post_wheel", tags=["shot"], form_name=G2),
        PASS("TRIPS FLOOD SPRINT", "GUN_TRIPS", "flood", tags=["3rd down", "pressure"], form_name=G3),
        PASS("EMPTY LEVELS", "GUN_EMPTY", "levels", tags=["3rd down"], week=2, form_name=GE),
        PASS("EMPTY HITCH-SEAM", "GUN_EMPTY", "hitch_seam", tags=["2-minute", "quick game"], week=2, form_name=GE),
        PASS("EMPTY FOUR VERTS", "GUN_EMPTY", "verts", tags=["shot", "2-minute"], week=2, form_name=GE),
        PASS("TRIPS MESH", "GUN_TRIPS", "mesh", tags=["3rd down"], form_name=G3),
        PASS("DOUBLES Y-CROSS", "GUN_2X2", "y_cross", tags=["long yardage"], week=2, form_name=G2),
        PASS("TRIPS DRIVE", "GUN_TRIPS", "drive", tags=["3rd down"], week=2, form_name=G3),
        PASS("EMPTY SNAG", "GUN_EMPTY", "snag", tags=["quick game", "pressure"], week=3, form_name=GE),
        PASS("DOUBLES SLANT-FLAT", "GUN_2X2", "slant_flat", tags=["quick game", "pressure"], form_name=G2),
        RPO("TRIPS 23 ZONE NOW", "GUN_TRIPS", "zone", {"Z": "now", "S": "stalk", "Y": "stalk"}, "now", d=-1, read_label="N", tags=["rpo", "opener"], form_name=G3),
        RPO("DOUBLES 22 ZONE BUBBLE", "GUN_2X2", "zone", {"Y": "bubble", "Z": "stalk"}, "bubble", d=-1, read_label="S", tags=["rpo"], week=2, form_name=G2),
        R("DOUBLES 22 ZONE READ", "GUN_2X2", "zone_read", d=1, carrier="T", tags=["option", "base run"], form_name=G2),
        PASS("TRIPS TUNNEL", "GUN_TRIPS", "tunnel", tags=["screen"], week=3, form_name=G3),
    ]


def maryland_plays():
    M, MS = "Maryland I", "Maryland I Split"
    return [
        R("MARYLAND 24 POWER", "MARYLAND_I", "power", d=1, carrier="T", kick="F", lead="H", tags=["base run", "opener"], form_name=M),
        R("MARYLAND 25 POWER", "MARYLAND_I", "power", d=-1, carrier="T", kick="F", lead="H", tags=["base run"], form_name=M),
        R("MARYLAND 22 ISO", "MARYLAND_I", "iso", d=1, carrier="T", lead="F", tags=["base run", "short yardage"], form_name=M),
        R("MARYLAND 28 TOSS", "MARYLAND_I", "toss", d=1, carrier="T", lead="F", wrap="H", tags=["perimeter"], form_name=M),
        R("MARYLAND 30 DIVE", "MARYLAND_I", "dive", d=1, carrier="F", hole="A", fakes=("H",), tags=["short yardage"], form_name=M),
        R("MARYLAND 20 WEDGE", "MARYLAND_I", "wedge", d=1, carrier="T", tags=["goal line", "short yardage"], form_name=M),
        R("MARYLAND 25 COUNTER", "MARYLAND_I", "counter", d=-1, carrier="T", fakes=("F",), tags=["constraint"], week=2, form_name=M),
        R("MARYLAND 42 TRAP", "MARYLAND_I", "trap", d=1, carrier="H", fakes=("F",), tags=["constraint"], week=2, form_name=M),
        R("MARYLAND 26 STRETCH", "MARYLAND_I", "stretch", d=1, carrier="T", lead="F", tags=["perimeter"], week=2, form_name=M),
        R("SPLIT 24 POWER", "MARYLAND_I_SPLIT", "power", d=1, carrier="T", kick="F", lead="H", tags=["base run"], week=2, form_name=MS),
        R("SPLIT 29 TOSS", "MARYLAND_I_SPLIT", "toss", d=-1, carrier="T", lead="F", tags=["perimeter"], week=3, form_name=MS),
        PASS("MARYLAND 95 BOOT", "MARYLAND_I", "boot", run_fake="T", tags=["play-action", "3rd down"], week=2, form_name=M),
        PASS("MARYLAND 84 POP", "MARYLAND_I", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=3, form_name=M),
        PASS("SPLIT 90 FLOOD", "MARYLAND_I_SPLIT", "flood", tags=["long yardage"], week=3, form_name=MS),
    ]


def t_plays():
    T, TS, WB = "Full House T", "T Split", "Wishbone"
    return [
        R("T 30 DIVE", "T_FULL", "dive", d=1, carrier="F", hole="A", tags=["base run", "opener", "short yardage"], form_name=T),
        R("T 34 BELLY", "T_FULL", "power", d=1, carrier="F", kick="T", tags=["base run"], form_name=T),
        R("T 44 POWER", "T_FULL", "power", d=1, carrier="T", kick="F", lead="H", tags=["base run"], form_name=T),
        R("T 32 TRAP", "T_FULL", "trap", d=1, carrier="F", fakes=("T",), tags=["constraint"], form_name=T),
        R("T 28 TOSS", "T_FULL", "toss", d=1, carrier="T", lead="F", tags=["perimeter"], form_name=T),
        R("T 45 COUNTER", "T_FULL", "counter", d=-1, carrier="T", fakes=("F",), tags=["constraint"], week=2, form_name=T),
        R("T 42 ISO", "T_FULL", "iso", d=1, carrier="H", lead="F", hole="B", tags=["short yardage"], week=2, form_name=T),
        R("T 10 WEDGE", "T_FULL", "wedge", d=1, carrier="Q", tags=["goal line", "short yardage"], form_name=T),
        R("BONE 28 TRIPLE", "WISHBONE", "option", d=1, carrier="Q", dive="F", pitch="T", lead="H", tags=["option", "perimeter"], week=2, form_name=WB),
        R("BONE 30 DIVE", "WISHBONE", "dive", d=1, carrier="F", hole="A", tags=["base run"], week=2, form_name=WB),
        R("SPLIT 44 POWER", "T_SPLIT", "power", d=1, carrier="T", kick="F", lead="H", tags=["base run"], week=2, form_name=TS),
        PASS("T 95 BOOT", "T_FULL", "boot", run_fake="F", tags=["play-action", "3rd down"], week=2, form_name=T),
        PASS("T 84 POP", "T_FULL", "pa_pop", run_fake="F", tags=["play-action", "shot"], week=3, form_name=T),
        PASS("SPLIT 90 FLOOD", "T_SPLIT", "flood", tags=["long yardage"], week=3, form_name=TS),
    ]


def singleback_plays():
    A, AT, ATR = "Ace", "Ace Twins", "Ace Trips"
    return [
        R("ACE 22 ZONE", "ACE", "zone", d=1, carrier="T", tags=["base run", "opener"], form_name=A),
        R("ACE 23 ZONE", "ACE", "zone", d=-1, carrier="T", tags=["base run"], form_name=A),
        R("ACE 26 STRETCH", "ACE", "stretch", d=1, carrier="T", tags=["perimeter"], form_name=A),
        R("ACE 25 COUNTER", "ACE", "counter", d=-1, carrier="T", tags=["constraint"], week=2, form_name=A),
        R("ACE 24 POWER", "ACE", "power", d=1, carrier="T", kick="H", tags=["base run", "short yardage"], week=2, form_name=A),
        R("ACE 22 TRAP", "ACE", "trap", d=1, carrier="T", tags=["constraint"], week=3, form_name=A),
        R("TWINS JET 29", "ACE_TWINS", "jet", d=1, carrier="S", motion="S", tags=["perimeter", "constraint"], week=2, form_name=AT),
        PASS("ACE 95 BOOT", "ACE", "boot", run_fake="T", tags=["play-action", "3rd down"], week=2, form_name=A),
        PASS("ACE 84 POP", "ACE", "pa_pop", run_fake="T", tags=["play-action", "shot"], week=2, form_name=A),
        PASS("TWINS 60 STICK", "ACE_TWINS", "stick", tags=["quick game", "3rd down"], form_name=AT),
        PASS("TWINS 70 SMASH", "ACE_TWINS", "smash", tags=["3rd down"], week=2, form_name=AT),
        PASS("ACE 60 SLANT-FLAT", "ACE", "slant_flat", tags=["quick game"], form_name=A),
        PASS("TRIPS 70 CURL-FLAT", "ACE_TRIPS", "curl_flat", tags=["quick game"], week=2, form_name=ATR),
        PASS("TRIPS 70 LEVELS", "ACE_TRIPS", "levels", tags=["3rd down"], week=3, form_name=ATR),
        PASS("TRIPS 70 FOUR VERTS", "ACE_TRIPS", "verts", tags=["shot", "2-minute"], week=3, form_name=ATR),
        PASS("ACE 76 RB SCREEN", "ACE", "rb_screen", tags=["screen", "pressure"], week=3, form_name=A),
    ]


def singlewing_plays():
    S, SS = "Single Wing", "Single Wing Spread"
    return [
        R("WING 24 POWER", "SW", "power", d=1, carrier="T", kick="B", lead="F", direct=True, tags=["base run", "opener"], form_name=S),
        R("WING 34 SPINNER", "SW", "power", d=1, carrier="F", kick="B", direct=True, tags=["base run"], form_name=S),
        R("WING 30 WEDGE", "SW", "wedge", d=1, carrier="F", direct=True, tags=["goal line", "short yardage"], form_name=S),
        R("WING 28 SWEEP", "SW", "toss", d=1, carrier="T", lead="B", direct=True, tags=["perimeter"], form_name=S),
        R("WING 23 TRAP", "SW", "trap", d=-1, carrier="T", direct=True, tags=["constraint"], week=2, form_name=S),
        R("WING 25 COUNTER", "SW", "counter", d=-1, carrier="T", direct=True, tags=["constraint"], week=2, form_name=S),
        R("WING 49 REVERSE", "SW", "jet", d=-1, carrier="W", direct=True, tags=["constraint", "perimeter"], week=2, form_name=S),
        R("WING 26 STRETCH", "SW", "stretch", d=1, carrier="T", lead="B", direct=True, tags=["perimeter"], week=3, form_name=S),
        R("SPREAD 24 POWER", "SW_SPREAD", "power", d=1, carrier="T", kick="B", lead="F", direct=True, tags=["base run"], week=2, form_name=SS),
        R("WING 22 ISO", "SW", "iso", d=1, carrier="T", lead="F", direct=True, tags=["short yardage"], week=2, form_name=S),
        PASS("WING 90 RUN-PASS", "SW", "flood", thrower="T", tags=["3rd down", "play-action"], week=2, form_name=S),
        PASS("WING 95 BOOT", "SW", "boot", thrower="T", run_fake="F", tags=["play-action"], week=3, form_name=S),
        PASS("SPREAD 84 POP", "SW_SPREAD", "pa_pop", thrower="T", run_fake="F", tags=["shot", "play-action"], week=3, form_name=SS),
    ]


def wingt_plays():
    RD, BL, DB = "Red (Wing-T)", "Blue (Wing-T)", "Double Wing-T"
    return [
        R("RED 41 BUCK SWEEP", "WT_RED", "sweep", d=1, carrier="H", fakes=("F",), tags=["base run", "opener", "perimeter"], form_name=RD),
        R("RED 32 TRAP", "WT_RED", "trap", d=1, carrier="F", fakes=("H",), tags=["base run", "constraint"], form_name=RD),
        R("RED 34 BELLY", "WT_RED", "power", d=1, carrier="F", kick="W", tags=["base run", "short yardage"], form_name=RD),
        R("RED 45 COUNTER", "WT_RED", "counter", d=-1, carrier="W", fakes=("F",), tags=["constraint"], week=2, form_name=RD),
        R("RED 30 WEDGE", "WT_RED", "wedge", d=1, carrier="F", tags=["goal line", "short yardage"], form_name=RD),
        R("RED JET 49", "WT_RED", "jet", d=-1, carrier="W", motion="W", tags=["perimeter"], week=2, form_name=RD),
        R("BLUE 44 DOWN", "WT_BLUE", "power", d=1, carrier="H", kick="F", tags=["base run"], week=2, form_name=BL),
        R("BLUE 48 TOSS", "WT_BLUE", "toss", d=1, carrier="H", lead="F", tags=["perimeter"], week=2, form_name=BL),
        R("DOUBLE 41 BUCK SWEEP", "WT_DOUBLE", "sweep", d=1, carrier="H", fakes=("F",), tags=["perimeter"], week=3, form_name=DB),
        R("RED 32 ISO", "WT_RED", "iso", d=1, carrier="F", lead="H", tags=["short yardage"], week=3, form_name=RD),
        PASS("RED 99 WAGGLE", "WT_RED", "boot", run_fake="H", tags=["play-action", "3rd down"], week=2, form_name=RD),
        PASS("RED 84 POP", "WT_RED", "pa_pop", run_fake="F", tags=["play-action", "shot"], week=2, form_name=RD),
        PASS("RED 60 SLANT-FLAT", "WT_RED", "slant_flat", tags=["quick game"], week=3, form_name=RD),
        PASS("BLUE 90 SPRINT FLOOD", "WT_BLUE", "flood", tags=["long yardage"], week=3, form_name=BL),
    ]


def gunt_plays():
    G, GW = "Gun-T", "Gun-T Twin Wing"
    return [
        R("GUN JET 29", "GUNT", "jet", d=-1, carrier="W", motion="W", tags=["perimeter", "opener"], form_name=G),
        R("GUN 31 BUCK SWEEP", "GUNT", "sweep", d=1, carrier="F", tags=["base run", "perimeter"], form_name=G),
        R("GUN 34 POWER", "GUNT", "power", d=1, carrier="F", kick="W", tags=["base run"], form_name=G),
        R("GUN 35 COUNTER", "GUNT", "counter", d=-1, carrier="F", tags=["constraint"], form_name=G),
        R("GUN 32 TRAP", "GUNT", "trap", d=1, carrier="F", tags=["constraint"], week=2, form_name=G),
        R("GUN 33 ZONE READ", "GUNT", "zone_read", d=-1, carrier="F", tags=["option"], week=2, form_name=G),
        R("GUN 38 POWER READ", "GUNT", "power_read", d=1, carrier="F", tags=["option"], week=2, form_name=G),
        R("GUN 14 QB POWER", "GUNT", "qb_power", d=1, carrier="Q", kick="W", lead="F", tags=["short yardage", "goal line"], week=2, form_name=G),
        R("TWIN JET 49", "GUNT_TWIN_WING", "jet", d=1, carrier="H", motion="H", tags=["perimeter"], week=3, form_name=GW),
        R("TWIN 34 POWER", "GUNT_TWIN_WING", "power", d=1, carrier="F", kick="H", tags=["base run"], week=3, form_name=GW),
        PASS("GUN 99 WAGGLE", "GUNT", "boot", run_fake="F", tags=["play-action", "3rd down"], week=2, form_name=G),
        PASS("GUN 84 POP", "GUNT", "pa_pop", run_fake="F", tags=["play-action", "shot"], week=2, form_name=G),
        PASS("GUN 60 STICK", "GUNT", "stick", tags=["quick game"], week=3, form_name=G),
        PASS("GUN 70 SMASH", "GUNT", "smash", tags=["3rd down"], week=3, form_name=G),
    ]


def dw_plays():
    D, DS = "Double Wing", "Double Wing Split"
    return [
        R("DW 48 SUPER POWER", "DW", "superpower", d=1, carrier="H", kick="F", tags=["base run", "opener"], form_name=D),
        R("DW 49 SUPER POWER", "DW", "superpower", d=-1, carrier="W", kick="F", tags=["base run"], form_name=D),
        R("DW 30 WEDGE", "DW", "wedge", d=1, carrier="F", tags=["goal line", "short yardage"], form_name=D),
        R("DW 47 COUNTER", "DW", "counter", d=-1, carrier="H", fakes=("F",), tags=["constraint"], week=2, form_name=D),
        R("DW 48 TOSS", "DW", "toss", d=1, carrier="W", lead="F", tags=["perimeter"], week=2, form_name=D),
        R("DW 32 TRAP", "DW", "trap", d=1, carrier="F", tags=["constraint"], week=2, form_name=D),
        R("DW 49 REVERSE", "DW", "jet", d=-1, carrier="W", tags=["perimeter", "constraint"], week=3, form_name=D),
        R("DW 10 QB WEDGE", "DW", "wedge", d=-1, carrier="Q", tags=["goal line"], form_name=D),
        R("SPLIT 48 SUPER POWER", "DW_SPREAD", "superpower", d=1, carrier="H", kick="F", tags=["base run"], week=2, form_name=DS),
        R("DW 46 POWER (F KICK)", "DW", "power", d=1, carrier="H", kick="F", hole="D", tags=["base run"], week=3, form_name=D),
        PASS("DW 98 BOOT", "DW", "boot", run_fake="H", tags=["play-action", "3rd down"], week=2, form_name=D),
        PASS("DW 84 POP", "DW", "pa_pop", run_fake="H", tags=["play-action", "shot"], week=3, form_name=D),
        PASS("SPLIT 90 SPRINT", "DW_SPREAD", "flood", tags=["long yardage"], week=3, form_name=DS),
    ]


OFFENSE_BOOKS = [
    dict(key="diamond", title="Diamond Offense", category="Offense", plays=diamond_plays,
         subtitle="Three backs, one quarterback and every answer: power, counter, option and play-action from the Pistol Diamond.",
         hook="Four players in the backfield. Every one of them is a threat. That's the Diamond.",
         philosophy=["The Diamond puts three backs around a pistol quarterback, which means the defense must declare its strength before "
                     "the snap — and you get to run at whatever it gave you. Two lead blockers on the edge, a downhill tailback, and a "
                     "quarterback who can keep it: the box math is always in your favor.",
                     "The system is built around one rule: <b>win the numbers game at the point of attack</b>. Power and Iso run behind "
                     "extra blockers. Counter and Zone Read punish over-pursuit. Boot and Pop make safeties pay for cheating."],
         why=["Symmetrical — you can run every play either direction without tipping it.",
              "Two lead blockers available on every run.",
              "QB run game (zone read, QB power) adds a hat in the box.",
              "Play-action off the same backfield action every snap."],
         formations=[("PISTOL_DIAMOND", "Diamond")], example=["DIAMOND", "—", "24", "POWER"]),
    dict(key="power1", title="Power I Offense — Vol. 1", category="Offense", plays=power1_plays,
         subtitle="Foundation edition: the I-formation downhill run game with complete play-action and quick-game complements.",
         hook="Line up. Tell them where it's going. Run it anyway.",
         philosophy=["Volume 1 is the foundation of the Power I system: a fullback, a tailback, a tight end and five linemen who know "
                     "exactly who to block. It is the most teachable offense in football because every play shares the same rules.",
                     "Power is the play. Everything else in this book — Iso, Toss, Counter, Boot — exists to make Power work again "
                     "when the defense adjusts to it."],
         why=["Simple rules: down, back, pull, kick. Linemen learn 3 blocks and run 10 plays.",
              "Physical identity that wears defenses down by the 4th quarter.",
              "Play-action off the same footwork produces explosive plays.",
              "Ideal for teams with a dominant back or a dominant line."],
         formations=[("I_PRO", "I Right"), ("I_TIGHT", "I Tight"), ("OFFSET_I", "Offset I"), ("PRO_SPLIT", "Pro Split")],
         example=["I RT", "—", "24", "POWER"]),
    dict(key="power2", title="Power I Offense — Vol. 2", category="Offense", plays=power2_plays,
         subtitle="Overload edition: unbalanced lines and wing sets that put extra blockers where the defense can't match them.",
         hook="Move one tackle and the whole defense has to move with you.",
         philosophy=["Volume 2 takes the Power I and overloads it. By moving the weak-side tackle to the strong side and adding a wing, "
                     "you create a three-man surface the defense must adjust to before the snap. Most can't — at least not correctly.",
                     "If the defense doesn't shift, you have more blockers than they have defenders at the point of attack. If it over-shifts, "
                     "the counter and reverse go to the vacated side."],
         why=["Creates numbers advantages without new plays — same rules, new surface.",
              "Confuses defensive alignment rules (who's the end man?).",
              "Elite in short yardage and at the goal line.",
              "Counter and reverse punish over-shifting defenses."],
         formations=[("UNB_WING", "Unbalanced Wing"), ("I_WING", "I Wing")], example=["UNB", "—", "24", "POWER"],
         personnel={"X": "Your tight end type on the weak side — he is an eligible end on the line.",
                    "W": "Tough, versatile wing: seal blocks, reverse carries and the boot flat."}),
    dict(key="power3", title="Power I Offense — Vol. 3", category="Offense", plays=power3_plays,
         subtitle="Pistol edition: modern power football with QB run, RPO and trips sets — the same rules, from 4 yards deep.",
         hook="Power football with a quarterback who can hurt you.",
         philosophy=["Volume 3 moves the Power system into the Pistol. The quarterback is at 4 yards, the tailback directly behind him, "
                     "and an H-back offset to the strength. The defense still sees power — but now the QB is a runner and the edges are reads.",
                     "Power Read, Zone Read and QB Power add a hat to the run game. Trips sets and RPOs force a light box."],
         why=["Downhill tailback path without tipping run direction.",
              "QB run game adds a blocker's worth of math.",
              "RPOs answer the overhang defender.",
              "H-back gives you a kicker, a lead blocker and a play-action threat."],
         formations=[("PISTOL_H", "Pistol H"), ("PISTOL_TRIPS", "Pistol Trips")], example=["PISTOL", "—", "24", "POWER"]),
    dict(key="rpo", title="RPO Offense", category="Offense", plays=rpo_plays,
         subtitle="Run-pass options from the spread: one post-snap read that makes a defender wrong on every snap.",
         hook="Make one defender choose. Then take whatever he didn't.",
         philosophy=["An RPO is a run play with a pass built in. The line blocks run every snap; the quarterback reads one defender — "
                     "the conflict player — and either hands off or throws to the route he just vacated.",
                     "This book teaches the four RPO families you need: <b>Zone + Bubble</b>, <b>Zone + Glance</b>, <b>Power + Stick</b> "
                     "and <b>Duo + Slant</b>, plus the QB run game and the dropback answers that keep defenses honest."],
         why=["One read, one decision — teachable to youth and HS quarterbacks.",
              "Linemen block the same run scheme every play.",
              "Forces defenses to declare who fits the run.",
              "Ideal for up-tempo — no extra protection rules."],
         formations=[("GUN_2X2", "Gun Doubles"), ("GUN_TRIPS", "Gun Trips"), ("GUN_11", "Gun Ace (11)")],
         example=["DOUBLES", "—", "22", "ZONE BUBBLE"]),
    dict(key="airraid", title="Air Raid Attack", category="Offense", plays=airraid_plays,
         subtitle="A complete spread passing system: Mesh, Y-Cross, Stick, Snag, Verticals and the screen game, fully coached.",
         hook="Few plays. Thousands of reps. Total mastery.",
         philosophy=["The Air Raid is a philosophy of repetition. You run a small number of concepts from many formations so your "
                     "quarterback sees every coverage against every concept, and your receivers learn to read the same windows week after week.",
                     "Each concept has a clear progression for the quarterback and rules for the receivers to adjust against man and zone. "
                     "The screen game and the draw keep the pass rush and the linebackers honest."],
         why=["Small playbook, deep mastery: 8 core concepts.",
              "Spreads the field so you can throw to your best athletes in space.",
              "Built-in answers to man, zone and pressure.",
              "Practice-efficient: concept-based routes transfer to every formation."],
         formations=[("GUN_2X2", "Gun Doubles"), ("GUN_TRIPS", "Gun Trips"), ("GUN_EMPTY", "Gun Empty")],
         example=["DOUBLES", "—", "—", "MESH"], cadence="Signal-in, no huddle. QB: “SET... GO!” Change to a 1-sound "
                                                               "(“GO”) when tempo is called."),
    dict(key="airraid2", title="Air Raid 2.0 — Tempo", category="Offense", plays=airraid2_plays,
         subtitle="The next level: empty sets, high-low shot plays and tempo RPOs built on the Air Raid foundation.",
         hook="Same language, more speed. Snap it before they're set.",
         philosophy=["Air Raid 2.0 assumes your team has mastered the core concepts in the Air Raid Attack book. Now you add pressure: "
                     "empty formations that spread the defense to five gaps, shot concepts like Dagger and Post-Wheel, and tempo RPOs that "
                     "punish a defense that can't get lined up.",
                     "The goal is to snap the ball with the defense still communicating. Every play here can be signaled with one word."],
         why=["Empty sets force the defense to declare man or zone pre-snap.",
              "Shot concepts attack the safeties with high-low reads.",
              "Tempo RPOs — no huddle, no substitutions, no problem.",
              "Builds on Air Raid terminology: zero re-teaching."],
         formations=[("GUN_2X2", "Gun Doubles"), ("GUN_TRIPS", "Gun Trips"), ("GUN_EMPTY", "Gun Empty")],
         example=["TRIPS", "—", "—", "DAGGER"], cadence="One-word signals; snap on the first sound in tempo mode."),
    dict(key="maryland", title="Maryland I Offense", category="Offense", plays=maryland_plays,
         subtitle="Stacked-backfield power football: three backs in a line behind the quarterback and no way to tell where it's going.",
         hook="Three backs in a straight line. The defense has to guess.",
         philosophy=["The Maryland I stacks the fullback, the halfback and the tailback directly behind the quarterback. Because all "
                     "three are aligned on the ball, nothing about the formation tips run direction — every play can go either way.",
                     "You get two lead blockers on every run, a power game that hits fast and a play-action game that freezes linebackers "
                     "who are desperate to fill."],
         why=["Zero pre-snap tells: perfectly balanced backfield.",
              "Two lead blockers on every run.",
              "Built for physical teams with depth at running back.",
              "Rarely seen — opponents can't simulate it in practice."],
         formations=[("MARYLAND_I", "Maryland I"), ("MARYLAND_I_SPLIT", "Maryland I Split")], example=["MARYLAND", "—", "24", "POWER"]),
    dict(key="tform", title="T Formation Offense", category="Offense", plays=t_plays,
         subtitle="Full-house T and Wishbone: dive, belly, trap, counter and the triple option from football's original power formation.",
         hook="The original. Still undefeated against defenses that don't practice against it.",
         philosophy=["The Full House T puts three backs side by side at 4–5 yards. The fullback dives, the halfbacks sweep and counter, "
                     "and the quarterback becomes a ball-handler who hides the ball on every snap.",
                     "Add the Wishbone variation and you have the triple option — the dive, the keep and the pitch from one mesh. "
                     "Defenses must assign a player to every back, every snap."],
         why=["Fast-hitting dive game sets up everything else.",
              "Misdirection on every play from identical backfield action.",
              "Wishbone triple option makes defenses play assignment football.",
              "Perfect fit for teams with several good backs and a smart QB."],
         formations=[("T_FULL", "Full House T"), ("T_SPLIT", "T Split"), ("WISHBONE", "Wishbone")], example=["T", "—", "30", "DIVE"]),
    dict(key="singleback", title="Single Back Offense", category="Offense", plays=singleback_plays,
         subtitle="One back, two tight ends and three-receiver sets: inside zone, stretch, counter, jet and a complete passing game.",
         hook="Balance in its purest form: run it or throw it from the same look.",
         philosophy=["The Single Back offense lines up in Ace (two tight ends, two receivers) and Twins/Trips variations. It's balanced "
                     "enough to run zone both directions and spread enough to throw against any coverage.",
                     "The run game is built on inside and outside zone. Counter and Power are the gap complements. Boot and Pop come off "
                     "the zone action; Stick, Smash and Levels handle third down."],
         why=["Zone blocking scales to any talent level.",
              "Two tight ends create 8-gap runs, then flex out for pass sets.",
              "Jet motion stresses the edges every play.",
              "Easy transition to spread or pro systems."],
         formations=[("ACE", "Ace"), ("ACE_TWINS", "Ace Twins"), ("ACE_TRIPS", "Ace Trips")], example=["ACE", "—", "22", "ZONE"]),
    dict(key="singlewing", title="Single Wing Offense", category="Offense", plays=singlewing_plays,
         subtitle="Direct-snap power football with an unbalanced line: off-tackle power, spinner, wedge, reverse and the tailback run-pass.",
         hook="Direct snap. Unbalanced line. Four ball carriers. One hundred years of headaches for defenses.",
         philosophy=["The Single Wing snaps the ball directly to the tailback or fullback behind an unbalanced line. A blocking back "
                     "and a wingback give you two extra blockers on the strong side. The result: double-teams at the point of attack on every play.",
                     "Because the ball goes straight to a runner, there's no handoff to fumble and no quarterback to sack. Spinner, "
                     "reverse and the tailback run-pass give the defense too many things to defend."],
         why=["Built-in double-teams at the point of attack.",
              "Direct snap removes the QB-RB exchange.",
              "Spinner and reverse misdirection from identical looks.",
              "Tailback run-pass is the most underrated play in football."],
         formations=[("SW", "Single Wing"), ("SW_SPREAD", "Single Wing Spread")], example=["WING", "—", "24", "POWER"],
         personnel={"B": "Blocking back: your toughest kick-out blocker. Aligns behind the strong guard/tackle.",
                    "T": "Tailback: the star. Takes the direct snap, runs and throws.",
                    "F": "Fullback: spinner ball-handler, lead blocker, short-yardage runner.",
                    "W": "Wingback: double-teams at the point, carries the reverse.",
                    "X": "Weak end: on the line, blocks or runs the backside cross."}),
    dict(key="wingt", title="Wing-T Offense", category="Offense", plays=wingt_plays,
         subtitle="The classic series offense: buck sweep, trap, belly, counter, jet and waggle — misdirection that never runs out.",
         hook="Run the buck sweep until they stop it. Then run what they gave up to stop it.",
         philosophy=["The Wing-T is a <b>series</b> offense: every play starts with identical backfield action, so the defense can't key "
                     "anyone. The Buck Sweep series (sweep, trap, waggle) is the heart; the Belly series and Jet series add more of the same "
                     "deception from a different starting point.",
                     "Guards pull on almost every play, so linebackers who read guards are always wrong. Down blocks give your linemen "
                     "angles instead of match-ups — the great equalizer for undersized lines."],
         why=["Angles over size — great for smaller lines.",
              "Series football: every play looks like 3 others.",
              "Waggle punishes defenders who flow to the sweep.",
              "Proven at every level from youth to college."],
         formations=[("WT_RED", "Red (Wing-T)"), ("WT_BLUE", "Blue (Wing-T)"), ("WT_DOUBLE", "Double Wing-T")],
         example=["RED", "—", "41", "BUCK SWEEP"],
         personnel={"H": "Halfback: your best runner. Buck sweep carrier, aligned opposite the wing.",
                    "F": "Fullback: the trap and belly runner; tough and quick.",
                    "W": "Wingback: down blocker, counter and jet carrier, waggle receiver."}),
    dict(key="gunt", title="Gun-T Offense", category="Offense", plays=gunt_plays,
         subtitle="Wing-T misdirection from the shotgun: jet, buck, power, counter and read options with the QB as a run threat.",
         hook="All the Wing-T misdirection, with the quarterback in the gun and the defense still guessing.",
         philosophy=["The Gun-T takes Wing-T series football into the shotgun. The quarterback is at 5 yards with the back beside him, "
                     "the wing and tight end stay attached, and jet motion threatens the edge before every snap.",
                     "From the gun, the QB becomes a run threat: Zone Read, Power Read and QB Power add a blocker's worth of math to "
                     "the classic buck, trap and counter."],
         why=["Modern spread looks with Wing-T rules.",
              "Jet motion holds the edge every play.",
              "QB reads remove an unblocked defender.",
              "Waggle from the gun: easy reads on the move."],
         formations=[("GUNT", "Gun-T"), ("GUNT_TWIN_WING", "Gun-T Twin Wing")], example=["GUN", "JET", "29", "SWEEP"]),
    dict(key="dw", title="Double Wing Offense", category="Offense", plays=dw_plays,
         subtitle="Tight splits, two wings, one fullback: Super Power, Wedge, Counter and Reverse — the great equalizer for youth football.",
         hook="Zero splits. Two wings. Everybody blocks down. Good luck.",
         philosophy=["The Double Wing lines up with zero-to-one-foot splits, two tight ends and two wingbacks, then runs a small set of "
                     "plays with relentless precision. Down blocks and two pullers create a wall the defense can't penetrate.",
                     "Super Power is the base. Wedge takes what the defense gives inside. Counter and Reverse punish flow. Boot and Pop "
                     "are there for the moment the safeties creep down to stop it all."],
         why=["Built for undersized and inexperienced lines.",
              "Tight splits eliminate penetration.",
              "Small playbook = maximum reps on each play.",
              "Ball-control offense that shortens games."],
         formations=[("DW", "Double Wing"), ("DW_SPREAD", "Double Wing Split")], example=["DW", "—", "48", "SUPER POWER"],
         personnel={"H": "Left wing: tough runner, takes Super Power going right.",
                    "W": "Right wing: tough runner, takes Super Power going left.",
                    "F": "Fullback: kick-out blocker and wedge carrier.",
                    "OL": "Splits are ZERO to one foot. Linemen must be disciplined, not big."}),
]
