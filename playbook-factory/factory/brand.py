"""Everything you'd change to make this product yours lives here.

Rename the brand, swap the colors, put your name on it, set the price —
then run `python3 build.py` and every PDF, the README and the store copy
regenerate with the new identity.
"""

BRAND = "IRONCLAD"                       # short, loud, one word works best
COLLECTION = "The Forge Collection"     # the bundle name
EDITION = "Complete System"
TAGLINE = "Built in the offseason. Proven on Friday night."
AUTHOR = "Coach [Your Name]"            # byline on every cover
WEBSITE = "yourstore.com/ironclad"      # printed in footers
YEAR = 2026
LEVEL = "Youth through High School (11-player tackle)"

PRICE = "$129"
COMPARE_AT = "$1,297"                   # sum of the individual book prices

# Colors (hex). Accent shows up on covers, headers, ball-carrier paths.
INK = "#121417"        # near-black
STEEL = "#5B6573"      # secondary text / ghost defenders
ACCENT = "#E8571A"     # forge orange
ACCENT_DARK = "#B23E0D"
PAPER = "#FFFFFF"
FIELD = "#F6F6F2"      # diagram background
FIELD_LINE = "#DAD9D2"
DEFENSE = "#2B4C7E"    # defender color on defensive pages

LICENSE_LINE = (f"© {YEAR} {BRAND}. Licensed for use by the purchasing coach and staff. "
                "Do not resell or redistribute.")

# ------------------------------------------------------------------ STYLE
# "slides"  = landscape presentation decks (diagram slide + breakdown slide per call)
# "print"   = portrait coaching manual (one page per play, field diagrams)
STYLE = "slides"

# Slide-edition diagram colors
SLIDE_SHAPE = "#2F6B3A"       # players (circles = offense, triangles = defense)
SLIDE_SHAPE_DARK = "#1F4A27"  # outlines, routes, blocks
SLIDE_RED = "#D62828"         # ball carrier, blitz paths, deep-middle oval, man boxes
SLIDE_YELLOW = "#F2C200"      # stunts/twists, motion, underneath + outside zones
SLIDE_BLUE = "#1E9BE0"        # QB spy / read defender

# Optional artwork (paths relative to playbook-factory/). Leave None to use the built-in graphic.
COVER_IMAGE = None            # e.g. "art/cover.jpg"  - left half of every cover slide
HERO_IMAGE = None             # e.g. "art/hero.jpg"   - Benefits + Philosophy slides
COACH_PHOTO = None            # e.g. "art/coach.jpg"  - closing call-to-action slide

# Closing call-to-action slide (set CTA_URL = "" to drop the slide)
CTA_TITLE = "Book a 1:1 Strategy Call"
CTA_URL = "https://yourstore.com/ironclad/call"
CTA_PITCH = "Get personalized game-plan breakdowns, real-time adjustments and 1:1 coaching mentorship."
CTA_CODE = "IRON50"
CTA_OFFER = "50% off your first strategy call"
SIGNOFF = "Now go build something that lasts."
