# Ask COOPR

Hold-to-talk on the hole screen. It runs in Expo Go SDK 58. The ElevenLabs key never ships in the app. Music is not part of this path.

## On the phone

The play screen keeps Ask COOPR as a glass orb in the bottom corner. It is 96 points across. Press it to open the caddie conversation.

In a development build or a TestFlight install, speech-to-text is Apple's on-device recognizer (`expo-speech-recognition`). Hold the mic, or turn on hands-free in the overlay or in More. Expo Go has no native speech module, so the same overlay shows a typed question and still answers. The typed path is the Expo Go path. It is not a second product.

`expo-speech` speaks the reply one sentence at a time, behind a speaker adapter. The device voice is the one that speaks today. The ElevenLabs speaker is the same adapter and refuses until a later voice is connected. It does not pretend to speak. If he starts talking while the caddie is speaking, speech stops.

The overlay is full-bleed glass. It shows a waveform, the live transcript, and the reply as it arrives. Yardage digits use Bebas Neue. A haptic tick marks each sentence. Sample mode is labeled on that glass: "Sample mode. No live model on this server."

Hands-free and callouts default off. Callouts speak one short line when he arrives at a new tee, or within 30 yards of the last mark. An out-of-reach par 4 or 5 tee uses the same honest line as the card. It does not invent a landing yardage.

There is no `/v1/voice` route. Speech-to-text stays on the phone. The transcript goes to `POST /v1/caddie` when `EXPO_PUBLIC_EXTRACT_URL` is a real origin. Deploy steps and the server variables are in `docs/CADDIE_SERVER.md`. Do not deploy from this page.

A desk check can set `localStorage['coopr.voice.sim']` to a sentence. Releasing the button uses that sentence and does not record. That is not sample mode. Sample mode is only when the server says the clip was not heard.

## What he can say

English only. The parser is rules. Unknown fields stay null.

- A distance and a lie are a club question: "165 yards out, got a bunker on left, what should i hit off the rough?", "I'm in the sand 30 out", "150 out", "I'm in the rough".
- "what's it play like" and "how does it play" ask for plays-like.
- "should I lay up" asks the lay-up call. "what's my miss" asks the miss line.
- "I made a 5" and "I made five" set the score. "two putts", "one putt", and "no putts" set putts. "next hole" and "next" advance. "I hit it right", "I hit it left", "I hit it short", "I hit the fairway", and "I hit it in the hazard" tag the miss.

German and Spanish use the same intent fields and return them empty. They do not borrow the English words. An optional model can fill a null field. It cannot overwrite a field the rules already set. The phone does not call a model.

## The answer

The number is the spoken yards when he states one. Otherwise it is the GPS yards. A typed long-press number is not GPS. If neither exists, the line is "No distance yet." and no club is invented.

Plays-like is recomputed from that number. It stays null until wind, elevation, and temperature are all known.

Rough and sand add yards the club has to cover. The table is an estimate, and the spoken line says so. It is not a measured carry.

| Lie | Distance | Yards added |
| --- | --- | --- |
| Rough | under 100 | 4 |
| Rough | 100 to 169 | 6 |
| Rough | 170 and up | 8 |
| Sand | under 40 | 6 |
| Sand | 40 to 99 | 10 |
| Sand | 100 and up | 14 |
| Tee, fairway, green | any | 0 |

Green is "On the green. No full swing." Inside 40 yards the wedge matrix is used. Farther out, the existing club call is used. A bunker or water on one side adds "Favor the other side."

## Hosted on EAS

The phone calls the production origin of project `@mikecoers/coopr`. API routes live in the Expo app:

- `POST /v1/voice` transcribes a held recording with ElevenLabs Scribe. The route reads `ELEVENLABS_API_KEY` from the server environment. It does not read `EXPO_PUBLIC_ELEVENLABS_API_KEY`. The conversation overlay does not use this route. It stays for a clip posted to the host.
- `POST /v1/caddie` is the conversation. The body is `{ transcript, context }`. The route reads `CADDIE_LLM_API_KEY` from the server environment. Optional `CADDIE_LLM_URL` (default `https://api.openai.com/v1/chat/completions`) and `CADDIE_LLM_MODEL` (default `gpt-4o-mini`). `CADDIE_MODE=sample` forces the scripted reply even when a key is present. No key also returns the scripted reply. The response is server-sent events: a mode line, one delta per sentence, any tool result, then done. A static web export has no API route, so the phone uses the same script and still labels sample mode.
- `POST /v1/extract` is the same photo route as the local server.

The caddie context is the hole, par, whether he is on the tee, GPS front/center/back, the plays-like breakdown, wind, the bag's carries and dispersion, the score so far, Chirpy or Chill, and the last few turns. Plays-like is recomputed on the server. A null dispersion stays null. Carry is never copied into total. Tools the model can call: `get_plays_like`, `recommend_club`, `log_score`, `set_club`, `mark_shot`.

Both refuse a body over 8 MB. Voice also refuses a body that is not an audio type (`audio/m4a`, `audio/mp4`, `audio/wav`, and the other types in `apps/mobile/src/api-guard.ts`), whether that type is the HTTP header or the JSON `mediaType`. Each route allows 20 calls a minute per IP, on that server instance. The phone still posts JSON. A clip can also be posted raw with an audio content type.

`web.output` is `server`, which is what EAS Hosting needs for those routes.

From the repo root, with both values exported and neither committed:

The voice deploy script is gone with `/v1/voice`. Use `docs/CADDIE_SERVER.md`. Do not deploy from this page.

Then publish the Expo Go preview so the phone has that origin:

```bash
export EXPO_TOKEN='...'
npm run preview:publish
```

`preview:publish` uses `EXPO_PUBLIC_EXTRACT_URL` if it is set, otherwise the https line in `apps/mobile/extract-origin.txt`. It does not send the ElevenLabs key into the app.

A posted audio clip is no longer transcribed. The check script is gone with `/v1/voice`.

## Local server

Same process as photo extract:

```bash
npx vite-node services/extract/server.ts
```

`POST /v1/voice`. Port defaults to `8787`. The body is not written to disk. The buffer is zeroed after the answer. A body over 8 MB is refused. The response is `cache-control: no-store`. If the transcript would contain the audio bytes, the server returns an error.

No `ELEVENLABS_API_KEY`, or `VOICE_MODE=sample`, returns the canned line "165 yards out, got a bunker on left, what should i hit off the rough?" with `mode: "sample"`, `heard: false`, and `audioRetained: false`. The audio is not sent.

Live mode posts the clip to ElevenLabs speech-to-text as multipart form data, model id `scribe_v1`, header `xi-api-key`. A missing transcript is an error. Nothing is invented.

Optional:

- `ELEVENLABS_STT_MODEL` — default `scribe_v1`.
- `ELEVENLABS_STT_URL` — default `https://api.elevenlabs.io/v1/speech-to-text`.
- `EXTRACT_TOKEN` — when set, the request must send `Authorization: Bearer <token>`. The hole screen does not. Leave it unset to play.
- `VOICE_MODE=sample` — canned transcript even when a key is present.

## On-device speech, and what Expo Go cannot do

`expo-speech-recognition` is in the app. A development build or a TestFlight binary can use `SFSpeechRecognizer` on the phone. The words are recognized on the device. Expo Go cannot load that native module, so it keeps the typed question in the same overlay. This repo does not add `expo-dev-client`. The preview profile is still an EAS store build.

MusicKit, Spotify, Amazon Music, ducking, and the ElevenLabs React Native SDK stay out. The ElevenLabs text-to-speech slot is not connected.

## What Mike provides

Send these on a secure channel. Not in chat, not in git, not in an issue.

1. `CADDIE_LLM_API_KEY` on the server for a live answer. Without it, the phone keeps the labeled sample. Speech-to-text does not use this key.
2. `EXPO_TOKEN` for the `@mikecoers` Expo account, in that same shell, and again for `npm run preview:publish` and for `eas build` / `eas submit`.
3. `ELEVENLABS_STT_MODEL` on the EAS production environment, only if `scribe_v1` is wrong for that account.
4. `CADDIE_LLM_API_KEY` on the same EAS server environment, as a sensitive variable, not a secret and not an `EXPO_PUBLIC_` value. Without it the caddie stays in sample mode and says so. Optional `CADDIE_LLM_URL` and `CADDIE_LLM_MODEL`. `CADDIE_MODE=sample` forces the script even when the key is set.

A real iPhone is still required for the microphone, for on-device recognition, for `expo-speech` audio, for haptics, and for a live GPS distance. The browser check uses a simulated sentence and a simulated position.

## TestFlight

On-device recognition needs a signed iOS binary. Expo Go is not enough.

- A paid Apple Developer account, used to sign `app.coopr.mobile.preview` (preview) or `app.coopr.mobile` (production). EAS creates the distribution certificate and provisioning profile on the first build. Do not commit them.
- `EXPO_TOKEN` for the `@mikecoers` Expo account. Project `998f1644-05ec-4980-a0b9-58e5703951d7`.
- App Store Connect access for that team, so `eas submit` can upload. The `submit.ios` blocks in `eas.json` are empty on purpose. The first submit asks for the Apple team. An App Store Connect API key, or an Apple ID with an app-specific password, is what EAS asks for. It is not stored in this repo.
- Server variables in `docs/CADDIE_SERVER.md`. Do not deploy until he asks.
- `CADDIE_LLM_API_KEY` on that same server environment if the spoken answers should come from the model. Without it, TestFlight still talks, in sample mode, from the real hole context.

```bash
cd apps/mobile
npx eas-cli@latest build -p ios --profile preview
npx eas-cli@latest submit -p ios --profile preview --latest
```
