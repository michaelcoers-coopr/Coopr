# Live charity events

Do not deploy from this note. It records the choice and the steps Mike runs. Nothing here publishes a build or a server.

## Choice

The board is an Expo Router API route plus one JSON file, and the screens poll every 5 seconds.

There is no socket. Expo's API routes are request/response, which is the same shape as the caddie routes already in `apps/mobile/app/v1`. A poll is enough for a charity leaderboard and needs no extra process.

The file is `apps/mobile/.data/charity-events.json`, or the path in `COOPR_EVENT_STORE`. It is gitignored. A restart of `expo start` on a machine with a disk keeps the scores. EAS Hosting can wipe that disk. A real event needs a persistent path, or a later swap of `openFileEventStore` for a database. That swap stays behind the same `EventStore` methods.

Event traffic does not use `x-coopr-secret`, Upstash, or the caddie budget. A public board is a GET. The phone that created the event sends `x-coopr-organizer`. A scorer sends `x-coopr-guest`. The compare walks both strings.

## What a phone can do

- The organizer sets the name, the charity, the date, scramble or stroke play, shotgun or tee times, and the groups. The course is High Cedars. The reply is a join code, a QR mark, and a share link.
- Logos are PNG, JPG, or SVG, 512 KB, fitted with contain. Slots are title, one per hole, leaderboard, and the share card. An SVG with a script, an event handler, or a `javascript:` URL is refused. There is no full-screen sponsor page.
- A golfer joins with a code, a QR, or a link. The name is enough. There is no account. The first claim of the scorer can post. Everyone else can watch. A score is stored on the phone first, then sent. The same idempotency key cannot write twice. A newer tap replaces an older one for that hole. A dropped network keeps the tap in the outbox. A locked hole stays on the phone as held.
- Scramble is one card per group. Stroke play is one card per player. The scorer can post anyone in that group. A viewer cannot post. The organizer can correct a hole.
- Lower to-par is better. A card with no scores sorts last and has no rank. Equal to-par shares a rank. Thru, then name, only orders the tie.
- The in-app board, `/event/CODE`, and `/event/CODE/tv` read the same payload. TV mode scrolls and rotates the logos. The home map does not grow a button. Live event is in the open lime sheet.

## LEGAL REVIEW

`charityUrl` is an outbound link. COOPR does not collect donations, run a checkout, or hold money. Do not turn that field on for a real event until counsel signs off. The sample event leaves it empty.

The sample organizer token `sample-organizer-token` works only on the event code `SAMPLE`. It is a fake mark for the demo, not a key for other events. Sponsor names on that event are Sample Sponsor A, B, C, and D.

## App variables

- `EXPO_PUBLIC_EVENT_ORIGIN` — https origin, no path. The phone uses it for the board and the join link. On the web build, the page origin is used when this is unset. A value containing `REPLACE` is ignored. Native without an origin keeps scores on the phone.
- `COOPR_EVENT_STORE` — absolute path of the JSON file on the API host. Unset uses `apps/mobile/.data/charity-events.json` next to the running app.
- `ALLOWED_ORIGINS` — same list as the caddie, only for browsers on another origin. The phone app does not need it.

Do not put the event routes on the caddie secret. Do not point `EXPO_PUBLIC_EXTRACT_URL` at a different host for scores. The board and the caddie can share an origin and still stay apart.

## Deploy steps

Do not deploy from this note.

1. Pick a host that keeps a disk, or set `COOPR_EVENT_STORE` to a path that survives a restart.
2. Set `EXPO_PUBLIC_EVENT_ORIGIN` to that https origin before a native build. Web on the same origin works without it.
3. Leave the sample token as documentation. Do not reuse it for a real event.
4. Ask counsel before showing a charity link.
