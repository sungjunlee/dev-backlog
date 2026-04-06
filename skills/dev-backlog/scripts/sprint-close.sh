#!/bin/bash
set -uo pipefail
# Close the active sprint: mark completed, move tasks, remind about context.
#
# Usage: bash scripts/sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]
#
# Steps:
#   1. Set sprint status: completed + add Progress entry
#   2. Move checked-off task files to backlog/completed/
#   3. Show Running Context entries (remind to promote to _context.md)
#   4. Optionally close GitHub milestone (--close-milestone)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="${1:-backlog}"
DRY_RUN=false
CLOSE_MILESTONE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --close-milestone) CLOSE_MILESTONE=true ;;
  esac
done

SPRINTS_DIR="$BACKLOG_DIR/sprints"
TASKS_DIR="$BACKLOG_DIR/tasks"
COMPLETED_DIR="$BACKLOG_DIR/completed"

if [ ! -d "$SPRINTS_DIR" ]; then
  echo "No sprints directory found."
  exit 1
fi

ACTIVE=$(find_active_sprint "$SPRINTS_DIR")
if [ -z "$ACTIVE" ]; then
  echo "No active sprint to close."
  exit 0
fi

SPRINT_NAME=$(basename "$ACTIVE" .md)
count_checkboxes "$ACTIVE"
echo "Closing sprint: $SPRINT_NAME ($CB_DONE/$CB_TOTAL done)"

# Warn if unchecked items remain
if [ "$CB_TODO" -gt 0 ] || [ "$CB_IN_FLIGHT" -gt 0 ]; then
  echo "Warning: $CB_TODO todo, $CB_IN_FLIGHT in-flight items remaining"
fi

# --- Step 1: Set status: completed ---
TODAY=$(date +%Y-%m-%d)
if $DRY_RUN; then
  echo "[dry-run] Would set status: completed in $ACTIVE"
else
  # Replace status: active with status: completed
  sed -i.bak "s/^status: active$/status: completed/" "$ACTIVE" && rm -f "$ACTIVE.bak"
  # Append progress entry
  echo "- $TODAY: Sprint closed. $CB_DONE/$CB_TOTAL tasks completed." >> "$ACTIVE"
  echo "Set status: completed in $ACTIVE"
fi

# --- Step 2: Move completed task files ---
# Collect issue numbers from checked items
DONE_ISSUES=$(grep "$RE_CB_DONE" "$ACTIVE" | sed "s/${RE_CB_DONE}\([0-9]*\).*/\1/" || true)

if [ -d "$TASKS_DIR" ] && [ -n "$DONE_ISSUES" ]; then
  if ! $DRY_RUN; then
    mkdir -p "$COMPLETED_DIR"
  fi
  echo "$DONE_ISSUES" | while IFS= read -r num; do
    # Find task file matching this issue number (exact match: PREFIX-NUM space)
    TASK_FILE=$(find "$TASKS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null \
      | grep -E "/[A-Z]+-${num} - " | head -1)
    if [ -n "$TASK_FILE" ]; then
      BASENAME=$(basename "$TASK_FILE")
      if $DRY_RUN; then
        echo "[dry-run] Would move: $BASENAME → completed/"
      else
        mv "$TASK_FILE" "$COMPLETED_DIR/$BASENAME"
        echo "Moved: $BASENAME → completed/"
      fi
    fi
  done
fi

# --- Step 3: Show Running Context entries ---
CONTEXT=$(extract_section "$ACTIVE" "Running Context")
if [ -n "$CONTEXT" ]; then
  echo ""
  echo "=== Running Context (review for _context.md promotion) ==="
  echo "$CONTEXT"
  echo ""
  echo "Promote project-level entries to: $SPRINTS_DIR/_context.md"
fi

# --- Step 4: Optionally close milestone ---
if $CLOSE_MILESTONE; then
  MILESTONE=$(grep '^milestone:' "$ACTIVE" | sed 's/^milestone: *//')
  if [ -n "$MILESTONE" ]; then
    if $DRY_RUN; then
      echo "[dry-run] Would close milestone: $MILESTONE"
    else
      MS="$MILESTONE" gh api repos/{owner}/{repo}/milestones \
        --jq '.[] | select(.title==env.MS) | .number' 2>/dev/null | \
        while IFS= read -r ms_num; do
          gh api -X PATCH "repos/{owner}/{repo}/milestones/$ms_num" -f state=closed 2>/dev/null && \
            echo "Closed milestone: $MILESTONE" || \
            echo "Warning: Could not close milestone: $MILESTONE"
        done
    fi
  fi
fi

echo ""
echo "Done."
