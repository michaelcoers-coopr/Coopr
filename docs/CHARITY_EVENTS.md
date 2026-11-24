# Live charity events

Do not deploy from this note. It records the choice and the steps Mike runs. Nothing here publishes a build or a server.

## Choice

The board is an Expo Router API route plus one JSON file, and the screens poll every 5 seconds.

There is no socket. Expo's API routes are request/response, which is the same shape as the caddie routes already in `apps/mobile/app/v1`. A poll is enough for a charity leaderboard and needs no extra process.

The file is `apps/mobile/.data/charity-events.json`, or the path in `COOPR_EVENT_STORE`. It is gitignored. A restart of `expo start` on a machine with a disk keeps the scores. EAS Hosting can wipe that disk. A real event needs a persistent path, or a later swap of `openFileEventStore` for a database. That swap stays behind the same `EventStore` methods.

Event traffic does not use `x-coopr-secret`, Upstash, or the caddie budget. A public board is a GET. The phone that created the event sends `x-coopr-organizer`. A scorer sends `x-coopr-guest`. The compare walks both strings.

## What a phone can do

- The organizer sets the name, the charity, the date, scramble or stroke play, shotgun or tee times, and the groups. A new event starts on High Cedars. The seeded Panthers Classic uses Auburn Golf Course. The reply is a join code, a QR mark, and a share link.
- Logos are PNG, JPG, or SVG, 512 KB, fitted with contain. Slots are Presented by, Team + Hole, a hole sign, a kid-photo sign on that same hole, the Panther Cup, the mulligan mark, a prize partner, and the share card. Friend of the Panthers is a list of names, with no logo. An SVG with a script, an event handler, or a `javascript:` URL is refused. There is no full-screen sponsor page.
- Mulligans are a count of coins or tickets already paid off the app. The limit is per event, either per player or per team. TODO(Mike): the flyer says max 2 and the organizer record says max 4 per foursome. The seed uses 4 per team until that is confirmed. The same tap cannot count twice.
- The start can be a modified shotgun. Each team has a starting hole, and two teams may share one. The sample leaves the holes unassigned.
- Closest to the pin and longest drive are hole numbers on the event. They show on the web board, the TV, and the share card when they are set. The sample leaves them empty. There is no hole-in-one.
- There are no handicaps and no flights. A tie matches the cards from the back nine unless the organizer chooses a shared rank instead.
- Sponsor prices on the menu are a reference only: Title $2,500, Team + Hole $700, Winning Team Prize $500, Mulligan $500, Hole $250, Friend $100, Kid photo hole sign $50. The app does not take that money. Seeded names are placeholders.
- Registration stays on the outside form. The organizer pastes a CSV of team name and up to four golfers. Import replaces the teams only before any score is posted.
- A team claims its name once. The scorer sets it. A waitlist team is listed and is not ranked.
- The web board and the TV use the event accent. Panthers teal is `#1EC8C8` on navy. The phone app stays navy, white, red, and lime.
- After the round, a golfer can answer three questions or skip. Skip stores nothing. An email is stored only if they check the consent box.
- The web board and the share card link to Get COOPR. The App Store button appears only when `EXPO_PUBLIC_APP_STORE_URL` is set and does not contain `REPLACE`.
- A golfer joins with a code, a QR, or a link. The name is enough. There is no account. The first claim of the scorer can post. Everyone else can watch. A score is stored on the phone first, then sent. The same idempotency key cannot write twice. A newer tap replaces an older one for that hole. A dropped network keeps the tap in the outbox. A locked hole stays on the phone as held.
- Scramble is one card per group. Stroke play is one card per player. The scorer can post anyone in that group. A viewer cannot post. The organizer can correct a hole.
- Lower to-par is better. A card with no scores sorts last and has no rank. Equal to-par shares a rank. Thru, then name, only orders the tie.
- The in-app board, `/event/CODE`, and `/event/CODE/tv` read the same payload. TV mode scrolls and rotates the logos. The home map does not grow a button. Live event is in the open lime sheet.

## LEGAL REVIEW

`charityUrl` is an outbound link. COOPR does not collect donations, run a checkout, or hold money. Do not turn that field on for a real event until counsel signs off. The sample event leaves it empty.

LEGAL REVIEW before May 23, 2027: the three-question copy in `apps/mobile/src/events/survey.ts` (`SURVEY_PRIVACY` and `SURVEY_CONSENT`). The golfer can skip. The stored fields are the name they joined with, the three answers, and an email only when the box is checked. Do not add any other personal data.

LEGAL REVIEW: a Panthers player photo on a hole needs a parent or guardian's written consent before it is uploaded. The sample mark says Sample Player Photo. It is not a picture of a child.

The sample organizer token `sample-organizer-token` works only on the event code `SAMPLE`. It is a fake mark for the demo, not a key for other events. Sponsor art on that event is placeholder drawing. No real sponsor name is seeded.

The hole screen still walks High Cedars. Auburn's published par-71 card is on the event board. Yardages in the round are not Auburn until that course is mapped.

## App variables

- `EXPO_PUBLIC_EVENT_ORIGIN` — https origin, no path. The phone uses it for the board and the join link. On the web build, the page origin is used when this is unset. A value containing `REPLACE` is ignored. Native without an origin keeps scores on the phone.
- `EXPO_PUBLIC_APP_STORE_URL` — optional https link on Get COOPR. A value containing `REPLACE` is not shown.
- `COOPR_EVENT_STORE` — absolute path of the JSON file on the API host. Unset uses `apps/mobile/.data/charity-events.json` next to the running app.
- `ALLOWED_ORIGINS` — same list as the caddie, only for browsers on another origin. The phone app does not need it.

Do not put the event routes on the caddie secret. Do not point `EXPO_PUBLIC_EXTRACT_URL` at a different host for scores. The board and the caddie can share an origin and still stay apart.

## Deploy steps

Do not deploy from this note.

1. Pick a host that keeps a disk, or set `COOPR_EVENT_STORE` to a path that survives a restart.
2. Set `EXPO_PUBLIC_EVENT_ORIGIN` to that https origin before a native build. Web on the same origin works without it.
3. Leave the sample token as documentation. Do not reuse it for a real event.
4. Ask counsel before showing a charity link.
