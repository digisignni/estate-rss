#!/usr/bin/env bash
# Installs rtk (https://github.com/rtk-ai/rtk), which the rtk@jaffskils plugin
# needs. Cloud sessions only; a no-op when rtk is already on PATH.
# crates.io "rtk" is an unrelated crate, so build the rtk package from git.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
command -v rtk >/dev/null 2>&1 && exit 0
command -v cargo >/dev/null 2>&1 || { echo "install-rtk: cargo not found" >&2; exit 0; }
cargo install --locked --git https://github.com/rtk-ai/rtk rtk >&2 \
  || echo "install-rtk: build failed" >&2
exit 0
