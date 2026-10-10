#!/usr/bin/env bash
# Fetches MediaPipe .task models with sha256 verification into models/.
# Usage: scripts/fetch-models.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/models"
mkdir -p "$OUT"
declare -A URLS=(
  [hand_landmarker.task]="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  [face_landmarker.task]="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  [selfie_segmenter.tflite]="https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite"
)
SUMS="$ROOT/models/SHA256SUMS"
touch "$SUMS"
for name in "${!URLS[@]}"; do
  url="${URLS[$name]}"
  dest="$OUT/$name"
  if [[ -f "$dest" ]]; then echo "exists: $name"; continue; fi
  echo "fetching $name ..."
  curl -fL --retry 3 -o "$dest" "$url"
  (cd "$OUT" && sha256sum "$name" >> SHA256SUMS)
done
echo "done. Verify with: (cd models && sha256sum -c SHA256SUMS)"
