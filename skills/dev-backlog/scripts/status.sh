#!/bin/bash
set -uo pipefail
# Project status from sprint file + GitHub + local files.
# Usage: bash scripts/status.sh [backlog-dir]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="${1:-backlog}"
SPRINTS_DIR="$BACKLOG_DIR/sprints"

# --- Active Sprint ---
echo "=== Active Sprint ==="
if [ -d "$SPRINTS_DIR" ]; then
  ACTIVE=$(find_active_sprint "$SPRINTS_DIR")
  if [ -n "$ACTIVE" ]; then
    SPRINT_NAME=$(basename "$ACTIVE" .md)
    count_checkboxes "$ACTIVE"
    if [ "$CB_TOTAL" -gt 0 ]; then
      PCT=$((CB_DONE * 100 / CB_TOTAL))
    else
      PCT=0
    fi
    if [ "$CB_IN_FLIGHT" -gt 0 ]; then
      echo "$SPRINT_NAME: $CB_DONE/$CB_TOTAL tasks ($PCT%) — $CB_IN_FLIGHT in-flight"
    else
      echo "$SPRINT_NAME: $CB_DONE/$CB_TOTAL tasks ($PCT%)"
    fi

    # Show in-flight items (dispatched via dev-relay)
    IN_FLIGHT_ITEMS=$(grep "$RE_CB_INFLIGHT" "$ACTIVE" | head -3)
    if [ -n "$IN_FLIGHT_ITEMS" ]; then
      echo ""
      echo "In flight:"
      echo "$IN_FLIGHT_ITEMS" | while IFS= read -r line; do echo "  $line"; done
    fi

    # Show next unchecked items
    NEXT_ITEMS=$(grep "$RE_CB_TODO" "$ACTIVE" | head -3)
    if [ -n "$NEXT_ITEMS" ]; then
      echo ""
      echo "Next up:"
      echo "$NEXT_ITEMS" | while IFS= read -r line; do echo "  $line"; done
    fi

    if [ "$CB_TODO" -eq 0 ] && [ "$CB_IN_FLIGHT" -eq 0 ] && [ "$CB_TOTAL" -gt 0 ]; then
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
  total=$(find "$BACKLOG_DIR/tasks" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  todo=$(find "$BACKLOG_DIR/tasks" -maxdepth 1 -name "*.md" -exec grep -l "^status: .*To Do" {} \; 2>/dev/null | wc -l | tr -d ' ')
  inprog=$(find "$BACKLOG_DIR/tasks" -maxdepth 1 -name "*.md" -exec grep -l "^status: .*In Progress" {} \; 2>/dev/null | wc -l | tr -d ' ')
  echo "Tasks: $total total, $todo To Do, $inprog In Progress"
else
  echo "No backlog/tasks/ directory"
fi

if [ -d "$BACKLOG_DIR/completed" ]; then
  done_count=$(find "$BACKLOG_DIR/completed" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "Completed: $done_count"
fi

# --- Relay Runs (optional — only when dev-relay is installed) ---
RELAY_HOME="${RELAY_HOME:-$HOME/.relay}"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$REPO_ROOT" ] && [ -d "$RELAY_HOME/runs" ]; then
  RESOLVED=$(cd "$REPO_ROOT" && pwd -P)
  SLUG_BASE=$(basename "$RESOLVED" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/^-\|-$//g')
  # Portable sha256: prefer sha256sum (Linux), fall back to shasum (macOS)
  if command -v sha256sum >/dev/null 2>&1; then
    SLUG_HASH=$(printf '%s' "$RESOLVED" | sha256sum | cut -c1-8)
  elif command -v shasum >/dev/null 2>&1; then
    SLUG_HASH=$(printf '%s' "$RESOLVED" | shasum -a 256 | cut -c1-8)
  else
    SLUG_HASH=""
  fi
  if [ -n "$SLUG_HASH" ]; then
    RELAY_RUNS_DIR="$RELAY_HOME/runs/${SLUG_BASE}-${SLUG_HASH}"
    if [ -d "$RELAY_RUNS_DIR" ]; then
      ACTIVE_MANIFESTS=$(find "$RELAY_RUNS_DIR" -maxdepth 1 -name "*.md" \
        -exec grep -lE "^state: *(dispatched|review_pending|changes_requested|ready_to_merge)" {} + 2>/dev/null)
      ACTIVE_RUNS=$(echo "$ACTIVE_MANIFESTS" | grep -c '.' 2>/dev/null) || ACTIVE_RUNS=0
      if [ "$ACTIVE_RUNS" -gt 0 ]; then
        echo ""
        echo "=== Relay Runs ==="
        echo "$ACTIVE_MANIFESTS" | while IFS= read -r mf; do
          [ -z "$mf" ] && continue
          RUN_ID=$(basename "$mf" .md)
          STATE=$(awk -F': *' '/^state:/{gsub(/['"'"'"]/,"",$2); print $2; exit}' "$mf")
          echo "  $RUN_ID ($STATE)"
        done
      fi
    fi
  fi
fi

# --- Past Sprints ---
if [ -d "$SPRINTS_DIR" ]; then
  PAST=$(find "$SPRINTS_DIR" -maxdepth 1 -name "*.md" ! -name "_context.md" -exec grep -l "^status: completed" {} \; 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PAST" -gt 0 ]; then
    echo "Past sprints: $PAST"
  fi
fi
