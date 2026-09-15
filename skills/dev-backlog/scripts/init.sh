#!/bin/bash
set -euo pipefail
# Compatibility wrapper for the tracker-aware Node setup entrypoint.
#
# Usage: bash scripts/init.sh [project-name]
#        project-name defaults to the current directory name.
#
PROJECT_NAME="${1:-$(basename "$(pwd)")}"
# Resolve without `dirname` (restricted PATH / Windows Git Bash).
# Normalize backslashes first: `%/*` only strips `/`, so a Windows path
# would otherwise equal BASH_SOURCE and fall back to `.` (the caller's cwd).
_src="${BASH_SOURCE[0]//\\//}"
SCRIPT_DIR="${_src%/*}"
[ "$SCRIPT_DIR" = "$_src" ] && SCRIPT_DIR="."
SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd)"
ARGS=(--project-name "$PROJECT_NAME" --non-interactive)

# The historical init.sh entrypoint created a GitHub-backed fresh setup.
# Existing selections are passed without explicit intent so .tracker is
# preserved and legacy config.yml selections receive the one-time migration.
if [ ! -f ".dev-backlog/.tracker" ] && [ ! -f ".dev-backlog/config.yml" ] \
  && [ ! -f "backlog/.tracker" ] && [ ! -f "backlog/config.yml" ]; then
  ARGS+=(--tracker github)
fi

exec node "$SCRIPT_DIR/setup-dev-backlog.js" "${ARGS[@]}"
