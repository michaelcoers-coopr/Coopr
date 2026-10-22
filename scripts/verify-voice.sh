#!/usr/bin/env bash
# Post one clip to a deployed Ask COOPR origin and print the transcript plus the parsed intent.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: scripts/verify-voice.sh <origin> <audio-file>" >&2
  exit 1
fi

origin=${1%/}
audio=$2
root=$(cd "$(dirname "$0")/.." && pwd)

if [[ ! -f "$audio" ]]; then
  echo "No audio file at $audio" >&2
  exit 1
fi

ext=${audio##*.}
ext=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')
case "$ext" in
  m4a) ctype=audio/m4a ;;
  mp4) ctype=audio/mp4 ;;
  aac) ctype=audio/aac ;;
  mp3) ctype=audio/mpeg ;;
  wav) ctype=audio/wav ;;
  webm) ctype=audio/webm ;;
  ogg) ctype=audio/ogg ;;
  *)
    echo "Use an m4a, mp4, aac, mp3, wav, webm, or ogg clip." >&2
    exit 1
    ;;
esac

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
code=$(curl -sS -o "$tmp" -w '%{http_code}' -X POST -H "content-type: $ctype" --data-binary @"$audio" "$origin/v1/voice")
if [[ "$code" != "200" ]]; then
  echo "Voice route returned $code" >&2
  cat "$tmp" >&2
  exit 1
fi

(
  cd "$root"
  COOPR_VOICE_JSON=$(cat "$tmp") npx vite-node scripts/verify-voice-intent.ts
)
