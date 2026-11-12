#!/usr/bin/env bash
# Run the game under a virtual display (for automated tests and screenshots on a machine with no screen).
# RES=540x960 renders at half size (much faster on a machine without a GPU).
# Usage: tools/run.sh [godot args] -- [game flags]     e.g. tools/run.sh -- --autoplay --quit-after=20
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
exec xvfb-run -a -s "-screen 0 1080x1920x24" "$GODOT" --path . --audio-driver Dummy --rendering-driver opengl3 --resolution "${RES:-1080x1920}" "$@"
