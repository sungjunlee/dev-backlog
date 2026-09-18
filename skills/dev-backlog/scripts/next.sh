#!/bin/bash
set -uo pipefail
# Show next actionable work from the active sprint file.
# Argument plumbing only — sprint-state.js owns the parsing and the rendering.
#
# Usage: bash scripts/next.sh [--json] [--track slug] [backlog-dir]
#        backlog-dir defaults to ./.dev-backlog

# Resolve without `dirname` — restricted PATH (Windows Git Bash) often has a
# broken dirname symlink, which emptied SCRIPT_DIR and skipped the sibling.
# Normalize backslashes first: `%/*` only strips `/`, so a Windows path
# would otherwise equal BASH_SOURCE and fall back to `.` (the caller's cwd).
_src="${BASH_SOURCE[0]//\\//}"
SCRIPT_DIR="${_src%/*}"
[ "$SCRIPT_DIR" = "$_src" ] && SCRIPT_DIR="."
SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd)"

BACKLOG_DIR="${DEFAULT_BACKLOG_DIR:-.dev-backlog}"
JSON=0
TRACK=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --json) JSON=1 ;;
    --track) shift; TRACK="${1:-}" ;;
    --track=*) TRACK="${1#--track=}" ;;
    *) BACKLOG_DIR="$1" ;;
  esac
  shift
done

ARGS=(--mode next)
[ "$JSON" -eq 0 ] && ARGS+=(--format text)
[ -n "$TRACK" ] && ARGS+=(--track "$TRACK")
exec node "$SCRIPT_DIR/sprint-state.js" "${ARGS[@]}" "$BACKLOG_DIR"
