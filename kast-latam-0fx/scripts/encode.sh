#!/usr/bin/env bash
# Encodes out/frames + out/soundtrack.wav into an X/Twitter-ready MP4 (H.264 High, yuv420p bt709, AAC 48k).
set -euo pipefail
cd "$(dirname "$0")/.."
FPS="${FPS:-60}"
SUB="${SUB:-1}"
EXT="${EXT:-png}"
OUT="${OUT:-out/kast-latam-0fx-1080.mp4}"
VF="scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p"
if [ "$SUB" -gt 1 ]; then
  # average SUB consecutive sub-frames into one frame (real motion blur)
  VF="tmix=frames=${SUB},select='eq(mod(n\,${SUB})\,${SUB}-1)',setpts=N/(${FPS}*TB),${VF}"
fi
ffmpeg -y -hide_banner -loglevel warning -nostats \
  -framerate "$((FPS * SUB))" -i "out/frames/f%05d.${EXT}" \
  -i out/soundtrack.wav \
  -vf "$VF" -r "$FPS" \
  -c:v libx264 -preset slow -crf 16 -maxrate 25M -bufsize 50M -profile:v high -level 4.2 -tune film \
  -x264-params "keyint=${FPS}:min-keyint=${FPS}:aq-mode=3" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 256k \
  -movflags +faststart -shortest "$OUT"
echo "wrote $OUT"
