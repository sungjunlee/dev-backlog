#!/bin/bash
set -euo pipefail
# Compatibility wrapper for the tracker-aware Node setup entrypoint.
#
# Usage: bash scripts/init.sh [project-name]
#        project-name defaults to the current directory name.
#
PROJECT_NAME="${1:-$(basename "$(pwd)")}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARGS=(--project-name "$PROJECT_NAME" --non-interactive)

# The historical init.sh entrypoint created a GitHub-backed fresh config.
# Existing configs are passed without explicit intent so their valid tracker is
# preserved and legacy configs receive the one-time GitHub compatibility pin.
if [ ! -f "backlog/config.yml" ]; then
  ARGS+=(--tracker github)
fi

exec node "$SCRIPT_DIR/setup-dev-backlog.js" "${ARGS[@]}"
