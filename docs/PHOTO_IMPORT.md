# Photo import

Phase 1.5. The phone takes or picks a photo. A server reads it. Mike reviews every number, then the phone saves what he keeps.

The vision key never ships in the app. This file does not contain a key, a token, or a host.

## What the phone does

`apps/mobile/app/import.tsx` uses `expo-image-picker` (Expo Go SDK 58):

- Take a photo, one image.
- Choose from the library, up to eight images.
- Review a sample extraction. That button does not send a photo. It is the way to try the screen with no server and no key.

`EXPO_PUBLIC_EXTRACT_URL` is the server origin, set when the preview is published. It is not a secret. Leave it unset in git. If it is unset, Take a photo and Choose from the library stop and say the photo was not read.

A session token, if the server expects one, is typed on the phone. It is not written into the bundle or into SQLite.

Save is off when a real photo came back from stub mode. The sample button is the only path that can store fixture rows, and the screen says they are a fixture.

## What gets saved

After confirm, on this phone, for this session:

- Launch-monitor rows are simulator shots. Carry and total stay apart. One shot does not become a club call. The caddie still wants five shots.
- Another app's average is their reported number. It joins a blend only when Mike sets a sample size and an environment. The weight is a quarter of a COOPR measurement. P20 and P80 are not invented, so it cannot clear a hazard.
- Scorecard pars, stroke index, and yardages stay on the import. They do not replace High Cedars. Strokes copy onto blank High Cedars holes only when the switch is on.
- Clubs use the brand, model, loft, and shaft that were legible. A full in-play 14 sends the new club to testing.
- A matching row starts unchecked. Matching means the same club and every printed distance within half a yard, the same reported source and metric, the same scorecard hole and strokes, or the same brand, model, and loft.
- The photo URI is kept only when Mike asks. Default is off. It is not copied into SQLite.

## Server

`services/extract/server.ts` is a single POST endpoint, `/v1/extract`. It is not an npm workspace. From the repo root:

```bash
npx vite-node services/extract/server.ts
```

Port defaults to `8787`. Set `PORT` to change it. The process does not write the image to disk. The request buffer is zeroed after the answer. The response is `cache-control: no-store`. A body over 8 MB is refused.

Stub is the default. It returns a labeled sample and `readFromImage: false`. It does not look at the pixels.

Live mode needs both of these in the server environment, not in the app:

- `EXTRACT_MODE=live`
- `COOPR_VISION_API_KEY`

Optional:

- `COOPR_VISION_BASE_URL` — OpenAI-compatible origin. Default `https://api.openai.com/v1`.
- `COOPR_VISION_MODEL` — default `gpt-4o-mini`. Change it if that model is wrong for the account.
- `EXTRACT_TOKEN` — when set, the phone must send `Authorization: Bearer <token>`.

The request JSON is `{ "imageBase64", "mediaType" }`. The model is told to leave unreadable fields null and not to guess carry from total. The server parses that JSON and drops anything outside a believable range. If the answer would contain the image bytes, the server returns an error instead.

## What Mike provides

Send these on a secure channel. Not in chat, not in git, not in an issue.

1. `COOPR_VISION_API_KEY` for the vision account he wants to pay for.
2. The base URL and model name, if they are not the defaults above.
3. `EXTRACT_TOKEN`, if he wants the endpoint closed. He then types that same token on the phone.
4. The public origin of the server, which becomes `EXPO_PUBLIC_EXTRACT_URL` at publish time. That origin is not the key.

Deploy is any host that can run Node 22 and reach the vision API. This repo does not pick a host and does not start the process in production.

## Phone check

1. Open Add from photos. Tap Review a sample extraction. Confirm the banner says no photo was read.
2. The 6-iron stays unchecked until you choose Carry or Total. Include does not turn on while that choice is open. Save stores the other rows and leaves that one out.
3. Choose Total or Carry, leave the sample size blank on the 8-iron, save, and confirm that average is labeled and held out of the blend.
4. Open the scorecard. The photo pars are a separate card. High Cedars pars are unchanged unless the stroke switch was on.
5. With a server and a key, photograph a TrackMan screen. Confirm carry and total that you cannot read stay empty, then save only the rows you trust.
