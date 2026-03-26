#!/bin/bash
# Show next actionable work from the active sprint file.
# Zero LLM cost — pure file parsing.
#
# Usage: bash scripts/next.sh [backlog-dir]
#        backlog-dir defaults to ./backlog

BACKLOG_DIR="${1:-backlog}"
SPRINTS_DIR="$BACKLOG_DIR/sprints"

if [ ! -d "$SPRINTS_DIR" ]; then
  echo "No backlog/sprints/ directory. Run init.sh first."
  exit 1
fi

# Find active sprint file (status: active in frontmatter)
ACTIVE=$(grep -rl "^status: active" "$SPRINTS_DIR"/*.md 2>/dev/null | grep -v _context.md | head -1)

if [ -z "$ACTIVE" ]; then
  echo "No active sprint found."
  echo "Check GitHub: gh issue list --state open"
  exit 0
fi

SPRINT_NAME=$(basename "$ACTIVE" .md)
echo "=== Sprint: $SPRINT_NAME ==="
echo ""

# Extract Goal
GOAL=$(sed -n '/^## Goal/,/^## /{/^## Goal/d;/^## /d;p;}' "$ACTIVE" | head -3 | sed 's/^ *//')
if [ -n "$GOAL" ]; then
  echo "Goal: $GOAL"
  echo ""
fi

# Count progress
TOTAL=$(grep -c '^\- \[.\] #' "$ACTIVE" 2>/dev/null || echo 0)
DONE=$(grep -c '^\- \[x\] #' "$ACTIVE" 2>/dev/null || echo 0)
TODO=$((TOTAL - DONE))
echo "Progress: $DONE/$TOTAL done ($TODO remaining)"
echo ""

# All done?
if [ "$TODO" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then
  echo "All items checked! Ready to close sprint."
  exit 0
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
LAST_PROGRESS=$(sed -n '/^## Progress/,/^## /{/^## /d;p;}' "$ACTIVE" | grep '^\- ' | tail -1)
if [ -n "$LAST_PROGRESS" ]; then
  echo "Last: $LAST_PROGRESS"
fi
