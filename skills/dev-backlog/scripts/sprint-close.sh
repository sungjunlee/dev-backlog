#!/bin/bash
set -uo pipefail
# Close the active sprint: mark completed, move tasks, remind about context.
#
# Usage: bash scripts/sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]
#
# Steps:
#   1. Run backlog-doctor pre-close and compute the text-only reassess signal
#   2. Set sprint status: completed + add Progress entry
#   3. Move checked-off task files to backlog/completed/
#   4. Show Running Context entries (remind to promote to _context.md)
#   5. Optionally close GitHub milestone (--close-milestone)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="backlog"
DRY_RUN=false
CLOSE_MILESTONE=false
BACKLOG_DIR_SET=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --close-milestone) CLOSE_MILESTONE=true ;;
    --*)
      echo "Unknown argument: $arg"
      exit 1
      ;;
    *)
      if $BACKLOG_DIR_SET; then
        echo "Unexpected argument: $arg"
        exit 1
      fi
      BACKLOG_DIR="$arg"
      BACKLOG_DIR_SET=true
      ;;
  esac
done

# Optional provider mutations must be authorized before local sprint mutation.
if $CLOSE_MILESTONE; then
  if ! node "$SCRIPT_DIR/tracker-capability.js" require milestones "$BACKLOG_DIR"; then
    exit 1
  fi
fi

SPRINTS_DIR="$BACKLOG_DIR/sprints"
TASKS_DIR="$BACKLOG_DIR/tasks"
COMPLETED_DIR="$BACKLOG_DIR/completed"

if [ ! -d "$SPRINTS_DIR" ]; then
  echo "No sprints directory found."
  exit 1
fi

ACTIVE=$(find_active_sprint "$SPRINTS_DIR" 2>/dev/null)
ACTIVE_STATUS=$?
if [ "$ACTIVE_STATUS" -eq 2 ]; then
  echo "Multiple active sprints found. Refusing to close an ambiguous sprint:"
  find_active_sprints "$SPRINTS_DIR" | while IFS= read -r sprint; do
    echo "  - $(basename "$sprint")"
  done
  exit 1
fi

if [ "$ACTIVE_STATUS" -ne 0 ]; then
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

# --- Step 1: Run backlog-doctor and compute the close signal ---
# The doctor runs before the status flip. Its Node close-summary mode receives
# the closing sprint path and counts that sprint on today's date, so dry-run
# output reports the same would-be reassess signal without mutating files.
TODAY=$(date +%Y-%m-%d)
DOCTOR_SUMMARY=$(node "$SCRIPT_DIR/backlog-doctor.js" --close-summary --closing-sprint "$ACTIVE" "$BACKLOG_DIR" 2>&1)
DOCTOR_STATUS=$?

# --- Step 2: Set status: completed ---
if $DRY_RUN; then
  echo "[dry-run] Would set status: completed in $ACTIVE"
else
  # Replace status: active with status: completed
  sed -i.bak "s/^status: active$/status: completed/" "$ACTIVE" && rm -f "$ACTIVE.bak"
  # Append progress entry
  echo "- $TODAY: Sprint closed. $CB_DONE/$CB_TOTAL tasks completed." >> "$ACTIVE"
  echo "Set status: completed in $ACTIVE"
fi

# --- Step 3: Move completed task files ---
# Collect exact task-file refs from checked items through the shared parser.
DONE_FILE_REFS=$(node "$SCRIPT_DIR/task-ref.js" completed-file-refs "$ACTIVE" "$BACKLOG_DIR")

if [ -d "$TASKS_DIR" ] && [ -n "$DONE_FILE_REFS" ]; then
  if ! $DRY_RUN; then
    mkdir -p "$COMPLETED_DIR"
  fi
  echo "$DONE_FILE_REFS" | while IFS= read -r file_ref; do
    # Match the complete storage ref, never a numeric prefix (1 vs 11).
    TASK_FILE=$(find "$TASKS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null \
      | while IFS= read -r candidate; do
          basename=$(basename "$candidate")
          if [ "$basename" = "${file_ref}.md" ] || [[ "$basename" == "${file_ref} - "* ]]; then
            printf '%s\n' "$candidate"
            break
          fi
        done)
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

# --- Step 4: Show Running Context entries ---
CONTEXT=$(extract_section "$ACTIVE" "Running Context")
if [ -n "$CONTEXT" ]; then
  echo ""
  echo "=== Running Context (review for _context.md promotion) ==="
  echo "$CONTEXT"
  echo ""
  echo "Promote project-level entries to: $SPRINTS_DIR/_context.md"
fi

# --- Step 5: Optionally close milestone ---
if $CLOSE_MILESTONE; then
  MILESTONE=$(grep '^milestone:' "$ACTIVE" | sed 's/^milestone: *//')
  if [ -n "$MILESTONE" ]; then
    if $DRY_RUN; then
      echo "[dry-run] Would close milestone: $MILESTONE"
    else
      node "$SCRIPT_DIR/tracker-capability.js" close-milestone milestones "$BACKLOG_DIR" "$MILESTONE" 2>/dev/null
    fi
  fi
fi

echo ""
printf "%s\n" "$DOCTOR_SUMMARY"
if [ "$DOCTOR_STATUS" -ne 0 ]; then
  echo "Doctor exit code: $DOCTOR_STATUS (close flow continues; see doctor failures above)."
fi
echo ""
echo "Done."
