#!/usr/bin/env bash
# Installs CLIs the project plugins need, in cloud sessions only:
#   omniroute (npm) for omniroute@abhi-plugins, rtk for rtk@jaffskils.
# crates.io "rtk" is an unrelated crate, so rtk is built from git.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0

# omniroute CLI for the omniroute@abhi-plugins plugin.
if ! command -v omniroute >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  npm i -g omniroute >&2 || echo "install-tools: omniroute install failed" >&2
fi

command -v rtk >/dev/null 2>&1 && exit 0
command -v cargo >/dev/null 2>&1 || { echo "install-tools: cargo not found" >&2; exit 0; }
cargo install --locked --git https://github.com/rtk-ai/rtk rtk >&2 \
  || echo "install-tools: build failed" >&2
exit 0
