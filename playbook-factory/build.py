#!/usr/bin/env python3
"""Build the complete playbook collection.

    python3 build.py              # all books + index + zip  -> dist/
    python3 build.py wingt anvil  # just those books (by key)

Edit factory/brand.py to rebrand everything.
"""
import os
import re
import sys
import time
import zipfile

from reportlab.platypus import Spacer, PageBreak
from reportlab.lib.units import inch

from factory import brand, layout
from factory.layout import P, section, bullets, numbered, grid, CONTENT_W
from factory.books_offense import OFFENSE_BOOKS, offense_book
from factory.books_defense import DEFENSE_BOOKS, defense_book
from factory.books_special import SPECIAL_BOOKS

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")


def catalog():
    books = []
    for spec in OFFENSE_BOOKS:
        books.append((spec, offense_book))
    for spec in DEFENSE_BOOKS:
        books.append((spec, defense_book))
    for spec in SPECIAL_BOOKS:
        books.append((spec, spec["builder"]))
    return books


def slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


def pages(path):
    from pypdf import PdfReader
    return len(PdfReader(path).pages)


def index_story(entries):
    story = []
    story += section("Welcome to the System", "Start here", toc=False)
    story.append(P(f"{brand.COLLECTION}: {len(entries)} playbooks and drillbooks. One language. One standard.", "quote"))
    story.append(P(f"Every book in the {brand.BRAND} collection uses the same terminology, the same numbering system and the same page "
                   "layout — so your staff learns it once and your players carry it from 7v7 in June to the playoffs in November. "
                   "Every play and every defensive call includes an assignment for all eleven players plus step-by-step instructions "
                   "and coaching points for the key players.", "body"))
    story.append(P("What's in the box", "h3"))
    rows = [["#", "BOOK", "CATEGORY", "PAGES"]] + [[f"{n:02d}", t, c, str(pg)] for (n, t, c, pg, _) in entries]
    story.append(grid(rows, [0.45 * inch, CONTENT_W * 0.55, CONTENT_W * 0.28, CONTENT_W * 0.17 - 0.45 * inch]))
    story.append(PageBreak())
    story += section("Build Your System", "Pick one of each", toc=False)
    story.append(P("You don't need all fourteen offenses — you need the right one for your players. Pick ONE offense, ONE defense, "
                   "and use the drillbook, training program and parent playbook with either.", "body"))
    story.append(grid([["IF YOUR TEAM HAS...", "OFFENSE", "DEFENSE"],
                       ["A small, inexperienced line", "Double Wing or Wing-T", "6-2 Wall"],
                       ["A great running back", "Power I (Vol. 1–3) or Maryland I", "4-4 Anvil"],
                       ["A running quarterback", "Diamond, Gun-T or Pistol Power (Vol. 3)", "4-2-5 Hammer"],
                       ["Lots of skill players, a passing QB", "Air Raid / Air Raid 2.0 / RPO", "4-2-5 Hammer"],
                       ["Several good backs, a smart QB", "T Formation (Wishbone) or Single Wing", "5-3 Forge"],
                       ["A balanced, well-coached roster", "Single Back", "5-3 Forge or 4-4 Anvil"]],
                      [CONTENT_W * 0.38, CONTENT_W * 0.36, CONTENT_W * 0.26]))
    story.append(P("Recommended reading order", "h3"))
    story += numbered(["This page, then your chosen offense and defense books — cover to cover with your staff.",
                       "Blocking Drillbook: build the in-season circuit into every practice plan.",
                       "Forged: Offseason Training: start 12 weeks before the first practice.",
                       "7v7 Playbook: summer passing league, using the same concepts as your fall offense.",
                       "The Parent Playbook: send it to every family before the season."])
    story.append(P("Printing", "h3"))
    story += bullets(["Letter size, portrait. Print the play pages single-sided so players can write on the back.",
                      "Wristband pages are designed for a standard 3-panel wristband — print at 100%."])
    story.append(P("License", "h3"))
    story.append(P(brand.LICENSE_LINE, "body"))
    return story


def main(selected):
    os.makedirs(DIST, exist_ok=True)
    books = catalog()
    total = len(books)
    entries = []
    t0 = time.time()
    for n, (spec, builder) in enumerate(books, 1):
        if selected and spec["key"] not in selected:
            continue
        meta = dict(title=spec["title"], subtitle=spec["subtitle"], category=spec["category"], num=n, of=total)
        fn = f"{n:02d}_{brand.BRAND}_{slug(spec['title'])}.pdf"
        path = os.path.join(DIST, fn)
        layout.build(path, meta, builder(spec))
        pg = pages(path)
        entries.append((n, spec["title"], spec["category"], pg, fn))
        print(f"  [{n:02d}/{total}] {fn}  ({pg} pages)")
    if selected:
        return
    # index
    meta = dict(title="Start Here", subtitle=f"Your guide to all {total} books in {brand.COLLECTION}.", category="Collection index",
                num=0, of=total)
    idx = os.path.join(DIST, f"00_{brand.BRAND}_Start_Here.pdf")
    layout.build(idx, meta, index_story(entries))
    readme = os.path.join(DIST, "README.txt")
    with open(readme, "w") as f:
        f.write(f"{brand.BRAND} — {brand.COLLECTION} ({brand.EDITION})\n{brand.TAGLINE}\n\n")
        f.write(f"{total} playbooks & drillbooks. Open 00_{brand.BRAND}_Start_Here.pdf first.\n\n")
        for (n, t, c, pg, fn) in entries:
            f.write(f"{n:02d}  {t:<40} {c:<18} {pg:>3} pages   {fn}\n")
        f.write(f"\nTotal pages: {sum(e[3] for e in entries)}\n\n{brand.LICENSE_LINE}\n")
    zpath = os.path.join(DIST, f"{brand.BRAND}_{slug(brand.COLLECTION)}_{slug(brand.EDITION)}.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        folder = f"{brand.BRAND}_{slug(brand.COLLECTION)}"
        z.write(readme, f"{folder}/README.txt")
        z.write(idx, f"{folder}/{os.path.basename(idx)}")
        for (n, t, c, pg, fn) in entries:
            z.write(os.path.join(DIST, fn), f"{folder}/{fn}")
    print(f"\n{total} books, {sum(e[3] for e in entries)} pages, built in {time.time() - t0:.1f}s")
    print(f"ZIP: {zpath} ({os.path.getsize(zpath) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
