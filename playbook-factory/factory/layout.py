"""PDF layout: covers, page chrome, typography and the reusable page builders."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepInFrame, KeepTogether, NextPageTemplate, Flowable, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from . import brand

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(HERE, "fonts")
for fn in os.listdir(FONT_DIR):
    if fn.endswith(".ttf"):
        try:
            pdfmetrics.registerFont(TTFont(fn[:-4], os.path.join(FONT_DIR, fn)))
        except Exception:
            pass
SYMBOLS = "\u25A0\u2192\u25A2\u25CB\u25CF\u2713\u2605\u25B6\u2190\u2191\u2193\u2194"


def sym(text):
    """Route glyphs the brand fonts lack to the bundled DejaVu symbol font."""
    if not isinstance(text, str):
        return text
    for ch in SYMBOLS:
        if ch in text:
            text = text.replace(ch, f'<font name="Sym-DejaVuSans">{ch}</font>')
    return text


pdfmetrics.registerFontFamily("Barlow", normal="Barlow-Regular", bold="Barlow-Bold",
                              italic="Barlow-Italic", boldItalic="Barlow-Bold")

INK = colors.HexColor(brand.INK)
ACC = colors.HexColor(brand.ACCENT)
ACC_D = colors.HexColor(brand.ACCENT_DARK)
STEEL = colors.HexColor(brand.STEEL)
LIGHT = colors.HexColor("#F1F1EE")
RULE = colors.HexColor("#D9D9D4")

PAGE_W, PAGE_H = letter
M = 0.6 * inch
CONTENT_W = PAGE_W - 2 * M

ST = {
    "h1": ParagraphStyle("h1", fontName="Oswald-Bold", fontSize=26, leading=30, textColor=INK, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Oswald-Bold", fontSize=16, leading=20, textColor=INK, spaceBefore=10, spaceAfter=4),
    "h3": ParagraphStyle("h3", fontName="BarlowCondensed-ExtraBold", fontSize=12.5, leading=15, textColor=ACC_D,
                         spaceBefore=8, spaceAfter=3),
    "kicker": ParagraphStyle("kicker", fontName="BarlowCondensed-Bold", fontSize=10, leading=12, textColor=ACC),
    "body": ParagraphStyle("body", fontName="Barlow-Regular", fontSize=10, leading=14, textColor=INK, spaceAfter=6),
    "lead": ParagraphStyle("lead", fontName="Barlow-Regular", fontSize=12, leading=17, textColor=INK, spaceAfter=8),
    "small": ParagraphStyle("small", fontName="Barlow-Regular", fontSize=8.4, leading=10.6, textColor=INK),
    "smallb": ParagraphStyle("smallb", fontName="BarlowCondensed-Bold", fontSize=9, leading=10.8, textColor=INK),
    "tiny": ParagraphStyle("tiny", fontName="Barlow-Regular", fontSize=7.5, leading=9.2, textColor=STEEL),
    "cell": ParagraphStyle("cell", fontName="Barlow-Regular", fontSize=8.6, leading=10.8, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="BarlowCondensed-Bold", fontSize=9.4, leading=11, textColor=INK),
    "playcall": ParagraphStyle("playcall", fontName="Oswald-Bold", fontSize=21, leading=24, textColor=INK),
    "toc0": ParagraphStyle("toc0", fontName="Barlow-SemiBold", fontSize=11, leading=17, textColor=INK),
    "toc1": ParagraphStyle("toc1", fontName="Barlow-Regular", fontSize=9.5, leading=13, leftIndent=14, textColor=STEEL),
    "quote": ParagraphStyle("quote", fontName="Oswald-SemiBold", fontSize=15, leading=20, textColor=ACC_D,
                            spaceBefore=6, spaceAfter=10),
}


def P(text, style="body"):
    return Paragraph(sym(text), ST[style] if isinstance(style, str) else style)


def bullets(items, style="body", bullet="\u2022"):
    out = []
    for it in items:
        out.append(Paragraph(f'<font color="{brand.ACCENT}">{bullet}</font>&nbsp;&nbsp;{sym(it)}',
                             ParagraphStyle("b", parent=ST[style], leftIndent=12, firstLineIndent=-12, spaceAfter=3)))
    return out


def numbered(items, style="body"):
    out = []
    for i, it in enumerate(items, 1):
        out.append(Paragraph(f'<font name="BarlowCondensed-ExtraBold" color="{brand.ACCENT}">{i}.</font>&nbsp; {sym(it)}',
                             ParagraphStyle("n", parent=ST[style], leftIndent=14, firstLineIndent=-14, spaceAfter=3)))
    return out


class Bar(Flowable):
    """Thin accent rule."""
    def __init__(self, width=CONTENT_W, h=3, color=ACC):
        super().__init__()
        self.width, self.height, self.color = width, h + 4, color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 2, self.width, self.height - 4, fill=1, stroke=0)


class Chip(Flowable):
    def __init__(self, text, color=INK, fg=colors.white, size=8):
        super().__init__()
        self.text, self.color, self.fg, self.size = text, color, fg, size
        self.width = pdfmetrics.stringWidth(text, "BarlowCondensed-Bold", size) + 10
        self.height = size + 6

    def draw(self):
        c = self.canv
        c.setFillColor(self.color)
        c.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=0)
        c.setFillColor(self.fg)
        c.setFont("BarlowCondensed-Bold", self.size)
        c.drawString(5, 3.4, self.text)


def chips(texts):
    cells = [Chip(t, color=(ACC if i == 0 else INK)) for i, t in enumerate(texts)]
    t = Table([cells], colWidths=[c.width + 4 for c in cells], hAlign="LEFT")
    t.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                           ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return t


def section(title, kicker=None, toc=True, level=0):
    items = []
    if kicker:
        items.append(P(kicker.upper(), "kicker"))
    h = Paragraph(title, ST["h1"] if level == 0 else ST["h2"])
    if toc:
        h._toc = (level, title)
    items += [h, Bar(), Spacer(1, 8)]
    return items


def grid(rows, widths, header=True, zebra=True, style_extra=(), font="cell"):
    hdr = ParagraphStyle("hdr", parent=ST["cellb"], textColor=colors.white)
    data = []
    for r, row in enumerate(rows):
        data.append([c if isinstance(c, Flowable) else
                     Paragraph(sym(str(c)), hdr if (header and r == 0) else ST[font]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    cmds = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5)]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), INK), ("LINEBELOW", (0, 0), (-1, 0), 1.2, ACC)]
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if i % 2 == 0:
                cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    cmds += list(style_extra)
    t.setStyle(TableStyle(cmds))
    return t


class Anchor(Flowable):
    """Zero-size flowable that registers a TOC/outline entry."""
    def __init__(self, level, text):
        super().__init__()
        self._toc = (level, text)
        self.width = self.height = 0

    def draw(self):
        pass


# ------------------------------------------------------------------ document
class BookDoc(BaseDocTemplate):
    def __init__(self, path, book, landscape=False):
        self.landscape = landscape
        ps = (960, 540) if landscape else letter
        super().__init__(path, pagesize=ps, leftMargin=M, rightMargin=M, topMargin=M + 0.25 * inch,
                         bottomMargin=M + 0.1 * inch, title=f"{brand.BRAND} {book['title']}",
                         author=brand.AUTHOR, subject=book.get("subtitle", ""), creator=f"{brand.BRAND} Playbook Factory")
        self.book = book
        if landscape:
            frame = Frame(48, 40, 960 - 96, 540 - 40 - 44, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
            cover, chrome = self._cover_slide, self._chrome_slide
        else:
            frame = Frame(M, M + 0.1 * inch, CONTENT_W, PAGE_H - 2 * M - 0.35 * inch, id="f", leftPadding=0,
                          rightPadding=0, topPadding=0, bottomPadding=0)
            cover, chrome = self._cover, self._chrome
        self.addPageTemplates([PageTemplate("cover", [frame], onPage=cover),
                               PageTemplate("body", [frame], onPage=chrome)])

    def _cover_slide(self, c, doc):
        from .slides import draw_cover_panel, img_path
        b = self.book
        Wd, Hd = 960, 540
        split = Wd * 0.575
        cov = img_path(brand.COVER_IMAGE)
        if cov:
            c.drawImage(cov, 0, 0, split, Hd, preserveAspectRatio=False)
        else:
            draw_cover_panel(c, 0, 0, split, Hd, b)
        st = ParagraphStyle("ct", fontName="Barlow-Bold", fontSize=40, leading=44, textColor=ACC, alignment=1)
        title = b["title"] if b["title"].lower().startswith("the ") else "The " + b["title"]
        p = Paragraph(title, st)
        rw = Wd - split - 60
        _, ph = p.wrap(rw, Hd)
        top = Hd / 2 + ph / 2 + 40
        p.drawOn(c, split + 30, top - ph)
        a = Paragraph(brand.AUTHOR, ParagraphStyle("ca", fontName="Barlow-Regular", fontSize=14, leading=18, alignment=1))
        _, ah = a.wrap(rw, 100)
        a.drawOn(c, split + 30, top - ph - 8 - ah)

    def _chrome_slide(self, c, doc):
        c.saveState()
        c.setFont("Barlow-Regular", 9)
        c.setFillColor(colors.HexColor("#8A9099"))
        c.drawRightString(960 - 52, 16, str(doc.page))
        c.restoreState()

    def afterFlowable(self, f):
        if hasattr(f, "_toc"):
            level, text = f._toc
            key = f"s{self.seq.nextf('toc')}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=True)
            self.notify("TOCEntry", (level, text, self.page, key))

    def _chrome(self, c, doc):
        b = self.book
        c.saveState()
        c.setFillColor(INK)
        c.rect(0, PAGE_H - 0.42 * inch, PAGE_W, 0.42 * inch, fill=1, stroke=0)
        c.setFillColor(ACC)
        c.rect(0, PAGE_H - 0.46 * inch, PAGE_W, 0.04 * inch, fill=1, stroke=0)
        c.setFont("Oswald-Bold", 11)
        c.setFillColor(colors.white)
        c.drawString(M, PAGE_H - 0.28 * inch, brand.BRAND)
        w = pdfmetrics.stringWidth(brand.BRAND, "Oswald-Bold", 11)
        c.setFont("BarlowCondensed-SemiBold", 10)
        c.setFillColor(colors.HexColor("#C9CDD3"))
        c.drawString(M + w + 8, PAGE_H - 0.28 * inch, b["title"].upper())
        c.setFillColor(ACC)
        c.setFont("BarlowCondensed-ExtraBold", 10)
        c.drawRightString(PAGE_W - M, PAGE_H - 0.28 * inch, f"BOOK {b['num']:02d}")
        c.setFont("Barlow-Regular", 7)
        c.setFillColor(STEEL)
        c.drawString(M, 0.42 * inch, brand.LICENSE_LINE)
        c.setFont("BarlowCondensed-Bold", 9)
        c.setFillColor(INK)
        c.drawRightString(PAGE_W - M, 0.42 * inch, str(doc.page))
        c.restoreState()

    def _cover(self, c, doc):
        b = self.book
        c.saveState()
        c.setFillColor(INK)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # diagonal forge stripes
        c.setFillColor(colors.HexColor("#1B1E23"))
        for i in range(-6, 14):
            x = i * 0.9 * inch
            p = c.beginPath()
            p.moveTo(x, 0); p.lineTo(x + 0.35 * inch, 0); p.lineTo(x + 0.35 * inch + PAGE_H * 0.45, PAGE_H)
            p.lineTo(x + PAGE_H * 0.45, PAGE_H); p.close()
            c.drawPath(p, fill=1, stroke=0)
        _cover_art(c, b)
        c.setFillColor(ACC)
        c.rect(0, PAGE_H * 0.47, PAGE_W, 0.09 * inch, fill=1, stroke=0)
        # brand + book number
        c.setFillColor(colors.white)
        c.setFont("Oswald-Bold", 22)
        c.drawString(M, PAGE_H - 1.0 * inch, brand.BRAND)
        c.setFont("BarlowCondensed-SemiBold", 12)
        c.setFillColor(colors.HexColor("#AEB4BC"))
        c.drawString(M, PAGE_H - 1.27 * inch, f"{brand.COLLECTION.upper()}  •  {brand.EDITION.upper()}")
        c.setFillColor(ACC)
        c.setFont("Oswald-Bold", 64)
        c.drawRightString(PAGE_W - M, PAGE_H - 1.25 * inch, f"{b['num']:02d}")
        c.setFont("BarlowCondensed-Bold", 10)
        c.setFillColor(colors.HexColor("#AEB4BC"))
        c.drawRightString(PAGE_W - M, PAGE_H - 1.5 * inch, f"BOOK {b['num']} OF {b['of']}")
        # category
        c.setFillColor(ACC)
        c.setFont("BarlowCondensed-ExtraBold", 15)
        c.drawString(M, PAGE_H * 0.47 + 0.45 * inch, b["category"].upper())
        # title (auto-shrink)
        title = b["title"].upper()
        size = 64
        while pdfmetrics.stringWidth(title, "Oswald-Bold", size) > CONTENT_W and size > 30:
            size -= 2
        lines = [title]
        if size <= 30:
            words = title.split()
            half = len(words) // 2
            lines = [" ".join(words[:half]), " ".join(words[half:])]
            size = 48
            while max(pdfmetrics.stringWidth(l, "Oswald-Bold", size) for l in lines) > CONTENT_W:
                size -= 2
        c.setFillColor(colors.white)
        c.setFont("Oswald-Bold", size)
        y = PAGE_H * 0.47 - 0.25 * inch - size
        for l in lines:
            c.drawString(M, y, l)
            y -= size * 1.05
        c.setFont("Barlow-Regular", 14)
        c.setFillColor(colors.HexColor("#D5D9DE"))
        y -= 6
        for line in _wrap(b.get("subtitle", ""), "Barlow-Regular", 14, CONTENT_W):
            c.drawString(M, y, line)
            y -= 19
        # footer
        c.setFillColor(ACC)
        c.rect(M, 1.25 * inch, 0.6 * inch, 0.05 * inch, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("BarlowCondensed-Bold", 13)
        c.drawString(M, 0.98 * inch, brand.AUTHOR)
        c.setFont("Barlow-Italic", 10)
        c.setFillColor(colors.HexColor("#AEB4BC"))
        c.drawString(M, 0.75 * inch, brand.TAGLINE)
        c.setFont("Barlow-Regular", 8)
        c.drawRightString(PAGE_W - M, 0.75 * inch, f"{brand.LEVEL}  •  {brand.WEBSITE}")
        c.restoreState()


def _cover_art(c, b):
    """Faint chalk-talk diagram in the upper half of every cover."""
    import math
    c.saveState()
    s = 15.0
    ox, oy = PAGE_W / 2, PAGE_H * 0.47 + 1.55 * inch
    c.setStrokeColor(colors.white)
    c.setFillColor(colors.white)
    c.setStrokeAlpha(0.13)
    c.setFillAlpha(0.13)
    c.setLineWidth(2.2)
    c.setDash(6, 5)
    c.line(0.3 * inch, oy + 0.9 * s, PAGE_W - 0.3 * inch, oy + 0.9 * s)
    c.setDash()
    defense = b.get("category", "").lower() == "defense"
    for i in range(-2, 3):
        c.circle(ox + i * 2.3 * s, oy, 0.85 * s, fill=0, stroke=1)
    for (x, y) in [(0, -2.6), (0, -5.6), (-14, 0), (14, -0.6)]:
        c.circle(ox + x * s, oy + y * s, 0.85 * s, fill=0, stroke=1)
    for (x, y) in [(-3.4, 2.3), (-1.1, 2.3), (1.1, 2.3), (3.4, 2.3), (-6, 6), (0, 6.5), (6, 6), (-13, 7), (13, 7), (-6, 11), (6, 11)]:
        px, py = ox + x * s, oy + y * s
        d = 0.65 * s
        c.line(px - d, py - d, px + d, py + d)
        c.line(px - d, py + d, px + d, py - d)

    def arrow(pts, w=2.4, acc=False):
        if acc:
            c.setStrokeColor(ACC); c.setFillColor(ACC); c.setStrokeAlpha(0.55); c.setFillAlpha(0.55)
        c.setLineWidth(w)
        p = c.beginPath()
        p.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (x, y) in pts[1:]:
            p.lineTo(ox + x * s, oy + y * s)
        c.drawPath(p, stroke=1, fill=0)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        a = math.atan2(y2 - y1, x2 - x1)
        bx, by = ox + x2 * s, oy + y2 * s
        L, W_ = 1.1 * s, 0.6 * s
        t = c.beginPath()
        t.moveTo(bx, by)
        t.lineTo(bx - L * math.cos(a) + W_ * math.sin(a), by - L * math.sin(a) - W_ * math.cos(a))
        t.lineTo(bx - L * math.cos(a) - W_ * math.sin(a), by - L * math.sin(a) + W_ * math.cos(a))
        t.close()
        c.drawPath(t, fill=1, stroke=0)
        c.setStrokeColor(colors.white); c.setFillColor(colors.white); c.setStrokeAlpha(0.13); c.setFillAlpha(0.13)

    if defense:
        arrow([(-6, 6), (-2.3, 1.2), (-1.5, -2.2)], acc=True)
        arrow([(6, 6), (8.5, 9.5)])
        arrow([(0, 6.5), (0, 10)])
        arrow([(-13, 7), (-13, 12)])
    else:
        arrow([(0, -5.6), (2.0, -3.0), (4.4, -0.8), (5.4, 3.5), (5.6, 9.0)], acc=True)
        arrow([(-14, 0), (-14, 6), (-10, 10.5)])
        arrow([(14, -0.6), (14, 9.5)])
        arrow([(0, -2.6), (-1.0, -4.5)], w=1.6)
    c.restoreState()


def _wrap(text, font, size, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(t, font, size) > width:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


def toc_block():
    toc = TableOfContents()
    toc.levelStyles = [ST["toc0"], ST["toc1"]]
    toc.dotsMinLevel = 0
    return [P("CONTENTS", "kicker"), Paragraph("What's Inside", ST["h1"]), Bar(), Spacer(1, 8), toc, PageBreak()]


def build(path, book, story, landscape=False):
    doc = BookDoc(path, book, landscape=landscape)
    full = [NextPageTemplate("body"), PageBreak()] + story
    doc.multiBuild(full)


# ------------------------------------------------------------ page builders
def play_page(play, num, max_dia_h=3.55 * inch):
    """One play per page: call, chips, diagram, 11-man assignment grid, step-by-step and coaching points."""
    head = [P(f"PLAY {num:02d}  \u2022  {play.family.upper()}", "kicker"), Paragraph(play.call, ST["playcall"]), Spacer(1, 3),
            chips([play.title, play.form_name.upper(), f"INSTALL: WEEK {play.week}"] + [t.upper() for t in play.tags[:2]]),
            Spacer(1, 6)]
    dia = play.diagram_fn(CONTENT_W)
    if dia.height > max_dia_h:
        dia = play.diagram_fn(CONTENT_W * max_dia_h / dia.height)
    dia.hAlign = "CENTER"
    what = P(f"<b>THE PLAY:</b> {play.what}", "small")
    # 4-column assignment grid (two players per row)
    cellp = ParagraphStyle("ap", parent=ST["cell"], fontSize=8, leading=9.8)
    posp = ParagraphStyle("pp", parent=ST["cellb"], fontSize=8.6, leading=10)
    items = play.assignments
    half = (len(items) + 1) // 2
    left, right = items[:half], items[half:]
    rows = []
    for i in range(half):
        r = [Paragraph(sym(left[i][0]), posp), Paragraph(sym(left[i][1]), cellp)]
        if i < len(right):
            r += [Paragraph(sym(right[i][0]), posp), Paragraph(sym(right[i][1]), cellp)]
        else:
            r += ["", ""]
        rows.append(r)
    pw = 0.95 * inch
    aw = (CONTENT_W - 2 * pw) / 2
    at = Table(rows, colWidths=[pw, aw, pw, aw])
    cmds = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LINEAFTER", (1, 0), (1, -1), 0.6, RULE), ("LINEABOVE", (0, 0), (-1, 0), 1.2, ACC)]
    for i in range(len(rows)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    at.setStyle(TableStyle(cmds))
    # step-by-step | coaching points
    colL, colR = [], []
    for (who, steps) in play.steps:
        colL.append(P(f"STEP-BY-STEP: {who.upper()}", "h3"))
        colL += numbered(steps, "small")
    colR.append(P("COACHING POINTS", "h3"))
    colR += bullets(play.points, "small")
    colR.append(P("BEST AGAINST", "h3"))
    colR.append(P(play.best, "small"))
    if play.pairs:
        colR.append(P("PAIRS WITH", "h3"))
        colR.append(P(play.pairs, "small"))
    body = Table([[colL, colR]], colWidths=[CONTENT_W * 0.55, CONTENT_W * 0.45])
    body.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (0, 0), 14), ("RIGHTPADDING", (1, 0), (1, 0), 0),
                              ("TOPPADDING", (0, 0), (-1, -1), 0)]))
    avail_h = PAGE_H - 2 * M - 0.45 * inch
    content = head + [dia, Spacer(1, 4), what, Spacer(1, 5), P("ASSIGNMENTS \u2014 ALL 11", "h3"), at, Spacer(1, 2), body]
    return [Anchor(1, f"{num:02d}. {play.call}"), KeepInFrame(CONTENT_W, avail_h, content, mode="shrink"), PageBreak()]


def wristband(plays, title="Wristband Card"):
    out = section(title, "Game day")
    out.append(P("Cut along the border and slide into a 3-panel wristband. Signal the number; the play is called "
                 "exactly as written. Fill the blank cells with your game-plan specials.", "body"))
    cells = [f"<b>{i:02d}</b>&nbsp; {p.call}" for i, p in enumerate(plays, 1)]
    while len(cells) % 3:
        cells.append("<b>__</b>&nbsp; ________________")
    for _ in range(6):
        cells.append("<b>__</b>&nbsp; ________________")
    rows = [cells[i:i + 3] for i in range(0, len(cells), 3)]
    t = grid(rows, [CONTENT_W / 3] * 3, header=False, font="cell",
             style_extra=[("BOX", (0, 0), (-1, -1), 1.2, INK), ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE)])
    out += [t, PageBreak()]
    return out


def call_sheet(plays, buckets, title="Game-Day Call Sheet"):
    out = section(title, "Game day")
    out.append(P("Organized by situation. Circle your top two calls in each box before kickoff; "
                 "track what's working in the margin at halftime.", "body"))
    boxes = []
    for (label, tags) in buckets:
        items = [p.call for p in plays if set(t.lower() for t in p.tags) & set(tags)]
        if not items:
            continue
        cell = [P(label.upper(), "h3")] + [P(f"▢&nbsp; {i}", "small") for i in items[:9]]
        boxes.append(cell)
    rows = [boxes[i:i + 2] for i in range(0, len(boxes), 2)]
    if rows and len(rows[-1]) == 1:
        rows[-1].append("")
    t = Table(rows, colWidths=[CONTENT_W / 2] * 2)
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1, INK), ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    out += [t, PageBreak()]
    return out


def install_plan(plays, weeks=3, title="Installation Plan"):
    out = section(title, "Practice")
    out.append(P("Install in layers. Each week adds plays only after the previous week's are run clean at full speed. "
                 "Every practice day follows the same rhythm: <b>Indy</b> (fundamentals) → <b>Group</b> (unit "
                 "assignments) → <b>Team</b> (full 11 vs scout look).", "body"))
    rows = [["WEEK", "DAY", "NEW INSTALL", "REVIEW / EMPHASIS"]]
    by_week = {}
    for p in plays:
        by_week.setdefault(min(p.week, weeks), []).append(p.call)
    for w in range(1, weeks + 1):
        calls = by_week.get(w, [])
        chunks = [calls[i::3] for i in range(3)]
        for dnum, chunk in enumerate(chunks, 1):
            emph = {1: "Formations, alignment, cadence. Walk-through then full speed.",
                    2: "Blocking rules vs 3 fronts. Ball security circuit.",
                    3: "Team period: script all installs vs scout defense. Situational reps."}[dnum]
            rows.append([f"Week {w}", f"Day {dnum}", ", ".join(chunk) or "Review", emph])
    out.append(grid(rows, [0.7 * inch, 0.6 * inch, CONTENT_W * 0.5, CONTENT_W - 1.3 * inch - CONTENT_W * 0.5]))
    out.append(Spacer(1, 10))
    out.append(P("Practice Period Template (90 minutes)", "h2"))
    out.append(grid([["MIN", "PERIOD", "FOCUS"],
                     ["0–10", "Dynamic warm-up", "Movement prep, form running, get-offs on cadence"],
                     ["10–25", "Indy", "Position fundamentals tied to this week's installs"],
                     ["25–40", "Group", "Inside run (OL/backs) and 7-on-7 or perimeter (skill)"],
                     ["40–45", "Water", ""],
                     ["45–70", "Team", "Scripted plays vs scout look; 2 reps each install"],
                     ["70–85", "Special teams / situations", "Short yardage, goal line, 2-minute"],
                     ["85–90", "Finish", "Conditioning tied to effort standard; break down"]],
                    [0.8 * inch, 1.8 * inch, CONTENT_W - 2.6 * inch]))
    out.append(PageBreak())
    return out


def notes_page(title="Coach's Notes"):
    out = section(title, "Your adjustments", toc=True)

    class Lines(Flowable):
        def __init__(self):
            super().__init__()
            self.width, self.height = CONTENT_W, 7.6 * inch

        def wrap(self, aw, ah):
            self.height = min(7.6 * inch, ah - 6)
            return self.width, self.height

        def draw(self):
            self.canv.setStrokeColor(RULE)
            y = self.height
            while y > 0:
                self.canv.line(0, y, self.width, y)
                y -= 0.32 * inch
    out += [Lines(), PageBreak()]
    return out
