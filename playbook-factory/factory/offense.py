"""Offensive play engine.

A play is described by a formation, a scheme/concept, a direction and a few
role assignments (who carries, who leads, who kicks...). From that the engine
derives (1) the diagram, (2) a per-player assignment table, (3) step-by-step
instructions for the key players and (4) coaching points.
"""
from dataclasses import dataclass, field
from . import formations as FM
from .diagram import Diagram, C_ACC

# --------------------------------------------------------------------- text
BLOCK = {
    "down": "DOWN: Step with your inside foot, hat across the defender in your inside gap and drive him down the line. Nobody crosses your inside gap.",
    "back": "BACK: Step to the backside A gap, hat in front of the defender covering the puller, wall him off. Fill for the pulling guard.",
    "base": "BASE: Man on you. Short power step, strike with hands inside, run your feet and finish him straight back.",
    "reach": "REACH: Bucket step playside, aim for the defender's outside number, work your hat outside and run your feet to seal him inside.",
    "zone": "ZONE: Step playside. Covered: work to his playside number. Uncovered: double with your playside teammate, eyes on the backer — climb when he shows.",
    "climb": "CLIMB: Release past the down lineman (chip on the way if needed) and take the first linebacker inside-out.",
    "hinge": "HINGE: Step inside to close the gap, then kick back and protect. Nothing crosses your face from the backside.",
    "cut": "CUTOFF: Work flat down the line, get your head across the backside defender and wall him off from pursuit.",
    "pull_kick": "PULL & KICK: Open step, pull flat down the line (don't drift into the backfield), kick out the end man on the line from inside-out.",
    "pull_wrap": "PULL & WRAP: Open step, pull flat, read the kick-out, turn up inside it and block the first color that shows (usually the LB).",
    "pull_lead": "PULL & LEAD: Pull flat to the edge, turn up at the corner and block the first defender who shows outside-in.",
    "trap": "TRAP: Pull flat and trap the first down lineman past the center on the playside. Inside-out angle, low man wins.",
    "wedge": "WEDGE: Step to the center's near hip, get shoulder-to-shoulder with your neighbor and move the pile together for 3 yards.",
    "arc": "ARC: Outside release, gain width, then climb and block the alley/force defender (safety or corner).",
    "kick": "KICK OUT: Attack the end man on the line from inside-out, inside shoulder, drive him to the sideline. Don't let him wrong-arm under you.",
    "lead": "LEAD: Hit the hole downhill and block the first linebacker in it. Head on the playside; stay on your feet.",
    "lead_edge": "LEAD EDGE: Attack the edge, log the first defender outside-in if he squeezes; kick him if he widens.",
    "seal": "SEAL: Block down on the first linebacker inside. Take away his scrape over the top.",
    "stalk": "STALK: Sell the vertical, break down at 4–5 yards, mirror, punch and stay between your man and the ball.",
    "crack": "CRACK: Block down on the first defender inside (the alley player). Hit in front, above the waist.",
    "run_off": "RUN OFF: Take the corner deep, then cut off the safety's angle to the ball.",
    "pro": "PASS PRO: Set, hands ready, inside-out leverage. No free rushers through your inside gap.",
    "pa_pro": "PLAY-ACTION PRO: Fire out low like it's run — no high hats — then set and protect your gap.",
    "fill": "FILL: Replace the pulling lineman. Step into the vacated gap and block the first defender who shows.",
    "screen": "SCREEN: Pass set for a one-count, let your man go, release flat and set the wall. Block the first threat in your path.",
    "leave": "LEAVE: Do not block the read defender. Release inside of him to the next level.",
    "protect": "PROTECT: Check your gap inside-out, then take the first threat off the edge. Stay in.",
}

ROUTE_TXT = {
    "go": "GO: Outside release, sell nothing — run past the corner. Track the ball over the outside shoulder.",
    "fade": "FADE: Outside release, stay 4–5 yards from the sideline, look for the ball at 12+.",
    "seam": "SEAM: Vertical up the hash/seam, stay on your track; split the safeties.",
    "hitch": "HITCH: Five hard steps, snap around at 5 to face the QB, come back to the ball.",
    "slant": "SLANT: Three steps vertical, plant and break 45° inside. Catch, get north.",
    "out": "SPEED OUT: Vertical to 5, round the break flat to the sideline. Catch, turn upfield.",
    "out10": "OUT: Sell vertical to 10, sink hips, snap flat to the sideline (come back slightly).",
    "dig": "DIG: Vertical to 12, plant, break flat inside. Settle in windows vs zone; run vs man.",
    "in6": "IN: Vertical to 6, plant, break flat inside. Find the window between hook defenders.",
    "curl": "CURL: Vertical to 10–12, stop, turn inside to the QB and work back to the ball.",
    "comeback": "COMEBACK: Push vertical to 14, sink, drive back to the sideline at 12.",
    "post": "POST: Vertical to 10–12, break 45° to the goalposts, eyes to the QB after the break.",
    "corner": "CORNER: Vertical to 10–12, break 45° to the corner pylon. Stay away from the sideline.",
    "flag": "FLAG: Vertical to 6, break to the corner. Climb — don't flatten.",
    "flat": "FLAT: Release outside, get width to the numbers at 2–3 yards. Eyes back early.",
    "arrow": "ARROW: Angle flat and fast to the sideline at 3–5 yards.",
    "whip": "WHIP: Push inside 3 yards, plant and pivot back outside.",
    "drag": "DRAG: Under the LBs at 2–3 yards across the formation. Keep running vs man, settle vs zone.",
    "mesh": "MESH: Cross the formation at 5–6 yards, rub shoulders with the other mesh runner, keep running.",
    "cross": "CROSS: Push to 6, then angle across the field to 12–15 yards on the far numbers.",
    "stick": "STICK: Vertical to 5, turn outside and sit facing the QB. Ball comes fast.",
    "snag": "SNAG: Vertical to 5, angle in to 6 and sit in the window under the corner.",
    "sit": "SIT: Release to 5–6 yards, find the hole between defenders and face the QB.",
    "wheel": "WHEEL: Angle to the flat, then turn it up the sideline. Over the outside shoulder.",
    "swing": "SWING: Belly out to the flat, eyes back to the QB at 3 yards.",
    "bubble": "BUBBLE: Bow back slightly, then gain width and downhill. Catch on the move.",
    "now": "NOW: Take one step back toward the QB on the snap. Catch and get north behind the block.",
    "check_flat": "CHECK-RELEASE: Check your protection gap; if no blitz, release to the flat.",
    "angle": "ANGLE: Stem outside 2 yards, break back inside under the LB.",
    "skinny": "SKINNY POST: Vertical to 8, slight inside break — stay outside the near safety.",
    "quick_out": "QUICK OUT: Three steps, snap flat to the sideline at 3.",
    "stalk": "STALK (screen side): Release and block the man over you.",
    "crack": "CRACK: Release inside and block the first defender inside of you (the alley player). Hit in front, above the waist.",
    "block": "BLOCK: Stay in and protect your gap.",
    "protect": "PROTECT: Check your gap inside-out, then the edge. Stay in.",
    "seal_lb": "SEAL: Block the first linebacker inside.",
    "tunnel": "TUNNEL: Take two steps upfield, plant, come back inside behind the wall.",
    "screen_rb": "RB SCREEN: Set as if to protect for a 2-count, slide out to the flat behind the OL wall.",
    "deep_cross": "DEEP OVER: Push to 8, angle across to 15–18 yards on the far hash.",
}

DROP_TXT = {
    "3": "3-step drop from under center: open, three steps, plant, throw on rhythm. Ball out on the plant.",
    "5": "5-step drop: open, five quick steps, hitch once if needed and deliver.",
    "gun3": "Gun quick game: catch, one rhythm step, throw. No hitch.",
    "gun5": "Gun 3-step: catch, three steps (open-crossover-plant), hitch if the window is late.",
    "sprint": "Sprint out: open playside, depth on first 2 steps, then attack the edge square to the line.",
    "boot": "Boot: fake the run with your back to the defense, then bootleg away at 7 yards depth; ball out by the hash.",
    "pa": "Play-action: sell the run fake (show the ball, eyes downfield after), set at 7 and deliver.",
}

SCHEMES = {
    "power": dict(
        title="POWER", family="Gap run",
        what="Downhill gap run: down blocks on the playside, a kick-out on the end man, and the backside guard pulling to lead through the hole.",
        carrier=["Take a lateral shuffle (or drop step under center) to the playside — give the puller time to clear.",
                 "Secure the ball with both arms over the top through the mesh.",
                 "Press the C gap aiming for the outside hip of the down block.",
                 "Read the kick-out: cut up inside it on the hip of the pulling guard.",
                 "Get north. Pads low, finish forward for 2 extra yards."],
        qb=["Under center: reverse pivot (gun: catch and turn) to the playside.",
            "Hand off deep and on the carrier's line — he comes to you.",
            "Carry out a full bootleg fake away from the play."],
        points=["Down blocks win the play — no penetration inside.",
                "The kicker must get his head INSIDE the end man.",
                "Puller: stay flat, turn up on the first color.",
                "Ball carrier presses to the kick, then makes ONE cut."],
        best="Even fronts, 5-technique ends and soft edges.",
        pairs="Counter (same look, other direction) and Boot/Waggle off the power fake."),
    "counter": dict(
        title="COUNTER", family="Gap run",
        what="Misdirection gap run: the carrier steps away, then follows two pullers (kick + wrap) back to the playside.",
        carrier=["Jab step AWAY from the call (sell flow). Only one step.",
                 "Plant and come back across to take the ball at the mesh.",
                 "Get on the hip of the wrapping puller.",
                 "Hit the C gap inside the kick-out, then get north."],
        qb=["Open away (or reverse out) to sell the flow.",
            "Hand off on the carrier's path back to the playside.",
            "Fake the boot away from the play."],
        points=["Patience: the jab step lets both pullers clear.",
                "Kicker's target is the end man on the line — inside-out.",
                "Wrapper reads the kick and fits inside it.",
                "Backside must hinge hard: no penetration behind the pullers."],
        best="Fast-flowing linebackers and teams that key the running back.",
        pairs="Power (same blocking look) and Counter Boot."),
    "iso": dict(
        title="ISO", family="Man run",
        what="Isolation: the line drives the man on them and the lead back isolates the linebacker in the B gap.",
        carrier=["Downhill on the snap, aim at the playside guard's outside hip.",
                 "Two hands on the ball through the line.",
                 "Read the lead block — cut off his hip (in or out).",
                 "Pads low, finish north."],
        qb=["Open playside (gun: catch and ride), hand off at depth.",
            "Carry out a play-action fake."],
        points=["Lead back must hit the hole full speed — he sets the tempo.",
                "Linemen: drive your man away from the hole.",
                "Runner makes the LB commit, then cuts off the lead block."],
        best="Over-shifted fronts and light boxes.",
        pairs="Play-action off the iso fake; Toss to punish run-blitzing LBs."),
    "zone": dict(
        title="INSIDE ZONE", family="Zone run",
        what="Zone run: the whole line steps playside and works double teams to linebackers; the back reads for a bang, bend or bounce.",
        carrier=["Take the handoff aiming at the playside guard's outside leg.",
                 "Press the line — be patient for 2 steps.",
                 "Read the first down lineman past the center: BANG (hit the hole), BEND (cut back) or BOUNCE (outside).",
                 "One cut and get north."],
        qb=["Open/ride the mesh (gun: hand off on the back's track).",
            "Carry out the keep fake to the backside."],
        points=["Linemen stay hip-to-hip on combos; climb only when the backer commits.",
                "Back presses to set up the cutback.",
                "Backside must cut off — that's where the big runs come from."],
        best="Any front; especially stunting and slanting fronts.",
        pairs="Zone read, play-action boot, outside zone."),
    "stretch": dict(
        title="STRETCH", family="Zone run",
        what="Outside zone: everyone reaches playside; the back aims outside the tight end and reads the edge block.",
        carrier=["Open step and attack the outside leg of the end man on the line.",
                 "Stay on your aiming point 3–4 steps — don't bail to the sideline.",
                 "Read the edge block: if he's hooked, take it outside; if he's pushed out, plant and cut up.",
                 "Get north after one cut."],
        qb=["Reach the ball to the back at depth.",
            "Carry out a hard boot fake away."],
        points=["Reach blocks: hat outside, run your feet.",
                "Back must stay on track to stretch the defense.",
                "Backside cuts off flat; the cutback is often there."],
        best="Fronts that slant inside or play with heavy inside DTs.",
        pairs="Boot pass and inside zone."),
    "toss": dict(
        title="TOSS", family="Perimeter run",
        what="Perimeter run: the pitch gets the ball to the edge fast; pin-and-pull blocking clears the alley.",
        carrier=["Open step and gain width immediately.",
                 "Catch the pitch with your eyes on the ball, hands up.",
                 "Get on the hip of the lead blocker/puller.",
                 "Read the lead block: in or out. Turn upfield — don't run sideways."],
        qb=["Reverse out and pitch soft and chest-high, leading the back.",
            "Follow the play as a trailer (or fake the boot away)."],
        points=["Pitch first, then run — no bobbles.",
                "Pin blocks inside, pullers outside.",
                "Receivers must win the stalk or crack for a big play."],
        best="Defenses pinching their ends or blitzing inside.",
        pairs="Power/counter inside to punish fast edges."),
    "trap": dict(
        title="TRAP", family="Gap run",
        what="Quick-hitting trap: let a defensive lineman come free, then trap him out with a pulling guard.",
        carrier=["Fast path downhill: aim for the inside hip of the playside guard.",
                 "Take the ball with your eyes downfield.",
                 "Hit the hole inside the trap block — no dancing.",
                 "Get north."],
        qb=["Open and get the ball deep in the back's belly — it's a quick hitter.",
            "Fake the boot or pitch away."],
        points=["The trapper pulls flat; low man wins.",
                "The trapped defender must be allowed to penetrate.",
                "Center's back block is critical — protect the pull."],
        best="Aggressive penetrating DTs and hard-charging ends.",
        pairs="Dive/iso from the same look; buck sweep in Wing-T."),
    "dive": dict(
        title="DIVE", family="Man run",
        what="Fastest run in the book: hand off into the A/B gap on a man scheme.",
        carrier=["Explode straight downhill on the snap.",
                 "Form a pocket, take the handoff on the move.",
                 "Hit the gap, find daylight, get north."],
        qb=["Open step, get the ball in the carrier's pocket quickly.",
            "Carry out the next play's fake (option or boot)."],
        points=["Speed beats scheme here. Quick hands, quick feet.",
                "Line: fire out low and drive the man on you."],
        best="Wide-aligned linemen and soft middles.",
        pairs="Option and counter from the same backfield action."),
    "wedge": dict(
        title="WEDGE", family="Short yardage",
        what="Short-yardage killer: the whole line forms a wedge on the center and moves the pile.",
        carrier=["Take the handoff (or snap) and stay tight behind the wedge.",
                 "Put a hand on the back of the wedge — follow the pile.",
                 "Bounce off the wedge only if it stalls."],
        qb=["Hand off quickly or keep (QB wedge) and follow the center."],
        points=["Shoulder-to-shoulder: no gaps between linemen.",
                "Everyone drives for 3 yards — low and together.",
                "Perfect for 3rd/4th and short and the goal line."],
        best="Gap-control defenses that penetrate; goal line.",
        pairs="Toss/sweep to punish defenses pinching in."),
    "sweep": dict(
        title="BUCK SWEEP", family="Perimeter run",
        what="Wing-T staple: both guards pull, the playside down blocks seal, and the halfback runs the alley.",
        carrier=["Step to the mesh behind the QB, take the handoff with eyes to the edge.",
                 "Get on the hip of the playside guard.",
                 "Read his kick-out; the second guard leads up through the hole.",
                 "Cut up inside the kick, get vertical."],
        qb=["Reverse pivot, give the FB a trap fake.",
            "Hand off to the HB at depth.",
            "Bootleg fake away (this sets up the Waggle)."],
        points=["Down blocks by the TE/wing/tackle must seal the line.",
                "Guards pull flat and fast — the timing IS the play.",
                "FB fake must be real to hold the inside backers."],
        best="Even fronts and fast-flowing linebackers.",
        pairs="Trap, Waggle and Counter from the same backfield action."),
    "jet": dict(
        title="JET SWEEP", family="Perimeter run",
        what="Full-speed motion across the formation; the ball is handed to the motion man going outside.",
        carrier=["Start motion on the QB's cue; be at the ball at full speed when it's snapped.",
                 "Take the handoff in front of the QB — form a pocket, don't slow down.",
                 "Stretch to the edge, read the lead/reach blocks.",
                 "Turn it up at the first opening."],
        qb=["Snap timed to motion (motion man at the tackle).",
            "Quick hand to the jet back, then fake the inside run to the back."],
        points=["Motion timing is everything — rep it daily.",
                "Reach blocks: hat outside.",
                "Backside back must sell the inside fake."],
        best="Defenses that can't run with motion; slow edges.",
        pairs="Jet fake + trap/power inside, jet boot pass."),
    "superpower": dict(
        title="SUPER POWER", family="Gap run",
        what="Double Wing signature: every playside man blocks down, the fullback kicks, and two pullers lead the backside wing off tackle.",
        carrier=["Step at the QB's heels on the snap (no motion needed).",
                 "Take the handoff behind the QB on a flat path to the playside.",
                 "Follow the pullers; read the fullback's kick-out.",
                 "Get north through the C gap."],
        qb=["Reverse pivot, hand to the wing coming across.",
            "Fake to the fullback or bootleg away."],
        points=["Tight splits: no gaps for penetration.",
                "Everyone on the playside blocks DOWN — angles win.",
                "Pullers stay tight to the line."],
        best="Any front — it's built to beat numbers with angles.",
        pairs="Wedge, Counter and the wing reverse."),
    "option": dict(
        title="TRIPLE OPTION", family="Option",
        what="Option football: the QB reads the dive key, then the pitch key; the defense must account for all three backs.",
        carrier=["Dive back: run to the inside hip of the playside guard. Form a pocket; if the QB pulls, carry out the fake and block.",
                 "Pitch back: get to pitch relationship — 4 yards wide, 1 yard behind the QB.",
                 "Pitch back: catch with your eyes and turn up the alley."],
        qb=["Open playside, ride the dive back with eyes on the read defender.",
            "Read: if he takes the dive — pull and attack the next defender. If he sits — give.",
            "Pitch key: if he takes you — pitch. If he takes the pitch — keep and get north."],
        points=["Read defenders are left unblocked on purpose.",
                "Pitch relationship never changes.",
                "Mesh is a ride, not a stab."],
        best="Man-to-man and aggressive fronts that chase the ball.",
        pairs="Dive, keep pass, counter option."),
    "zone_read": dict(
        title="ZONE READ", family="Option",
        what="Inside zone with the backside end left unblocked; the QB reads him to give or keep.",
        carrier=["Take the mesh aiming at the playside B gap.",
                 "Run the inside-zone read: bang, bend or bounce.",
                 "If the QB pulls, carry out the fake hard."],
        qb=["Catch the snap and ride the back with eyes on the backside end.",
            "End crashes down — KEEP and run off his outside shoulder.",
            "End stays home or widens — GIVE."],
        points=["Make the read with your eyes, not your hands.",
                "Backside end must be left alone.",
                "Keep path: attack the alley, protect yourself — get down or out of bounds."],
        best="Defenses with crashing ends; light boxes vs spread.",
        pairs="Bubble RPO and the QB power keep."),
    "power_read": dict(
        title="POWER READ", family="Option",
        what="Power blocking with the back running sweep; the QB reads the playside end and keeps inside on the pull.",
        carrier=["Sweep path immediately: attack the edge.",
                 "Take the ball if given and turn it up outside."],
        qb=["Catch the snap, ride the back with eyes on the playside end.",
            "End widens with the sweep — KEEP and follow the puller inside.",
            "End squeezes inside — GIVE."],
        points=["Puller must turn up inside on the first color.",
                "QB: decision at the mesh, no hesitation."],
        best="Wide, fast edges and spread defenses.",
        pairs="Zone read and counter."),
    "qb_power": dict(
        title="QB POWER", family="Gap run",
        what="Power blocking with the QB as the runner and the back as a lead/kick blocker.",
        carrier=["Catch the snap and take one patient step.",
                 "Follow the pulling guard through the C gap.",
                 "Cut inside the kick-out block; get north."],
        qb=["(QB is the runner)"],
        points=["Patience at the mesh — let the guard clear.",
                "Lead back attacks the end man inside-out."],
        best="Short yardage and red zone; adds an extra blocker.",
        pairs="Zone read and power read."),
}

PASS = {}  # filled by concept() below


def concept(key, title, routes, drop, progression, what, steps, points, beats, side="strong"):
    PASS[key] = dict(title=title, routes=routes, drop=drop, progression=progression, what=what,
                     steps=steps, points=points, beats=beats, side=side)


concept("stick", "STICK", dict(ps1="fade", ps2="stick", ps3="flat", bs1="slant", bs2="sit", back="flat"), "gun3",
        ["ps2", "ps3", "bs1"], "Quick-game triangle: the stick at 5, the flat underneath and the fade clearing the corner.",
        ["Pre-snap: count the flat defender.", "Eyes on the flat defender at the snap.", "He widens with the flat → throw the STICK.",
         "He sits on the stick → throw the FLAT.", "Backside slant if the triangle is dead."],
        ["Stick turns OUT, away from the backer.", "Flat runner gets width — don't drift up."], "Cover 3 and soft zone.")
concept("slant_flat", "SLANT-FLAT", dict(ps1="slant", ps2="flat", ps3="seam", bs1="slant", bs2="flat", back="protect"), "3",
        ["ps1", "ps2", "bs1"], "High-low the flat defender: the slant behind him, the flat underneath.",
        ["Pre-snap: find the flat defender.", "3-step drop, eyes on the flat defender.", "He widens → slant.", "He sits or jumps the slant → flat."],
        ["Slant must win inside leverage.", "Ball out on the plant foot."], "Off coverage, cover 3, quarters.")
concept("smash", "SMASH", dict(ps1="hitch", ps2="corner", ps3="flat", bs1="post", bs2="sit", back="check_flat"), "gun5",
        ["ps2", "ps1", "bs1"], "Hi-low the corner: the hitch under him, the corner route over him.",
        ["Pre-snap: two high safeties? Smash is on.", "Eyes on the cornerback.", "He sinks → throw the hitch.", "He sits on the hitch → corner."],
        ["Corner route: break at 10–12, angle to the pylon.", "Hitch settles at 5 in front of the corner."], "Cover 2 and two-high shells.")
concept("verts", "FOUR VERTICALS", dict(ps1="go", ps2="seam", ps3="seam", bs1="go", bs2="seam", back="check_flat"), "gun5",
        ["ps2", "bs2", "ps1", "back"], "Put four vertical threats on the safeties and throw away from them.",
        ["Pre-snap: count the safeties.", "One high: work the seams away from the middle safety.", "Two high: throw the seam between them.",
         "Checkdown to the back if all four are covered."],
        ["Inside receivers: stay on your seam, don't drift.", "Outside receivers: outside release, stay 5 yards from the sideline."],
        "Cover 3 and single-high pressure.")
concept("mesh", "MESH", dict(ps1="corner", ps2="mesh", bs1="sit", bs2="drag", back="swing"), "gun5",
        ["bs2", "ps2", "ps1", "back"], "Two shallow crossers rub off each other; the corner and swing stretch the zone.",
        ["Pre-snap: man or zone?", "Man: hit the mesh runner coming open off the rub.", "Zone: mesh runners sit in the windows.",
         "Corner route vs soft flats; swing as the outlet."],
        ["Mesh runners: one at 5, one at 6 — shoulders touch.", "Keep running vs man; settle vs zone."], "Man coverage and blitz.")
concept("curl_flat", "CURL-FLAT", dict(ps1="curl", ps2="flat", ps3="seam", bs1="curl", bs2="flat", back="protect"), "gun5",
        ["ps1", "ps2", "bs1"], "High-low the curl/flat defender to either side.",
        ["Eyes on the flat defender.", "He widens with the flat → curl.", "He sinks under the curl → flat."],
        ["Curl: work back to the ball.", "Flat: catch and get upfield."], "Cover 3 and zone.")
concept("flood", "FLOOD", dict(ps1="go", ps2="out10", ps3="flat", bs1="dig", bs2="drag", back="flat"), "sprint",
        ["ps2", "ps3", "ps1"], "Three levels to one side: deep, intermediate and flat.",
        ["Sprint out to the call side.", "Read high-to-low: go → out → flat.", "Run it if the edge opens."],
        ["Spacing is the play — 5, 10, 20+ yards.", "QB square shoulders before throwing on the move."], "Cover 3 and soft zone.")
concept("levels", "LEVELS", dict(ps1="in6", ps2="dig", ps3="sit", bs1="post", bs2="seam", back="check_flat"), "gun5",
        ["ps2", "ps1", "back"], "Two in-breakers stacked at 6 and 12 to high-low the hook defenders.",
        ["Eyes on the hook/curl backer.", "He drops → throw the 6-yard in.", "He jumps the shallow in → throw the dig behind him."],
        ["Dig must clear the LB's depth.", "Throw the dig on time — before the safety rotates."], "Zone with inside linebackers that bite.")
concept("dagger", "DAGGER", dict(ps1="dig", ps2="seam", ps3="drag", bs1="post", bs2="sit", back="check_flat"), "gun5",
        ["ps2", "ps1", "back"], "Seam clears the middle; the dig breaks in underneath into the vacated space.",
        ["Eyes on the near safety.", "He jumps the seam → dig.", "He stays deep → seam."], ["Dig breaks at 12–15."], "Cover 2 and quarters.")
concept("y_cross", "Y-CROSS", dict(ps1="post", ps2="cross", ps3="flat", bs1="go", bs2="cross", back="flat"), "gun5",
        ["ps1", "bs2", "back"], "Deep cross behind the linebackers with a post clearing the safety.",
        ["Play-action or quick drop.", "Post first if the safety vacates.", "Hit the crosser as he clears the LBs.", "Flat as the outlet."],
        ["Crosser stays on a rising line.", "Post must hold the safety."], "Cover 3, man without a robber.")
concept("hitch_seam", "HITCH-SEAM", dict(ps1="hitch", ps2="seam", ps3="seam", bs1="hitch", bs2="seam", back="protect"), "gun3",
        ["ps1", "ps2", "bs1"], "Hitches outside, seams inside: easy completions vs off coverage.",
        ["Pre-snap: corner depth > 6 yards? Throw the hitch.", "Squat corner → seam over him."], ["Hitch at 5, snap back to the QB."], "Off-corner coverage.")
concept("snag", "SNAG", dict(ps1="snag", ps2="corner", ps3="flat", bs1="slant", bs2="sit", back="flat"), "gun3",
        ["ps1", "back", "ps2"], "Triangle read: snag at 5, corner over the top and the flat underneath.",
        ["Read the flat defender.", "Snag between the LBs is the bread and butter.", "Corner if the corner squats."],
        ["Snag settles in the window, facing the QB."], "Zone and cover 2.")
concept("boot", "BOOT FLOOD", dict(ps1="go", ps2="out10", ps3="flat", bs1="cross", bs2="drag", back="flat"), "boot",
        ["ps3", "bs1", "ps2"], "Run fake one way, the QB boots the other with flat, cross and deep options.",
        ["Sell the run fake — back to the defense.", "Boot to 7 yards depth outside the tackle.", "Read high-low: cross → flat.", "Run it if the edge is empty."],
        ["Run fake must be identical to the base run.", "Flat runner gets to the sideline."], "Teams that flow hard to stop the run.", side="weak")
concept("pa_pop", "PLAY-ACTION POP", dict(ps1="post", ps2="seam", ps3="seam", bs1="go", bs2="seam", back="protect"), "pa",
        ["ps2", "ps1", "bs1"], "Run fake freezes the LBs and safeties; the TE pops up the seam behind them.",
        ["Hard run fake.", "Eyes on the safety.", "Safety bites → seam/post.", "Safety stays deep → throw away from him."],
        ["TE must sell the block for one count, then release."], "Aggressive run-support safeties.")
concept("bubble", "BUBBLE SCREEN", dict(ps1="stalk", ps2="bubble", ps3="stalk", bs1="go", bs2="seam", back="protect"), "gun3",
        ["ps2"], "Fast perimeter throw that makes the defense defend the width of the field.",
        ["Catch the snap and turn, throw on rhythm to the bubble.", "Lead him to the sideline, chest height."],
        ["Stalk blockers stay on their man.", "Bubble catches and goes north."], "Overloaded boxes; soft edges.")
concept("tunnel", "TUNNEL SCREEN", dict(ps1="tunnel", ps2="crack", ps3="crack", bs1="go", bs2="seam", back="protect"), "gun3",
        ["ps1"], "Wide receiver comes back inside behind a wall of linemen and the slot's crack block.",
        ["Catch, quick set, deliver to the WR on his first step back inside."], ["OL: release flat outside, block the first threat."], "Press and soft corners.")
concept("rb_screen", "RB SCREEN", dict(ps1="go", ps2="seam", ps3="seam", bs1="go", bs2="seam", back="screen_rb"), "gun5",
        ["back"], "Let the rush in, then dump it over their heads to the back behind a wall.",
        ["Drop deeper than normal — invite the rush.", "Loft it over the rusher to the back."],
        ["OL: set, let them go, release.", "Back: sell the pass block for a 2-count."], "Heavy pressure, aggressive pass rushers.")
concept("drive", "DRIVE", dict(ps1="go", ps2="dig", ps3="drag", bs1="post", bs2="drag", back="check_flat"), "gun5",
        ["ps3", "ps2", "back"], "Shallow cross underneath, dig over the top: high-low the middle linebacker.",
        ["Eyes on the middle backer.", "He drops → shallow.", "He jumps the shallow → dig."], ["Shallow crosses at 2–3 yards."], "Zone with a single middle LB.")
concept("post_wheel", "POST-WHEEL", dict(ps1="post", ps2="wheel", ps3="flat", bs1="dig", bs2="drag", back="protect"), "gun5",
        ["ps2", "ps1", "bs1"], "Outside receiver runs the post inside, slot wheels up the sideline behind him.",
        ["Watch the corner: if he follows the post, throw the wheel.", "Post if the safety drifts to the wheel."], ["Wheel: get width first, then up."], "Man and cover 3.")


def _concept_routes(name):
    return PASS[name]


# -------------------------------------------------------------------- helpers
def route_pts(name, x, y, out):
    """Return path points for a named route. out = +1/-1 toward the near sideline."""
    i = -out
    r = {
        "go": [(x, 2), (x + out * 0.6, 13.5)],
        "fade": [(x + out * 1.2, 2), (x + out * 2.2, 13.5)],
        "seam": [(x, 2), (x + i * 0.3, 13.5)],
        "hitch": [(x, 5), (x + i * 0.6, 4)],
        "slant": [(x, 1.2), (x + i * 4.5, 5.5)],
        "out": [(x, 5), (x + out * 4.5, 5)],
        "out10": [(x, 10), (x + out * 4.5, 9.5)],
        "dig": [(x, 12), (x + i * 9, 12)],
        "in6": [(x, 6), (x + i * 7, 6)],
        "curl": [(x, 11), (x + i * 1.2, 9.5)],
        "comeback": [(x, 13), (x + out * 2, 11.5)],
        "post": [(x, 10), (x + i * 5, 13.5)],
        "corner": [(x, 10), (x + out * 4.5, 13.5)],
        "flag": [(x, 6), (x + out * 4.5, 12)],
        "flat": [(x + out * 1, 1), (x + out * 5, 2.5)],
        "arrow": [(x + out * 5, 3.5)],
        "whip": [(x + i * 2, 3), (x + out * 1.5, 3)],
        "drag": [(x + i * 1, 1.8), (-out * 8, 2.8)],
        "mesh": [(x + i * 1, 2.5), (-out * 9, 5.5)],
        "cross": [(x, 6), (-out * 12, 12.5)],
        "deep_cross": [(x, 8), (-out * 10, 14)],
        "stick": [(x, 5), (x + out * 0.9, 5)],
        "snag": [(x, 4.5), (x + i * 1.8, 5.8)],
        "sit": [(x + i * 1.5, 5.5)],
        "wheel": [(x + out * 2, y + 1.8), (x + out * 4.5, 4), (x + out * 4.8, 13.5)],
        "swing": [(x + out * 2.5, y + 0.2), (x + out * 6, y + 1.6), (x + out * 7.5, 1.5)],
        "bubble": [(x + out * 1.5, y - 1.0), (x + out * 3.5, y - 0.6), (x + out * 4.5, 1.2)],
        "now": [(x + i * 0.1, y - 0.9)],
        "check_flat": [(x + out * 1.5, y + 0.6), (x + out * 5, 1.2)],
        "angle": [(x + out * 2.5, y + 2.0), (x + i * 0.5, 3.5)],
        "skinny": [(x, 8), (x + i * 2, 13.5)],
        "quick_out": [(x, 3), (x + out * 4, 3)],
        "stalk": [(x, 3.2)],
        "crack": [(x + i * 3.5, 3.5)],
        "block": [(x + i * 0.3, y - 0.6)],
        "protect": [(x + out * 0.8, y + 0.4)],
        "seal_lb": [(x + i * 2.0, 3.8)],
        "tunnel": [(x, y + 1.3), (x + i * 3.0, y + 0.3), (x + i * 4.5, 3)],
        "screen_rb": [(x + out * 1.0, y - 0.6), (x + out * 5.5, y - 0.2), (x + out * 6.5, 1.5)],
    }[name]
    return [(x, y)] + r


ROUTE_END = {"stalk": "t", "crack": "t", "block": "t", "protect": "t", "seal_lb": "t"}
ROUTE_SMOOTH = {"wheel", "swing", "bubble", "screen_rb", "tunnel", "check_flat"}


@dataclass
class Play:
    call: str
    form_key: str
    form_name: str
    family: str
    title: str
    what: str
    diagram_fn: object
    assignments: list
    steps: list
    points: list
    best: str
    pairs: str = ""
    tags: list = field(default_factory=list)
    week: int = 1
    blocks: list = None   # slide-style breakdown: [(position name, [short lines])]


# ---------------------------------------------------------------- the engine
class Build:
    def __init__(self, form_key, left=False, d=1, pos_names=None):
        self.form_key = form_key
        self.f = FM.get(form_key, left)
        self.d = d
        self.names = pos_names or {}
        self.paths = []      # (label, pts, style, end, smooth, motion)
        self.text = {}       # label -> assignment text
        self.keys = set()
        self.rings = []
        self.extra_labels = []
        line = [(k, v) for k, v in self.f.items() if v[2] in ("OL", "TE") and v[1] > -1.2]
        self.center = "C"
        cx = self.f["C"][0]
        self.ps = sorted([k for k, v in line if (v[0] - cx) * d > 0.2], key=lambda k: abs(self.f[k][0] - cx))
        self.bs = sorted([k for k, v in line if (v[0] - cx) * d < -0.2], key=lambda k: abs(self.f[k][0] - cx))
        self.cx = cx

    # ---- geometry
    def X(self, k):
        return self.f[k][0]

    def Y(self, k):
        return self.f[k][1]

    def gap(self, letter, side=None):
        """x position of a playside (or backside) gap."""
        side = side or self.d
        L = self.ps if side == self.d else self.bs
        xs = [self.cx] + [self.X(k) for k in L]
        idx = "ABCD".find(letter)
        if letter == "E":  # edge
            return xs[-1] + side * 3.2
        if idx + 1 < len(xs):
            return (xs[idx] + xs[idx + 1]) / 2
        return xs[-1] + side * (1.0 + 0.9 * (idx + 1 - len(xs)))

    def emol(self, side=None):
        side = side or self.d
        L = self.ps if side == self.d else self.bs
        return (self.X(L[-1]) if L else self.cx) + side * 1.1

    # ---- block primitives (relative to play direction)
    def blk(self, k, kind, **kw):
        x, y = self.X(k), self.Y(k)
        d = self.d
        Ly = y
        pts = {
            "down": [(x, y), (x - d * 1.3, y + 1.6)],
            "back": [(x, y), (x - d * 1.3, y + 1.4)],
            "base": [(x, y), (x, y + 1.6)],
            "reach": [(x, y), (x + d * 1.1, y + 1.4)],
            "zone": [(x, y), (x + d * 0.8, y + 1.7)],
            "climb": [(x, y), (x + d * 0.5, y + 1.6), (x + d * 0.9, 4.0)],
            "hinge": [(x, y), (x - d * 0.4, y + 0.4), (x - d * 1.0, y - 0.3)],
            "cut": [(x, y), (x - d * 0.6, y + 1.3)],
            "pull_kick": [(x, y), (x + d * 0.6, Ly - 0.9), (kw.get("tx", self.emol()) - d * 1.1, Ly - 0.9), (kw.get("tx", self.emol()), Ly + 0.9)],
            "pull_wrap": [(x, y), (x + d * 0.6, Ly - 0.9), (kw.get("tx", self.gap("C")) - d * 0.7, Ly - 0.9), (kw.get("tx", self.gap("C")), Ly + 1.8), (kw.get("tx", self.gap("C")) + d * 0.3, 4.2)],
            "pull_lead": [(x, y), (x + d * 0.6, Ly - 1.0), (kw.get("tx", self.emol() + d * 1.5) - d * 1.0, Ly - 1.0), (kw.get("tx", self.emol() + d * 1.5), 2.0), (kw.get("tx", self.emol() + d * 1.5) + d * 0.6, 4.2)],
            "trap": [(x, y), (x + d * 0.5, Ly - 0.6), (kw.get("tx", self.gap("B")) - d * 0.5, Ly - 0.5), (kw.get("tx", self.gap("B")), Ly + 0.9)],
            "wedge": [(x, y), (x + (self.cx - x) * 0.45, y + 1.8)],
            "arc": [(x, y), (x + d * 1.4, y + 1.0), (x + d * 2.0, 4.5)],
            "pro": [(x, y), (x + (0.35 if x > self.cx + 2 else -0.35 if x < self.cx - 2 else 0), y - 1.0)],
            "pa_pro": [(x, y), (x, y + 0.9)],
            "fill": [(x, y), (x - d * 0.8, y + 1.2)],
            "screen": [(x, y), (x, y - 0.8), (x + d * 3.0 + (self.cx - x) * 0.2, y - 0.8), (x + d * 5.0, 0.5)],
            "double": [(x, y), (x + d * 0.5 * (1 if kw.get("out") else -1), y + 1.6)],
            "leave": [(x, y), (x - d * 0.4, y + 1.4), (x - d * 0.8, 4.0)],
            "crack": [(x, y), (x - d * 3.5 if abs(x) > 6 else x - d * 1.8, 3.5)],
            "stalk": [(x, y), (x, 3.0)],
            "run_off": [(x, y), (x, 5.0), (x - d * 2.0, 8.0)],
            "seal": [(x, y), (x - d * 1.6, 3.8)],
        }[kind]
        self.paths.append((k, pts, "block", "t", False, 0))
        self.text[k] = BLOCK[kind]

    def back_path(self, k, pts, style="run", end="arrow", smooth=True, txt=None, key=False, motion=0):
        self.paths.append((k, [(self.X(k), self.Y(k))] + pts, style, end, smooth, motion))
        if txt:
            self.text[k] = txt
        if key:
            self.keys.add(k)

    def route(self, k, name, out=None, motion_to=None):
        x, y = self.X(k), self.Y(k)
        mpts = []
        if motion_to is not None:
            mpts = [(x, y), (motion_to, y)]
            x = motion_to
        if out is None:
            out = 1 if x > self.cx + 0.2 else (-1 if x < self.cx - 0.2 else self.d)
        pts = route_pts(name, x, y, out)
        if mpts:
            pts = mpts[:1] + pts
        self.paths.append((k, pts, "route", ROUTE_END.get(name, "arrow"), name in ROUTE_SMOOTH, 1 if mpts else 0))
        self.text[k] = ROUTE_TXT[name]

    def name(self, k):
        if k in self.names:
            return self.names[k]
        role = self.f[k][2]
        base = FM.POS_NAMES.get(k, k)
        if k == "H":
            base = {"RB": "Halfback", "TE": "H-Back", "WING": "Wingback", "SLOT": "Slot"}.get(role, base)
        if k == "Y" and role == "SLOT":
            base = "Y Slot"
        if k == "X" and role == "TE":
            base = "Split End (tight)"
        if k == "T" and role == "SLOT":
            base = "Tailback (split out)"
        if k == "F" and role == "RB" and self.form_key.startswith(("GUN", "PISTOL")):
            base = "Running Back"
        if k == "T" and self.form_key.startswith(("GUN", "ACE", "PISTOL_H", "PISTOL_TRIPS", "7V7")):
            base = "Running Back"
        return f"{k} – {base}"

    # ---- diagram
    def diagram(self, width, ghost=True, ymax=11.5, extra=None, theme="print", height=None):
        D = Diagram(width, xmax=17.5, ymin=-8.4, ymax=ymax, theme=theme, height=height)
        if ghost:
            for (lbl, x, y) in ghost_defense(self.f):
                if y < ymax - 0.6:
                    D.d(x, y, lbl, "ghost")
        for (k, pts, style, end, smooth, motion) in self.paths:
            D.path(pts, style if style != "block" else "route", end=end, smooth=smooth, motion=motion)
        for (x, y, t) in self.rings:
            D.ring(x, y, t)
        for k, (x, y, r) in self.f.items():
            kind = "key" if k in self.keys else ("center" if k == "C" else "o")
            D.o(x, y, "" if r == "OL" else k, kind)
        for (x, y, s) in self.extra_labels:
            x, y = D.clip(x, y)
            D.text(x, y - 0.3, s, size=8.5, color=C_ACC)
        if extra:
            extra(D)
        return D

    def table(self):
        order = ["LT", "LG", "C", "RG", "RT", "Y", "X", "H", "W", "S", "Z", "Q", "B", "F", "T"]
        rows = []
        for k in order + [k for k in self.f if k not in order]:
            if k in self.f and k not in [r[0] for r in rows]:
                rows.append((k, self.name(k), self.text.get(k, "Carry out your fake; be a decoy to the whistle.")))
        return [(n, t) for (_, n, t) in rows]


def ghost_defense(f):
    """A plausible defensive look to draw behind every offensive play."""
    st = FM.strength(f)
    if len([1 for v in f.values() if v[2] == "OL"]) == 1:  # 7v7: no linemen
        wr = sorted([v for v in f.values() if v[2] in ("WR", "SLOT")], key=lambda v: v[0])
        out = [("C", wr[0][0] + 0.5, 6.0), ("C", wr[-1][0] - 0.5, 6.0), ("$", st * 6.5, 11.0), ("F", -st * 6.5, 11.0),
               ("M", 0.0, 5.0), ("S", st * 4.5, 4.5), ("W", -st * 4.5, 4.5)]
        return out
    line = [v for k, v in f.items() if v[2] in ("OL", "TE") and v[1] > -1.2]
    out = []
    for side in (1, -1):
        xs = [abs(v[0]) for v in line if v[0] * side > 0]
        L = max(xs) if xs else 3.0
        out.append(("E", side * (L + (0.9 if L >= 4 else 0.7)), 0.9))
    out.append(("T", st * 2.1, 0.9))
    out.append(("T", -st * 0.7, 0.9))
    detached = [(v[0], v[1]) for k, v in f.items() if v[2] in ("WR", "SLOT") and abs(v[0]) > 6.5]
    st_detached = sorted([p for p in detached if p[0] * st > 0], key=lambda p: abs(p[0]))
    heavy = len(detached) == 0
    if len(detached) >= 3 and st_detached:
        slot = st_detached[0]
        out += [("N", slot[0] - st * 1.2, 4.0), ("M", st * 1.4, 4.8), ("W", -st * 1.8, 4.8)]
    else:
        stx = [abs(v[0]) for v in line if v[0] * st > 0]
        out += [("S", st * ((max(stx) if stx else 3) + 0.4), 4.3), ("M", st * 0.5, 4.8), ("W", -st * 2.6, 4.5)]
    for side in (1, -1):
        wide = sorted([p for p in detached if p[0] * side > 0], key=lambda p: -abs(p[0]))
        if wide:
            out.append(("C", wide[0][0] - side * 0.5, 6.5))
        else:
            out.append(("C", side * 8.5, 6.0))
    if heavy:
        stx = [abs(v[0]) for v in f.values() if v[0] * st > 0 and v[2] != "OL"]
        out += [("$", st * ((max(stx) if stx else 4.5) + 1.8), 4.6), ("F", -st * 1.5, 10.5)]
    else:
        out += [("$", st * 6.5, 10.5), ("F", -st * 6.5, 10.5)]
    return out


def ghost_find(f, label, side):
    for (l, x, y) in ghost_defense(f):
        if l == label and x * side > 0:
            return (x, y)
    return None


HOLE_NAMES = {"A": "A gap", "B": "B gap", "C": "C gap (off tackle)", "D": "D gap (outside the TE)", "E": "the edge"}


# ------------------------------------------------------------------ run plays
def run_play(call, form_key, scheme, d=1, left=False, carrier="T", lead=None, kick=None, wrap=None,
             fakes=(), hole=None, motion=None, read=None, tags=(), week=1, names=None, form_name="",
             pitch=None, dive=None, direct=False):
    b = Build(form_key, left=left, d=d, pos_names=names)
    S = SCHEMES[scheme]
    ps, bs = b.ps, b.bs
    hole = hole or {"power": "C", "counter": "C", "iso": "B", "zone": "B", "stretch": "D", "toss": "E",
                    "trap": "B", "dive": "A", "wedge": "A", "sweep": "D", "jet": "E", "superpower": "C",
                    "option": "B", "zone_read": "B", "power_read": "E", "qb_power": "C"}[scheme]
    hx = b.gap(hole)
    used = {carrier, lead, kick, wrap, motion, pitch, dive}
    ps = [k for k in ps if k not in used]
    bs = [k for k in bs if k not in used]
    # ---------------- line
    if scheme in ("power", "superpower", "qb_power", "power_read"):
        for k in ps:
            b.blk(k, "down")
        b.blk("C", "back")
        if bs:
            b.blk(bs[0], "pull_wrap", tx=hx)
        if scheme == "superpower" and len(bs) > 1:
            b.blk(bs[1], "pull_wrap", tx=hx + d * 0.5)
            b.text[bs[1]] = BLOCK["pull_wrap"] + " You're the second puller — follow the guard and take the next color."
            for k in bs[2:]:
                b.blk(k, "hinge")
        else:
            for k in bs[1:]:
                b.blk(k, "hinge")
    elif scheme == "counter":
        for k in ps:
            b.blk(k, "down")
        b.blk("C", "back")
        if len(bs) > 0:
            b.blk(bs[0], "pull_kick")
        if len(bs) > 1:
            b.blk(bs[1], "pull_wrap", tx=hx)
        for k in bs[2:]:
            b.blk(k, "hinge")
    elif scheme in ("iso", "dive"):
        for k in ps + ["C"] + bs:
            b.blk(k, "base")
    elif scheme in ("zone", "zone_read"):
        for k in ps + ["C"]:
            b.blk(k, "zone")
        for i, k in enumerate(bs):
            b.blk(k, "zone" if i < 2 else "cut")
        if scheme == "zone_read" and bs:
            last = bs[-1]
            b.blk(last, "zone")  # tackle zones inside; end is left
    elif scheme in ("stretch", "jet"):
        for k in ps + ["C"]:
            b.blk(k, "reach")
        for k in bs:
            b.blk(k, "cut")
    elif scheme == "toss":
        for k in ps[1:]:
            b.blk(k, "down")
        if ps:
            b.blk(ps[0], "pull_lead")
        b.blk("C", "reach")
        for k in bs:
            b.blk(k, "cut")
    elif scheme == "trap":
        if ps:
            b.blk(ps[0], "climb")
            b.text[ps[0]] = "LEAD UP: Release inside the first down lineman to the backside linebacker. Don't block the man being trapped."
        for k in ps[1:]:
            b.blk(k, "climb")
        b.blk("C", "back")
        if bs:
            b.blk(bs[0], "trap", tx=b.gap("A") + d * 1.2)
        for k in bs[1:]:
            b.blk(k, "cut")
    elif scheme == "wedge":
        for k in ps + ["C"] + bs:
            b.blk(k, "wedge")
        b.text["C"] = "WEDGE POINT: You are the point. Fire straight ahead low; everyone forms on your hips."
    elif scheme == "sweep":
        for k in ps[1:]:
            b.blk(k, "down")
        if ps:
            b.blk(ps[0], "pull_kick", tx=b.emol() + d * 1.0)
        b.blk("C", "back")
        if bs:
            b.blk(bs[0], "pull_wrap", tx=b.emol() + d * 0.2)
        for k in bs[1:]:
            b.blk(k, "cut")
    elif scheme == "option":
        # base, but leave the first defender outside the PS tackle (dive key)
        for k in ps:
            b.blk(k, "base")
        b.blk("C", "base")
        for k in bs:
            b.blk(k, "cut")
        te = [k for k in ps if b.f[k][2] == "TE"]
        if te:
            b.blk(te[-1], "arc")
        tack = [k for k in ps if b.f[k][2] == "OL"]
        if tack:
            b.blk(tack[-1], "leave")
    # ---------------- read marks
    if scheme == "zone_read":
        e = ghost_find(b.f, "E", -d)
        if e:
            b.rings.append((e[0], e[1], "READ"))
    if scheme == "power_read":
        e = ghost_find(b.f, "E", d)
        if e:
            b.rings.append((e[0], e[1], "READ"))
    if scheme == "option":
        e = ghost_find(b.f, "E", d)
        if e:
            b.rings.append((e[0], e[1], "DIVE KEY"))
        c = ghost_find(b.f, "C", d) or ghost_find(b.f, "$", d)
        if c:
            b.rings.append((min(abs(c[0]), abs(e[0]) + 3.5) * d if e else c[0], 3.2, "PITCH KEY"))
    # ---------------- receivers / wings not on the line
    for k, (x, y, r) in b.f.items():
        if k in b.text or k == carrier or r in ("QB", "RB") or k in (lead, kick, wrap, pitch, dive):
            continue
        if r in ("WR", "SLOT"):
            if x * d > 0:
                b.blk(k, "stalk")
            else:
                b.blk(k, "run_off")
                b.text[k] = BLOCK["run_off"]
        elif r == "WING":
            if k == motion:
                continue
            if x * d > 0:
                b.blk(k, "seal" if scheme not in ("toss", "stretch", "jet") else "reach")
            else:
                b.blk(k, "cut")
                b.text[k] = "CUTOFF: Step inside and wall off the backside — nobody chases from behind."
    # ---------------- backs
    qb = "Q" if "Q" in b.f else "B"
    cxp, cyp = b.X(carrier), b.Y(carrier)
    if motion:
        mx = b.X(motion)
    if lead:
        tgt = (hx, 4.0) if scheme in ("iso", "zone", "dive") else (b.emol() + d * 1.2, 2.2)
        b.back_path(lead, [(hx * 0.6, -1.5), tgt], style="route", end="t", smooth=True,
                    txt=BLOCK["lead"] if scheme not in ("toss", "sweep", "stretch", "jet") else BLOCK["lead_edge"])
    if kick:
        b.back_path(kick, [(b.emol() - d * 1.5, -1.2), (b.emol() - d * 0.2, 0.6)], style="route", end="t", smooth=True, txt=BLOCK["kick"])
    if wrap:
        b.back_path(wrap, [(hx - d * 0.6, -1.4), (hx, 1.5), (hx + d * 0.4, 4.2)], style="route", end="t", smooth=True, txt=BLOCK["pull_wrap"])
    # carrier path
    if scheme in ("toss", "power_read"):
        pts = [(cxp + d * 2.5, cyp + 0.4), (b.emol() + d * 1.8, -1.0), (b.emol() + d * 2.6, 3.0), (b.emol() + d * 2.4, 7.5)]
    elif scheme == "counter":
        pts = [(cxp - d * 1.3, cyp + 0.3), (cxp + d * 0.3, -3.2), (hx - d * 0.2, -0.6), (hx + d * 0.2, 3.0), (hx + d * 0.5, 7.5)]
    elif scheme == "superpower":
        pts = [(cxp * 0.35, -3.1), (hx - d * 1.0, -1.7), (hx, 1.0), (hx + d * 0.4, 7.0)]
    elif scheme in ("sweep",):
        pts = [(cxp * 0.3 + d * 0.5, -3.0), (b.emol() - d * 0.2, -1.6), (b.emol() + d * 0.4, 1.6), (b.emol() + d * 0.8, 7.5)]
    elif scheme == "jet":
        pts = [(b.cx + d * 1.2, cyp), (b.emol() + d * 2.5, cyp + 0.4), (b.emol() + d * 3.5, 3.0), (b.emol() + d * 3.4, 7.5)]
    elif scheme == "qb_power":
        pts = [(cxp + d * 0.6, cyp + 0.4), (hx - d * 0.4, -1.4), (hx, 1.2), (hx + d * 0.3, 7.0)]
    elif scheme == "option":
        pts = [(cxp + d * 1.2, cyp + 0.5), (hx + d * 3.0, -1.6), (hx + d * 5.5, 1.5), (hx + d * 5.8, 7.0)]
    elif scheme == "wedge":
        pts = [(b.cx + d * 0.4, -1.6), (b.cx + d * 0.3, 1.2), (b.cx + d * 0.2, 6.0)]
    else:
        pts = [(hx * 0.5, cyp * 0.5 if cyp < -3 else cyp + 0.8), (hx, -1.0), (hx, 1.2), (hx + d * 0.3, 7.0)]
    if motion and motion == carrier:
        b.back_path(carrier, [(b.cx - d * 0.1, cyp)] + pts[1:], motion=1, key=True)
        # the zigzag segment is the motion
    else:
        b.back_path(carrier, pts, key=True)
    b.text[carrier] = f"BALL CARRIER: {S['carrier'][0]} Aiming point: {HOLE_NAMES[hole]}."
    # option pieces
    if dive:
        b.back_path(dive, [(b.gap("B") * 0.6, -2.0), (b.gap("B"), 1.5)], style="dash", txt="DIVE: Fast path to the inside hip of the guard; take it if given, else fake hard and block the first backer.")
    if pitch:
        px, py = b.X(pitch), b.Y(pitch)
        b.back_path(pitch, [(px + d * 3.5, py + 0.2), (b.emol() + d * 6.0, -2.0)], style="dash", txt="PITCH: Get to pitch relationship (4 wide, 1 back) — catch the pitch with your eyes and turn it up.")
    # QB action
    if qb in b.f and qb != carrier:
        qx, qy = b.X(qb), b.Y(qb)
        if direct or qb == "B":
            if qb not in b.text:
                b.back_path(qb, [(hx * 0.6, -1.2), (b.emol() - d * 0.5, 1.2)], style="route", end="t", smooth=True,
                            txt="BLOCKING BACK: Lead through the hole and take the first defender who shows — usually the playside LB.")
        elif scheme in ("zone_read",):
            b.back_path(qb, [(qx - d * 1.0, qy + 0.2), (qx - d * 4.0, -2.2), (qx - d * 6.0, 1.0)], style="dot",
                        txt="QB: " + " ".join(S["qb"]))
        elif scheme == "power_read":
            b.back_path(qb, [(qx + d * 0.5, qy + 1.0), (hx - d * 0.4, -1.0), (hx - d * 0.2, 4.0)], style="dot",
                        txt="QB: " + " ".join(S["qb"]))
        elif scheme == "option":
            b.back_path(qb, [(qx + d * 1.5, qy + 0.1), (hx + d * 2.5, -1.3), (hx + d * 3.6, 1.2)], style="dash",
                        txt="QB: " + " ".join(S["qb"]))
        elif scheme == "wedge" and carrier == qb:
            pass
        else:
            boot_side = -d
            b.back_path(qb, [(qx + boot_side * 1.0, qy - 1.2), (qx + boot_side * 4.5, qy - 1.6)], style="dot", smooth=True,
                        txt="QB: " + " ".join(S["qb"]))
    for fk in fakes:
        fx, fy = b.X(fk), b.Y(fk)
        b.back_path(fk, [(fx + (-d) * 1.5, fy + 1.0), (fx + (-d) * 3.0, -0.5)], style="dot", smooth=True,
                    txt="FAKE: Carry out your fake at full speed — make a defender tackle you.")
    if motion and motion != carrier:
        mx, my = b.X(motion), b.Y(motion)
        b.paths.append((motion, [(mx, my), (b.cx + d * 1.0, my), (b.cx + d * 6, my + 0.6)], "route", "arrow", False, 1))
        b.text[motion] = "JET MOTION: Full-speed motion on cue; sell the jet sweep through the mesh and out to the edge."
    steps = [("Ball carrier", S["carrier"])]
    if qb in b.f and qb != carrier and not direct and qb != "B":
        steps.append(("Quarterback", S["qb"]))
    if direct or qb == "B":
        steps[0] = ("Ball carrier (direct snap)", ["Receive the direct snap at the belt, eyes to the hole."] + S["carrier"][1:])
    fam = S["family"]
    return Play(call=call, form_key=form_key, form_name=form_name or form_key, family=fam, title=S["title"],
                what=S["what"], diagram_fn=lambda w, b=b, **kw: b.diagram(w, **kw),
                assignments=b.table(), steps=steps, points=S["points"], best=S["best"], pairs=S["pairs"],
                tags=list(tags), week=week)


# ------------------------------------------------------------------ pass plays
def classify(f, side):
    rec = [(k, v) for k, v in f.items() if v[2] in ("WR", "SLOT", "TE", "WING")]
    ps = sorted([k for k, v in rec if v[0] * side > 0], key=lambda k: -abs(f[k][0]))
    bs = sorted([k for k, v in rec if v[0] * side < 0], key=lambda k: -abs(f[k][0]))
    backs = [k for k, v in f.items() if v[2] == "RB"]
    return ps, bs, backs


def pass_play(call, form_key, concept_key, left=False, side=None, tags=(), week=1, names=None, form_name="",
              protect=(), overrides=None, run_fake=None, motion=None, motion_to=None, thrower="Q"):
    C = PASS[concept_key]
    f = FM.get(form_key, left)
    st = FM.strength(f)
    if side is None:
        side = st if C["side"] == "strong" else -st
    b = Build(form_key, left=left, d=side, pos_names=names)
    ps, bs, backs = classify(b.f, side)
    backs = [k for k in backs if k != thrower]
    roles = {}
    for i, k in enumerate(ps[:3]):
        roles[k] = f"ps{i + 1}"
    for i, k in enumerate(bs[:2]):
        roles[k] = f"bs{i + 1}"
    for k in ps[3:] + bs[2:]:
        roles[k] = "extra"
    for i, k in enumerate(backs):
        roles[k] = "back" if i == 0 else "back2"
    routes = dict(C["routes"])
    routes.setdefault("extra", "protect")
    routes.setdefault("back2", "protect")
    if overrides:
        routes.update(overrides)
    drop = C["drop"]
    under_center = b.f.get(thrower, (0, -5, ""))[1] > -3
    if under_center and drop.startswith("gun"):
        drop = "3" if drop == "gun3" else "5"
    if not under_center and drop in ("3", "5"):
        drop = "gun3" if drop == "3" else "gun5"
    # line
    for k in b.ps + ["C"] + b.bs:
        if b.f[k][2] == "OL":
            b.blk(k, "pa_pro" if drop in ("boot", "pa") else ("screen" if concept_key == "rb_screen" and abs(b.X(k) - b.cx) < 3.1 else "pro"))
    # receivers & backs
    for k, role in roles.items():
        r = overrides.get(k) if overrides and k in overrides else routes.get(role, "protect")
        if k in protect:
            r = "protect" if b.f[k][2] != "RB" else "protect"
        if b.f[k][2] == "TE" and r in ("protect", "block"):
            b.blk(k, "pro")
            continue
        if b.f[k][2] == "RB" and r in ("protect", "block"):
            bx, by = b.X(k), b.Y(k)
            b.back_path(k, [(bx + (0.9 if bx >= b.cx else -0.9), by + 1.3)], style="route", end="t", smooth=False,
                        txt=ROUTE_TXT["protect"])
            continue
        mt = motion_to if k == motion else None
        b.route(k, r, motion_to=mt)
        if r not in ("stalk", "crack", "block", "protect", "seal_lb"):
            b.keys.add(k) if roles.get(k) == C["progression"][0] else None
    # QB / passer
    if thrower == "T" and "B" in b.f:
        bx, by = b.X("B"), b.Y("B")
        b.back_path("B", [(bx - side * 0.5, by + 0.9)], style="route", end="t", smooth=False,
                    txt="BLOCKING BACK: Step up and protect the B gap; take the first rusher inside-out.")
    if thrower in b.f:
        qx, qy = b.X(thrower), b.Y(thrower)
        if drop == "3":
            q = [(qx, qy - 2.6)]
        elif drop == "5":
            q = [(qx, qy - 4.5)]
        elif drop == "gun3":
            q = [(qx, qy - 0.8)]
        elif drop == "gun5":
            q = [(qx, qy - 2.0)]
        elif drop == "sprint":
            q = [(qx + side * 1.5, qy - 1.6), (qx + side * 5.5, qy - 1.0)]
        elif drop == "boot":
            q = [(qx - side * 1.6, qy - 1.0), (qx + side * 1.0, qy - 2.4), (qx + side * 6.0, qy - 1.2)]
        else:  # pa
            q = [(qx - side * 1.2, qy - 1.2), (qx, qy - 3.5)]
        b.back_path(thrower, q, style="route", end="arrow", smooth=len(q) > 2,
                    txt=("PASSER: " if thrower != "Q" else "QB: ") + DROP_TXT[drop])
    if run_fake:
        fk = run_fake
        if fk in b.text:
            pass
        fx, fy = b.X(fk), b.Y(fk)
        fd = -side if drop == "boot" else side
        b.paths = [p for p in b.paths if p[0] != fk]
        b.back_path(fk, [(fx + fd * 1.2, fy + 1.4), (fx + fd * 2.4, -0.8)], style="dot", smooth=True,
                    txt="RUN FAKE: Sell the run — form the pocket, bend at the waist, run through the line like you have it. Then block the first threat.")
    for (lbl, prog) in zip(["1", "2", "3", "4"], C["progression"]):
        for k, role in roles.items():
            if role == prog:
                pts = [p for p in b.paths if p[0] == k]
                if pts:
                    ex, ey = pts[-1][1][-1]
                    b.extra_labels.append((ex + (0.9 if ex >= 0 else -0.9), ey + 0.4, lbl))
    steps = [("Quarterback", [DROP_TXT[drop]] + C["steps"])]
    pts = list(C["points"])
    return Play(call=call, form_key=form_key, form_name=form_name or form_key, family="Pass" if drop not in ("boot", "pa") else "Play-action",
                title=C["title"], what=C["what"], diagram_fn=lambda w, b=b, **kw: b.diagram(w, ymax=14.0, **kw),
                assignments=b.table(), steps=steps, points=pts, best=C["beats"], pairs="", tags=list(tags), week=week)


# -------------------------------------------------------------------- RPOs
RPO_TXT = {
    "bubble": dict(title="ZONE + BUBBLE", read="the overhang/apex defender to the bubble side",
                   rules=["Apex defender widens with the bubble → HAND OFF.", "Apex defender squeezes the box → THROW THE BUBBLE."]),
    "glance": dict(title="ZONE + GLANCE", read="the boundary/near safety",
                   rules=["Safety triggers downhill on the run → PULL and throw the glance (skinny post).", "Safety stays deep → HAND OFF."]),
    "stick": dict(title="POWER + STICK", read="the flat/apex defender",
                  rules=["Apex fits the run → throw the stick/flat behind him.", "Apex carries the stick → HAND OFF."]),
    "now": dict(title="ZONE + NOW", read="the numbers count to the trips side",
                rules=["Pre-snap: more receivers than defenders outside the box → throw the NOW.", "Otherwise → hand off."]),
    "slant": dict(title="DUO + SLANT", read="the inside linebacker to the slant side",
                  rules=["LB steps up on the run → PULL and throw the slant behind him.", "LB drops → HAND OFF."]),
}


def rpo_play(call, form_key, run_scheme, pass_routes, rpo_key, d=1, left=False, carrier="T", read_label="N",
             tags=(), week=1, form_name="", names=None):
    p = run_play(call, form_key, run_scheme, d=d, left=left, carrier=carrier, tags=tags, week=week,
                 form_name=form_name, names=names)
    # rebuild with routes added to the pass side
    b = p.diagram_fn.__defaults__[0]
    for k, rname in pass_routes.items():
        b.paths = [x for x in b.paths if x[0] != k]
        b.route(k, rname)
    side = -d
    read = ghost_find(b.f, read_label, side) or ghost_find(b.f, "S", side) or ghost_find(b.f, "W", side)
    if read:
        b.rings.append((read[0], read[1], "READ"))
    R = RPO_TXT[rpo_key]
    p.title = R["title"]
    p.family = "RPO"
    p.what = f"Run-pass option: the line blocks {SCHEMES[run_scheme]['title'].lower()} while the QB reads {R['read']} and decides post-snap."
    p.steps = [("Quarterback", ["Catch the snap and put the ball in the back's belly; eyes on the read defender."] + R["rules"] +
                ["Decision is made by the end of the mesh — no hesitation."]), ("Ball carrier", SCHEMES[run_scheme]["carrier"])]
    p.points = ["Linemen block run every snap — never more than 1 yard downfield on a throw.",
                "Receivers on the pass side run their route full speed every time."] + SCHEMES[run_scheme]["points"][:2]
    p.best = "Defenses that use a conflict defender to fit the run and cover a receiver."
    p.assignments = b.table()
    if "Q" in b.f:
        for i, (n, t) in enumerate(p.assignments):
            if n.startswith("Q "):
                p.assignments[i] = (n, "QB: Mesh with the back, read the conflict defender: " + " ".join(R["rules"]))
    p.diagram_fn = lambda w, b=b, **kw: b.diagram(w, ymax=13.0, **kw)
    return p
