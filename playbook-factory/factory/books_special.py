"""Specialty books: 7v7, Blocking Drillbook, Offseason Training, Parent Playbook."""
from reportlab.platypus import Spacer, PageBreak, Table, TableStyle, KeepInFrame, KeepTogether, Flowable
from reportlab.lib.units import inch
from . import offense as O
from .defense import build_call
from .layout import (P, ST, section, bullets, numbered, grid, play_page, wristband, notes_page, toc_block, CONTENT_W,
                     chips, Anchor, PAGE_H, M, RULE, INK, ACC)
from .diagram import Diagram
from . import brand

PASS = O.pass_play

# =========================================================================== 7v7
F77 = {
    "C": ("Corner (left)", ("cb", "w"), ("none",)),
    "K": ("Corner (right)", ("cb", "s"), ("none",)),
    "F": ("Free Safety", ("s", "w", 5.5, 11.0), ("none",)),
    "$": ("Strong Safety", ("s", "s", 5.5, 11.0), ("none",)),
    "S": ("Sam / Nickel", ("apex", "s", 5.0), ("none",)),
    "M": ("Mike", ("lb", "c", 0.0, 5.5), ("none",)),
    "W": ("Will", ("apex", "w", 5.0), ("none",)),
}


def seven_plays():
    A, T, E, B = "2x2", "Trips", "Empty", "Bunch"
    return [
        PASS("2x2 STICK", "7V7_2X2", "stick", tags=["quick game"], form_name=A),
        PASS("2x2 SMASH", "7V7_2X2", "smash", tags=["3rd down"], form_name=A),
        PASS("2x2 MESH", "7V7_2X2", "mesh", tags=["3rd down"], form_name=A),
        PASS("2x2 FOUR VERTS", "7V7_2X2", "verts", tags=["shot"], form_name=A),
        PASS("2x2 SLANT-FLAT", "7V7_2X2", "slant_flat", tags=["quick game"], form_name=A),
        PASS("2x2 POST-WHEEL", "7V7_2X2", "post_wheel", tags=["shot"], week=2, form_name=A),
        PASS("TRIPS SNAG", "7V7_TRIPS", "snag", tags=["quick game"], form_name=T),
        PASS("TRIPS Y-CROSS", "7V7_TRIPS", "y_cross", tags=["3rd down"], week=2, form_name=T),
        PASS("TRIPS DAGGER", "7V7_TRIPS", "dagger", tags=["shot"], week=2, form_name=T),
        PASS("TRIPS LEVELS", "7V7_TRIPS", "levels", tags=["3rd down"], week=2, form_name=T),
        PASS("TRIPS FLOOD", "7V7_TRIPS", "flood", tags=["red zone"], week=2, form_name=T),
        PASS("EMPTY HITCH-SEAM", "7V7_EMPTY", "hitch_seam", tags=["quick game"], week=2, form_name=E),
        PASS("EMPTY CURL-FLAT", "7V7_EMPTY", "curl_flat", tags=["quick game"], week=3, form_name=E),
        PASS("BUNCH SNAG", "7V7_BUNCH", "snag", tags=["red zone"], week=3, form_name=B),
        PASS("BUNCH DRIVE", "7V7_BUNCH", "drive", tags=["3rd down"], week=3, form_name=B),
    ]


def seven_defense():
    G = "7V7_2X2"
    cv3 = {"C": "deep_l", "K": "deep_r", "F": "deep_m", "$": "flat_r", "S": "curl_r", "M": "mid", "W": "curl_l"}
    f3 = dict(F77)
    f3["F"] = ("Free Safety", ("s", "c", 0.0, 12.0), ("none",))
    f3["$"] = ("Strong Safety (rotates down)", ("apex", "s", 6.0), ("none",))
    f3["S"] = ("Sam", ("lb", "s", 3.2, 5.0), ("none",))
    f3["W"] = ("Will", ("apex", "w", 5.0), ("none",))
    cv3 = {"C": "deep_l", "K": "deep_r", "F": "deep_m", "$": "flat_r", "S": "hook_r", "M": "mid", "W": "flat_l"}
    cv2 = {"C": "flat_l", "K": "flat_r", "F": "half_l", "$": "half_r", "S": "curl_r", "M": "mid", "W": "curl_l"}
    cv4 = {"C": "q1", "K": "q4", "F": "q2", "$": "q3", "S": "curl_r", "M": "mid", "W": "curl_l"}
    cv1 = {"C": ("man", "w1"), "K": ("man", "s1"), "S": ("man", "s2"), "W": ("man", "w2"), "M": ("man", "b"), "F": "deep_m", "$": "rob"}
    f1 = dict(f3)
    from .books_defense import COV
    out = []
    for name, f, cv, key, what in [("7v7 COVER 3", f3, cv3, "c3", "Three deep, four under. The safest call in 7v7 — nothing deep, rally and tackle (tag) the catch."),
                                   ("7v7 COVER 2", F77, cv2, "c2", "Two deep halves with corners squatting in the flats. Take away the quick game."),
                                   ("7v7 COVER 4", F77, cv4, "c4", "Quarters: four deep, three under. Built to stop verticals and shot plays."),
                                   ("7v7 COVER 1", f1, cv1, "c1", "Man-free with a robber. Use it when you can win one-on-one.")]:
        out.append(build_call(name, G, f, cv, show="pass", title=COV[key]["name"].upper(), family="Coverage", what=what,
                              steps=COV[key]["steps"], points=COV[key]["points"], best="Mix it with the others — never sit in one coverage.",
                              tags=["defense"], form_name="vs 2x2"))
    return out


def seven_book(spec):
    plays = seven_plays()
    dcalls = seven_defense()
    story = toc_block()
    story += section("Start Here", "7v7")
    story.append(P("No linemen. No run game. Just your receivers, your quarterback and every coverage the defense has.", "quote"))
    story += [P("7v7 is the fastest way to build a passing game: it gives your skill players hundreds of reps against live coverage "
                "in a single summer. This book gives you a complete 7v7 system — 15 offensive concepts from four formations and four "
                "defensive coverages — using the exact same language as the Air Raid, RPO and Single Back books, so everything carries "
                "straight over to the fall.", "body")]
    story.append(P("Typical tournament rules (check your event)", "h3"))
    story += bullets(["Seven on seven: center (eligible after the snap in most events), QB, five eligible receivers.",
                      "QB has a 4-second clock (horn/whistle). No QB runs.",
                      "Two-hand touch or flag pull; no blocking.",
                      "40-yard field: first down at the 25 and the 10; three downs to make each line.",
                      "Interceptions are typically worth points and end the possession."])
    story.append(P("How to practice it", "h3"))
    story += numbered(["Install 3 concepts a week. Walk-through, then air (no defense), then vs a scout look, then live.",
                       "Script each period: one concept vs all four coverages so the QB learns where the ball goes.",
                       "Chart every throw: concept, coverage, result. Your quarterback's decision is graded, not just the outcome.",
                       "Rotate defense units — 7v7 is your secondary's best summer teacher too."])
    story.append(PageBreak())
    story += section("Offense: The Concepts", f"{len(plays)} concepts")
    rows = [["#", "CALL", "FORMATION"]] + [[f"{i:02d}", p.call, p.form_name] for i, p in enumerate(plays, 1)]
    story.append(grid(rows, [0.45 * inch, CONTENT_W * 0.6, CONTENT_W * 0.4 - 0.45 * inch]))
    story.append(PageBreak())
    for i, p in enumerate(plays, 1):
        story += play_page(p, i)
    story += section("Defense: The Coverages", "4 coverages")
    story.append(P("Rotate these four coverages. Disguise every snap from the same two-high look so the quarterback "
                   "has to read it after the snap.", "body"))
    story.append(PageBreak())
    for i, c in enumerate(dcalls, len(plays) + 1):
        story += play_page(c, i)
    story += wristband(plays, title="7v7 Wristband")
    story += notes_page()
    return story


# =================================================================== DRILLBOOK
class Drill:
    def __init__(self, name, cat, time, players, purpose, setup, steps, points, errors, progression, draw):
        self.name, self.cat, self.time, self.players = name, cat, time, players
        self.purpose, self.setup, self.steps, self.points = purpose, setup, steps, points
        self.errors, self.progression, self.draw = errors, progression, draw


def dg(w, xmax=9, ymin=-4.5, ymax=6):
    return Diagram(w, xmax=xmax, ymin=ymin, ymax=ymax, hashes=False)


def d_fit(w):
    D = dg(w)
    for x in (-3, 0, 3):
        D.o(x, -0.8, "")
        D.d(x, 1.2, "D")
        D.path([(x, -0.8), (x, 0.6)], end="t")
    D.text(0, 4.0, "Fit position: hands inside, hips sunk, back flat", size=8)
    return D


def d_sled(w):
    D = dg(w)
    D.bag(0, 1.6)
    D.o(-1.0, -0.8, "")
    D.o(1.0, -0.8, "")
    D.path([(-1.0, -0.8), (-0.8, 1.0)], end="t")
    D.path([(1.0, -0.8), (0.8, 1.0)], end="t")
    D.path([(0, 2.2), (0, 4.5)], style="dash")
    D.text(0, 5.2, "drive 5 yds", size=8)
    return D


def d_board(w):
    D = dg(w)
    D.bag(0, 0.6, horiz=False)
    D.o(0, -2.2, "")
    D.d(0, 3.0, "D")
    D.path([(0, -2.2), (0, 2.2)], end="t", style="run")
    D.text(2.8, 0.6, "board / line", size=8)
    return D


def d_down(w):
    D = dg(w)
    D.o(-1.5, -0.8, "")
    D.o(0, -0.8, "")
    D.d(-1.5 + 0.0, 1.0, "D")
    D.path([(0, -0.8), (-1.3, 0.8)], end="t")
    D.cone(1.5, -0.8)
    D.text(0, 4.5, "Step with the inside foot; hat across", size=8)
    return D


def d_double(w):
    D = dg(w)
    D.o(-0.8, -0.8, "")
    D.o(0.8, -0.8, "")
    D.d(0, 0.9, "D")
    D.d(0.5, 4.5, "LB")
    D.path([(-0.8, -0.8), (-0.3, 0.6)], end="t")
    D.path([(0.8, -0.8), (0.3, 0.6), (0.6, 3.6)], end="t", style="dash")
    D.text(-4, 4.5, "hip-to-hip, eyes on LB", size=8)
    return D


def d_pull(w):
    D = dg(w, xmax=10)
    for x in (-3, -1.5, 0, 1.5, 3):
        D.cone(x, -0.2) if x != -1.5 else D.o(x, -0.8, "")
    D.d(5.0, 0.8, "D")
    D.path([(-1.5, -0.8), (-1.0, -1.8), (4.0, -1.8), (5.0, 0.2)], end="t", smooth=True)
    D.text(1.5, -3.6, "flat pull — don't drift", size=8)
    return D


def d_trap(w):
    D = dg(w)
    D.o(-1.5, -0.8, "")
    D.cone(0, -0.6)
    D.d(2.1, 0.9, "D")
    D.path([(-1.5, -0.8), (-0.8, -1.4), (1.4, -1.0), (2.0, 0.3)], end="t", smooth=True)
    D.path([(2.1, 0.9), (2.0, -0.2)], style="dot")
    D.text(0, 4.0, "Let him penetrate. Inside-out. Low man wins.", size=8)
    return D


def d_reach(w):
    D = dg(w)
    D.o(0, -0.8, "")
    D.d(1.0, 1.0, "D")
    D.path([(0, -0.8), (0.9, -0.6), (1.6, 0.6)], end="t", smooth=True)
    D.cone(3.5, 1.0)
    D.text(0, 4.5, "Bucket step, aim for outside number", size=8)
    return D


def d_pass(w):
    D = dg(w)
    D.o(0, -0.8, "")
    D.d(1.6, 1.0, "D")
    D.path([(0, -0.8), (0.6, -2.4)], end="t")
    D.path([(1.6, 1.0), (1.8, -1.2), (0.8, -3.2)], style="dot", smooth=True)
    D.cone(-0.5, -4.0)
    D.text(0, 4.5, "Kick-slide, punch, re-set", size=8)
    return D


def d_mirror(w):
    D = dg(w)
    D.cone(-3, 0)
    D.cone(3, 0)
    D.cone(-3, 3)
    D.cone(3, 3)
    D.o(0, 0.3, "")
    D.d(0, 2.8, "D")
    D.path([(0, 0.3), (-2.0, 0.3)], style="dash", end="arrow")
    D.path([(0, 2.8), (2.0, 2.8)], style="dot", end="arrow")
    D.text(0, 5.0, "5 x 3 yd box", size=8)
    return D


def d_stalk(w):
    D = dg(w, xmax=10)
    D.o(-4, -0.8, "WR")
    D.d(-4.5, 5.0, "C")
    D.path([(-4, -0.8), (-4, 3.2)], end="t")
    D.text(1.5, 2.0, "push vertical, break down at 4–5", size=8)
    return D


def d_crack(w):
    D = dg(w, xmax=10)
    D.o(6, -0.8, "WR")
    D.d(3, 4.0, "LB")
    D.d(7.0, 5.0, "C")
    D.path([(6, -0.8), (3.6, 3.5)], end="t")
    D.text(-3, 2.0, "Crack: hit in front, above the waist", size=8)
    return D


def d_lead(w):
    D = dg(w)
    D.o(0, -3.6, "F")
    D.o(0, -5.6, "T")
    D.d(0.8, 3.2, "LB")
    D.bag(-1.2, 0.2, horiz=False)
    D.bag(1.2, 0.2, horiz=False)
    D.path([(0, -3.6), (0.4, 0.0), (0.8, 2.4)], end="t")
    D.path([(0, -5.6), (0.2, -1.0), (0.0, 4.6)], style="run")
    return D


def d_kick(w):
    D = dg(w)
    D.o(-1.0, -3.6, "F")
    D.d(3.6, 1.0, "E")
    D.bag(2.0, -0.4, horiz=False)
    D.path([(-1.0, -3.6), (1.8, -1.6), (3.2, 0.4)], end="t", smooth=True)
    D.text(-3.0, 3.5, "inside-out, inside shoulder", size=8)
    return D


def d_wedge(w):
    D = dg(w)
    xs = [-3, -1.5, 0, 1.5, 3]
    for x in xs:
        D.o(x, -0.8, "" if x else "C")
        D.path([(x, -0.8), (x * 0.45, 1.0)], end="t")
    for x in (-2.0, 0, 2.0):
        D.d(x, 1.6, "D")
    D.text(0, 4.5, "Converge on the center's hips", size=8)
    return D


def d_chute(w):
    D = dg(w)
    D.bag(-1.6, 1.2, horiz=False)
    D.bag(1.6, 1.2, horiz=False)
    D.text(4.6, 1.0, "chute (bar at 4 ft)", size=8)
    D.o(0, -1.0, "")
    D.path([(0, -1.0), (0, 4.2)], end="arrow")
    return D


def d_combo(w):
    D = dg(w)
    D.o(-0.8, -0.8, "")
    D.o(0.8, -0.8, "")
    D.d(0.6, 0.9, "D")
    D.d(-1.5, 4.5, "LB")
    D.path([(-0.8, -0.8), (-0.1, 0.4), (-1.2, 3.6)], end="t", style="dash")
    D.path([(0.8, -0.8), (0.9, 0.3)], end="t")
    D.text(4.5, 4.5, "Zone combo: climb late", size=8)
    return D


def d_screen(w):
    D = dg(w, xmax=11)
    for x in (-1.5, 0, 1.5):
        D.o(x, -0.8, "")
        D.path([(x, -0.8), (x, -1.6), (x + 5.5, -1.6), (x + 6.2, 0.6)], end="t", smooth=True)
    D.o(6.5, -4.5, "RB")
    D.path([(6.5, -4.5), (7.5, -2.8), (8.0, 3.0)], style="run", smooth=True)
    return D


def d_hands(w):
    D = dg(w)
    D.o(-1.2, -0.3, "")
    D.d(1.2, 0.3, "D")
    D.path([(-1.2, -0.3), (0.5, 0.3)], end="t")
    D.text(0, 3.5, "Partner: knees / feet stationary", size=8)
    return D


def d_cutoff(w):
    D = dg(w)
    D.o(0, -0.8, "")
    D.d(-1.4, 1.0, "D")
    D.path([(0, -0.8), (-0.8, -0.4), (-1.6, 0.4)], end="t", smooth=True)
    D.path([(-1.4, 1.0), (1.5, 2.0)], style="dot")
    D.text(3.5, 4.0, "Head across, wall off pursuit", size=8)
    return D


DRILLS = [
    Drill("Fit & Freeze", "Fundamentals", "5 min", "Pairs", "Teach the perfect contact position before adding speed.",
          "Pairs, one blocker and one bag holder/defender, at a line.",
          ["Blocker starts in a fit position: feet shoulder-width, knees bent, back flat.", "Hands inside on the defender's chest plate, thumbs up.",
           "Coach checks: head up, hips below shoulders, elbows tight.", "On the whistle, blocker freezes; coach corrects; rotate."],
          ["Thumbs up, elbows in.", "Eyes through the defender's chin.", "Weight on the balls of the feet."],
          [("Bending at the waist", "Sink the hips; chest over knees."), ("Hands outside", "Aim for the numbers.")],
          "Fit → 1-step drive → 3-step drive.", d_fit),
    Drill("Get-Off Board", "Fundamentals", "8 min", "Lines of 3", "Develop the low, fast first step that wins every block.",
          "2x8 board or a painted line; defender holds a shield 2 yds away.",
          ["Blocker in 3-point stance straddling the board.", "On cadence, fire off — feet must stay on either side of the board.",
           "Strike the shield with hands inside.", "Drive 3 yards and finish."],
          ["Wide base: feet never cross the board.", "First step 6 inches, not a lunge.", "Strike on the second step."],
          [("Narrow base", "Feet outside the board, every step."), ("Standing up", "Keep your pads under the defender's.")],
          "Board → board + chute → board + live defender.", d_board),
    Drill("Chute Drive", "Fundamentals", "6 min", "Single file", "Force pad level down under a bar so linemen learn to play low.",
          "Chute frame or a held pole at 4 ft, two bags as walls.",
          ["Start in a 3-point stance under the bar.", "Fire out through the chute on cadence.", "Drive past the bar and finish 5 yards."],
          ["Pads stay under the bar — if you hit it you're too high.", "Short, choppy steps."],
          [("Popping up", "Eyes on a spot 2 yards ahead.")], "Chute → chute + strike shield.", d_chute),
    Drill("Sled Drive", "Fundamentals", "6 min", "Pairs", "Build the leg drive and finish to move a man off the ball.",
          "1- or 2-man sled or heavy bag.", ["Fit on the sled pad.", "On the whistle, drive with short steps for 5 yards.", "Finish with a hip roll."],
          ["Feet keep moving, never stop.", "Hips roll through at the finish."], [("Stepping long", "Short, powerful steps.")],
          "Fit → 3-step → full drive.", d_sled),
    Drill("Hand Punch", "Fundamentals", "4 min", "Pairs", "Develop violent, accurate hands.",
          "Partners on their knees facing each other.", ["Defender holds a shield on chest.", "Blocker punches with both hands inside, locks out.",
                                                        "Reset and repeat 10x."],
          ["Thumbs up, punch from the hip.", "Lock out the elbows."], [("Winding up", "Short punch from the chest.")],
          "Knees → stance → live.", d_hands),
    Drill("Down Block", "Blocks", "8 min", "Groups of 3", "Teach the inside-gap block used in Power, Counter, Buck Sweep.",
          "Blocker and defender in the inside gap; cone marks the blocker's outside.",
          ["Defender aligns in the blocker's inside gap.", "Blocker steps with the inside foot at the defender's near hip.",
           "Head across, inside shoulder into the hip, drive him down the line.", "Finish 3 yards down the line."],
          ["Inside foot first.", "Head across the defender's body.", "Stay square; drive with the legs."],
          [("Head behind the defender", "Aim for the far hip."), ("Overstepping", "6-inch step.")], "Walk → half speed → live.", d_down),
    Drill("Double Team to Backer", "Blocks", "10 min", "Groups of 4", "Teach the combo block that wins the line and climbs to the LB.",
          "Two blockers, one down defender, one linebacker.",
          ["Both blockers step to the down defender, hip-to-hip.", "Drive him back off the ball; eyes on the linebacker.",
           "When the LB commits, the near blocker climbs to him."],
          ["Hip-to-hip — no seam.", "Move the DL first, then climb.", "Climb flat, not up the field."],
          [("Leaving too early", "Move the DL 2 yards first.")], "Walk → live with LB read.", d_double),
    Drill("Zone Combo", "Blocks", "8 min", "Groups of 4", "Inside-zone combo footwork and timing.",
          "Covered and uncovered linemen with DL shaded and LB.",
          ["Both linemen take the playside zone step.", "Uncovered lineman helps on the DL, eyes on the LB.", "Climb when the LB fits."],
          ["Same first step both players.", "Four hands on the DL until the LB shows."], [("Climbing too soon", "Earn it — move the DL.")],
          "vs shade → vs head-up → vs stunt.", d_combo),
    Drill("Reach Block", "Blocks", "8 min", "Pairs", "Seal a defender inside on stretch, toss and jet.",
          "Defender aligned outside shade; cone marks the sideline target.",
          ["Bucket step playside — open the hip.", "Aim for the defender's outside number.", "Work the hat outside and run your feet."],
          ["Gain ground with the first step.", "Get the outside hand on the outside number."], [("Lunging", "Run your feet to the block.")],
          "Fit → bucket step → live.", d_reach),
    Drill("Cutoff Block", "Blocks", "6 min", "Pairs", "Stop backside pursuit on zone and gap runs.",
          "Defender in the backside gap.", ["Flat step down the line.", "Head across the defender.", "Wall him off from the play."],
          ["Flat step — no depth.", "Run with him if he chases."], [("Head behind", "Lead with the hat.")], "Walk → live.", d_cutoff),
    Drill("Pull & Kick", "Pulling", "10 min", "Single file", "Teach guards to pull flat and kick out the end man.",
          "Cones for the line, a defender with a shield at end-man position.",
          ["Open step, pull flat behind the line.", "Gain ground — shoulders square to the line of scrimmage.",
           "Turn up inside-out on the end man, hit with the inside shoulder."],
          ["Flat pull — don't drift.", "Inside-out leverage.", "Low man wins."],
          [("Drifting into the backfield", "Rat-tail the line of cones."), ("Hitting square", "Inside shoulder, near hip.")],
          "Pull only → pull + kick shield → live.", d_pull),
    Drill("Trap Block", "Pulling", "8 min", "Groups of 3", "Teach the quick trap on a penetrating defender.",
          "Defender aligned on the playside guard; cone for the center.",
          ["Defender penetrates on the snap.", "Trapper pulls flat, finds him, attacks from inside out.", "Drive him out of the hole."],
          ["Find the near number.", "Expect him to be deeper than you think."], [("Too high", "Bend the knees through contact.")],
          "Walk → defender penetrates → live.", d_trap),
    Drill("Wedge Drill", "Short yardage", "8 min", "Full line", "Short-yardage wedge timing and shoulder-to-shoulder drive.",
          "Five linemen, three defenders on a line.",
          ["Center fires straight ahead low.", "Everyone steps to the center's near hip, shoulder-to-shoulder.", "Drive the pile 3 yards together."],
          ["No seams between linemen.", "Low and together."], [("Linemen splitting", "Inside arm hooks the neighbor.")],
          "Walk → vs bags → live.", d_wedge),
    Drill("Pass Pro Kick-Slide", "Pass protection", "8 min", "Pairs", "Develop the set, punch and re-set of pass protection.",
          "Blocker and rusher, cone marks the QB spot.",
          ["Set: kick-slide back and out with the outside foot.", "Punch the rusher's chest when he engages.", "Re-set and mirror."],
          ["Never cross your feet.", "Punch, don't catch.", "Keep him off the QB cone."], [("Lunging", "Let him come to you.")],
          "Shadow → hand-only → live.", d_pass),
    Drill("Mirror Box", "Pass protection", "5 min", "Pairs", "Footwork and body control vs quick rushers.",
          "5 x 3 yd box of cones.", ["Defender shuffles side to side.", "Blocker mirrors, staying square.", "30-second reps."],
          ["Stay in front.", "Short choppy steps."], [("Crossing feet", "Shuffle, don't run.")], "Shuffle → with contact.", d_mirror),
    Drill("RB Lead Block", "Backs", "8 min", "Lines of 3", "Teach fullbacks to isolate the linebacker in the hole.",
          "Two bags form the hole; LB with a shield 4 yds deep.",
          ["Fullback attacks downhill to the hole.", "Hit the LB with the playside shoulder, head on the playside.", "Tailback reads the block."],
          ["Hit the hole full speed.", "Stay on your feet."], [("Ducking the head", "Eyes up through contact.")], "Bags → live LB.", d_lead),
    Drill("RB Kick-Out", "Backs", "8 min", "Lines of 3", "Teach the fullback/H-back kick-out on Power.",
          "Defender at end-man position, bag marking the tackle.",
          ["Arc slightly to get inside-out leverage.", "Hit with the inside shoulder on the near hip.", "Drive him to the sideline."],
          ["Inside-out every time.", "Don't let him wrong-arm under you."], [("Kicking too wide", "Aim for his inside number.")],
          "Shield → live.", d_kick),
    Drill("WR Stalk Block", "Perimeter", "8 min", "Pairs", "Teach receivers to block on the perimeter.",
          "Receiver and corner 5 yds apart.",
          ["Push vertically to sell the route.", "Break down at 4–5 yds — chop the feet.", "Punch, mirror and stay between the man and the ball."],
          ["Sell the vertical.", "Inside-out leverage.", "Never lunge."], [("Lunging", "Breakdown first, then punch.")],
          "Mirror → punch → live.", d_stalk),
    Drill("WR Crack Block", "Perimeter", "6 min", "Groups of 3", "Teach the crack block on the alley defender.",
          "Receiver, linebacker in the alley, corner.",
          ["Release inside on the snap.", "Find the alley defender.", "Hit in front, above the waist."],
          ["Never block from behind.", "Hands inside."], [("Late release", "Release on the snap.")], "Walk → live.", d_crack),
    Drill("Screen Release", "Pass protection", "8 min", "OL + RB", "Teach the timing of the screen release and wall.",
          "Three linemen, a back, cones for the screen spot.",
          ["Linemen pass set for a one-count.", "Release flat to the screen spot.", "Block the first threat; back catches and follows."],
          ["Sell the pass set.", "Release flat, not upfield."], [("Releasing too early", "Count 'one-thousand' in the set.")],
          "Walk → full speed.", d_screen),
]


def drill_page(drill, num):
    head = [P(f"DRILL {num:02d}  •  {drill.cat.upper()}", "kicker"), P(drill.name, "playcall"), Spacer(1, 3),
            chips([drill.cat.upper(), f"TIME: {drill.time.upper()}", f"GROUPS: {drill.players.upper()}"]), Spacer(1, 8)]
    dia = drill.draw(CONTENT_W * 0.55)
    left = [P("PURPOSE", "h3"), P(drill.purpose, "small"), P("SETUP", "h3"), P(drill.setup, "small"),
            P("PROGRESSION", "h3"), P(drill.progression, "small")]
    t = Table([[dia, left]], colWidths=[CONTENT_W * 0.58, CONTENT_W * 0.42])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    body = [P("STEP-BY-STEP", "h3")] + numbered(drill.steps, "body") + [P("COACHING POINTS", "h3")] + bullets(drill.points, "body")
    body.append(P("COMMON MISTAKES → FIXES", "h3"))
    body.append(grid([["MISTAKE", "FIX"]] + [[a, b] for a, b in drill.errors], [CONTENT_W * 0.45, CONTENT_W * 0.55]))
    content = head + [t, Spacer(1, 6)] + body
    return [Anchor(1, f"{num:02d}. {drill.name}"), KeepInFrame(CONTENT_W, PAGE_H - 2 * M - 0.45 * inch, content, mode="shrink"), PageBreak()]


def drill_book(spec):
    story = toc_block()
    story += section("Start Here", "Blocking drillbook")
    story.append(P("Plays don't win games. Blocks do. Every play in every book in this collection depends on the twenty blocks taught here.", "quote"))
    story += [P("This drillbook is organized from the ground up: fundamentals (stance, get-off, hands, leg drive), then the blocks "
                "your schemes call for (down, double, zone combo, reach, cutoff), then pulling, pass protection and the backs' and "
                "receivers' blocks. Each drill has a diagram, setup, step-by-step instructions, coaching points and the most common "
                "mistakes with their fixes.", "body")]
    story.append(P("Weekly blocking circuit (in-season)", "h3"))
    story.append(grid([["DAY", "FUNDAMENTALS (8 MIN)", "SCHEME BLOCKS (10 MIN)", "SPECIALTY (5 MIN)"],
                       ["Mon", "Get-Off Board, Hand Punch", "Down Block, Double Team", "Pull & Kick"],
                       ["Tue", "Fit & Freeze, Chute Drive", "Zone Combo, Reach, Cutoff", "Pass Pro Kick-Slide"],
                       ["Wed", "Get-Off Board, Sled Drive", "Game-plan blocks vs scout fronts", "Trap / Wedge"],
                       ["Thu", "Hand Punch", "Walk-through only", "Screen Release"]],
                      [0.6 * inch, (CONTENT_W - 0.6 * inch) / 3, (CONTENT_W - 0.6 * inch) / 3, (CONTENT_W - 0.6 * inch) / 3]))
    story.append(P("Safety first", "h3"))
    story += bullets(["Teach every block at walk-through speed before adding contact.", "Head up, eyes through the target — never lead with the crown of the helmet.",
                      "Limit live full-contact reps; most blocking skill is built at thud and fit speed.",
                      "Follow your league's contact-practice limits."])
    story.append(PageBreak())
    story += section("The Drills", f"{len(DRILLS)} drills")
    story.append(grid([["#", "DRILL", "CATEGORY", "TIME"]] + [[f"{i:02d}", d.name, d.cat, d.time] for i, d in enumerate(DRILLS, 1)],
                      [0.45 * inch, CONTENT_W * 0.45, CONTENT_W * 0.3, CONTENT_W * 0.25 - 0.45 * inch]))
    story.append(PageBreak())
    for i, d in enumerate(DRILLS, 1):
        story += drill_page(d, i)
    story += notes_page()
    return story


# ========================================================= OFFSEASON TRAINING
LIFT_YOUTH = {
    "A": [("Bodyweight squat", "3x12", "3x15", "4x15"), ("Push-up (incline if needed)", "3x8", "3x12", "4x12"),
          ("Glute bridge", "3x12", "3x15", "3x20"), ("Plank", "3x20s", "3x30s", "3x40s"), ("Band pull-apart", "2x15", "3x15", "3x20")],
    "B": [("Reverse lunge", "3x8/leg", "3x10/leg", "3x12/leg"), ("Inverted row", "3x6", "3x8", "4x8"),
          ("Single-leg glute bridge", "2x10/leg", "3x10/leg", "3x12/leg"), ("Side plank", "2x15s", "3x20s", "3x30s"),
          ("Bear crawl", "3x10 yd", "3x15 yd", "3x20 yd")],
}
LIFT_HS = {
    "A": [("Back squat (or goblet squat)", "4x8 @65%", "5x5 @75%", "5x3 @82%"), ("Bench press", "4x8 @65%", "5x5 @75%", "5x3 @82%"),
          ("Romanian deadlift", "3x10", "4x8", "4x6"), ("DB row", "3x10/arm", "4x8/arm", "4x8/arm"), ("Pallof press", "3x10/side", "3x12/side", "3x12/side")],
    "B": [("Hang clean (technique first)", "4x3 @60%", "5x3 @70%", "6x2 @78%"), ("Trap-bar deadlift", "4x6 @65%", "4x5 @75%", "5x3 @82%"),
          ("DB incline press", "3x10", "4x8", "4x6"), ("Pull-up / lat pulldown", "3x8", "4x8", "4x6"),
          ("Rear-foot-elevated split squat", "3x8/leg", "3x8/leg", "3x6/leg")],
}
SPEED = [("A-skip & B-skip", "Posture and knee drive mechanics", "2x20 yd each"),
         ("Wall drive march", "Acceleration body angle", "3x10/leg"),
         ("10-yd starts (2-point & 3-point)", "First-step quickness", "6–8 reps, full rest"),
         ("Flying 20s", "Top-end speed", "4 reps, walk-back rest"),
         ("Pro agility (5-10-5)", "Change of direction", "4 reps each way"),
         ("L-drill (3-cone)", "Bend and re-acceleration", "4 reps"),
         ("Lateral shuffle to sprint", "Defensive reaction", "6 reps"),
         ("Med-ball scoop toss", "Hip power transfer", "3x5"),
         ("Broad jump (stick landing)", "Horizontal power", "3x3"),
         ("Pogo hops", "Ankle stiffness / elastic power", "3x15")]
TESTS = [("40-yard dash", "Speed", "Laser or hand-time; best of 2"), ("Pro agility (5-10-5)", "Change of direction", "Best of 2"),
         ("Vertical jump", "Lower-body power", "Best of 3"), ("Broad jump", "Lower-body power", "Best of 3"),
         ("Push-ups (max, 1 min)", "Upper-body endurance", "Strict form"), ("Plank (max hold)", "Core", "Hold until form breaks"),
         ("Main lifts (HS only)", "Strength", "3-rep max estimate — never a true 1RM for youth")]


def training_book(spec):
    story = toc_block()
    story += section("Start Here", "Offseason training")
    story.append(P("Championships are forged in the offseason, when nobody's watching.", "quote"))
    story += [P("This is a 12-week program in three 4-week phases: <b>Foundation</b> (movement quality and work capacity), "
                "<b>Strength</b> (load and volume) and <b>Power & Speed</b> (convert strength to football speed). It comes in two tracks:", "body")]
    story += bullets(["<b>Youth track (ages 8–13):</b> bodyweight and band training only. Movement quality, coordination and fun.",
                      "<b>High school track (ages 14+):</b> barbell and dumbbell training with percentage-based progressions.",
                      "Both tracks share the same speed, agility and conditioning sessions, scaled by volume."])
    story.append(P("Safety & supervision", "h3"))
    story += bullets(["Every session supervised by a qualified adult; teach technique with an empty bar or bodyweight first.",
                      "Get a pre-participation physical before starting. Stop and see a professional for any pain (not soreness).",
                      "Hydrate before, during and after every session; train in the shade or indoors during heat.",
                      "Never test true 1-rep maxes with youth athletes."])
    story.append(PageBreak())
    story += section("Weekly Schedule", "The template")
    story.append(grid([["DAY", "SESSION", "DURATION"], ["Monday", "Lift A + Speed (acceleration)", "60 min"],
                       ["Tuesday", "Conditioning + mobility", "40 min"], ["Wednesday", "Lift B + Agility (change of direction)", "60 min"],
                       ["Thursday", "Off / skill work (position drills, throwing, routes)", "—"],
                       ["Friday", "Lift A (variation) + Speed (top end) + jumps", "60 min"], ["Sat/Sun", "Off — play other sports, rest, recover", "—"]],
                      [1.3 * inch, CONTENT_W - 2.3 * inch, 1.0 * inch]))
    story.append(Spacer(1, 8))
    story.append(P("Session structure", "h3"))
    story += numbered(["Dynamic warm-up (10 min): jog, leg swings, walking lunges, skips, high knees, butt kicks, carioca.",
                       "Speed or agility block (15 min) — always fresh, before lifting.",
                       "Strength block (25–30 min).", "Core and mobility finisher (5–10 min)."])
    story.append(PageBreak())
    for track, data, label in [("Youth", LIFT_YOUTH, "Youth Track (bodyweight)"), ("High School", LIFT_HS, "High School Track (barbell)")]:
        story += section(label, "Strength program")
        for day in ("A", "B"):
            story.append(P(f"Lift {day}", "h3"))
            rows = [["EXERCISE", "WEEKS 1–4 FOUNDATION", "WEEKS 5–8 STRENGTH", "WEEKS 9–12 POWER"]] + [list(r) for r in data[day]]
            story.append(grid(rows, [CONTENT_W * 0.34] + [CONTENT_W * 0.22] * 3))
        story.append(Spacer(1, 6))
        story += bullets(["Rest 60–90 s between sets in Foundation, 2 min in Strength, 2–3 min in Power.",
                          "Add weight (or reps) only when every rep of the previous session was perfect.",
                          "Week 4, 8 and 12 are deload/test weeks: cut volume by 40%."] if track == "High School" else
                         ["Rest 45–60 s between sets.", "Perfect reps only — stop the set when form breaks.",
                          "Make it competitive: partners count reps and coach each other."])
        story.append(PageBreak())
    story += section("Speed & Agility", "Football speed")
    story.append(grid([["DRILL", "PURPOSE", "VOLUME"]] + [list(r) for r in SPEED], [CONTENT_W * 0.35, CONTENT_W * 0.4, CONTENT_W * 0.25]))
    story.append(Spacer(1, 6))
    story += bullets(["Speed work is done fresh with full rest — it's skill practice, not conditioning.",
                      "Coach posture: tall, eyes forward, arms 90°, drive the knee.", "Phase 3 adds resisted sprints (sled or partner band)."])
    story.append(PageBreak())
    story += section("Conditioning", "Game shape")
    story.append(grid([["PHASE", "SESSION", "WORK : REST"], ["Foundation", "Tempo runs: 10 x 100 yds at 70%", "Walk 50 yds between"],
                       ["Strength", "Gassers: 6 x (sideline-to-sideline x2)", "1 : 2"],
                       ["Power & Speed", "Football-specific: 12 x 6-second sprints", "1 : 5 (matches play length + huddle)"],
                       ["All phases", "Position drills at game tempo (Thursday)", "—"]],
                      [CONTENT_W * 0.25, CONTENT_W * 0.5, CONTENT_W * 0.25]))
    story.append(Spacer(1, 8))
    story.append(P("Mobility (daily, 10 min)", "h3"))
    story += bullets(["90/90 hip switches — 2x8/side", "World's greatest stretch — 2x5/side", "Couch stretch — 2x30 s/side",
                      "Thoracic rotations — 2x8/side", "Ankle rocks — 2x10/side"])
    story.append(PageBreak())
    story += section("Fuel & Recovery", "The other 22 hours")
    story += bullets(["<b>Eat real meals:</b> three meals + two snacks. Every plate: a protein, a carb, a fruit or vegetable.",
                      "<b>Hydrate:</b> water through the day; urine should be light yellow. Add a sports drink during long, hot sessions.",
                      "<b>Sleep:</b> 9–11 hours for youth, 8–10 for teens. Sleep is when strength is built.",
                      "<b>Recover:</b> active recovery on off days — walk, swim, play another sport.",
                      "<b>Supplements:</b> not needed for youth athletes. Food first; talk to a doctor before using any supplement."])
    story.append(PageBreak())
    story += section("Testing & Tracking", "Measure it")
    story.append(P("Test in week 1 and week 12 (and week 8 for HS). Post the results — athletes compete with their own numbers.", "body"))
    story.append(grid([["TEST", "MEASURES", "PROTOCOL"]] + [list(t) for t in TESTS], [CONTENT_W * 0.35, CONTENT_W * 0.3, CONTENT_W * 0.35]))
    story.append(Spacer(1, 10))
    story.append(P("Athlete tracking sheet", "h3"))
    story.append(grid([["ATHLETE", "40", "5-10-5", "VERT", "BROAD", "PUSH-UPS", "PLANK", "NOTES"]] + [[""] * 8 for _ in range(14)],
                      [CONTENT_W * 0.2] + [CONTENT_W * 0.09] * 6 + [CONTENT_W * 0.26]))
    story.append(PageBreak())
    story += notes_page("Training Log")
    return story


# ============================================================ PARENT PLAYBOOK
def parent_book(spec):
    story = toc_block()
    story += section("Welcome", "For families")
    story.append(P("You're part of the team, too.", "quote"))
    story += [P("Thank you for trusting us with your athlete this season. This guide explains how our program works, what to expect "
                "week to week, and how you can help your player get the most out of football — on the field and off it.", "body"),
              P("Our promise to you: we will teach the game safely, communicate clearly, and hold every player to the same standard of "
                "effort, attitude and respect. We ask the same of our families.", "body")]
    story.append(P("Program values", "h3"))
    story += bullets(["<b>Safety</b> — proper technique and equipment, every rep.", "<b>Effort</b> — we control effort and attitude.",
                      "<b>Accountability</b> — be on time, be prepared, be coachable.", "<b>Team</b> — the team is more important than any one player."])
    story.append(PageBreak())
    story += section("The Season at a Glance", "What to expect")
    story.append(grid([["WHEN", "WHAT", "WHAT PARENTS DO"], ["Pre-season", "Registration, physicals, equipment fitting", "Complete forms; schedule the physical"],
                       ["Weeks 1–2", "Conditioning, fundamentals, helmet-only practices (per league rules)", "Hydration, sleep, on-time drop-off"],
                       ["Weeks 3–4", "Full pads, scheme install, scrimmages", "Check equipment fit weekly"],
                       ["Game season", "Games weekly; practice 2–3 days", "Volunteer roles; positive sideline"],
                       ["Post-season", "Banquet, equipment return, offseason plan", "Return gear; celebrate the season"]],
                      [1.2 * inch, CONTENT_W * 0.42, CONTENT_W - 1.2 * inch - CONTENT_W * 0.42]))
    story.append(PageBreak())
    story += section("Communication", "How we talk")
    story += numbered(["<b>Team updates</b> go out through one channel (team app / email). Check it daily during the season.",
                       "<b>Absences:</b> tell the coach before practice — not after.",
                       "<b>The 24-hour rule:</b> no discussions about playing time or play calls on game day. Wait 24 hours, then request a meeting.",
                       "<b>Playing time:</b> earned at practice through effort, attitude and knowing your assignment. Coaches are happy to tell your player what to work on.",
                       "<b>Emergencies:</b> call the head coach directly."])
    story.append(P("Topics we're always happy to discuss", "h3"))
    story += bullets(["How your athlete can improve.", "Concerns about safety, health or the team environment.", "Anything going on at home or school that affects your player."])
    story.append(PageBreak())
    story += section("Equipment Guide", "Fit matters")
    story.append(grid([["ITEM", "FIT CHECK"], ["Helmet", "Snug: one finger-width above the eyebrows; doesn't rotate when you twist the facemask. Chin strap centered and tight."],
                       ["Shoulder pads", "Cover the shoulder tip; arch sits 1–2 fingers above the collarbone; laces snug."],
                       ["Mouthguard", "Worn every rep. Replace if chewed or torn."], ["Cleats", "Thumb-width at the toe; molded cleats for youth."],
                       ["Pants & pads", "Thigh pads centered on the thigh; knee pads over the kneecap."]],
                      [1.4 * inch, CONTENT_W - 1.4 * inch]))
    story.append(Spacer(1, 6))
    story += bullets(["Check fit every week — players grow and pads shift.", "Never modify a helmet. Report any cracks or damage to a coach immediately.",
                      "Label everything with your player's name."])
    story.append(PageBreak())
    story += section("Health & Safety", "Know the signs")
    story.append(P("Heat & hydration", "h3"))
    story += bullets(["Send a full water bottle to every practice and game; drink before practice too.", "Signs of heat illness: headache, dizziness, nausea, confusion, "
                      "extreme fatigue, cramps. Tell a coach immediately.", "Light-colored clothing; sunscreen for practice."])
    story.append(P("Head injuries", "h3"))
    story.append(P("Every coach in our program completes concussion-awareness training. If a head injury is suspected, the player is removed "
                   "from play and does not return until cleared in writing by a licensed healthcare professional, following our league's "
                   "and state's return-to-play rules.", "body"))
    story += bullets(["Watch for: headache, dizziness, confusion, sensitivity to light or noise, nausea, feeling “foggy,” memory problems, mood changes.",
                      "Tell a coach about ANY of these — even days after a hit.", "Free parent resources: the CDC HEADS UP program (cdc.gov/headsup)."])
    story.append(P("When in doubt, sit them out.", "quote"))
    story.append(PageBreak())
    story += section("Football 101", "Learn the game")
    story.append(P("Positions", "h3"))
    story.append(grid([["OFFENSE", "WHAT THEY DO"], ["Quarterback", "Takes the snap; hands off, runs or throws."],
                       ["Running backs", "Carry the ball, block, catch passes."], ["Offensive line", "Block — they make every play work."],
                       ["Tight end", "Blocks and catches."], ["Receivers", "Catch passes, block downfield."]],
                      [1.6 * inch, CONTENT_W - 1.6 * inch]))
    story.append(Spacer(1, 4))
    story.append(grid([["DEFENSE", "WHAT THEY DO"], ["Defensive line", "Stop the run at the line; rush the passer."],
                       ["Linebackers", "Fill run gaps, cover short passes, blitz."], ["Cornerbacks", "Cover receivers."],
                       ["Safeties", "Last line of defense; deep coverage and run support."]],
                      [1.6 * inch, CONTENT_W - 1.6 * inch]))
    story.append(P("Scoring", "h3"))
    story += bullets(["Touchdown 6 • Extra point kick 1 (youth leagues often 2) • Two-point conversion 2 (youth often 1) • Field goal 3 • Safety 2. Check your league rules."])
    story.append(P("Common penalties", "h3"))
    story.append(grid([["PENALTY", "WHAT IT MEANS"], ["False start", "Offensive player moves before the snap."], ["Offside", "Defender is across the line at the snap."],
                       ["Holding", "Grabbing and restricting an opponent illegally."], ["Pass interference", "Illegal contact with a receiver while the ball is in the air."],
                       ["Personal foul", "Unnecessary roughness, late hits, helmet-to-helmet contact."], ["Delay of game", "Play clock runs out before the snap."]],
                      [1.6 * inch, CONTENT_W - 1.6 * inch]))
    story.append(PageBreak())
    story += section("How to Help at Home", "Support your athlete")
    story += numbered(["Ask “Did you have fun? What did you learn?” — not “Why didn't you get the ball?”",
                       "Let the coaches coach. One voice on the sideline is easier for players to hear.",
                       "Praise effort and attitude — those are the things your player controls.",
                       "Prioritize sleep, meals and homework. Tired players get hurt.",
                       "Model good sportsmanship: cheer for every player, respect officials, shake hands with the other team."])
    story.append(P("Volunteer roles", "h3"))
    story += bullets(["Team parent (communications, snacks, banquet)", "Chain crew / clock operator", "Film / photography", "Equipment manager",
                      "Concessions and fundraising", "Hydration station lead"])
    story.append(PageBreak())
    story += section("Family Code of Conduct", "Sign & return")
    story += numbered(["I will be a positive role model for my athlete and every player on the field.",
                       "I will respect officials, coaches, opponents and other families.",
                       "I will use the 24-hour rule and the proper channels for concerns.",
                       "I will make sure my athlete is on time, hydrated, rested and has properly fitted equipment.",
                       "I will remember this is a game played by kids, for kids."])
    story.append(Spacer(1, 26))
    for label in ("Player name", "Parent/guardian signature", "Date"):
        story.append(P(f"{label}: ________________________________________________", "body"))
        story.append(Spacer(1, 12))
    story.append(PageBreak())
    story += notes_page("Family Notes")
    return story


SPECIAL_BOOKS = [
    dict(key="7v7", title="7v7 Playbook", category="Passing game", builder=seven_book,
         subtitle="Fifteen offensive concepts and four coverages for summer 7v7 — the same language as the fall offense."),
    dict(key="training", title="Forged: Offseason Training", category="Strength & speed", builder=training_book,
         subtitle="A 12-week strength, speed and conditioning program with separate youth and high school tracks."),
    dict(key="blocking", title="Blocking Drillbook", category="Drillbook", builder=drill_book,
         subtitle="Twenty blocking drills with diagrams, step-by-step instructions, coaching points and mistake fixes."),
    dict(key="parents", title="The Parent Playbook", category="Bonus", builder=parent_book,
         subtitle="Everything families need: season timeline, communication, equipment, safety, Football 101 and the family code."),
]
