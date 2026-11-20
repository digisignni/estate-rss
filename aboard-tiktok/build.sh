#!/usr/bin/env bash
# Rebuild the video end to end:  ./build.sh [work_dir]
#   needs: node + playwright (Chromium), ffmpeg, python3 with numpy scipy opencv-python-headless pillow
#   env:   PYTHON=python interpreter to use (default python3), WORKERS=parallel browsers (default 3)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$HERE/.work}"
PY="${PYTHON:-python3}"
NAME="digital_aboard_stop_scrolling"
mkdir -p "$WORK" "$HERE/out"

rm -rf "$WORK/frames"
node "$HERE/tools/render.js" --out "$WORK/frames" --workers "${WORKERS:-3}"   # 1080x1920 PNG frames
"$PY" "$HERE/tools/blend.py" "$WORK/frames"                                   # motion blur
"$PY" "$HERE/tools/audio.py" "$WORK/audio"                                    # original beat + sound design

# (-aac_pns 0: ffmpeg's AAC noise-substitution tool produced full-scale clicks on this track)
encode() {  # <wav> <target LUFS> <out.mp4>
  local lufs gain
  lufs=$(ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 | awk '$1=="I:"{v=$2} END{print v}')
  gain=$(awk -v i="$lufs" -v t="$2" 'BEGIN{printf "%.2f", t - i}')
  ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$WORK/frames/%05d.png" -i "$1" \
    -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
    -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -g 30 -bf 2 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -af "volume=${gain}dB,alimiter=limit=0.89:level=disabled" -c:a aac -b:a 256k -aac_pns 0 -ar 48000 \
    -movflags +faststart -shortest "$3"
  echo "  $(basename "$3")  (audio ${lufs} LUFS -> $2 LUFS)"
}
encode "$WORK/audio/soundtrack.wav" -13 "$HERE/out/${NAME}.mp4"
encode "$WORK/audio/sfx_only.wav"   -18 "$HERE/out/${NAME}_sfx_only.mp4"   # for adding a trending sound in-app
ffmpeg -hide_banner -loglevel error -y -i "$WORK/frames/00000.png" -q:v 2 "$HERE/out/${NAME}_cover.jpg"
echo "done -> $HERE/out"
