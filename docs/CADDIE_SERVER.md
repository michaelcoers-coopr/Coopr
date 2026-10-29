# Caddie server

Do not deploy from this note. It lists the variables and the steps. Nothing here publishes a build.

The phone calls `POST /v1/caddie` and `POST /v1/extract` on the origin in `EXPO_PUBLIC_EXTRACT_URL`. There is no `/v1/voice` route. Speech-to-text stays on the phone. Spoken answers use the device voice (`expo-speech`). A premium voice is not connected.

## Server environment

Set these on the host. Do not put the model keys in the app.

- `COOPR_API_SECRET` — shared secret. When set, every POST must send the same value in `x-coopr-secret`. When unset, the routes stay open for a local desk check.
- `ALLOWED_ORIGINS` — comma-separated https origins (and `http://localhost:8081` for the desk). A request from any other origin does not get `access-control-allow-origin`. There is no `*`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — rate limit and the monthly counter. Without them, the limit is the memory of that one instance and does not survive a serverless cold start.
- `CADDIE_LLM_API_KEY` — model key. No key means a labeled sample answer.
- `CADDIE_LLM_URL` — optional. Default `https://api.openai.com/v1/chat/completions`.
- `CADDIE_LLM_MODEL` — optional. Default `gpt-4o-mini`.
- `CADDIE_MODE=sample` — force the sample answer even when a key is set.
- `EXTRACT_TOKEN`, `COOPR_VISION_API_KEY`, `COOPR_VISION_BASE_URL`, `COOPR_VISION_MODEL`, `EXTRACT_MODE` — photo extract, unchanged.

A live caddie turn is counted at 2 cents. The month stops at 100 dollars (`10000` cents). After that the route returns the labeled sample and does not call the model.

JSON turns over 32 KB are refused. Photo uploads over 8 MB are refused.

## App environment

- `EXPO_PUBLIC_EXTRACT_URL` — https origin, no path. A value containing `REPLACE` is ignored and the phone stays on the sample answer.
- `EXPO_PUBLIC_CADDIE_SECRET` — the same string as `COOPR_API_SECRET`, sent as `x-coopr-secret`. It is in the app binary. It is a gate, not a place to hide the model key. A value containing `REPLACE` is not sent.

Mute and hands-free are on the round menu. Hold Ask to talk when the on-device recognizer is there. Web falls back to typing. Answers are spoken unless Mute caddie is on.

## Deploy steps

1. Create an Upstash Redis database and copy the REST URL and token.
2. Choose the secret and the allowed origins.
3. Set the server variables above on EAS Hosting for the production deploy. Mark `COOPR_API_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `CADDIE_LLM_API_KEY`, and `COOPR_VISION_API_KEY` sensitive.
4. Deploy the Expo Router routes with `npx eas-cli@latest deploy --prod` from `apps/mobile`. Do not run a voice script. `/v1/voice` is gone.
5. Put the printed https origin in `EXPO_PUBLIC_EXTRACT_URL` and the secret in `EXPO_PUBLIC_CADDIE_SECRET` for the beta build profile.
6. Do not deploy until those two app values are real. A `REPLACE` placeholder keeps the sample answer.
