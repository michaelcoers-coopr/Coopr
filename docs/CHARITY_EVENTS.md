# Live charity events

Do not deploy from this note. It records the choice and the steps Mike runs. Nothing here publishes a build or a server.

## Choice

The board is an Expo Router API route, and the screens poll every 5 seconds.

There is no socket. Expo's API routes are request/response, which is the same shape as the caddie routes already in `apps/mobile/app/v1`. A poll is enough for a charity leaderboard and needs no extra process.

The store is chosen by `DATABASE_URL`. When that variable is set, scores go to Postgres through Neon's HTTPS driver (`@neondatabase/serverless`). EAS Hosting throws the process away, so a TCP pool from `pg` would pin connections the platform recycles. One score is one conditional `UPDATE ... WHERE revision = <the revision the writer read>`. Postgres applies that statement on its own, so two groups posting at once both keep their holes. The same idempotency key is stored in that row. A retry, including an outbox replay, returns the score already saved and does not add a second one.

When `DATABASE_URL` is unset, the API uses one JSON file. That is the local and CI path. The file is `apps/mobile/.data/charity-events.json`, or the path in `COOPR_EVENT_STORE`. It is gitignored. A restart of `expo start` on a machine with a disk keeps the scores. A single save is a rename, so a crash does not leave a half-written file. Two server processes writing that file can still drop a score. EAS Hosting can wipe the disk. A real event uses `DATABASE_URL`.

The driver speaks Neon's SQL-over-HTTP endpoint. `DATABASE_URL` has to be a Neon connection string. A direct URL for another Postgres host will not connect.

Event traffic does not use `x-coopr-secret`, Upstash, or the caddie budget. A public board is a GET. The phone that created the event sends `x-coopr-organizer`. A scorer sends `x-coopr-guest`. The compare walks both strings.

## What a phone can do

- The organizer sets the name, the charity, the date, scramble or stroke play, shotgun or tee times, and the groups. A new event starts on High Cedars. The seeded Panthers Classic uses Auburn Golf Course. The reply is a join code, a QR mark, and a share link.
- Logos are PNG, JPG, or SVG, 512 KB, fitted with contain. Slots are Presented by, Team + Hole, a hole sign, a kid-photo sign on that same hole, the Panther Cup, the mulligan mark, a prize partner, and the share card. Friend of the Panthers is a list of names, with no logo. An SVG with a script, an event handler, or a `javascript:` URL is refused. There is no full-screen sponsor page.
- Mulligans are a count of coins or tickets already paid off the app. The limit is per event, either per player or per team. Mike confirmed the Panthers Classic is 4 per team. The same tap cannot count twice.
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

## Variables

Server variables live on the EAS Hosting environment. Do not put them in the app binary and do not commit the values.

- `DATABASE_URL` — Neon connection string. Sensitive. This is the durable store. Unset keeps the JSON file, which is what local expo and CI use.
- `COOPR_EVENT_STORE` — absolute path of the JSON file when `DATABASE_URL` is unset. Unset uses `apps/mobile/.data/charity-events.json` next to the running app.
- `ALLOWED_ORIGINS` — same list as the caddie, only for browsers on another origin. The phone app does not need it.

App variables are baked in at build time. `preview`, `production`, and `beta` in `apps/mobile/eas.json` set the event origin.

- `EXPO_PUBLIC_EVENT_ORIGIN` — `https://coopr.expo.app`, no path. The phone, the web board, the TV board, the QR code, and the share link all use this origin. On a web build the page origin is used when this is unset, so a board opened on that host still matches. A value containing `REPLACE` is ignored. A native dev build with the variable missing throws and names `EXPO_PUBLIC_EVENT_ORIGIN`. A release build without it uses `https://coopr.expo.app`.
- `EXPO_PUBLIC_APP_STORE_URL` — optional https link on Get COOPR. A value containing `REPLACE` is not shown.

Do not put the event routes on the caddie secret. Do not point `EXPO_PUBLIC_EXTRACT_URL` at a different host for scores. The board and the caddie can share an origin and still stay apart. Do not put `DATABASE_URL` in `EXPO_PUBLIC_` or in `eas.json`.

## Migration

Do not deploy from this note. The migration talks to Neon. It does not publish a host or a binary.

From the repo root, with `DATABASE_URL` exported in the shell:

```
npm run event-store:migrate
```

That runs `apps/mobile/scripts/event-store-migrate.ts`. It creates `coopr_charity_events` if needed and seeds the `SAMPLE` event. A second run leaves a current SAMPLE alone, including scores. The statement is `apps/mobile/src/events/sql/001_charity_events.sql`. The hosted process runs the same statement on its first request, so a missed migration still creates the table. Run the script anyway before the event so SAMPLE is there before the first golfer.

## Deploy steps

Do not deploy from this note. Mike runs these on his machine. Nothing here builds or submits the iOS app.

1. Create a Neon project and copy its connection string. Keep the value in the shell. Do not commit it.
2. Export `DATABASE_URL` and run `npm run event-store:migrate` from the repo root. The script prints the SAMPLE revision and does not print the connection string.
3. From `apps/mobile`, set the host variable. `EXPO_TOKEN` is the Expo access token already used for the caddie deploy.

```
npx eas-cli env:set --name DATABASE_URL --value "$DATABASE_URL" --environment production --visibility sensitive --scope project --type string --non-interactive
```

4. Deploy the host with the existing caddie path: `bash scripts/deploy-caddie.sh`. The charity routes are in the same Expo app, so that deploy publishes them. Do not stand up a second host. If the deploy prints an origin other than `https://coopr.expo.app`, change `EXPO_PUBLIC_EVENT_ORIGIN` in `apps/mobile/eas.json` on `preview`, `production`, and `beta` to that origin before the native build.
5. Build the TestFlight binary from the `beta` profile (or `preview`). Those profiles already set `EXPO_PUBLIC_EVENT_ORIGIN` to `https://coopr.expo.app`. A native dev client needs the same variable in the shell. Without it, the dev client throws instead of keeping scores only on the phone.
6. Open `https://coopr.expo.app/event/SAMPLE`, the TV route `/event/SAMPLE/tv`, and a join link from the organizer screen. The QR code and the share text use that same origin.
7. Leave the sample token as documentation. Do not reuse it for a real event.
8. Ask counsel before showing a charity link.
