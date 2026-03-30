#!/bin/bash
set -uo pipefail
# Show next actionable work from the active sprint file.
# Zero LLM cost — pure file parsing.
#
# Usage: bash scripts/next.sh [backlog-dir]
#        backlog-dir defaults to ./backlog

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="${1:-backlog}"
SPRINTS_DIR="$BACKLOG_DIR/sprints"

if [ ! -d "$SPRINTS_DIR" ]; then
  echo "No backlog/sprints/ directory. Run init.sh first."
  exit 1
fi

ACTIVE=$(find_active_sprint "$SPRINTS_DIR")

if [ -z "$ACTIVE" ]; then
  echo "No active sprint found."
  echo "Check GitHub: gh issue list --state open"
  exit 0
fi

SPRINT_NAME=$(basename "$ACTIVE" .md)
echo "=== Sprint: $SPRINT_NAME ==="
echo ""

# Extract Goal
GOAL=$(extract_section "$ACTIVE" "Goal" | head -3 | sed 's/^ *//')
if [ -n "$GOAL" ]; then
  echo "Goal: $GOAL"
  echo ""
fi

# Count progress
count_checkboxes "$ACTIVE"
if [ "$CB_IN_FLIGHT" -gt 0 ]; then
  echo "Progress: $CB_DONE/$CB_TOTAL done ($CB_IN_FLIGHT in-flight, $CB_TODO remaining)"
else
  echo "Progress: $CB_DONE/$CB_TOTAL done ($CB_TODO remaining)"
fi
echo ""

# All done?
if [ "$CB_TODO" -eq 0 ] && [ "$CB_IN_FLIGHT" -eq 0 ] && [ "$CB_TOTAL" -gt 0 ]; then
  echo "All items checked! Ready to close sprint."
  exit 0
fi

# Show in-flight items (dispatched via dev-relay, marked [~])
if [ "$CB_IN_FLIGHT" -gt 0 ]; then
  echo "In flight:"
  grep '^\- \[~\] #' "$ACTIVE" | while IFS= read -r line; do
    echo "  $line"
  done
  echo ""
fi

# Find current batch (first batch with unchecked items)
CURRENT_BATCH=""
IN_BATCH=""
while IFS= read -r line; do
  if echo "$line" | grep -q '^### Batch'; then
    IN_BATCH="$line"
  fi
  if [ -n "$IN_BATCH" ] && echo "$line" | grep -q '^\- \[ \] #'; then
    if [ -z "$CURRENT_BATCH" ]; then
      CURRENT_BATCH="$IN_BATCH"
      echo "Next: $CURRENT_BATCH"
    fi
    echo "  $line"
  fi
  # Stop after finding the first incomplete batch
  if [ -n "$CURRENT_BATCH" ] && echo "$line" | grep -q '^### Batch' && [ "$line" != "$CURRENT_BATCH" ]; then
    break
  fi
done < "$ACTIVE"

# If no batch headers, show all unchecked items
if [ -z "$CURRENT_BATCH" ]; then
  echo "Next items:"
  grep '^\- \[ \] #' "$ACTIVE" | while IFS= read -r line; do
    echo "  $line"
  done
fi

# Last progress entry
echo ""
LAST_PROGRESS=$(extract_section "$ACTIVE" "Progress" | grep '^\- ' | tail -1)
if [ -n "$LAST_PROGRESS" ]; then
  echo "Last: $LAST_PROGRESS"
fi
