# Caddie server

Do not deploy from this note. It lists the variables and the script Mike runs. Nothing here publishes a build.

The phone calls `POST /v1/caddie` and `POST /v1/extract` on the origin in `EXPO_PUBLIC_EXTRACT_URL`. There is no `/v1/voice` route. Speech-to-text stays on the phone. Spoken answers use the device voice (`expo-speech`). A premium voice is not connected.

The live caddie and measured shots are in this beta. They are not waiting on a later release. The beta profile in `apps/mobile/eas.json` already carries the app variables as `REPLACE` placeholders.

## Server environment

Set these on the host. Do not put the model keys in the app. `scripts/deploy-caddie.sh` writes them to the EAS production environment. Sensitive values are `COOPR_API_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `CADDIE_LLM_API_KEY`, and, when set, `COOPR_VISION_API_KEY` and `EXTRACT_TOKEN`.

- `COOPR_API_SECRET` — shared secret. Every POST must send the same value in `x-coopr-secret`. An unset secret is refused. The compare does not stop at the first different character.
- `ALLOWED_ORIGINS` — comma-separated https origins (and `http://localhost:8081` for the desk). A request from any other origin does not get `access-control-allow-origin`. There is no `*`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — optional. When both are set, the rate limit and the monthly counter are on. The cap key is `caddie-budget:YYYY-MM`. Each live turn adds 2 cents. A total above `10000` cents, or any failed Upstash call, returns the labeled sample and does not call the model. When either variable is unset, there is no rate limit and no spend cap, and the route does not return an error for their absence.
- `CADDIE_LLM_API_KEY` — model key. No key means a labeled sample answer.
- `CADDIE_LLM_URL` — optional. Default `https://api.openai.com/v1/chat/completions`.
- `CADDIE_LLM_MODEL` — optional. Default `gpt-4o-mini`.
- `CADDIE_MODE=sample` — force the sample answer even when a key is set. This does not spend the month.
- `EXTRACT_TOKEN`, `COOPR_VISION_API_KEY`, `COOPR_VISION_BASE_URL`, `COOPR_VISION_MODEL`, `EXTRACT_MODE` — photo extract, unchanged.

A live caddie turn is counted at 2 cents. The month stops at 100 dollars (`10000` cents).

JSON turns over 32 KB are refused. Photo uploads over 8 MB are refused.

## App environment

These live on the beta build profile, not on the host.

- `EXPO_PUBLIC_EXTRACT_URL` — https origin, no path. A value containing `REPLACE` is ignored and the phone stays on the sample answer.
- `EXPO_PUBLIC_CADDIE_SECRET` — the same string as `COOPR_API_SECRET`, sent as `x-coopr-secret`. It is in the app binary. It is a gate, not a place to hide the model key. A value containing `REPLACE` is not sent. The beta placeholder is `REPLACE-WITH-CADDIE-SECRET`.
- `EXPO_PUBLIC_FEEDBACK_EMAIL` — inbox for the feedback screen. A `REPLACE` placeholder does not open mail.

Mute and hands-free are on the round menu. Hold Ask to talk when the on-device recognizer is there. Web falls back to typing. Answers are spoken unless Mute caddie is on.

## Deploy steps

Do not deploy from this note. Mike runs the script. It does not build or submit the iOS app.

1. Create an Upstash Redis database and copy the REST URL and token.
2. Choose the secret and the allowed origins.
3. Export `EXPO_TOKEN` plus the server variables above. Do not commit them.
4. From the repo root, run `bash scripts/deploy-caddie.sh`. It sets the EAS production environment and runs `npx eas-cli@latest deploy --prod` from `apps/mobile`. It prints only the https origin and writes that origin to `apps/mobile/extract-origin.txt`.
5. Replace `EXPO_PUBLIC_EXTRACT_URL` with that origin and `EXPO_PUBLIC_CADDIE_SECRET` with the same string as `COOPR_API_SECRET` in `apps/mobile/eas.json` under `build.beta.env`, then build the beta. A value containing `REPLACE` keeps the sample answer.
