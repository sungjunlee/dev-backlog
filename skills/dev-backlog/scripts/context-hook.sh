#!/bin/bash
set -uo pipefail
trap 'exit 0' ERR
# Auto-context hook for Claude Code PreToolUse.
# Outputs one-line sprint summary to prevent context drift in long sessions.
#
# Usage: bash scripts/context-hook.sh [backlog-dir]
#
# Designed for Claude Code settings.json:
#   "hooks": {
#     "PreToolUse": [{
#       "matcher": "Write|Edit|NotebookEdit",
#       "command": "bash /path/to/scripts/context-hook.sh /path/to/backlog"
#     }]
#   }
#
# Always exits 0 — must never block tool execution.
# Uses trap ERR instead of set -e to guarantee exit 0 on any failure.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="${1:-backlog}"
SPRINTS_DIR="$BACKLOG_DIR/sprints"

if [ ! -d "$SPRINTS_DIR" ]; then
  exit 0
fi

if ACTIVE=$(find_active_sprint "$SPRINTS_DIR" 2>/dev/null); then
  ACTIVE_STATUS=0
else
  ACTIVE_STATUS=$?
fi
if [ "$ACTIVE_STATUS" -eq 2 ]; then
  echo "[Sprint warning] Multiple active sprints found; resolve backlog/sprints/ before editing."
  exit 0
fi

if [ "$ACTIVE_STATUS" -ne 0 ]; then
  exit 0
fi

SPRINT_NAME=$(basename "$ACTIVE" .md)
count_checkboxes "$ACTIVE"

# Build summary line
SUMMARY="[Sprint: $SPRINT_NAME] $CB_DONE/$CB_TOTAL done"

if [ "$CB_IN_FLIGHT" -gt 0 ]; then
  SUMMARY="$SUMMARY, $CB_IN_FLIGHT in-flight"
fi

# Find next unchecked item
NEXT_ITEM=$(next_todo_item "$ACTIVE" || true)
if [ -n "$NEXT_ITEM" ]; then
  SUMMARY="$SUMMARY | Next: $NEXT_ITEM"
fi

echo "$SUMMARY"
exit 0
