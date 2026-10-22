# Ask COOPR

Hold-to-talk on the hole screen. It runs in Expo Go SDK 58. The ElevenLabs key never ships in the app. Music is not part of this path.

## On the phone

The play screen keeps one button, Ask COOPR, at the bottom of the sheet. It is at least 88 points tall. Hold it to talk. Let go to send.

`expo-audio` records. That module loads in Expo Go. `expo-speech` speaks the caddie line back. The same line is on screen in large type, with chips for the yards, the lie, and each hazard. Tap a lie or a hazard chip to cycle it. The distance chip has minus and plus, five yards a tap. A command (score, putts, next hole, miss) runs, and an Undo row sits above the button.

The phone posts `{ audioBase64, mediaType }` to `{EXPO_PUBLIC_EXTRACT_URL}/v1/voice`. That is the same origin as photo extract. The hole screen does not ask for a token. If `EXTRACT_TOKEN` is set on the server, leave it unset for a round, or voice requests are refused.

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

## Server

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

## Later, not in Expo Go

Airplane mode needs on-device iOS speech recognition (`SFSpeechRecognizer`, or a dev-client module such as `expo-speech-recognition`). That is a development build. Expo Go cannot host it. The transcript would still go through the same parser. This repo does not add that module and does not add a dev client.

MusicKit, Spotify, Amazon Music, ducking, and the ElevenLabs React Native SDK stay out.

## What Mike provides

Send these on a secure channel. Not in chat, not in git, not in an issue.

1. `ELEVENLABS_API_KEY` for the Scribe account. Without it, Ask COOPR speaks the canned transcript and does not hear him.
2. `ELEVENLABS_STT_MODEL`, only if `scribe_v1` is wrong for that account.
3. The public origin of this server, as `EXPO_PUBLIC_EXTRACT_URL` when the preview is published. That origin is not the key.

A real phone is still required for the microphone, for `expo-speech` audio, and for a live GPS distance. The browser check uses a simulated sentence and a simulated position.
