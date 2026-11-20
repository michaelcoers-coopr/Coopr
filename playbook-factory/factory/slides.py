"""Slide edition: landscape 16:9 presentation decks.

Format per call/play:
  1. Diagram slide   - thin title, big shapes, color-coded paths, nothing else.
  2. Breakdown slide - boxed call name + bold pitch line, then two boxed columns
                       with one block per position (name + 3-4 short lines).
  3. (optional) Step-by-step slide - numbered steps for the key players,
                       coaching points, best against.
Intro slides: cover, benefits, philosophy, terminology/technique charts,
legend; closing call-to-action slide.
"""
import math
import os
import re

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics

from . import brand, layout  # layout registers the fonts
from . import formations as FM
from . import offense as O
from .diagram import Diagram, C_SHAPE, C_SHAPE_D, C_RED, C_YEL
from .layout import sym

W, H = 960.0, 540.0
M = 40.0
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INK = colors.HexColor(brand.INK)
ACC = colors.HexColor(brand.ACCENT)
GREY = colors.HexColor("#8A9099")
STEP_SLIDES = True


def S(name, **kw):
    base = dict(fontName="Barlow-Regular", fontSize=11, leading=14, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)


def img_path(p):
    if not p:
        return None
    full = p if os.path.isabs(p) else os.path.join(HERE, p)
    return full if os.path.exists(full) else None


class Deck:
    def __init__(self, path, meta):
        self.c = canvas.Canvas(path, pagesize=(W, H))
        self.c.setTitle(f"{brand.BRAND} {meta['title']}")
        self.c.setAuthor(brand.AUTHOR)
        self.c.setCreator(f"{brand.BRAND} Playbook Factory")
        self.meta = meta
        self.n = 0
        self.outline_n = 0

    # -------------------------------------------------------------- basics
    def end(self, number=True):
        self.n += 1
        if number:
            self.c.setFont("Barlow-Regular", 9)
            self.c.setFillColor(GREY)
            self.c.drawRightString(W - 52, 16, str(self.n))
        self.c.showPage()

    def mark(self, title, level=0):
        key = f"o{self.outline_n}"
        self.outline_n += 1
        self.c.bookmarkPage(key)
        self.c.addOutlineEntry(title, key, level=level, closed=level == 0)

    def para(self, html, x, top, w, style, h=2000):
        p = Paragraph(sym(html), style)
        _, ph = p.wrap(w, h)
        p.drawOn(self.c, x, top - ph)
        return ph

    def box(self, x, y, w, h, lw=0.9, color=INK):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(lw)
        self.c.rect(x, y, w, h, fill=0, stroke=1)

    def thin_title(self, text, align="right", size=34, top=None):
        c = self.c
        c.setFillColor(INK)
        c.setFont("Barlow-Regular", size)
        while pdfmetrics.stringWidth(text, "Barlow-Regular", size) > W - 2 * M and size > 18:
            size -= 2
            c.setFont("Barlow-Regular", size)
        y = top if top is not None else H - 30 - size
        if align == "right":
            c.drawRightString(W - M - 20, y, text)
        elif align == "center":
            c.drawCentredString(W / 2, y, text)
        else:
            c.drawString(M + 20, y, text)
        return y

    def heavy_title(self, text, size=36, top=None):
        c = self.c
        c.setFillColor(INK)
        while pdfmetrics.stringWidth(text, "Oswald-Bold", size) > W - 2 * M and size > 18:
            size -= 2
        c.setFont("Oswald-Bold", size)
        y = top if top is not None else H - 30 - size
        c.drawString(M, y, text)
        return y

    def image(self, path, x, y, w, h, circle=False):
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(path)
        iw, ih = ir.getSize()
        scale = max(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        c = self.c
        c.saveState()
        p = c.beginPath()
        if circle:
            p.circle(x + w / 2, y + h / 2, min(w, h) / 2)
        else:
            p.rect(x, y, w, h)
        c.clipPath(p, stroke=0, fill=0)
        c.drawImage(ir, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
        c.restoreState()

    def draw_diagram(self, dia, cx, top):
        dia.canv = self.c
        dia.drawOn(self.c, cx - dia.width / 2, top - dia.height)

    # --------------------------------------------------------------- slides
    def cover(self):
        b = self.meta
        c = self.c
        split = W * 0.575
        cov = img_path(brand.COVER_IMAGE)
        if cov:
            self.image(cov, 0, 0, split, H)
        else:
            draw_cover_panel(c, 0, 0, split, H, b)
        # right side
        c.setFillColor(colors.HexColor("#E6E1D3"))
        c.setFillAlpha(0.7)
        c.circle(split + 120, H - 70, 18, fill=1, stroke=0)
        c.circle(W - 70, 95, 26, fill=1, stroke=0)
        c.setFillAlpha(1)
        title = f"The {b['title']}" if not b["title"].lower().startswith("the ") else b["title"]
        st = S("ct", fontName="Barlow-Bold", fontSize=40, leading=44, textColor=ACC, alignment=1)
        rw = W - split - 60
        ph = Paragraph(title, st).wrap(rw, H)[1]
        top = H / 2 + ph / 2 + 50
        self.para(title, split + 30, top, rw, st)
        self.para(brand.AUTHOR, split + 30, top - ph - 6, rw, S("ca", fontSize=14, leading=18, alignment=1))
        self.para(f"{brand.BRAND} • {brand.COLLECTION}", split + 30, top - ph - 28, rw,
                  S("cb", fontSize=10, leading=13, alignment=1, textColor=GREY))
        self.end(number=False)

    def benefits(self, title, items, visual=None):
        self.mark("Benefits")
        c = self.c
        st = S("bt", fontSize=42, leading=46)
        self.para(title, M + 8, H - 40, W * 0.48, st)
        y = H - 40 - Paragraph(title, st).wrap(W * 0.48, H)[1] - 22
        bs = S("bb", fontSize=22, leading=28, leftIndent=20, firstLineIndent=-20, spaceAfter=10)
        for it in items:
            y -= self.para(f"•&nbsp;&nbsp;{it}", M + 8, y, W * 0.47, bs) + 10
        hero = img_path(brand.HERO_IMAGE)
        x0, w0 = W * 0.53, W * 0.47 - M
        if hero:
            self.image(hero, x0, 60, w0, H - 130)
        elif visual is not None:
            dia = visual(w0, H - 140)
            self.draw_diagram(dia, x0 + w0 / 2, H - 60 - (H - 140 - dia.height) / 2)
        self.end()

    def philosophy(self, title, hook, paragraph, standards, visual=None):
        self.mark("Philosophy")
        c = self.c
        self.box(M - 6, 22, W - 2 * M + 12, H - 60)
        hero = img_path(brand.HERO_IMAGE)
        tw = (W - 2 * M - 20) * 0.55
        y = H - 50
        y -= self.para(title, M + 6, y, tw, S("pt", fontName="Barlow-Bold", fontSize=34, leading=38)) + 10
        y -= self.para(f"<b>{hook}</b>", M + 6, y, tw, S("ph", fontSize=19, leading=24)) + 10
        y -= self.para(paragraph, M + 6, y, tw, S("pp", fontSize=14.5, leading=19)) + 16
        for i, s in enumerate(standards, 1):
            y -= self.para(f"<b>{i}. {s}</b>", M + 6, y, tw, S("ps", fontSize=16, leading=20)) + 5
        rx, rw = M + tw + 30, W - 2 * M - tw - 30
        if hero:
            self.image(hero, rx, 26, rw, H - 120)
        elif visual is not None:
            dia = visual(rw, H - 120)
            self.draw_diagram(dia, rx + rw / 2, H / 2 + dia.height / 2 - 10)
        self.end()

    def diagram_slide(self, title, dia_fn, outline=None, level=1):
        if outline:
            self.mark(outline, level)
        y = self.thin_title(title)
        dia = dia_fn(W - 2 * M, y - 40)
        self.draw_diagram(dia, W / 2, y - 18)
        self.end()

    def breakdown(self, title, summary_bold, summary_rest, blocks):
        c = self.c
        x, w = M - 10, W - 2 * M + 20
        top = H - 40
        hs = S("hs", fontSize=14.5, leading=19)
        ht = self.para(f"<b>{title.upper()}</b>", x + 8, top - 6, w - 16, S("ht", fontName="Barlow-Bold", fontSize=16, leading=20))
        hb = self.para(f"<b>{summary_bold}</b> {summary_rest}", x + 8, top - 10 - ht, w - 16, hs)
        hh = ht + hb + 18
        self.box(x, top - hh, w, hh)
        # two columns
        n = len(blocks)
        half = (n + 1) // 2
        cols = [blocks[:half], blocks[half:]]
        avail = top - hh - 12 - 26
        colw = (w - 12) / 2
        blocks = [(n, ls[:3]) for n, ls in blocks]
        cols = [blocks[:half], blocks[half:]]
        size = 12
        while size > 6.5:
            st = S("bk", fontSize=size, leading=size * 1.22, spaceAfter=size * 0.7)
            hs_ = [sum(Paragraph(self._block_html(b), st).wrap(colw - 16, 2000)[1] + st.spaceAfter for b in col) for col in cols]
            if max(hs_) <= avail - 10:
                break
            size -= 0.25
        bh = min(avail, max(hs_) + 14)
        for i, col in enumerate(cols):
            cx = x + i * (colw + 12)
            self.box(cx, top - hh - 12 - bh, colw, bh)
            yy = top - hh - 12 - 7
            for b in col:
                yy -= self.para(self._block_html(b), cx + 8, yy, colw - 16, st) + st.spaceAfter
        self.end()

    @staticmethod
    def _block_html(b):
        name, lines = b
        return f"<b>{name}</b><br/>" + "<br/>".join(lines)

    def steps_slide(self, title, steps, points, best, pairs=""):
        c = self.c
        self.thin_title(f"{title}: Step-by-Step", align="left", size=28)
        x, w = M - 10, W - 2 * M + 20
        top = H - 80
        colw = w * 0.56
        st = S("ss", fontSize=12, leading=15.5, leftIndent=16, firstLineIndent=-16, spaceAfter=3)
        hst = S("sh", fontName="Barlow-Bold", fontSize=13.5, leading=17, textColor=colors.HexColor(brand.ACCENT_DARK), spaceAfter=3)
        size = 14
        while True:
            st = S("ss", fontSize=size, leading=size * 1.3, leftIndent=16, firstLineIndent=-16)
            tot = 0
            for who, ss in steps:
                tot += Paragraph(who, hst).wrap(colw - 20, 999)[1] + 6
                tot += sum(Paragraph(f"{i}. {s}", st).wrap(colw - 20, 999)[1] + 3 for i, s in enumerate(ss, 1)) + 8
            if tot < top - 40 or size <= 8:
                break
            size -= 0.5
        y = top - 8
        for who, ss in steps:
            y -= self.para(f"STEP-BY-STEP: {who.upper()}", x + 10, y, colw - 20, hst) + 4
            for i, s in enumerate(ss, 1):
                y -= self.para(f"<font color='{brand.ACCENT}'><b>{i}.</b></font> {s}", x + 10, y, colw - 20, st) + 3
            y -= 8
        self.box(x, 30, colw, top - 30)
        rx, rw = x + colw + 12, w - colw - 12
        y = top - 8
        y -= self.para("COACHING POINTS", rx + 10, y, rw - 20, hst) + 4
        ps = S("pp2", fontSize=13, leading=17, leftIndent=12, firstLineIndent=-12)
        for p in points:
            y -= self.para(f"• {p}", rx + 10, y, rw - 20, ps) + 3
        y -= 10
        y -= self.para("BEST AGAINST", rx + 10, y, rw - 20, hst) + 4
        y -= self.para(best, rx + 10, y, rw - 20, ps) + 10
        if pairs:
            y -= self.para("PAIRS WITH", rx + 10, y, rw - 20, hst) + 4
            y -= self.para(pairs, rx + 10, y, rw - 20, ps)
        self.box(rx, 30, rw, top - 30)
        self.end()

    def text_slide(self, heavy, intro_html, sections, outline=None):
        if outline:
            self.mark(outline)
        y = self.heavy_title(heavy, size=32, top=H - 64)
        x, w = M - 10, W - 2 * M + 20
        top = y - 14
        hh = self.para(intro_html, x + 8, top - 6, w - 16, S("ti", fontSize=12.5, leading=17)) + 14
        self.box(x, top - hh, w, hh)
        yy = top - hh - 16
        for (head, body) in sections:
            yy -= self.para(f"<b>{head}</b>", x + 8, yy, w - 16, S("th", fontSize=17, leading=21)) + 4
            yy -= self.para(body, x + 8, yy, w - 16, S("tb", fontSize=14, leading=19)) + 12
        self.end()

    def table_slide(self, title, header_html, rows, widths, font=12.5, outline=None, heavy=False):
        if outline:
            self.mark(outline)
        if heavy:
            y = self.heavy_title(title, size=32, top=H - 64)
        else:
            y = self.thin_title(title, align="left", size=32, top=H - 66)
        top = y - 16
        if header_html:
            hh = self.para(header_html, M + 2, top - 6, W - 2 * M - 4, S("tsh", fontSize=13, leading=17)) + 14
            self.box(M - 6, top - hh, W - 2 * M + 12, hh)
            top -= hh + 14
        f = font
        while True:
            cs = S("tc", fontSize=f, leading=f * 1.25)
            hs = S("tch", fontName="Barlow-Bold", fontSize=f, leading=f * 1.25)
            data = [[Paragraph(sym(str(cell)), hs if r == 0 else cs) for cell in row] for r, row in enumerate(rows)]
            t = Table(data, colWidths=widths)
            t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4),
                                   ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                                   ("LINEBELOW", (0, 0), (-1, 0), 1.0, INK)]))
            tw, th = t.wrap(W - 2 * M, H)
            if th < top - 34 or f <= 7:
                break
            f -= 0.5
        t.drawOn(self.c, M, top - th)
        self.end()

    def legend(self, title, items):
        """items: [(label, draw_fn(width, height) -> Diagram)]"""
        if not getattr(self, "_legend_marked", False):
            self.mark("Terminology")
            self._legend_marked = True
        y = self.thin_title("Terminology", align="left", size=40, top=H - 80)
        rowh = (y - 50) / len(items)
        for i, (label, fn) in enumerate(items):
            cy = y - 30 - rowh * i - rowh / 2
            self.c.setFont("Barlow-Regular", 20)
            self.c.setFillColor(INK)
            self.c.drawString(M + 40, cy - 6, f"•  {label} –")
            dia = fn(300, rowh - 8)
            self.draw_diagram(dia, M + 40 + pdfmetrics.stringWidth(f"•  {label} –", "Barlow-Regular", 20) + 20 + dia.width / 2,
                              cy + dia.height / 2)
        self.end()

    def cta(self):
        if not brand.CTA_URL:
            return
        self.mark("Next steps")
        c = self.c
        x, w = M, W * 0.42
        y = H - 46
        y -= self.para(f"Good luck, Coach. {brand.SIGNOFF} You've got the system — now it's time to execute with "
                       f"discipline, confidence and {brand.BRAND} intensity.", x, y, w, S("c1", fontSize=14, leading=18)) + 16
        y -= self.para(f"If you want <b>direct help from {brand.AUTHOR}</b> to <b>win more games</b>, make smarter adjustments "
                       f"and <b>dominate your season</b>…", x, y, w, S("c2", fontSize=14, leading=18)) + 16
        st = S("c3", fontName="Barlow-Bold", fontSize=22, leading=26, textColor=colors.HexColor(brand.ACCENT_DARK))
        ph = self.para(f"<u>{brand.CTA_TITLE} with {brand.AUTHOR}</u>", x, y, w, st)
        c.linkURL(brand.CTA_URL, (x, y - ph, x + w, y), relative=0)
        y -= ph + 8
        y -= self.para(brand.CTA_PITCH, x, y, w, S("c4", fontSize=14, leading=18)) + 12
        y -= self.para(f"<b>Exclusive Playbook Owner Discount:</b><br/>Use code <b>{brand.CTA_CODE}</b> for <b>{brand.CTA_OFFER}</b>.",
                       x, y, w, S("c5", fontSize=14, leading=18)) + 12
        y -= self.para("This code is ONLY for coaches who own this playbook.", x, y, w, S("c6", fontSize=14, leading=18)) + 18
        self.para(f"<b>{brand.BRAND} out!</b><br/>{brand.AUTHOR}", x, y, w, S("c7", fontSize=14, leading=18))
        cx, cy, r = W * 0.70, H / 2, 190
        photo = img_path(brand.COACH_PHOTO)
        if photo:
            self.image(photo, cx - r, cy - r, 2 * r, 2 * r, circle=True)
        else:
            c.setFillColor(INK)
            c.circle(cx, cy, r, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Oswald-Bold", 46)
            c.drawCentredString(cx, cy + 4, brand.BRAND)
            c.setFillColor(ACC)
            c.setFont("BarlowCondensed-Bold", 18)
            c.drawCentredString(cx, cy - 26, brand.AUTHOR.upper())
        c.setFillColor(colors.HexColor("#DCE8D5"))
        c.setFillAlpha(0.8)
        c.circle(cx - r * 0.85, cy - r * 0.9, 45, fill=1, stroke=0)
        c.setFillAlpha(1)
        self.end()

    def save(self):
        self.c.save()


# ---------------------------------------------------------------- covers
def draw_cover_panel(c, x0, y0, w, h, meta):
    """Built-in cover art (used when no COVER_IMAGE is set)."""
    c.saveState()
    cp = c.beginPath()
    cp.rect(x0, y0, w, h)
    c.clipPath(cp, stroke=0, fill=0)
    c.setFillColor(colors.HexColor("#15181C"))
    c.rect(x0, y0, w, h, fill=1, stroke=0)
    # vignette stripes
    c.setFillColor(colors.HexColor("#1D2127"))
    for i in range(-8, 12):
        xx = x0 + i * 70
        p = c.beginPath()
        p.moveTo(xx, y0); p.lineTo(xx + 26, y0); p.lineTo(xx + 26 + h * 0.5, y0 + h); p.lineTo(xx + h * 0.5, y0 + h); p.close()
        c.drawPath(p, fill=1, stroke=0)
    # chalk play
    defense = meta.get("category", "").lower() == "defense"
    _chalk(c, x0 + w / 2, y0 + h * 0.30, 12.5, defense)
    # title lettering
    cream = colors.HexColor("#EFE8D6")
    lines = [f"THE {brand.BRAND}", meta["title"].upper()]
    words = meta["title"].upper().split()
    big = []
    cur = ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if pdfmetrics.stringWidth(t, "Oswald-Bold", 58) > w - 60 and cur:
            big.append(cur)
            cur = wd
        else:
            cur = t
    big.append(cur)
    size = 58 if len(big) <= 2 else 46
    yy = y0 + h - 30
    c.setFillColor(cream)
    c.setFont("Oswald-Bold", 26)
    yy -= 26
    c.drawCentredString(x0 + w / 2, yy, lines[0])
    for ln in big:
        while pdfmetrics.stringWidth(ln, "Oswald-Bold", size) > w - 40:
            size -= 2
        yy -= size + 2
        c.setFont("Oswald-Bold", size)
        c.drawCentredString(x0 + w / 2, yy, ln)
    c.setFillColor(ACC)
    c.setFont("BarlowCondensed-Bold", 16)
    c.drawCentredString(x0 + w / 2, y0 + 26, f"{meta.get('category', '').upper()}  •  BOOK {meta['num']:02d} OF {meta['of']}")
    c.restoreState()


def _chalk(c, ox, oy, s, defense):
    c.saveState()
    c.setStrokeColor(colors.white); c.setFillColor(colors.white)
    c.setStrokeAlpha(0.16); c.setFillAlpha(0.16)
    c.setLineWidth(2.2)
    for i in range(-2, 3):
        c.circle(ox + i * 2.3 * s, oy, 0.9 * s, fill=0, stroke=1)
    for (x, y) in [(0, -2.6), (0, -5.4), (-13, 0), (13, -0.6)]:
        c.circle(ox + x * s, oy + y * s, 0.9 * s, fill=0, stroke=1)
    for (x, y) in [(-3.4, 2.4), (-1.1, 2.4), (1.1, 2.4), (3.4, 2.4), (-6, 6), (0, 6.5), (6, 6), (-12, 7), (12, 7)]:
        px, py, d = ox + x * s, oy + y * s, 0.7 * s
        c.line(px - d, py - d, px + d, py + d)
        c.line(px - d, py + d, px + d, py - d)
    c.setStrokeColor(ACC); c.setStrokeAlpha(0.6); c.setLineWidth(3)
    p = c.beginPath()
    if defense:
        p.moveTo(ox - 6 * s, oy + 6 * s); p.curveTo(ox - 4 * s, oy + 3 * s, ox - 2.4 * s, oy + 1 * s, ox - 1.6 * s, oy - 2.4 * s)
    else:
        p.moveTo(ox, oy - 5.4 * s); p.curveTo(ox + 3 * s, oy - 3 * s, ox + 5 * s, oy + 1 * s, ox + 5.5 * s, oy + 8 * s)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


# ------------------------------------------------------- offense breakdowns
_BLOCK_CUES = {
    "down": ["<b>Down block</b> — inside gap", "Inside foot first, hat across", "No penetration inside"],
    "back": ["<b>Back block</b> — backside A-gap", "Cover up for the pulling guard", "Wall him off"],
    "base": ["<b>Base block</b> — man on you", "Strike with hands inside", "Drive him off the ball"],
    "reach": ["<b>Reach block</b> playside", "Bucket step, aim for the outside number", "Seal him inside"],
    "zone": ["<b>Zone step</b> playside", "Covered: work his playside number", "Uncovered: double, climb to the LB"],
    "climb": ["<b>Climb</b> to the 2nd level", "Take the first linebacker", "Inside-out leverage"],
    "hinge": ["<b>Hinge</b> — protect the backside", "Step inside, then kick back", "Nothing crosses your face"],
    "cut": ["<b>Cutoff</b> the backside", "Flat step down the line", "Wall off pursuit"],
    "pull_kick": ["<b>Pull &amp; kick out</b> the end man", "Pull flat — don't drift", "Inside-out, drive him to the sideline"],
    "pull_wrap": ["<b>Pull &amp; wrap</b> through the hole", "Read the kick-out block", "Take the first color (LB)"],
    "pull_lead": ["<b>Pull &amp; lead</b> to the edge", "Turn up at the corner", "Block the first threat outside"],
    "trap": ["<b>Trap</b> the first DL past the center", "Pull flat, inside-out", "Low man wins"],
    "wedge": ["<b>Wedge</b> on the center's hip", "Shoulder to shoulder", "Move the pile 3 yards"],
    "arc": ["<b>Arc release</b>", "Gain width, then climb", "Block the alley defender"],
    "kick": ["<b>Kick out</b> the end man", "Attack inside-out", "Inside shoulder, drive him out"],
    "lead": ["<b>Lead</b> through the hole", "Hit it downhill, full speed", "Take the first linebacker"],
    "lead_edge": ["<b>Lead</b> on the edge", "Log him if he squeezes", "Kick him if he widens"],
    "seal": ["<b>Seal</b> the linebacker", "Block down on the first LB inside", "Take away his scrape"],
    "stalk": ["<b>Stalk block</b> the corner", "Sell vertical, break down at 5", "Stay between your man and the ball"],
    "crack": ["<b>Crack block</b>", "Release inside", "Hit in front, above the waist"],
    "run_off": ["<b>Run off</b> the corner", "Take him deep", "Cut off the safety's angle"],
    "pro": ["<b>Pass pro</b>", "Set, hands ready", "Inside-out — no free rushers"],
    "pa_pro": ["<b>Play-action pro</b>", "Fire out low like it's run", "Then set and protect"],
    "fill": ["<b>Fill</b> for the puller", "Step into the vacated gap", "Block the first defender to show"],
    "screen": ["<b>Screen release</b>", "Set for a 1-count, let him go", "Release flat and set the wall"],
    "leave": ["<b>Leave the read defender</b>", "Release inside to the 2nd level", "Do NOT block the read"],
    "protect": ["<b>Protect</b>", "Check your gap inside-out", "Then the edge — stay in"],
}
_TEXT_TO_CUES = {O.BLOCK[k]: v for k, v in _BLOCK_CUES.items() if k in O.BLOCK}
_TEXT_TO_CUES[O.ROUTE_TXT["protect"]] = _BLOCK_CUES["protect"]
_TEXT_TO_CUES[O.ROUTE_TXT["block"]] = _BLOCK_CUES["protect"]


def _sentences(t):
    t = re.sub(r"\s+", " ", t.strip())
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", t)
    return [p.rstrip(".") for p in parts if p]


def offense_lines(text, play):
    if text in _TEXT_TO_CUES:
        return _TEXT_TO_CUES[text]
    m = re.match(r"^([A-Z][A-Z &'/\-]+):\s*(.*)$", text)
    if not m:
        return [f"<b>{_sentences(text)[0]}</b>"] + _sentences(text)[1:3]
    title, rest = m.group(1).strip(), m.group(2)
    sents = _sentences(rest)
    if title == "BALL CARRIER":
        hole = re.search(r"Aiming point: (.*?)\.?$", rest)
        lines = [f"<b>Ball carrier — {hole.group(1) if hole else 'hit the hole'}</b>"]
        steps = play.steps[0][1] if play.steps else []
        lines += [s.rstrip(".") for s in (steps[1:2] + steps[-1:])]
        return lines
    if title in ("QB", "PASSER"):
        return [f"<b>{sents[0]}</b>"] + sents[1:3]
    nice = title.title().replace("&", "&amp;")
    if text in O.ROUTE_TXT.values():
        return [f"<b>{nice}</b> route"] + sents[:2]
    return [f"<b>{nice}</b>"] + sents[:3]


def offense_blocks(play):
    out = []
    for name, text in play.assignments:
        lab, _, full = name.partition(" – ")
        out.append((f"{full} ({lab})", offense_lines(text, play)))
    return out


def split_summary(what):
    s = _sentences(what)
    if len(s) == 1 and ":" in s[0]:
        a, b = s[0].split(":", 1)
        return a + ":", b.strip() + "."
    return s[0] + ".", " ".join(x + "." for x in s[1:])


# ------------------------------------------------------------------ legends
def _mini(w, h, xmax=4.5, ymin=-1.6, ymax=1.6, flip=False):
    return Diagram(w, xmax=xmax, ymin=ymin, ymax=ymax, theme="slides", hashes=False, los=False, height=h, flip=flip)


def legend_defense():
    def man(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.o(0, -1.1); D.d(0, 1.1); D.path([(0, 1.1), (0, -1.1)], style="man", end="none"); return D

    def deep(w, h):
        D = _mini(w, h, flip=True); D.zone(0, 0, 3.6, 1.1); D.d(0, 0); return D

    def zone(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.zone(1.0, 1.0, 2.8, 1.1); D.d(-2.5, -1.2); D.path([(-2.5, -1.2), (0.6, 0.6)], style="drop"); return D

    def rush(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.o(0, -1.2); D.d(-0.8, 1.0); D.path([(-0.8, 1.0), (-0.5, -0.3)], style="dgap"); return D

    def blitz(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.d(-2, 1.4); D.path([(-2, 1.4), (-0.3, 0.6), (0.4, -1.8)], style="blitz", smooth=True); return D

    def twist(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.d(-2, 1.2); D.path([(-2, 1.2), (-0.4, 1.0), (0.6, -0.9)], style="stunt", smooth=True); return D

    def spy(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.d(0, 0); D.ring(0, 0, ""); return D

    def creep(w, h):
        D = _mini(w, h, ymin=-2.2, ymax=2.2, flip=True); D.d(-1.5, 1.6); D.path([(-1.5, 1.6), (-1.5, -0.8)], style="drop")
        D.d(1.5, -1.2); D.path([(1.5, -1.2), (1.5, 1.4)], style="drop"); return D
    return [[("Man coverage", man), ("Deep middle (Cover 1 / Cover 3 safety)", deep), ("Zone drop", zone), ("Gap rush", rush)],
            [("Blitz", blitz), ("Twist / stunt", twist), ("Quarterback spy", spy), ("Creep up / creep back", creep)]]


def legend_offense():
    def blk(w, h):
        D = _mini(w, h); D.o(-1.5, -0.8); D.path([(-1.5, -0.8), (0.5, 0.8)], end="t"); return D

    def carrier(w, h):
        D = _mini(w, h); D.o(-3, -0.8, "", "key"); D.path([(-3, -0.8), (0, -0.2), (2.5, 1.2)], style="run", smooth=True); return D

    def route(w, h):
        D = _mini(w, h); D.o(-3, -0.8); D.path([(-3, -0.8), (-3, 1.0), (1.5, 1.0)]); return D

    def motion(w, h):
        D = _mini(w, h); D.o(-3.4, 0); D.path([(-3.4, 0), (2.0, 0), (3.6, 1.0)], motion=1); return D

    def fake(w, h):
        D = _mini(w, h); D.o(-2.5, 0); D.path([(-2.5, 0), (2.5, 0.6)], style="dot", end="arrow"); return D

    def read(w, h):
        D = _mini(w, h); D.d(0, 0, "", "ghost"); D.ring(0, 0, ""); return D

    def pitch(w, h):
        D = _mini(w, h); D.o(-3, -0.6); D.path([(-3, -0.6), (2.5, 0.8)], style="dash"); return D

    def ghost(w, h):
        D = _mini(w, h); D.d(-1.5, 0, "", "ghost"); D.d(1.5, 0, "", "ghost"); return D
    return [[("Block", blk), ("Ball carrier", carrier), ("Route", route), ("Pre-snap motion", motion)],
            [("Fake / ball handling", fake), ("Option / pitch path", pitch), ("Read defender (unblocked)", read), ("Defensive look", ghost)]]


# ------------------------------------------------------------------- decks
KEEP_UPPER = {"RT", "LT", "DW", "UNB", "QB", "RB", "RPO", "PA", "I", "II", "T", "H", "F", "Y", "X", "Z", "S", "W", "GL"}


def nice(call):
    out = []
    for w in call.split():
        if any(ch.isdigit() for ch in w) or w in KEEP_UPPER or (len(w) <= 2 and w.isalpha() and w.isupper()):
            out.append(w)
        elif w == "VS":
            out.append("vs")
        elif w.startswith("("):
            out.append("(" + w[1:].capitalize())
        elif "-" in w:
            out.append("-".join(x.capitalize() if not any(ch.isdigit() for ch in x) and x not in KEEP_UPPER else x for x in w.split("-")))
        else:
            out.append(w.capitalize())
    return " ".join(out)


def play_slides(deck, p, num, blocks=None):
    deck.diagram_slide(nice(p.call), lambda w, h, p=p: p.diagram_fn(w, theme="slides", height=h),
                       outline=f"{num:02d}. {p.call}")
    bold, rest = split_summary(p.what)
    rest = (rest + " " if rest else "") + f"Best against: {p.best}"
    deck.breakdown(f"{p.call} – {p.title}" if p.title.upper() not in p.call.upper() else p.call, bold, rest,
                   blocks if blocks is not None else (p.blocks or offense_blocks(p)))
    if STEP_SLIDES:
        deck.steps_slide(nice(p.call), p.steps, p.points, p.best, p.pairs)


def offense_deck(path, meta, spec):
    plays = spec["plays"]()
    d = Deck(path, meta)
    d.cover()
    base = plays[0]
    d.benefits(f"Benefits of the {meta['title']}", spec["why"], visual=lambda w, h: base.diagram_fn(w, theme="slides", height=h))
    d.philosophy(f"{brand.BRAND} Philosophy", spec["hook"], spec["philosophy"][0], spec["why"],
                 visual=lambda w, h: plays[min(1, len(plays) - 1)].diagram_fn(w, theme="slides", height=h))
    # hole numbering
    d.mark("Terminology & numbering")
    y = d.heavy_title("Hole Numbering & Play Calling", size=34, top=H - 64)

    def holes(w, h):
        D = Diagram(w, xmax=11, ymin=-3.4, ymax=2.4, theme="slides", hashes=False, los=False, height=h)
        f = FM.get("I_TIGHT")
        for k, (x, yy, r) in f.items():
            if r in ("OL", "TE"):
                D.o(x, yy, "" if r == "OL" else k, "center" if k == "C" else "o")
        D.o(0, -2.4, "Q")
        for n, x in [(0, 0.75), (1, -0.75), (2, 2.25), (3, -2.25), (4, 3.75), (5, -3.75), (6, 5.4), (7, -5.4), (8, 8.5), (9, -8.5)]:
            D.text(x, 0.9, str(n), size=18)
        return D
    dia = holes(W - 2 * M, 190)
    d.draw_diagram(dia, W / 2, y - 14)
    ex = spec.get("example", ["I RT", "—", "24", "POWER"])
    d.para(f"<b>Even numbers go right, odd numbers go left.</b> 0/1 = A gap • 2/3 = B gap • 4/5 = C gap (off tackle) "
           f"• 6/7 = D gap • 8/9 = the edge.<br/><b>Backs:</b> 1 = QB, 2 = tailback, 3 = fullback, 4 = wing/halfback. "
           f"First digit = ball carrier, second digit = hole.<br/><b>Call structure:</b> FORMATION → (MOTION) → BACK + HOLE "
           f"→ SCHEME. Example: <b>{ex[0]} {ex[2]} {ex[3]}</b>.<br/><b>Pass series:</b> 60s quick game • 70s drop-back "
           f"• 80s play-action • 90s sprint/boot.",
           M, y - 14 - dia.height - 10, W - 2 * M, S("hn", fontSize=14, leading=19))
    d.end()
    for chunk in legend_offense():
        d.legend("Terminology", chunk)
    # formations
    for key, name in spec["formations"]:
        fm = FM.get(key)
        d.mark(f"Formation: {name}")
        yy = d.thin_title(f"Formation: {name}", align="left", size=32, top=H - 66)

        def fd(w, h, key=key):
            f = FM.get(key)
            D = Diagram(w, xmax=17.5, ymin=-8.0, ymax=1.4, theme="slides", hashes=False, los=False, height=h)
            for k, (x, y_, r) in f.items():
                D.o(x, y_, "" if r == "OL" else k, "center" if k == "C" else "o")
            return D
        dia = fd(W - 2 * M, 220)
        d.draw_diagram(dia, W / 2, yy - 10)
        from .books_offense import align_rule
        rows = [f"<b>{k}:</b> {align_rule(k, *fm[k], fm)}" for k in ["Q", "B", "T", "F", "H", "W", "Y", "X", "Z", "S"] if k in fm]
        half = (len(rows) + 1) // 2
        bt = yy - 10 - dia.height - 14
        for i, col in enumerate([rows[:half], rows[half:]]):
            cx = M + i * (W - 2 * M) / 2
            d.para("<br/>".join(col), cx + 8, bt - 8, (W - 2 * M) / 2 - 16, S("al", fontSize=12.5, leading=17))
        d.box(M - 4, 30, W - 2 * M + 8, bt - 30)
        d.end()
    for i, p in enumerate(plays, 1):
        play_slides(d, p, i)
    _closing_tables(d, plays)
    d.cta()
    d.save()


def _closing_tables(d, plays):
    rows = [["WEEK", "NEW INSTALL"]]
    by = {}
    for p in plays:
        by.setdefault(p.week, []).append(p.call)
    for wk in sorted(by):
        rows.append([f"Week {wk}", ", ".join(by[wk])])
    d.table_slide("Installation Plan", "Install in layers. Add a call only when last week's calls are run clean at full speed. "
                  "Every practice: <b>Indy</b> → <b>Group</b> → <b>Team</b>.", rows, [90, W - 2 * M - 90], font=14,
                  outline="Installation plan")
    cells = [f"<b>{i:02d}</b>&nbsp; {p.call}" for i, p in enumerate(plays, 1)]
    while len(cells) % 3:
        cells.append("<b>__</b>&nbsp; ______________")
    cells += ["<b>__</b>&nbsp; ______________"] * 3
    rows = [["WRISTBAND", "", ""]] + [cells[i:i + 3] for i in range(0, len(cells), 3)]
    d.table_slide("Wristband Card", "Signal the number — the call is run exactly as written. Fill the blanks with your game-plan specials.",
                  rows, [(W - 2 * M) / 3] * 3, font=13, outline="Wristband")


def defense_deck(path, meta, spec):
    from .books_defense import COV
    from .defense import TECH_TXT, D as DD
    calls = spec["calls"]()
    d = Deck(path, meta)
    d.cover()
    base = calls[0]
    d.benefits(f"Benefits of the {meta['title']}", spec["why"], visual=lambda w, h: base.diagram_fn(w, theme="slides", height=h))
    d.philosophy(f"{brand.BRAND} Philosophy", spec["hook"], spec["philosophy"][0],
                 ["Win the line of scrimmage.", "Own your gap — every snap.", "Eleven hats to the football.",
                  "Shut down their best player.", "Hunt the football."],
                 visual=lambda w, h: calls[1].diagram_fn(w, theme="slides", height=h))
    # technique & gap chart
    d.mark("Techniques & gaps")
    y = d.heavy_title("Defensive Alignment Techniques & Gaps", size=34, top=H - 64)
    front = spec["front"]

    def chart(w, h):
        dd = DD("I_PRO")
        D = Diagram(w, xmax=17.5, ymin=-7.4, ymax=13.5, theme="slides", hashes=False, los=False, height=h, flip=True)
        for k, (x, yy, r) in dd.f.items():
            if k != "X" and k != "Z":
                D.o(x, yy, "", "center" if k == "C" else "o")
        D.o(-15, -0.8)
        D.o(13, -0.8)
        tx = {"0": [0], "1": [-0.6, 0.6], "2i": [-1.05, 1.05], "2": [-1.5, 1.5], "3": [-2.1, 2.1], "4i": [-2.6, 2.6],
              "4": [-3.0, 3.0], "5": [-3.6, 3.6], "7": [-4.1, 4.1], "6": [-4.5, 4.5], "9": [-5.2, 5.2]}
        for t, xs in tx.items():
            for xx in xs:
                D.text(xx, 0.45 + (0.5 if t in ("1", "2i", "4i", "7") else 0), t, size=9)
        for g, xx in [("A", 0.75), ("B", 2.25), ("C", 3.75), ("D", 5.3)]:
            D.text(xx, -1.0, g, size=12)
            D.text(-xx, -1.0, g, size=12)
        for lab, (pos, sp, run) in front.items():
            x, yy = dd.pos(sp)
            yy = min(yy, 10.5)
            D.d(x, yy + 1.0, lab)
            D.text(x, yy + 2.6, pos.split(" (")[0], size=7.5, bold=False)
        return D
    dia = chart(W - 2 * M, y - 50)
    d.draw_diagram(dia, W / 2, y - 10)
    d.end()
    d.text_slide("Defensive Alignment Techniques & Gaps Explained",
                 f"The <b>{meta['title']}</b> is built on <b>discipline, leverage and relentless effort</b>. Every lineman and linebacker "
                 "must know their <b>technique number</b> (where they align on an offensive player) and their <b>gap responsibility</b> "
                 "(the space between offensive linemen they own). That's how eleven players play as one.",
                 [("Gaps", "Gaps are lettered from the <b>center outward</b>:<br/><b>A gap:</b> between the center and guard<br/>"
                           "<b>B gap:</b> between the guard and tackle<br/><b>C gap:</b> between the tackle and tight end<br/>"
                           "<b>D gap:</b> outside the tight end"),
                  ("Goal", f"Every defender owns a gap — no over-pursuit, no freelancing. "
                           f"If every player controls his gap, the {brand.BRAND} defense controls the line of scrimmage.")])
    rows = [["Technique", "Alignment"]] + [[k, v.split(": ", 1)[-1][0].upper() + v.split(": ", 1)[-1][1:]] for k, v in TECH_TXT.items()]
    d.table_slide("Technique Numbers", "<b>Technique numbers</b> tell a defender exactly where to align on an offensive player. "
                  "They're numbered from the inside out, starting with the center.", rows, [140, W - 2 * M - 140], font=13)
    for chunk in legend_defense():
        d.legend("Terminology", chunk)
    for i, cl in enumerate(calls, 1):
        play_slides(d, cl, i)
    _closing_tables(d, calls)
    d.cta()
    d.save()


def seven_deck(path, meta, spec):
    from .books_special import seven_plays, seven_defense
    plays, dcalls = seven_plays(), seven_defense()
    d = Deck(path, meta)
    d.cover()
    d.benefits("Benefits of 7v7", ["Hundreds of live reps vs real coverage every summer.",
                                   "Same concepts and language as your fall offense.",
                                   "Quarterback decisions graded on every snap.",
                                   "Your secondary's best offseason teacher."],
               visual=lambda w, h: plays[0].diagram_fn(w, theme="slides", height=h))
    for chunk in legend_offense():
        d.legend("Terminology", chunk)
    for i, p in enumerate(plays, 1):
        play_slides(d, p, i)
    for chunk in legend_defense():
        d.legend("Terminology", chunk)
    for i, c in enumerate(dcalls, len(plays) + 1):
        play_slides(d, c, i)
    _closing_tables(d, plays)
    d.cta()
    d.save()


def drill_deck(path, meta, spec):
    from . import books_special as BS
    BS.DRILL_THEME = "slides"
    d = Deck(path, meta)
    d.cover()
    d.benefits("Benefits of the Blocking Drillbook", ["Every block in every scheme, taught from the ground up.",
                                                      "Fundamentals first: stance, get-off, hands, leg drive.",
                                                      "Step-by-step instructions and the most common mistakes with fixes.",
                                                      "A ready-made in-season blocking circuit."])
    for i, dr in enumerate(BS.DRILLS, 1):
        d.diagram_slide(dr.name, lambda w, h, dr=dr: _fit_drill(dr, w, h), outline=f"{i:02d}. {dr.name}", level=0)
        blocks = [("Purpose", [dr.purpose]), ("Setup", [dr.setup]), ("Time / groups", [f"{dr.time} • {dr.players}"]),
                  ("Progression", [dr.progression]),
                  ("Step-by-step", [f"{j}. {s}" for j, s in enumerate(dr.steps, 1)]),
                  ("Coaching points", dr.points),
                  ("Common mistakes → fixes", [f"{a} → {b}" for a, b in dr.errors])]
        d.breakdown(f"Drill {i:02d}: {dr.name}", dr.purpose, f"Category: {dr.cat}.", blocks)
    BS.DRILL_THEME = "print"
    d.cta()
    d.save()


def _fit_drill(dr, w, h):
    dia = dr.draw(w)
    if dia.height > h:
        dia = dr.draw(w * h / dia.height)
    return dia
