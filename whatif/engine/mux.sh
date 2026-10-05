#!/usr/bin/env bash
# Combine rendered video + procedural audio into the final upload file (-14 LUFS, TikTok loudness).
# Usage: engine/mux.sh <episode-name>
set -euo pipefail
d="$(dirname "$0")/../out/$1"
ffmpeg -loglevel error -y -i "$d/video.mp4" -i "$d/audio.wav" \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:v copy -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart "$d/final.mp4"
echo "final -> $d/final.mp4"
