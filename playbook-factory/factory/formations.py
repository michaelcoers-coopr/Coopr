"""Offensive formations, defined strength-RIGHT in diagram yards.

Each player: label -> (x, y, role). Roles: OL, TE, WR, SLOT, WING, QB, RB.
`mirror()` flips a formation to the left. Labels are what's printed in the
circle (offensive linemen are drawn unlabeled; C is drawn as a square).
"""

OL_Y = -0.8
OFF_Y = -1.7


def line(splits=1.5):
    return {"LT": (-2 * splits, OL_Y, "OL"), "LG": (-splits, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
            "RG": (splits, OL_Y, "OL"), "RT": (2 * splits, OL_Y, "OL")}


def F(**players):
    out = line()
    out.update(players)
    return out


QB_UC = (0, -2.0, "QB")
QB_GUN = (0, -5.2, "QB")
QB_PISTOL = (0, -3.8, "QB")

FORMATIONS = {
    # ---------------------------------------------------------- pro / I
    "I_PRO": F(Q=QB_UC, F=(0, -4.4, "RB"), T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"),
               X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "I_TIGHT": F(Q=QB_UC, F=(0, -4.4, "RB"), T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"),
                 H=(-4.5, OL_Y, "TE"), Z=(13, OFF_Y, "WR")),
    "I_WING": F(Q=QB_UC, F=(0, -4.4, "RB"), T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"),
                H=(-4.5, OL_Y, "TE"), W=(5.6, OFF_Y, "WING")),
    "OFFSET_I": F(Q=QB_UC, F=(1.6, -4.4, "RB"), T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"),
                  X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "PRO_SPLIT": F(Q=QB_UC, F=(2.2, -5.0, "RB"), T=(-2.2, -5.0, "RB"), Y=(4.5, OL_Y, "TE"),
                   X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "I_TWINS": F(Q=QB_UC, F=(0, -4.4, "RB"), T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"),
                 X=(-15, OL_Y, "WR"), Z=(-9, OFF_Y, "SLOT")),
    # ------------------------------------------------------- unbalanced
    "UNB_WING": {"LT": (1.5 * 3, OL_Y, "OL"), "LG": (-1.5, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
                 "RG": (1.5, OL_Y, "OL"), "RT": (3.0, OL_Y, "OL"), "Y": (6.0, OL_Y, "TE"),
                 "X": (-3.0, OL_Y, "TE"), "W": (7.1, OFF_Y, "WING"), "Q": QB_UC,
                 "F": (0, -4.4, "RB"), "T": (0, -6.6, "RB")},
    # ---------------------------------------------------------- pistol
    "PISTOL_H": F(Q=QB_PISTOL, T=(0, -6.6, "RB"), H=(3.0, -2.2, "TE"), Y=(4.5, OL_Y, "TE"),
                  X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "PISTOL_DIAMOND": F(Q=QB_PISTOL, T=(0, -6.6, "RB"), H=(-1.9, -4.4, "RB"), F=(1.9, -4.4, "RB"),
                        Y=(4.5, OL_Y, "TE"), X=(-15, OL_Y, "WR")),
    "PISTOL_TRIPS": F(Q=QB_PISTOL, T=(0, -6.6, "RB"), Y=(4.5, OL_Y, "TE"), S=(9, OFF_Y, "SLOT"),
                      Z=(15, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    # ------------------------------------------------------- full house
    "T_FULL": F(Q=QB_UC, F=(0, -4.6, "RB"), H=(-2.6, -4.6, "RB"), T=(2.6, -4.6, "RB"),
                Y=(4.5, OL_Y, "TE"), X=(-4.5, OL_Y, "TE")),
    "T_SPLIT": F(Q=QB_UC, F=(0, -4.6, "RB"), H=(-2.6, -4.6, "RB"), T=(2.6, -4.6, "RB"),
                 Y=(4.5, OL_Y, "TE"), X=(-12, OL_Y, "WR")),
    "WISHBONE": F(Q=QB_UC, F=(0, -4.0, "RB"), H=(-2.2, -5.6, "RB"), T=(2.2, -5.6, "RB"),
                  Y=(4.5, OL_Y, "TE"), X=(-12, OL_Y, "WR")),
    "MARYLAND_I": F(Q=QB_UC, F=(0, -3.9, "RB"), H=(0, -5.5, "RB"), T=(0, -7.1, "RB"),
                    Y=(4.5, OL_Y, "TE"), X=(-4.5, OL_Y, "TE")),
    "MARYLAND_I_SPLIT": F(Q=QB_UC, F=(0, -3.9, "RB"), H=(0, -5.5, "RB"), T=(0, -7.1, "RB"),
                          Y=(4.5, OL_Y, "TE"), X=(-13, OL_Y, "WR")),
    # ------------------------------------------------------ double wing
    "DW": {"LT": (-2.4, OL_Y, "OL"), "LG": (-1.2, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
           "RG": (1.2, OL_Y, "OL"), "RT": (2.4, OL_Y, "OL"), "Y": (3.6, OL_Y, "TE"),
           "X": (-3.6, OL_Y, "TE"), "W": (4.7, OFF_Y, "WING"), "H": (-4.7, OFF_Y, "WING"),
           "Q": QB_UC, "F": (0, -4.0, "RB")},
    "DW_SPREAD": {"LT": (-2.4, OL_Y, "OL"), "LG": (-1.2, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
                  "RG": (1.2, OL_Y, "OL"), "RT": (2.4, OL_Y, "OL"), "Y": (3.6, OL_Y, "TE"),
                  "X": (-12, OL_Y, "WR"), "W": (4.7, OFF_Y, "WING"), "H": (-4.7, OFF_Y, "WING"),
                  "Q": QB_UC, "F": (0, -4.0, "RB")},
    # ---------------------------------------------------------- wing-T
    "WT_RED": F(Q=QB_UC, F=(0, -4.5, "RB"), H=(-2.4, -4.5, "RB"), W=(5.6, OFF_Y, "WING"),
                Y=(4.5, OL_Y, "TE"), X=(-12, OL_Y, "WR")),
    "WT_BLUE": F(Q=QB_UC, F=(0, -4.5, "RB"), H=(2.4, -4.5, "RB"), W=(5.6, OFF_Y, "WING"),
                 Y=(4.5, OL_Y, "TE"), X=(-12, OL_Y, "WR")),
    "WT_DOUBLE": F(Q=QB_UC, F=(0, -4.5, "RB"), H=(-5.6, OFF_Y, "WING"), W=(5.6, OFF_Y, "WING"),
                   Y=(4.5, OL_Y, "TE"), X=(-12, OL_Y, "WR")),
    "GUNT": F(Q=QB_GUN, F=(-1.6, -5.2, "RB"), W=(5.6, OFF_Y, "WING"), Y=(4.5, OL_Y, "TE"),
              Z=(13, OFF_Y, "WR"), X=(-15, OL_Y, "WR")),
    "GUNT_TWIN_WING": F(Q=QB_GUN, F=(-1.6, -5.2, "RB"), W=(5.6, OFF_Y, "WING"), Y=(4.5, OL_Y, "TE"),
                        H=(-5.6, OFF_Y, "WING"), X=(-15, OL_Y, "WR")),
    # ------------------------------------------------------ single wing
    "SW": {"LT": (-1.5, OL_Y, "OL"), "LG": (1.5, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
           "RG": (3.0, OL_Y, "OL"), "RT": (4.5, OL_Y, "OL"), "Y": (6.0, OL_Y, "TE"),
           "X": (-3.0, OL_Y, "TE"), "W": (7.2, OFF_Y, "WING"), "B": (4.0, -2.1, "QB"),
           "F": (2.4, -4.4, "RB"), "T": (0.2, -5.3, "RB")},
    "SW_SPREAD": {"LT": (-1.5, OL_Y, "OL"), "LG": (1.5, OL_Y, "OL"), "C": (0, OL_Y, "OL"),
                  "RG": (3.0, OL_Y, "OL"), "RT": (4.5, OL_Y, "OL"), "Y": (6.0, OL_Y, "TE"),
                  "X": (-13, OL_Y, "WR"), "W": (7.2, OFF_Y, "WING"), "B": (4.0, -2.1, "QB"),
                  "F": (2.4, -4.4, "RB"), "T": (0.2, -5.3, "RB")},
    # ------------------------------------------------------- one back
    "ACE": F(Q=QB_UC, T=(0, -6.0, "RB"), Y=(4.5, OL_Y, "TE"), H=(-4.5, OL_Y, "TE"),
             X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "ACE_TWINS": F(Q=QB_UC, T=(0, -6.0, "RB"), Y=(4.5, OL_Y, "TE"), S=(-9, OFF_Y, "SLOT"),
                   X=(-15, OL_Y, "WR"), Z=(13, OFF_Y, "WR")),
    "ACE_TRIPS": F(Q=QB_UC, T=(0, -6.0, "RB"), Y=(4.5, OL_Y, "TE"), S=(9, OFF_Y, "SLOT"),
                   Z=(15, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    # ----------------------------------------------------------- spread
    "GUN_2X2": F(Q=QB_GUN, T=(-1.6, -5.2, "RB"), Y=(8.5, OFF_Y, "SLOT"), S=(-8.5, OFF_Y, "SLOT"),
                 Z=(15, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    "GUN_TRIPS": F(Q=QB_GUN, T=(-1.6, -5.2, "RB"), Y=(6.5, OFF_Y, "SLOT"), S=(10.5, OFF_Y, "SLOT"),
                   Z=(15.5, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    "GUN_TRIPS_TE": F(Q=QB_GUN, T=(-1.6, -5.2, "RB"), Y=(4.5, OL_Y, "TE"), S=(9, OFF_Y, "SLOT"),
                      Z=(15, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    "GUN_EMPTY": F(Q=QB_GUN, T=(-5.0, OFF_Y, "SLOT"), Y=(6.5, OFF_Y, "SLOT"), S=(10.5, OFF_Y, "SLOT"),
                   Z=(15.5, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    "GUN_11": F(Q=QB_GUN, T=(-1.6, -5.2, "RB"), Y=(4.5, OL_Y, "TE"), S=(-8.5, OFF_Y, "SLOT"),
                Z=(15, OL_Y, "WR"), X=(-15, OL_Y, "WR")),
    # ------------------------------------------------------------- 7v7
    "7V7_2X2": {"C": (0, OL_Y, "OL"), "Q": (0, -5.0, "QB"), "Y": (8, OFF_Y, "SLOT"),
                "S": (-8, OFF_Y, "SLOT"), "Z": (15, OL_Y, "WR"), "X": (-15, OL_Y, "WR"),
                "T": (-1.6, -5.0, "RB")},
    "7V7_TRIPS": {"C": (0, OL_Y, "OL"), "Q": (0, -5.0, "QB"), "Y": (6, OFF_Y, "SLOT"),
                  "S": (10.5, OFF_Y, "SLOT"), "Z": (15.5, OL_Y, "WR"), "X": (-15, OL_Y, "WR"),
                  "T": (-1.6, -5.0, "RB")},
    "7V7_EMPTY": {"C": (0, OL_Y, "OL"), "Q": (0, -5.0, "QB"), "Y": (6, OFF_Y, "SLOT"),
                  "S": (10.5, OFF_Y, "SLOT"), "Z": (15.5, OL_Y, "WR"), "X": (-15, OL_Y, "WR"),
                  "T": (-8, OFF_Y, "SLOT")},
    "7V7_BUNCH": {"C": (0, OL_Y, "OL"), "Q": (0, -5.0, "QB"), "Y": (8.0, OFF_Y, "SLOT"),
                  "S": (10, -2.8, "SLOT"), "Z": (11.0, OL_Y, "WR"), "X": (-15, OL_Y, "WR"),
                  "T": (-1.6, -5.0, "RB")},
}

# Human-readable names + who lines up where (for the formation gallery pages).
POS_NAMES = {
    "LT": "Left Tackle", "LG": "Left Guard", "C": "Center", "RG": "Right Guard", "RT": "Right Tackle",
    "Q": "Quarterback", "B": "Blocking Back", "F": "Fullback", "T": "Tailback", "H": "H-Back",
    "Y": "Tight End", "X": "Split End", "Z": "Flanker", "W": "Wingback", "S": "Slot",
}


def mirror(form):
    return {k: (-x, y, r) for k, (x, y, r) in form.items()}


def get(name, left=False):
    f = dict(FORMATIONS[name])
    return mirror(f) if left else f


def strength(form):
    """+1 if the formation is strong right (more non-OL bodies right of ball), else -1."""
    score = 0
    for k, (x, y, r) in form.items():
        if r in ("OL", "QB") or abs(x) < 0.3 or (r == "RB" and abs(x) < 3):
            continue
        score += 1 if x > 0 else -1
        if r == "TE":
            score += 0.5 if x > 0 else -0.5
    return 1 if score >= 0 else -1
