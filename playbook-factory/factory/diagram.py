"""Play-diagram renderer.

World coordinates are in yards: x runs sideline-to-sideline with the ball at
x=0, y is depth with the line of scrimmage at y=0 (offense negative, defense
positive). Everything is drawn as a ReportLab Flowable so it drops straight
into a platypus story.
"""
import math
from reportlab.platypus import Flowable
from reportlab.lib import colors
from . import brand

C_INK = colors.HexColor(brand.INK)
C_ACC = colors.HexColor(brand.ACCENT)
C_STEEL = colors.HexColor(brand.STEEL)
C_FIELD = colors.HexColor(brand.FIELD)
C_LINE = colors.HexColor(brand.FIELD_LINE)
C_DEF = colors.HexColor(brand.DEFENSE)
C_GHOST = colors.HexColor("#A7AEB8")
C_ZONE = colors.HexColor("#2B4C7E")

R = 0.62  # player radius in yards


class Diagram(Flowable):
    def __init__(self, width, xmax=20.0, ymin=-9.0, ymax=10.0, los=True, hashes=True):
        super().__init__()
        self.width = width
        self.xmax, self.ymin, self.ymax = xmax, ymin, ymax
        self.s = width / (2 * xmax)
        self.height = (ymax - ymin) * self.s
        self.los, self.hashes = los, hashes
        self.players, self.paths, self.zones, self.marks, self.labels = [], [], [], [], []

    # ---------------------------------------------------------------- API
    def o(self, x, y, label="", kind="o"):
        """kind: o | center | key | ghost"""
        self.players.append(("O", x, y, label, kind))

    def d(self, x, y, label="", kind="d"):
        """kind: d | ghost | key"""
        self.players.append(("D", x, y, label, kind))

    def path(self, pts, style="route", end="arrow", smooth=False, motion=0, color=None, width=None):
        """style: route | run | block | dash | dot | blitz | man | motion
        end: arrow | t | none.  motion=n zig-zags the first n segments."""
        self.paths.append(dict(pts=pts, style=style, end=end, smooth=smooth,
                               motion=motion, color=color, width=width))

    def zone(self, x, y, rx, ry, label=""):
        self.zones.append((x, y, rx, ry, label))

    def cone(self, x, y):
        self.marks.append(("cone", x, y))

    def bag(self, x, y, horiz=True):
        self.marks.append(("bag", x, y, horiz))

    def ring(self, x, y, txt="READ"):
        self.marks.append(("ring", x, y, txt))

    def text(self, x, y, s, size=7, color=None, bold=True):
        self.labels.append((x, y, s, size, color, bold))

    # ---------------------------------------------------------- transform
    def P(self, x, y):
        return ((x + self.xmax) * self.s, (y - self.ymin) * self.s)

    def clip(self, x, y):
        m = R * 0.9
        return (max(-self.xmax + m, min(self.xmax - m, x)), max(self.ymin + m, min(self.ymax - m, y)))

    # ---------------------------------------------------------------- draw
    def draw(self):
        c = self.canv
        s = self.s
        c.saveState()
        # field
        c.setFillColor(C_FIELD)
        c.setStrokeColor(C_LINE)
        c.setLineWidth(0.6)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)
        c.setStrokeColor(C_LINE)
        c.setLineWidth(0.5)
        y0 = math.ceil(self.ymin / 5) * 5
        yy = y0
        while yy < self.ymax:
            if yy != 0:
                _, py = self.P(0, yy)
                c.line(2, py, self.width - 2, py)
            yy += 5
        if self.hashes:
            for hx in (-6.2, 6.2):
                yy = math.ceil(self.ymin)
                while yy < self.ymax:
                    px, py = self.P(hx, yy)
                    c.line(px - 0.35 * s, py, px + 0.35 * s, py)
                    yy += 1
        if self.los:
            _, py = self.P(0, 0)
            c.setStrokeColor(C_STEEL)
            c.setDash(3, 3)
            c.setLineWidth(0.7)
            c.line(2, py, self.width - 2, py)
            c.setDash()
        # zones
        for (x, y, rx, ry, label) in self.zones:
            px, py = self.P(x, y)
            c.setFillColor(C_ZONE)
            c.setFillAlpha(0.10)
            c.setStrokeColor(C_ZONE)
            c.setStrokeAlpha(0.55)
            c.setDash(2, 2)
            c.setLineWidth(0.7)
            c.ellipse(px - rx * s, py - ry * s, px + rx * s, py + ry * s, fill=1, stroke=1)
            c.setDash()
            c.setFillAlpha(1)
            c.setStrokeAlpha(1)
            if label:
                c.setFillColor(C_ZONE)
                c.setFont("BarlowCondensed-Bold", max(5.5, 0.9 * s))
                c.drawCentredString(px, py - 0.3 * s, label)
        # marks under players
        for m in self.marks:
            if m[0] == "cone":
                px, py = self.P(m[1], m[2])
                c.setFillColor(C_ACC)
                p = c.beginPath()
                p.moveTo(px, py + 0.55 * s)
                p.lineTo(px - 0.45 * s, py - 0.35 * s)
                p.lineTo(px + 0.45 * s, py - 0.35 * s)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
            elif m[0] == "bag":
                px, py = self.P(m[1], m[2])
                c.setFillColor(C_STEEL)
                w, h = (2.2 * s, 0.55 * s) if m[3] else (0.55 * s, 2.2 * s)
                c.roundRect(px - w / 2, py - h / 2, w, h, 1.5, fill=1, stroke=0)
        # paths
        for p in self.paths:
            self._draw_path(c, p)
        # players
        for (side, x, y, label, kind) in self.players:
            self._draw_player(c, side, x, y, label, kind)
        for m in self.marks:
            if m[0] == "ring":
                px, py = self.P(m[1], m[2])
                c.setStrokeColor(C_ACC)
                c.setLineWidth(1.3)
                c.circle(px, py, R * 1.6 * s, fill=0, stroke=1)
                c.setFillColor(C_ACC)
                c.setFont("BarlowCondensed-ExtraBold", max(5.5, 0.85 * s))
                c.drawCentredString(px, py + R * 1.75 * s, m[3])
        for (x, y, txt, size, color, bold) in self.labels:
            px, py = self.P(x, y)
            c.setFillColor(color or C_INK)
            c.setFont("BarlowCondensed-Bold" if bold else "Barlow-Regular", size)
            c.drawCentredString(px, py, txt)
        c.restoreState()

    def _draw_player(self, c, side, x, y, label, kind):
        s = self.s
        px, py = self.P(x, y)
        r = R * s
        if side == "O":
            if kind == "ghost":
                c.setStrokeColor(C_GHOST)
                c.setFillColor(colors.white)
                c.setLineWidth(0.8)
            elif kind == "key":
                c.setStrokeColor(C_INK)
                c.setFillColor(C_ACC)
                c.setLineWidth(1.0)
            else:
                c.setStrokeColor(C_INK)
                c.setFillColor(colors.white)
                c.setLineWidth(1.0)
            if kind == "center" or label == "C" and kind != "ghost":
                c.rect(px - r, py - r, 2 * r, 2 * r, fill=1, stroke=1)
            else:
                c.circle(px, py, r, fill=1, stroke=1)
            if label:
                c.setFillColor(colors.white if kind == "key" else (C_GHOST if kind == "ghost" else C_INK))
                fs = max(5, r * (1.05 if len(label) <= 1 else 0.85))
                c.setFont("BarlowCondensed-ExtraBold", fs)
                c.drawCentredString(px, py - fs * 0.34, label)
        else:
            col = {"d": C_DEF, "ghost": C_GHOST, "key": C_ACC}[kind]
            fs = max(7, r * (2.0 if len(label) <= 1 else 1.5))
            if kind == "key":
                c.setFillColor(C_ACC)
                c.circle(px, py, r * 1.05, fill=1, stroke=0)
                c.setFillColor(colors.white)
            else:
                c.setFillColor(col)
            c.setFont("BarlowCondensed-ExtraBold", fs if kind != "key" else fs * 0.75)
            c.drawCentredString(px, py - (fs if kind != "key" else fs * 0.75) * 0.35, label or "V")

    def _style(self, c, p):
        st = p["style"]
        col = p["color"]
        w = p["width"]
        c.setDash()
        if st == "run":
            c.setStrokeColor(col or C_ACC); c.setLineWidth(w or 2.0)
        elif st == "blitz":
            c.setStrokeColor(col or C_ACC); c.setLineWidth(w or 1.8)
        elif st == "dash":
            c.setStrokeColor(col or C_INK); c.setLineWidth(w or 1.1); c.setDash(4, 2.5)
        elif st == "dot":
            c.setStrokeColor(col or C_STEEL); c.setLineWidth(w or 1.1); c.setDash(1, 2)
        elif st == "man":
            c.setStrokeColor(col or C_DEF); c.setLineWidth(w or 0.9); c.setDash(1.5, 2)
        elif st == "drop":
            c.setStrokeColor(col or C_DEF); c.setLineWidth(w or 1.1); c.setDash(4, 2.5)
        elif st == "dgap":
            c.setStrokeColor(col or C_DEF); c.setLineWidth(w or 1.4)
        else:  # route / block / motion
            c.setStrokeColor(col or C_INK); c.setLineWidth(w or 1.25)
        return c._strokeColorObj if hasattr(c, "_strokeColorObj") else (col or C_INK)

    def _draw_path(self, c, p):
        pts = [self.clip(*q) for q in p["pts"]]
        if len(pts) < 2:
            return
        s = self.s
        c.saveState()
        self._style(c, p)
        stroke_col = p["color"] or {"run": C_ACC, "blitz": C_ACC, "man": C_DEF, "drop": C_DEF,
                                    "dgap": C_DEF, "dot": C_STEEL}.get(p["style"], C_INK)
        P = [self.P(*q) for q in pts]
        n_motion = p["motion"]
        # motion zig-zag segments
        start = 0
        if n_motion:
            for i in range(min(n_motion, len(P) - 1)):
                self._zigzag(c, P[i], P[i + 1])
            start = min(n_motion, len(P) - 1)
        rest = P[start:]
        if len(rest) >= 2:
            if p["smooth"] and len(rest) >= 3:
                path = c.beginPath()
                path.moveTo(*rest[0])
                ext = [rest[0]] + rest + [rest[-1]]
                for i in range(1, len(ext) - 2):
                    p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
                    c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
                    c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
                    path.curveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
                c.drawPath(path, stroke=1, fill=0)
                a, b = (c2, rest[-1])
            else:
                path = c.beginPath()
                path.moveTo(*rest[0])
                for q in rest[1:]:
                    path.lineTo(*q)
                c.drawPath(path, stroke=1, fill=0)
                a, b = rest[-2], rest[-1]
        else:
            a, b = P[-2], P[-1]
        c.setDash()
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        if p["end"] == "arrow":
            L = 0.75 * s
            Wd = 0.42 * s
            bx, by = b
            p1 = (bx - L * math.cos(ang) + Wd * math.sin(ang), by - L * math.sin(ang) - Wd * math.cos(ang))
            p2 = (bx - L * math.cos(ang) - Wd * math.sin(ang), by - L * math.sin(ang) + Wd * math.cos(ang))
            c.setFillColor(stroke_col)
            tri = c.beginPath()
            tri.moveTo(bx, by); tri.lineTo(*p1); tri.lineTo(*p2); tri.close()
            c.drawPath(tri, fill=1, stroke=0)
        elif p["end"] == "t":
            L = 0.55 * s
            bx, by = b
            c.setLineWidth(max(1.4, c._lineWidth if hasattr(c, "_lineWidth") else 1.4))
            c.line(bx + L * math.sin(ang), by - L * math.cos(ang), bx - L * math.sin(ang), by + L * math.cos(ang))
        c.restoreState()

    def _zigzag(self, c, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        dist = math.hypot(dx, dy)
        if dist < 1:
            return
        ux, uy = dx / dist, dy / dist
        nx, ny = -uy, ux
        amp = 0.35 * self.s
        step = 0.7 * self.s
        n = max(2, int(dist / step))
        path = c.beginPath()
        path.moveTo(*a)
        for i in range(1, n):
            t = i / n
            sgn = 1 if i % 2 else -1
            path.lineTo(a[0] + dx * t + nx * amp * sgn, a[1] + dy * t + ny * amp * sgn)
        path.lineTo(*b)
        c.drawPath(path, stroke=1, fill=0)
