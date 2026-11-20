"""Play-diagram renderer.

World coordinates are in yards: x runs sideline-to-sideline with the ball at
x=0, y is depth with the line of scrimmage at y=0 (offense negative, defense
positive). Everything is drawn as a ReportLab Flowable so it drops straight
into a platypus story, or can be drawn onto a canvas with drawOn().

Two themes:
  print   field background, yard lines, outlined players, letter defenders.
  slides  presentation look: no field, big filled shapes (circles = offense,
          triangles = defense, square = center), color-coded paths:
          solid = rush/route/block, RED = blitz / ball carrier,
          YELLOW = stunt/twist/motion and underneath zones, RED oval = deep
          middle, RED box = man coverage, dashed = drop into coverage.
`flip=True` draws from the defense's point of view (offense on top).
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

C_SHAPE = colors.HexColor(getattr(brand, "SLIDE_SHAPE", "#2F6B3A"))
C_SHAPE_D = colors.HexColor(getattr(brand, "SLIDE_SHAPE_DARK", "#1F4A27"))
C_RED = colors.HexColor(getattr(brand, "SLIDE_RED", "#D62828"))
C_YEL = colors.HexColor(getattr(brand, "SLIDE_YELLOW", "#F2C200"))
C_BLUE = colors.HexColor(getattr(brand, "SLIDE_BLUE", "#1E9BE0"))

R = 0.62  # player radius in yards (print theme)


class Diagram(Flowable):
    def __init__(self, width, xmax=20.0, ymin=-9.0, ymax=10.0, los=True, hashes=True, theme="print", flip=False,
                 height=None):
        super().__init__()
        self.theme, self.flip = theme, flip
        self.xmax, self.ymin, self.ymax = xmax, ymin, ymax
        self.R = R if theme == "print" else 1.15
        pad = 0 if theme == "print" else self.R + 0.25
        self.X0 = self._fx(xmax) + (pad if theme != "print" else 0)
        self.Y0, self.Y1 = self._fy(ymin) - pad, self._fy(ymax) + pad
        s = width / (2 * self.X0)
        if height is not None:
            s = min(s, height / (self.Y1 - self.Y0))
        self.s = s
        self.width = 2 * self.X0 * s
        self.height = (self.Y1 - self.Y0) * s
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
        """style: route | run | block | dash | dot | blitz | stunt | man | drop | dgap
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
    # slides theme spreads the box (wider splits) and compresses sidelines / deep field
    def _fx(self, x):
        if self.theme == "print":
            return x
        a = abs(x)
        v = a * 2.0 if a <= 6 else 12 + (a - 6) * 0.6
        return math.copysign(v, x)

    def _fy(self, y):
        if self.theme == "print":
            return y
        a = abs(y)
        v = a * 1.9 if a <= 3 else (5.7 + (a - 3) * 1.0 if a <= 6 else 8.7 + (a - 6) * 0.55)
        return math.copysign(v, y)

    def P(self, x, y):
        tx, ty = self._fx(x), self._fy(y)
        if self.flip:
            return ((tx + self.X0) * self.s, (self.Y1 - ty) * self.s)
        return ((tx + self.X0) * self.s, (ty - self.Y0) * self.s)

    def clip(self, x, y):
        m = R * 0.9
        return (max(-self.xmax + m, min(self.xmax - m, x)), max(self.ymin + m, min(self.ymax - m, y)))

    def zone_radii(self, x, y, rx, ry):
        rx2, ry2 = (self._fx(x + rx) - self._fx(x - rx)) / 2, (self._fy(y + ry) - self._fy(y - ry)) / 2
        return (rx2 * 1.45, ry2 * 1.7) if self.theme != "print" else (rx2, ry2)

    @property
    def slides(self):
        return self.theme == "slides"

    # ---------------------------------------------------------------- draw
    def draw(self):
        c = self.canv
        s = self.s
        c.saveState()
        if not self.slides:
            self._field(c)
        # zones
        for (x, y, rx, ry, label) in self.zones:
            px, py = self.P(x, y)
            rx, ry = self.zone_radii(x, y, rx, ry)
            if self.slides:
                deep_mid = abs(x) < 1.0 and y > 8.5
                c.setStrokeColor(C_RED if deep_mid else C_YEL)
                c.setLineWidth(1.4 if deep_mid else 2.2)
                c.ellipse(px - rx * s, py - ry * s, px + rx * s, py + ry * s, fill=0, stroke=1)
                continue
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
                c.setFillColor(C_ACC if not self.slides else C_YEL)
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
        # paths (man boxes first so they sit under arrows)
        for p in self.paths:
            if self.slides and p["style"] == "man":
                self._man_box(c, p)
        for p in self.paths:
            if self.slides and p["style"] == "man":
                continue
            self._draw_path(c, p)
        for (side, x, y, label, kind) in self.players:
            self._draw_player(c, side, x, y, label, kind)
        for m in self.marks:
            if m[0] == "ring":
                px, py = self.P(m[1], m[2])
                col = C_BLUE if self.slides else C_ACC
                c.setStrokeColor(col)
                c.setLineWidth(1.3 if not self.slides else 2.0)
                c.circle(px, py, self.R * 1.7 * s, fill=0, stroke=1)
                c.setFillColor(col)
                c.setFont("BarlowCondensed-ExtraBold", max(5.5, 0.85 * s))
                c.drawCentredString(px, py + self.R * 1.85 * s, m[3])
        for (x, y, txt, size, color, bold) in self.labels:
            px, py = self.P(x, y)
            c.setFillColor(color or C_INK)
            if self.slides and size <= 9:
                size *= 1.5
            c.setFont("BarlowCondensed-Bold" if bold else "Barlow-Regular", size)
            c.drawCentredString(px, py, txt)
        c.restoreState()

    def _field(self, c):
        s = self.s
        c.setFillColor(C_FIELD)
        c.setStrokeColor(C_LINE)
        c.setLineWidth(0.6)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)
        c.setLineWidth(0.5)
        yy = math.ceil(self.ymin / 5) * 5
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

    def _draw_player(self, c, side, x, y, label, kind):
        s = self.s
        px, py = self.P(x, y)
        r = self.R * s
        if self.slides:
            return self._slide_player(c, side, px, py, r, label, kind)
        if side == "O":
            if kind == "ghost":
                c.setStrokeColor(C_GHOST); c.setFillColor(colors.white); c.setLineWidth(0.8)
            elif kind == "key":
                c.setStrokeColor(C_INK); c.setFillColor(C_ACC); c.setLineWidth(1.0)
            else:
                c.setStrokeColor(C_INK); c.setFillColor(colors.white); c.setLineWidth(1.0)
            if kind == "center" or (label == "C" and kind != "ghost"):
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
            f2 = fs if kind != "key" else fs * 0.75
            c.setFont("BarlowCondensed-ExtraBold", f2)
            c.drawCentredString(px, py - f2 * 0.35, label or "V")

    def _slide_player(self, c, side, px, py, r, label, kind):
        c.setLineWidth(0.8)
        if side == "O":
            fill = C_RED if kind == "key" else C_SHAPE
            c.setFillColor(fill)
            c.setStrokeColor(C_SHAPE_D)
            if kind == "center" or (label == "C" and kind in ("ghost", "o")):
                c.rect(px - r, py - r, 2 * r, 2 * r, fill=1, stroke=1)
                label = ""
            else:
                c.circle(px, py, r, fill=1, stroke=1)
            if label and kind != "ghost":
                fs = r * (1.05 if len(label) <= 1 else 0.8)
                c.setFillColor(colors.white)
                c.setFont("BarlowCondensed-Bold", fs)
                c.drawCentredString(px, py - fs * 0.34, label)
        else:
            ghost = kind == "ghost"
            h = r * 2.1
            c.setFillColor(C_SHAPE)
            c.setStrokeColor(C_SHAPE_D)
            if ghost:
                c.setFillAlpha(0.28)
                c.setStrokeAlpha(0.35)
            p = c.beginPath()
            if self.flip:   # triangles point at the offense (up)
                p.moveTo(px, py + h * 0.55); p.lineTo(px - h * 0.55, py - h * 0.45); p.lineTo(px + h * 0.55, py - h * 0.45)
            else:
                p.moveTo(px, py - h * 0.55); p.lineTo(px - h * 0.55, py + h * 0.45); p.lineTo(px + h * 0.55, py + h * 0.45)
            p.close()
            c.drawPath(p, fill=1, stroke=1)
            c.setFillAlpha(1)
            c.setStrokeAlpha(1)
            if label and not ghost:
                fs = r * (0.95 if len(label) <= 1 else 0.7)
                c.setFillColor(colors.white)
                c.setFont("BarlowCondensed-Bold", fs)
                c.drawCentredString(px, py - fs * 0.45 + (-h * 0.08 if self.flip else h * 0.08), label)

    def _man_box(self, c, p):
        (x1, y1), (x2, y2) = p["pts"][0], p["pts"][-1]
        a, b = self.P(x1, y1), self.P(x2, y2)
        pad = self.R * self.s * 1.45
        x0, x3 = min(a[0], b[0]) - pad, max(a[0], b[0]) + pad
        y0, y3 = min(a[1], b[1]) - pad, max(a[1], b[1]) + pad
        c.saveState()
        c.setStrokeColor(C_RED)
        c.setLineWidth(1.8)
        c.rect(x0, y0, x3 - x0, y3 - y0, fill=0, stroke=1)
        c.restoreState()

    def _style(self, c, p):
        """Set stroke for a path; return the color used for its arrowhead."""
        st, col, w = p["style"], p["color"], p["width"]
        c.setDash()
        if self.slides:
            table = {"run": (C_RED, 2.4, None), "blitz": (C_RED, 2.2, None), "stunt": (C_YEL, 2.2, None),
                     "dash": (C_SHAPE, 1.6, (5, 3)), "dot": (C_STEEL, 1.3, (2, 2.5)), "man": (C_RED, 1.0, (1.5, 2)),
                     "drop": (C_SHAPE, 1.8, (5, 3)), "dgap": (C_SHAPE, 2.0, None), "motion": (C_YEL, 1.6, None)}
            colr, lw, dash = table.get(st, (C_SHAPE_D, 1.7, None))
        else:
            table = {"run": (C_ACC, 2.0, None), "blitz": (C_ACC, 1.8, None), "stunt": (C_ACC, 1.8, None),
                     "dash": (C_INK, 1.1, (4, 2.5)), "dot": (C_STEEL, 1.1, (1, 2)), "man": (C_DEF, 0.9, (1.5, 2)),
                     "drop": (C_DEF, 1.1, (4, 2.5)), "dgap": (C_DEF, 1.4, None)}
            colr, lw, dash = table.get(st, (C_INK, 1.25, None))
        colr = col or colr
        c.setStrokeColor(colr)
        c.setLineWidth(w or lw)
        if dash:
            c.setDash(*dash)
        return colr

    def _draw_path(self, c, p):
        pts = [self.clip(*q) for q in p["pts"]]
        if len(pts) < 2:
            return
        s = self.s
        c.saveState()
        stroke_col = self._style(c, p)
        P = [self.P(*q) for q in pts]
        start = 0
        if p["motion"]:
            if self.slides:
                c.saveState()
                c.setStrokeColor(C_YEL)
                c.setDash()
            for i in range(min(p["motion"], len(P) - 1)):
                self._zigzag(c, P[i], P[i + 1])
            if self.slides:
                c.restoreState()
            start = min(p["motion"], len(P) - 1)
        rest = P[start:]
        if len(rest) >= 2:
            path = c.beginPath()
            path.moveTo(*rest[0])
            if p["smooth"] and len(rest) >= 3:
                ext = [rest[0]] + rest + [rest[-1]]
                c2 = rest[0]
                for i in range(1, len(ext) - 2):
                    p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
                    c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
                    c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
                    path.curveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
                a, b = c2, rest[-1]
            else:
                for q in rest[1:]:
                    path.lineTo(*q)
                a, b = rest[-2], rest[-1]
            c.drawPath(path, stroke=1, fill=0)
        else:
            a, b = P[-2], P[-1]
        c.setDash()
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        if p["end"] == "arrow":
            L = (0.75 if not self.slides else 0.6) * s
            Wd = (0.42 if not self.slides else 0.3) * s
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
            c.setLineWidth(1.8 if self.slides else 1.4)
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
