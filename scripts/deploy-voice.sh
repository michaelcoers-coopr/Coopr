#!/usr/bin/env bash
# Deploy Ask COOPR to EAS Hosting for @mikecoers/coopr.
# Stdout is only the deployed origin. The ElevenLabs key is never printed.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
app="$root/apps/mobile"
origin_file="$app/extract-origin.txt"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "EXPO_TOKEN is not set. Create one at https://expo.dev/settings/access-tokens and export it in this shell. Do not commit it." >&2
  exit 1
fi
if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
  echo "ELEVENLABS_API_KEY is not set. Export it in this shell. Do not commit it." >&2
  exit 1
fi

key=$ELEVENLABS_API_KEY
unset ELEVENLABS_API_KEY

redact() {
  local text=$1
  if [[ -n "$key" ]]; then
    text=${text//"$key"/[redacted]}
  fi
  printf '%s\n' "$text"
}

cd "$app"

# EAS Hosting injects plaintext and sensitive variables into API routes.
# Visibility secret never leaves EAS, so the worker would not see the key and Scribe would not hear him.
# https://docs.expo.dev/eas/environment-variables/usage/
env_log=$(
  EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest env:set \
    --name ELEVENLABS_API_KEY \
    --value "$key" \
    --type string \
    --visibility sensitive \
    --environment production \
    --scope project \
    --non-interactive 2>&1
) || {
  redact "$env_log" >&2
  exit 1
}
if [[ "$env_log" == *"$key"* ]]; then
  echo "Refusing to continue: the env command echoed the key." >&2
  exit 1
fi

export EXPO_PUBLIC_FOUNDER_TOOLS=0
export CI=1
export EXPO_NO_TELEMETRY=1
export_log=$(npx expo export --platform web --output-dir dist 2>&1) || {
  redact "$export_log" >&2
  exit 1
}

deploy_err=$(mktemp)
deploy_log=$(
  EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest deploy \
    --prod \
    --environment production \
    --non-interactive \
    --json \
    --export-dir dist 2>"$deploy_err"
) || {
  redact "$(cat "$deploy_err")$deploy_log" >&2
  rm -f "$deploy_err"
  exit 1
}
rm -f "$deploy_err"

origin=$(printf '%s' "$deploy_log" | node "$root/scripts/deploy-origin.mjs") || {
  redact "$deploy_log" >&2
  exit 1
}
umask 077
cat > "$origin_file" <<EOF
# EAS Hosting origin for Ask COOPR. Not a secret. scripts/deploy-voice.sh writes the URL.
$origin
EOF
printf '%s\n' "$origin"
