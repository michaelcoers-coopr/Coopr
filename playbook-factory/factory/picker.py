"""The Package Picker: turn combine numbers + the eye test into a playbook choice.

Part 1 is a generic coaching guide (no player data). Part 2 is an optional team
report built from a team-data dict, so private rosters never live in the repo:

    python3 -m factory.picker team.py out.pdf     # team.py defines TEAM = {...}
"""
import statistics as st
import sys

from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import Flowable, PageBreak, Spacer, Table, TableStyle, KeepTogether

from . import brand, layout
from .layout import P, ST, section, bullets, numbered, grid, CONTENT_W, toc_block, INK, ACC, RULE

GREEN = colors.HexColor("#2F6B3A")
STEEL = colors.HexColor(brand.STEEL)


def say(text):
    """Pull-quote in the coach-to-coach voice."""
    return P(text, "quote")


# =================================================================== PART 1
def guide():
    s = toc_block()
    s += section("Here's the Deal", "The Package Picker")
    s.append(say("You don't need Spider 2 Y Banana. You need the right plays for the kids you actually have."))
    s += [P("Every season, the same thing happens. A first-year coach buys a playbook because a great team runs it, "
            "installs 40 plays, and spends October wondering why nothing works. Meanwhile the coach across the field "
            "— maybe he's coached 15 years — runs six plays and beats him by three touchdowns.", "body"),
          P("Here's the secret: <b>the experienced coach didn't pick a better playbook. He picked a playbook that fit his "
            "players, and then he found edges.</b> That's it. That's the whole game. This guide teaches you to do both.", "body"),
          P("Three steps:", "h3")]
    s += numbered(["<b>Measure your kids</b> — a simple combine plus the eye test. (Part 1, Chapter 1)",
                   "<b>Sort them into player types</b> — not positions yet. Types. (Chapter 2)",
                   "<b>Count your types and pick the package</b> that turns your roster into an advantage. (Chapters 3–4)",
                   "Then <b>steal every edge</b> a better coach would use against you. (Chapter 5)"])
    s.append(PageBreak())

    # ---------------------------------------------------------- the combine
    s += section("Chapter 1: The Combine", "Measure what matters")
    s.append(say("A stopwatch doesn't care whose kid it is. That's why you use one."))
    s.append(P("Three timed tests and four things you watch for. Laser timer if you've got one, a phone and two parents if you "
               "don't. Two reps each, keep the best, and write down <b>both</b> reps — a big gap between rep 1 and rep 2 "
               "tells you something too (effort, focus, or a bad start).", "body"))
    s.append(grid([["TEST", "WHAT IT REALLY TELLS YOU", "WHO IT MATTERS MOST FOR", "WHAT YOU DO WITH IT"],
                   ["<b>10-yard split</b>", "Burst. How fast a kid gets going from a stance. Most youth plays are won or lost in "
                    "the first 10 yards.", "Running backs, wings, linebackers, pulling guards, defensive ends",
                    "Your best 10-yard kids touch the ball or chase it. Your best-bursting lineman pulls."],
                   ["<b>40-yard dash</b>", "Speed once he's going. The last 20 yards = top speed.", "Edge runners, jet sweep, "
                    "corners, safeties", "Fast 40 + slow 10 = he needs a running start. Give him motion."],
                   ["<b>L-drill (3-cone)</b>", "Change of direction. Can he plant, bend and go without slowing to a jog?",
                    "Ball carriers in traffic, linebackers, corners", "Best L-drill kids carry the ball inside and play "
                    "linebacker. Worst L-drill kids should run straight lines."],
                   ["<b>40 split at 20</b>", "Acceleration. Compare the 20 split to the 10 and the 40.", "Everybody",
                    "Shows who is a slow starter but a fast finisher."]],
                  [1.1 * inch, 2.35 * inch, 1.75 * inch, CONTENT_W - 5.2 * inch]))
    s.append(Spacer(1, 8))
    s.append(P("The eye test (grade 1–3 on each)", "h3"))
    s.append(grid([["WATCH FOR", "HOW TO SEE IT", "WHY IT MATTERS"],
                   ["<b>Contact</b>", "Sumo circle, 1-on-1 tackling on a bag, King of the Hill.", "Speed without contact = a "
                    "kid who runs out of bounds. Contact without speed = a lineman."],
                   ["<b>Hands</b>", "10 tosses from 5 yards, count the catches. Snaps to the QB.", "Hands decide your center, "
                    "your QB, your pitch man and your receivers."],
                   ["<b>Instincts</b>", "Flag-pull tag, pursuit drill. Who finds the ball without being told?", "Instinct kids "
                    "play linebacker and safety."],
                   ["<b>Coachability</b>", "Tell him one thing. Does he do it next rep?", "At 7 years old, this beats talent. "
                    "Your QB and center must have it."]],
                  [1.1 * inch, 2.9 * inch, CONTENT_W - 4.0 * inch]))
    s.append(Spacer(1, 6))
    s += bullets(["<b>Keep it team-relative.</b> Don't compare your 1st graders to the internet. Rank them against each other.",
                  "<b>Retest every 4–6 weeks.</b> Kids change fast at this age. Your September depth chart is not your October one.",
                  "<b>Clean data or no data.</b> If a time is suspicious, rerun it. One bad laser start can move a kid to the wrong position."])
    s.append(PageBreak())

    # --------------------------------------------------------- quadrant
    s += section("Chapter 2: The Quadrant", "Sort types before positions")
    s.append(say("Plot every kid on two numbers. Burst and speed. Now you can see your whole team on one page."))
    s.append(P("Draw a line at your team's middle 10-yard time and your team's middle 40 time. Every kid lands in one of "
               "four boxes. <b>Every box has a job. There are no bad boxes.</b>", "body"))
    s.append(QuadrantLegend())
    s.append(Spacer(1, 8))
    s.append(P("Now add the eye test and you get your player types:", "h3"))
    s.append(grid([["TYPE", "COMBINE SIGNATURE", "EYE TEST", "OFFENSE", "DEFENSE"],
                   ["<b>Weapon</b>", "Top third in 10 AND 40", "Wants the ball", "Ball carrier, wing, jet", "Edge (DE/OLB), safety, corner"],
                   ["<b>Burst Back / Thumper</b>", "Top-half 10, middle 40", "Likes contact", "Fullback, wing that blocks down, "
                    "power runner", "Inside linebacker, defensive end"],
                   ["<b>Jitterbug</b>", "Best L-drill times", "Slippery", "Inside runs, counter, slot", "Linebacker, corner"],
                   ["<b>Rocket</b>", "Slow 10, fast 40", "Straight-line glider", "Jet sweep, reverse, split end", "Safety, corner "
                    "(needs a cushion)"],
                   ["<b>Hands</b>", "Any", "Catches everything", "Tight end, receiver, pitch back", "Corner, safety"],
                   ["<b>Point Guard</b>", "Any (better if Weapon)", "Calm, coachable, leader", "Quarterback", "Middle linebacker"],
                   ["<b>Snapper</b>", "Best 10 among the linemen", "Good hands, never rattled", "CENTER", "Nose / A-gap"],
                   ["<b>Anchor</b>", "Bottom half 10 and 40", "Big, steady, low", "Guard, tackle, tight end", "Defensive tackle"]],
                  [1.25 * inch, 1.35 * inch, 1.15 * inch, 1.6 * inch, CONTENT_W - 5.35 * inch]))
    s.append(Spacer(1, 6))
    s.append(P("<b>The rookie mistake:</b> putting every good athlete in the backfield and five leftover kids on the line. "
               "The best coaches put an athlete at center (the snap is the #1 cause of youth fumbles) and their best-bursting "
               "lineman at pulling guard. Angles and the snap win more games than a fast tailback.", "body"))
    s.append(PageBreak())

    # ------------------------------------------------------ package picker
    s += section("Chapter 3: Count Your Guys", "Your roster picks the playbook")
    s.append(say("Don't ask 'what's the best offense?' Ask 'what does my roster have too much of?' Then use it."))
    s.append(P("Count how many of each type you have. Then answer six questions. Each answer points you toward a family of "
               "books in this collection.", "body"))
    s.append(grid([["QUESTION", "IF YES →", "IF NO →"],
                   ["1. Can your center and QB make the snap clean 9 times out of 10?", "Anything under center is fine "
                    "(Double Wing, Wing-T, Power I, T)", "Single Wing (direct snap) or Double Wing with your surest hands at center. "
                    "No shotgun."],
                   ["2. Is your line bigger and better than most teams you'll play?", "Power I Vol. 1–3, Maryland I: "
                    "line up and run behind them", "Double Wing or Wing-T: tight splits, down blocks, angles beat size"],
                   ["3. Do you have 4+ Weapons / Burst Backs?", "Spread the carries: Double Wing, Wing-T, T Formation (series "
                    "football)", "Feed one back: Power I, Maryland I, Diamond"],
                   ["4. Do you have Rockets?", "Add jet motion (Wing-T, Gun-T, Single Back jet)", "Skip jet; run inside "
                    "and off-tackle"],
                   ["5. Can your QB throw 10 yards on target?", "Add Boot and Pop play-action (in every book)", "Run it. "
                    "Throw only off play-action. Air Raid/RPO wait until grade 4–5+"],
                   ["6. Is one runner clearly better than everyone else?", "I-formation family: Power I, Maryland I, "
                    "Single Wing tailback", "Misdirection families: Wing-T, Double Wing, T/Wishbone"]],
                  [2.5 * inch, 2.3 * inch, CONTENT_W - 4.8 * inch]))
    s.append(Spacer(1, 10))
    s.append(P("Defense: same idea", "h3"))
    s.append(grid([["IF YOUR ROSTER HAS...", "RUN", "WHY"],
                   ["Lots of Anchors, opponents who run the ball (most youth teams)", "6-2 Wall", "Six on the line takes away "
                    "every inside gap; ends with speed contain the sweep"],
                   ["Lots of Burst/Thumper linebacker types", "4-4 Anvil", "Gets four linebackers on the field; eight in the box"],
                   ["One big, immovable kid", "5-3 Forge", "Put him at nose; three linebackers run free"],
                   ["Fast DBs and opponents who spread out and throw", "4-2-5 Hammer", "Five DBs, hybrids who tackle"]],
                  [2.7 * inch, 1.1 * inch, CONTENT_W - 3.8 * inch]))
    s.append(PageBreak())

    # ------------------------------------------------------------ edges
    s += section("Chapter 4: Finding Edges", "How a new coach beats a better one")
    s.append(say("The other guy has more experience. Fine. Experience is just a list of edges. Here's the list."))
    edges = [
        ("Win the snap.", "Rep the center–QB exchange every single practice. 50 snaps a night. Most youth turnovers happen "
         "before the play even starts. Put a Snapper (athlete, good hands) at center."),
        ("Angles beat size.", "Tight splits, down blocks and pulling guards (Double Wing, Wing-T) let small kids block big ones. "
         "Never ask a small kid to drive a big kid straight back."),
        ("Break their alignment rules.", "Youth defenses line up on what they practiced. Unbalanced line, two tight ends, a wing "
         "they didn't see on film: now they're outnumbered on one side. Run there."),
        ("Make them guess with series football.", "Same backfield action, three plays: Buck Sweep, Trap, Waggle. Or Super Power, "
         "Counter, Boot. Their best linebacker is wrong every snap."),
        ("Find their worst defender.", "Scout them like you combine your own kids. Who's slow on the edge? Who won't tackle? "
         "Run at him until their coach fixes it. Then run the counter."),
        ("Use motion.", "Jet motion makes a defense talk and shift. Seven-year-olds can't do both. Even if you don't give it to "
         "the motion man, the defense flows and your counter hits."),
        ("Script and chart.", "Script your first 8 plays. Chart their defense on 1st down. By the 2nd quarter you'll know what "
         "they do. Most coaches never write it down."),
        ("The ball IS the game.", "Turnovers and penalties decide most youth games. Count fumbles and false starts in practice. "
         "Ball security circuit every day. It's a free win."),
        ("Turn minimum-play rules into a plan.", "Know your league's rules. Rotate on purpose. Scheme hides kids: the backside "
         "tackle on Power only hinges; the backside wing on Double Wing only cuts off."),
        ("Put speed where they run.", "Most youth offenses run sweeps. Set your edges with Weapons, squeeze the inside with "
         "Anchors, and the sweep goes nowhere."),
        ("Fewer plays, more reps.", "Install 6–8 plays. Run each one 50 times before you add another. Execution beats "
         "creativity at every level below varsity."),
        ("Add one wrinkle a week.", "A new formation, the same plays. The other coach has to re-teach his defense; you didn't "
         "re-teach anything."),
        ("Retest and adjust.", "Combine again mid-season. The kid who couldn't tackle in August might be your best linebacker "
         "in October."),
    ]
    for i, (h, b) in enumerate(edges, 1):
        s.append(KeepTogether([P(f"Edge #{i}: {h}", "h3"), P(b, "body")]))
    s.append(PageBreak())
    return s


class QuadrantLegend(Flowable):
    """The four-box teaching graphic (no player data)."""

    def __init__(self, w=CONTENT_W, h=2.7 * inch):
        super().__init__()
        self.width, self.height = w, h

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        boxes = [("ROCKETS", "Slow start, fast finish", "Give them a running start: jet, reverse, split end, safety", 0, 1, "#F2C200"),
                 ("WEAPONS", "Fast start, fast finish", "Ball in their hands. Edges on defense.", 1, 1, "#D62828"),
                 ("ANCHORS", "Steady, strong, not flashy", "Line of scrimmage. Pick your Snapper here.", 0, 0, "#5B6573"),
                 ("BURST / THUMPERS", "Fast start, average finish", "Fullback, wings, linebackers, pulling guard", 1, 0, "#2F6B3A")]
        bw, bh = w / 2 - 4, h / 2 - 4
        for title, sub, job, cx, cy, col in boxes:
            x, y = cx * (w / 2) + 2, cy * (h / 2) + 2
            c.setFillColor(colors.HexColor(col))
            c.setFillAlpha(0.12)
            c.roundRect(x, y, bw, bh, 6, fill=1, stroke=0)
            c.setFillAlpha(1)
            c.setFillColor(colors.HexColor(col))
            c.setFont("Oswald-Bold", 16)
            c.drawString(x + 12, y + bh - 24, title)
            c.setFillColor(INK)
            c.setFont("Barlow-SemiBold", 10)
            c.drawString(x + 12, y + bh - 40, sub)
            c.setFont("Barlow-Regular", 9.5)
            c.drawString(x + 12, y + bh - 56, job)
        c.setFillColor(STEEL)
        c.setFont("BarlowCondensed-Bold", 9)
        c.drawCentredString(w / 2, -12, "← slower 10-yard          BURST          faster 10-yard →")
        c.saveState()
        c.translate(-10, h / 2)
        c.rotate(90)
        c.drawCentredString(0, 0, "← slower 40      SPEED      faster 40 →")
        c.restoreState()


class Quadrant(Flowable):
    """Scatter: x = 10-yard (faster to the right), y = 40 (faster up)."""

    def __init__(self, kids, w=CONTENT_W, h=5.2 * inch):
        super().__init__()
        self.kids = [k for k in kids if k.get("ten") and k.get("forty")]
        self.width, self.height = w, h

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        tens = [k["ten"] for k in self.kids]
        fs = [k["forty"] for k in self.kids]
        m10, m40 = st.median(tens), st.median(fs)
        # zoom to the pack; outliers are pinned to the chart edge and marked with an arrow
        x0 = min(max(tens), sorted(tens)[int(len(tens) * 0.9)] + 0.08)
        x1 = min(tens) - 0.03                                  # reversed: faster right
        y0 = min(max(fs), sorted(fs)[int(len(fs) * 0.9)] + 0.25)
        y1 = min(fs) - 0.12                                    # reversed: faster up
        pad_l, pad_b = 34, 26

        def X(v):
            v = min(v, x0)
            return pad_l + (v - x0) / (x1 - x0) * (w - pad_l - 10)

        def Y(v):
            v = min(v, y0)
            return pad_b + (v - y0) / (y1 - y0) * (h - pad_b - 10)
        # quadrant tints
        mx, my = X(m10), Y(m40)
        for (ax, ay, bx, by, col, lab) in [(pad_l, my, mx, h - 10, "#F2C200", "ROCKETS"), (mx, my, w - 10, h - 10, "#D62828", "WEAPONS"),
                                            (pad_l, pad_b, mx, my, "#5B6573", "ANCHORS"), (mx, pad_b, w - 10, my, "#2F6B3A", "BURST / THUMPERS")]:
            c.setFillColor(colors.HexColor(col))
            c.setFillAlpha(0.09)
            c.rect(ax, ay, bx - ax, by - ay, fill=1, stroke=0)
            c.setFillAlpha(0.55)
            c.setFont("Oswald-Bold", 13)
            c.drawString(ax + 6, by - 18, lab)
        c.setFillAlpha(1)
        c.setStrokeColor(STEEL)
        c.setDash(3, 3)
        c.line(mx, pad_b, mx, h - 10)
        c.line(pad_l, my, w - 10, my)
        c.setDash()
        c.setFont("Barlow-Regular", 7.5)
        c.setFillColor(STEEL)
        c.drawString(mx + 3, pad_b + 3, f"team median 10Y {m10:.2f}")
        c.drawRightString(w - 12, my + 3, f"team median 40 {m40:.2f}")
        # axes ticks
        c.setFont("Barlow-Regular", 7)
        t = round(x0, 1)
        while t >= x1:
            c.drawCentredString(X(t), pad_b - 10, f"{t:.1f}")
            t = round(t - 0.1, 2)
        t = int(y0 * 4) / 4
        while t >= y1:
            c.drawRightString(pad_l - 4, Y(t) - 3, f"{t:.2f}")
            t -= 0.25
        c.setFont("BarlowCondensed-Bold", 8.5)
        c.drawCentredString((pad_l + w) / 2, 2, "10-YARD SPLIT (burst)  —  faster →")
        c.saveState()
        c.translate(8, h / 2)
        c.rotate(90)
        c.drawCentredString(0, 0, "40-YARD (speed)  —  faster →")
        c.restoreState()
        placed = []
        for k in sorted(self.kids, key=lambda k: k["ten"]):
            px, py = X(k["ten"]), Y(k["forty"])
            c.setFillColor(colors.HexColor("#D62828") if not k.get("forty_verified", True) else INK)
            c.circle(px, py, 3.2, fill=1, stroke=0)
            label = k["name"].split()[0] + " " + k["name"].split()[-1][0] + "." + ("*" if not k.get("forty_verified", True) else "")
            if k["ten"] > x0 or k["forty"] > y0:
                label += f" (off chart: {k['ten']:.2f} / {k['forty']:.2f})"
            ly = py + 4
            for (qx, qy) in placed:
                if abs(qx - px) < 58 and abs(qy - ly) < 9:
                    ly = qy - 10
            placed.append((px, ly))
            c.setFillColor(INK)
            c.setFont("Barlow-SemiBold", 7.5)
            c.drawString(px + 4, ly, label)


# =================================================================== PART 2
def team_report(T):
    kids = T["kids"]
    s = section(f"Part 2: {T['team']}", "Scouting report", level=0)
    s.append(P(T["intro"], "body"))
    s.append(P("<b>* = 40 time was recorded but not marked verified in the tracker.</b> Treat it as provisional until rerun.", "small"))
    s.append(Spacer(1, 6))
    s.append(Quadrant(kids))
    s.append(Spacer(1, 4))
    s.append(P(T["quadrant_read"], "body"))
    s.append(PageBreak())
    # leaderboards
    s += section("The Leaderboards", "Who's who", level=1)

    def board(key, title, n=10, fmt="{:.2f}"):
        ks = sorted([k for k in kids if k.get(key)], key=lambda k: k[key])[:n]
        rows = [[title, ""]] + [[f"{i}. {k['name']}" + ("*" if key == "forty" and not k.get("forty_verified", True) else ""),
                                  fmt.format(k[key])] for i, k in enumerate(ks, 1)]
        t = grid(rows, [1.55 * inch, 0.6 * inch], font="cell")
        return t
    t = Table([[board("ten", "10-YARD SPLIT"), board("forty", "40-YARD"), board("ldrill", "L-DRILL", n=12)]],
              colWidths=[CONTENT_W / 3] * 3)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    s.append(t)
    s.append(Spacer(1, 8))
    s += bullets(T["leaderboard_notes"])
    s.append(PageBreak())
    # player types
    s += section("Every Kid Has a Job", "Player types", level=1)
    rows = [["PLAYER", "10Y", "40", "L", "TYPE", "OFFENSE", "DEFENSE", "VS. THE BOARD"]]
    for k in kids:
        a = T["assign"].get(k["name"], {})
        rows.append([f"<b>{k['name']}</b>", f"{k['ten']:.2f}" if k.get("ten") else "—",
                     (f"{k['forty']:.2f}" + ("*" if not k.get("forty_verified", True) else "")) if k.get("forty") else "—",
                     f"{k['ldrill']:.1f}" if k.get("ldrill") else "—", a.get("type", "Untested"), a.get("o", ""), a.get("d", ""),
                     a.get("vs", "")])
    s.append(grid(rows, [1.15 * inch, 0.38 * inch, 0.45 * inch, 0.35 * inch, 0.95 * inch, 1.05 * inch, 0.95 * inch,
                         CONTENT_W - 5.28 * inch], font="cell"))
    s.append(PageBreak())
    # count & pick
    s += section("Count Your Guys", "The roster picks the playbook", level=1)
    s.append(grid([["TYPE", "COUNT", "WHO"]] + [[t_, str(len(w)), ", ".join(w)] for t_, w in T["counts"]],
                  [1.5 * inch, 0.6 * inch, CONTENT_W - 2.1 * inch]))
    s.append(Spacer(1, 8))
    s.append(P("The six questions", "h3"))
    s.append(grid([["QUESTION", "ANSWER", "POINTS TOWARD"]] + T["questions"], [2.6 * inch, 2.1 * inch, CONTENT_W - 4.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(P("Package scorecard", "h3"))
    s.append(grid([["PACKAGE", "FIT", "WHY"]] + T["scorecard"], [1.7 * inch, 0.9 * inch, CONTENT_W - 2.6 * inch]))
    s.append(PageBreak())
    s += section("The Call", "Recommendation", level=1)
    s.append(say(T["call_quote"]))
    for head, body in T["call"]:
        s.append(P(head, "h3"))
        if isinstance(body, list):
            s += bullets(body)
        else:
            s.append(P(body, "body"))
    s.append(PageBreak())
    s += section("Where the Stopwatch and the Board Disagree", "Feedback on the projections", level=1)
    s.append(P(T["disagree_intro"], "body"))
    for head, body in T["disagree"]:
        s.append(KeepTogether([P(head, "h3"), P(body, "body")]))
    s.append(PageBreak())
    s += section("Fix the Data, Then Retest", "Before the next Lab Day", level=1)
    s.append(P("Data problems found in the tracker", "h3"))
    s += numbered(T["data_issues"])
    s.append(P("Next Lab Day to-do", "h3"))
    s += numbered(T["todo"])
    return s


def build(path, team=None):
    meta = dict(title="The Package Picker", subtitle="Turn your combine numbers into the right playbook — and find the edges "
                "that beat better coaches.", category="Coaching guide", num=0, of=22)
    story = guide()
    if team:
        story += team_report(team)
    layout.build(path, meta, story)


if __name__ == "__main__":
    import runpy
    team = runpy.run_path(sys.argv[1])["TEAM"] if len(sys.argv) > 2 else None
    build(sys.argv[-1], team)
