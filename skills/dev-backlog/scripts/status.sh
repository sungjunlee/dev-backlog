#!/bin/bash
# Project status from sprint file + GitHub + local files.
# Usage: bash scripts/status.sh [backlog-dir]

BACKLOG_DIR="${1:-backlog}"
SPRINTS_DIR="$BACKLOG_DIR/sprints"

# --- Active Sprint ---
echo "=== Active Sprint ==="
if [ -d "$SPRINTS_DIR" ]; then
  ACTIVE=$(grep -rl "^status: active" "$SPRINTS_DIR"/*.md 2>/dev/null | grep -v _context.md | head -1)
  if [ -n "$ACTIVE" ]; then
    SPRINT_NAME=$(basename "$ACTIVE" .md)
    TOTAL=$(grep -c '^\- \[.\] #' "$ACTIVE" 2>/dev/null || echo 0)
    DONE=$(grep -c '^\- \[x\] #' "$ACTIVE" 2>/dev/null || echo 0)
    TODO=$((TOTAL - DONE))
    if [ "$TOTAL" -gt 0 ]; then
      PCT=$((DONE * 100 / TOTAL))
    else
      PCT=0
    fi
    echo "$SPRINT_NAME: $DONE/$TOTAL tasks ($PCT%)"

    # Show in-progress (unchecked items in completed batches, or first unchecked batch)
    NEXT_ITEMS=$(grep '^\- \[ \] #' "$ACTIVE" | head -3)
    if [ -n "$NEXT_ITEMS" ]; then
      echo ""
      echo "Next up:"
      echo "$NEXT_ITEMS" | while IFS= read -r line; do echo "  $line"; done
    fi

    if [ "$TODO" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then
      echo ""
      echo ">> All items done — ready to close sprint"
    fi
  else
    echo "(no active sprint)"
  fi
else
  echo "(no backlog/sprints/ directory)"
fi

# --- GitHub Issues ---
echo ""
echo "=== GitHub Issues ==="
gh issue list --state open --limit 20 --json number,title,labels,milestone --jq '
  .[] | "\(.number)\t\(.milestone.title // "-")\t\(.title)\t\([.labels[].name] | join(","))"
' 2>/dev/null | column -t -s $'\t' || echo "(gh not available)"

# --- Local Files ---
echo ""
echo "=== Local Files ==="
if [ -d "$BACKLOG_DIR/tasks" ]; then
  total=$(ls "$BACKLOG_DIR/tasks/"*.md 2>/dev/null | wc -l | tr -d ' ')
  todo=$(grep -l "^status: .*To Do" "$BACKLOG_DIR/tasks/"*.md 2>/dev/null | wc -l | tr -d ' ')
  inprog=$(grep -l "^status: .*In Progress" "$BACKLOG_DIR/tasks/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "Tasks: $total total, $todo To Do, $inprog In Progress"
else
  echo "No backlog/tasks/ directory"
fi

if [ -d "$BACKLOG_DIR/completed" ]; then
  done_count=$(ls "$BACKLOG_DIR/completed/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "Completed: $done_count"
fi

# --- Past Sprints ---
if [ -d "$SPRINTS_DIR" ]; then
  PAST=$(grep -rl "^status: completed" "$SPRINTS_DIR"/*.md 2>/dev/null | grep -v _context.md | wc -l | tr -d ' ')
  if [ "$PAST" -gt 0 ]; then
    echo "Past sprints: $PAST"
  fi
fi
