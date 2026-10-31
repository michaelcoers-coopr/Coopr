#!/usr/bin/env bash
# Set the production host variables and deploy /v1/caddie and /v1/extract.
# Mike runs this on his machine. Do not run it from an agent, and do not commit the values.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "EXPO_TOKEN is required. Create one at https://expo.dev/settings/access-tokens and export it in this shell. Do not commit it." >&2
  exit 1
fi

required=(COOPR_API_SECRET ALLOWED_ORIGINS UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN CADDIE_LLM_API_KEY)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if (( ${#missing[@]} > 0 )); then
  echo "Missing required variables: ${missing[*]}" >&2
  echo "Export the names from docs/CADDIE_SERVER.md. This script does not print values." >&2
  exit 1
fi

redact() {
  REDACT_FILE="$1" node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const names = [
      "EXPO_TOKEN",
      "COOPR_API_SECRET",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "CADDIE_LLM_API_KEY",
      "COOPR_VISION_API_KEY",
      "EXTRACT_TOKEN",
      "CADDIE_LLM_URL",
      "COOPR_VISION_BASE_URL",
    ];
    let text = "";
    try {
      text = readFileSync(process.env.REDACT_FILE ?? "", "utf8");
    } catch {
      text = "";
    }
    for (const name of names) {
      const value = process.env[name];
      if (value) text = text.split(value).join("[redacted]");
    }
    process.stderr.write(text);
  '
}

set_var() {
  local name="$1"
  local visibility="$2"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    return 0
  fi
  local log
  log=$(mktemp)
  if ! npx --yes eas-cli@latest env:set \
    --name "$name" \
    --value "$value" \
    --environment production \
    --visibility "$visibility" \
    --scope project \
    --type string \
    --non-interactive \
    >"$log" 2>&1; then
    echo "Could not set ${name}." >&2
    redact "$log"
    rm -f "$log"
    exit 1
  fi
  rm -f "$log"
}

cd "$root/apps/mobile"

set_var COOPR_API_SECRET sensitive
set_var UPSTASH_REDIS_REST_TOKEN sensitive
set_var CADDIE_LLM_API_KEY sensitive
set_var COOPR_VISION_API_KEY sensitive
set_var EXTRACT_TOKEN sensitive
set_var ALLOWED_ORIGINS plaintext
set_var UPSTASH_REDIS_REST_URL plaintext
set_var CADDIE_LLM_URL plaintext
set_var CADDIE_LLM_MODEL plaintext
set_var COOPR_VISION_BASE_URL plaintext
set_var COOPR_VISION_MODEL plaintext
set_var EXTRACT_MODE plaintext
set_var CADDIE_MODE plaintext

log=$(mktemp)
if ! npx --yes eas-cli@latest deploy --prod >"$log" 2>&1; then
  echo "eas deploy failed." >&2
  redact "$log"
  rm -f "$log"
  exit 1
fi

if ! origin=$(node "$root/scripts/deploy-origin.mjs" < "$log"); then
  echo "eas deploy did not print an https origin." >&2
  rm -f "$log"
  exit 1
fi
rm -f "$log"
printf '%s\n' "$origin" > "$root/apps/mobile/extract-origin.txt"
printf '%s\n' "$origin"
