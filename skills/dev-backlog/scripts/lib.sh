#!/bin/bash
# Shared library for dev-backlog bash scripts.
# Source this file: source "$(dirname "$0")/lib.sh"

# Legacy GitHub checkbox regex aliases — integration contract with dev-relay.
# Core shell consumers use checkbox_lines/count_checkboxes below, which delegate
# task-ref grammar to task-ref.js and therefore also accept configured local refs.
# See: references/integration-contract.md
RE_CB_ANY='^\- \[.\] #'
RE_CB_DONE='^\- \[x\] #'
RE_CB_INFLIGHT='^\- \[~\] #'
RE_CB_TODO='^\- \[ \] #'

TASK_REF_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print valid Plan checkbox lines, optionally limited to one marker (space/~ /x).
# Usage: checkbox_lines "$FILE" [marker]
checkbox_lines() {
  local file="$1" marker="${2-}" backlog_dir
  backlog_dir=$(dirname "$(dirname "$file")")
  if [ "$#" -gt 1 ]; then
    node "$TASK_REF_SCRIPT_DIR/task-ref.js" plan-lines "$file" "$backlog_dir" "$marker"
  else
    node "$TASK_REF_SCRIPT_DIR/task-ref.js" plan-lines "$file" "$backlog_dir"
  fi
}

# List active sprint files (status: active in frontmatter).
# Usage: find_active_sprints "$SPRINTS_DIR"
find_active_sprints() {
  local sprints_dir="$1"
  find "$sprints_dir" -maxdepth 1 -name "*.md" ! -name "_context.md" \
    -exec grep -l "^status: active" {} + 2>/dev/null | sort
}

# Find the active sprint file.
# Return codes:
#   0: exactly one active sprint, printed to stdout
#   1: no active sprint
#   2: multiple active sprints, printed to stderr
# Usage: ACTIVE=$(find_active_sprint "$SPRINTS_DIR")
find_active_sprint() {
  local sprints_dir="$1"
  local active
  local count

  active=$(find_active_sprints "$sprints_dir")
  count=$(printf "%s\n" "$active" | grep -c . || true)

  if [ "$count" -eq 0 ]; then
    return 1
  fi

  if [ "$count" -gt 1 ]; then
    {
      echo "Multiple active sprint files found:"
      printf "%s\n" "$active" | sed 's/^/  /'
    } >&2
    return 2
  fi

  printf "%s\n" "$active"
}

# Print the active sprint file whose slug (basename) or component: matches $2.
# Return 0 and print the path when found; return 1 when no active track matches.
# Usage: SPRINT=$(resolve_track "$SPRINTS_DIR" "$TRACK")
resolve_track() {
  local sprints_dir="$1" track="$2" f slug component
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    slug=$(basename "$f" .md)
    component=$(awk -F': *' '/^component:/{gsub(/["'"'"']/,"",$2); print $2; exit}' "$f")
    if [ "$slug" = "$track" ] || [ "$component" = "$track" ]; then
      printf '%s\n' "$f"
      return 0
    fi
  done < <(find_active_sprints "$sprints_dir")
  return 1
}

# Count checkbox states in a sprint file through the shared task-ref parser.
# Sets: CB_TOTAL, CB_DONE, CB_IN_FLIGHT, CB_TODO
# Usage: count_checkboxes "$FILE"
count_checkboxes() {
  local file="$1"
  local backlog_dir counts
  backlog_dir=$(dirname "$(dirname "$file")")
  counts=$(node "$TASK_REF_SCRIPT_DIR/task-ref.js" counts "$file" "$backlog_dir")
  read -r CB_TOTAL CB_DONE CB_IN_FLIGHT CB_TODO <<< "$counts"
}

# Return the first unchecked todo item (stripped of "- [ ] " prefix).
# Usage: NEXT=$(next_todo_item "$FILE")
next_todo_item() {
  local file="$1"
  # Strip the stable checkbox display prefix while keeping the parsed task ref.
  checkbox_lines "$file" " " | head -1 | sed 's/^- \[ \] //'
}

# Extract a markdown section by heading (## level).
# Handles: last section (no next ##), empty sections, trailing whitespace.
# Usage: extract_section "$FILE" "Goal"
extract_section() {
  local file="$1" section="$2"
  awk -v sect="$section" '
    BEGIN { found=0 }
    /^## / {
      if (found) exit
      if ($0 ~ "^## " sect "[ \t]*$") { found=1; next }
    }
    found { print }
  ' "$file" | awk 'NF{p=NR} {lines[NR]=$0} END{for(i=1;i<=p;i++) print lines[i]}'
}
