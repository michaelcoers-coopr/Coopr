"""Defensive call engine.

A defense is a FRONT (alignments by technique + run gaps) plus a COVERAGE (zone
drops / man assignments). A CALL is front + coverage + overrides (stunts and
blitzes). The engine draws the call against a ghosted offensive formation and
writes an align / run / pass assignment for every defender.
"""
from . import formations as FM
from .diagram import Diagram
from .offense import Play

TECH_X = {"0": 0.0, "1": 0.6, "2i": 1.05, "2": 1.5, "3": 2.1, "4i": 2.6, "4": 3.0, "5": 3.6, "7": 4.1, "6": 4.5,
          "9": 5.2, "w9": 6.3}
TECH_TXT = {"0": "0-technique: head-up on the center", "1": "1-technique: shade the center's shoulder",
            "2i": "2i: inside eye of the guard", "2": "2-technique: head-up on the guard",
            "3": "3-technique: outside eye of the guard", "4i": "4i: inside eye of the tackle",
            "4": "4-technique: head-up on the tackle", "5": "5-technique: outside eye of the tackle",
            "7": "7-technique: inside eye of the tight end (or 1 yd outside the tackle if no TE)",
            "6": "6-technique: head-up on the tight end", "9": "9-technique: outside eye of the tight end",
            "w9": "Wide 9: 1.5 yds outside the end man, 2-point stance"}
GAP_X = {"A": 0.75, "B": 2.25, "C": 3.75, "D": 5.3, "E": 7.0}
GAP_TXT = {"A": "A gap", "B": "B gap", "C": "C gap", "D": "D gap (outside the TE)", "E": "contain / force"}

ZONES = {
    "deep_l": (-11.5, 14.0, 4.6, 2.0, "DEEP 1/3"), "deep_m": (0, 14.8, 4.6, 2.0, "DEEP 1/3"), "deep_r": (11.5, 14.0, 4.6, 2.0, "DEEP 1/3"),
    "half_l": (-8.0, 14.5, 7.0, 2.0, "DEEP 1/2"), "half_r": (8.0, 14.5, 7.0, 2.0, "DEEP 1/2"),
    "q1": (-13.0, 13.8, 3.3, 1.9, "1/4"), "q2": (-4.5, 14.6, 3.3, 1.9, "1/4"), "q3": (4.5, 14.6, 3.3, 1.9, "1/4"),
    "q4": (13.0, 13.8, 3.3, 1.9, "1/4"),
    "flat_l": (-13.0, 3.6, 3.4, 1.7, "FLAT"), "flat_r": (13.0, 3.6, 3.4, 1.7, "FLAT"),
    "curl_l": (-8.8, 7.8, 2.8, 1.6, "CURL"), "curl_r": (8.8, 7.8, 2.8, 1.6, "CURL"),
    "hook_l": (-4.0, 6.6, 2.6, 1.5, "HOOK"), "hook_r": (4.0, 6.6, 2.6, 1.5, "HOOK"),
    "mid": (0.0, 7.6, 2.8, 1.5, "MIDDLE"), "rob": (0.0, 9.8, 3.0, 1.5, "ROBBER"),
}
ZONE_TXT = {
    "deep": "DEEP THIRD: Backpedal at the snap, keep everything in front and on top of you. Break on the ball thrown.",
    "half": "DEEP HALF: Split the difference between #1 and #2. Nobody gets behind you; break on the throw.",
    "q": "QUARTER: Read #2 — if he goes vertical, carry him; if not, help on #1. Run support from the outside in.",
    "flat": "FLAT: Get width and depth to the flat (8–10 yds wide, 5 deep). Reroute #2, break on anything thrown short outside.",
    "curl": "CURL: Drop under the #1 receiver's curl, 10–12 yds. Wall him off from inside, then drive on the flat.",
    "hook": "HOOK: Drop to 8–10 yds over the hash, eyes on the QB, collision anything crossing.",
    "mid": "MIDDLE HOOK: Drop to 10 yds over the ball, read the QB's eyes, wall the crossers.",
    "rob": "ROBBER: Sit at 10–12 in the middle; read the QB and rob the dig/curl/cross.",
}


def zone_text(z):
    for k in ("deep", "half", "flat", "curl", "hook", "mid", "rob"):
        if z.startswith(k):
            return ZONE_TXT[k]
    if z.startswith("q"):
        return ZONE_TXT["q"]
    return z


class D:
    """Resolve a front against a formation."""

    def __init__(self, form_key, left=False):
        self.form_key = form_key
        self.f = FM.get(form_key, left)
        self.st = FM.strength(self.f)
        rec = [(k, v) for k, v in self.f.items() if v[2] in ("WR", "SLOT", "TE", "WING")]
        self.side_rec = {}
        for s in (1, -1):
            self.side_rec[s] = sorted([k for k, v in rec if v[0] * s > 0], key=lambda k: -abs(self.f[k][0]))

    def sx(self, side):
        return self.st if side == "s" else -self.st

    def pos(self, spec):
        kind = spec[0]
        if kind == "tech":
            _, side, tech = spec
            return (self.sx(side) * TECH_X[tech], 1.0)
        if kind == "lb":
            _, side, xo, depth = spec
            return ((self.sx(side) if side in ("s", "w") else 1) * xo, depth)
        if kind == "cb":
            side = self.sx(spec[1])
            r = self.side_rec[side]
            wide = [k for k in r if abs(self.f[k][0]) > 7]
            if wide:
                return (self.f[wide[0]][0] - side * 0.5, spec[2] if len(spec) > 2 else 6.0)
            return (side * 8.0, 5.0)
        if kind == "apex":
            side = self.sx(spec[1])
            r = self.side_rec[side]
            if len(r) >= 2 and abs(self.f[r[1]][0]) > 6:
                return ((self.f[r[1]][0] + side * 3.6) / 2, spec[2] if len(spec) > 2 else 4.5)
            return (side * 5.6, spec[2] if len(spec) > 2 else 4.0)
        if kind == "s":
            _, side, xo, depth = spec
            return ((self.sx(side) if side in ("s", "w") else 1) * xo, depth)
        raise ValueError(spec)

    def rec(self, which):
        """which: s1/s2/s3/w1/w2/b (first back)."""
        if which in ("b", "b2"):
            backs = [k for k, v in self.f.items() if v[2] == "RB"]
            i = 0 if which == "b" else 1
            return backs[i] if i < len(backs) else None
        side = self.st if which[0] == "s" else -self.st
        r = self.side_rec[side]
        i = int(which[1]) - 1
        return r[i] if i < len(r) else None


def build_call(call, form_key, front, coverage, overrides=None, show="pass", title="", family="Front",
               what="", steps=(), points=(), best="", pairs="", tags=(), week=1, form_name="", left=False):
    """front: {label: (posname, posspec, run_action)}; coverage: {label: pass_action}
    run_action: ('gap', 'B', 's'|'w') | ('contain', 's'|'w') | ('alley', side) | ('fill',)
    pass_action: 'deep_l' etc | ('man', 's1') | 'rush' | ('blitz', 'B', 's') | 'spy'
    overrides: {label: action} replaces run (DL stunt) or pass (blitz) actions."""
    dd = D(form_key, left)
    ov = overrides or {}
    DG = []
    rows = []
    for label, (posname, spec, run) in front.items():
        x, y = dd.pos(spec)
        pact = coverage.get(label, "rush")
        ract = run
        o = ov.get(label)
        if o is not None:
            if o[0] in ("blitz",) or o == "rush" or (isinstance(o, tuple) and o[0] in ("man", "spy")):
                pact = o
            elif isinstance(o, str):
                pact = o
            else:
                ract = o
        DG.append((label, x, y, ract, pact, posname, spec))
    # ------------------------------------------------------------ text
    for (label, x, y, ract, pact, posname, spec) in DG:
        def yd(v):
            v = round(abs(v))
            return f"{v} yd" + ("" if v == 1 else "s")
        side_w = "strong" if (x * dd.st) > 0 else "weak"
        al = TECH_TXT[spec[2]] if spec[0] == "tech" else {
            "lb": (f"{yd(x)} {side_w} of the ball" if abs(x) > 0.3 else "Over the ball") + f", {yd(y)} deep",
            "cb": f"Over the #1 receiver, {yd(y)} deep, outside leverage",
            "apex": f"Apex between the end man and #2, {yd(y)} deep",
            "s": f"{yd(y)} deep, " + (f"{yd(x)} to the {side_w} side" if abs(x) > 0.3 else "middle of the field")}[spec[0]]
        if ract[0] == "gap":
            side = "strong" if ract[2] == "s" else "weak"
            rt = f"{GAP_TXT[ract[1]]} ({side})"
            if ract[1] in ("D", "E"):
                rt += " — set the edge, force the ball back inside"
        elif ract[0] == "slant":
            side = "strong" if ract[2] == "s" else "weak"
            rt = f"SLANT to the {GAP_TXT[ract[1]]} ({side}) on the snap — get skinny, beat the block to your gap"
        elif ract[0] == "loop":
            side = "strong" if ract[2] == "s" else "weak"
            rt = f"LOOP: jab step, then loop behind your teammate to the {GAP_TXT[ract[1]]} ({side})"
        elif ract[0] == "contain":
            rt = "Contain: keep outside leverage on the ball, squeeze from outside-in"
        elif ract[0] == "alley":
            rt = "Alley/force: fill outside-in once the ball declares; first defender in the alley"
        elif ract[0] == "fill":
            rt = "Fill: deep-middle run support, fill the cutback lane last"
        elif ract[0] == "deep":
            rt = "Secondary run support: play pass first, then fill the alley inside the corner"
        elif ract[0] == "none":
            rt = ""
        else:
            rt = ""
        if isinstance(pact, tuple) and pact[0] == "man":
            rk = dd.rec(pact[1])
            pt = (f"MAN on {rk} — inside leverage, trail and squeeze" if rk else
                  "MAN on the #2 receiver to your side — if none, play the hook to your side")
        elif isinstance(pact, tuple) and pact[0] == "blitz":
            side = "strong" if pact[2] == "s" else "weak"
            pt = f"BLITZ the {GAP_TXT[pact[1]]} ({side}): time the snap, get skinny through the gap, take the near hip of the QB/RB mesh"
            rt = f"Blitz gap: {GAP_TXT[pact[1]]}"
        elif pact == "rush":
            pt = "RUSH: Rush your gap; contain the QB if you're the end man" if spec[0] == "tech" else "Rush"
        elif pact == "spy":
            pt = "SPY the QB: mirror him from 5 yds, tackle the scramble"
        else:
            pt = zone_text(pact)
        rows.append((f"{label} – {posname}", f"<b>ALIGN:</b> {al}. <b>RUN:</b> {rt}. <b>PASS:</b> {pt}"))

    def diagram(width, dd=dd, DG=DG, show=show):
        Dg = Diagram(width, xmax=17.5, ymin=-7.6, ymax=16.6)
        for k, (x, y, r) in dd.f.items():
            Dg.o(x, y, "" if r == "OL" else k, "ghost")
        zones_drawn = set()
        for (label, x, y, ract, pact, posname, spec) in DG:
            blitzer = isinstance(pact, tuple) and pact[0] == "blitz"
            if blitzer:
                g = GAP_X[pact[1]] * (dd.st if pact[2] == "s" else -dd.st)
                Dg.path([(x, y), (g, 0.4), (g * 0.7, -3.2)], style="blitz", smooth=True)
            elif show == "run" or spec[0] == "tech":
                if ract[0] in ("gap", "slant"):
                    g = GAP_X[ract[1]] * (dd.st if ract[2] == "s" else -dd.st)
                    gy = 0.15 if spec[0] == "tech" else 1.0
                    Dg.path([(x, y), (g, gy)], style="dgap" if ract[0] == "gap" else "blitz")
                elif ract[0] == "loop":
                    g = GAP_X[ract[1]] * (dd.st if ract[2] == "s" else -dd.st)
                    Dg.path([(x, y), (x, y + 0.9), (g, 0.9), (g, 0.1)], style="blitz", smooth=True)
                elif ract[0] == "contain":
                    sd = 1 if x > 0 else -1
                    Dg.path([(x, y), (x + sd * 0.8, -0.8)], style="dgap")
                elif ract[0] == "alley":
                    sd = 1 if x > 0 else -1
                    Dg.path([(x, y), (x - sd * 1.5, y - 2.5)], style="dgap")
                if show == "pass" and spec[0] != "tech" and not isinstance(pact, tuple) and pact in ZONES:
                    pass
            if show == "pass" and not blitzer and spec[0] != "tech":
                if isinstance(pact, tuple) and pact[0] == "man":
                    rk = dd.rec(pact[1])
                    if rk:
                        rx, ry = dd.f[rk][0], dd.f[rk][1]
                        Dg.path([(x, y), (rx, ry + 0.9)], style="man", end="none")
                elif pact == "spy":
                    Dg.path([(x, y), (0, 3.0)], style="man", end="arrow")
                elif pact in ZONES:
                    zx, zy, rx_, ry_, zl = ZONES[pact]
                    if pact not in zones_drawn:
                        Dg.zone(zx, zy, rx_, ry_, zl)
                        zones_drawn.add(pact)
                    Dg.path([(x, y), (zx, zy - ry_ * 0.4)], style="drop")
            elif show == "pass" and spec[0] == "tech" and isinstance(pact, str) and pact in ZONES:
                zx, zy, rx_, ry_, zl = ZONES[pact]
                Dg.zone(zx, zy, rx_, ry_, zl)
                Dg.path([(x, y), (zx, zy - ry_ * 0.4)], style="drop")
        for (label, x, y, ract, pact, posname, spec) in DG:
            key = isinstance(pact, tuple) and pact[0] == "blitz" or (ract[0] in ("slant", "loop") and show != "pass")
            Dg.d(x, y, label, "key" if key else "d")
        return Dg

    if show == "run":
        diagram_fn = lambda w: diagram(w)  # noqa: E731
    else:
        diagram_fn = lambda w: diagram(w)  # noqa: E731
    return Play(call=call, form_key=form_key, form_name=form_name or form_key, family=family, title=title or call,
                what=what, diagram_fn=diagram_fn, assignments=rows, steps=list(steps), points=list(points), best=best,
                pairs=pairs, tags=list(tags), week=week)
