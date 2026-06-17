#!/bin/bash
# Shared library for dev-backlog bash scripts.
# Source this file: source "$(dirname "$0")/lib.sh"

# Checkbox regex patterns — integration contract with dev-relay.
# See: references/integration-contract.md
RE_CB_ANY='^\- \[.\] #'
RE_CB_DONE='^\- \[x\] #'
RE_CB_INFLIGHT='^\- \[~\] #'
RE_CB_TODO='^\- \[ \] #'

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

# Count checkbox states in a sprint file (single awk pass).
# Sets: CB_TOTAL, CB_DONE, CB_IN_FLIGHT, CB_TODO
# Usage: count_checkboxes "$FILE"
count_checkboxes() {
  local file="$1"
  local counts
  # Awk patterns mirror RE_CB_* constants (awk can't reference shell vars directly)
  counts=$(awk '/^- \[.\] #/{t++} /^- \[x\] #/{d++} /^- \[~\] #/{f++} END{print t+0, d+0, f+0}' "$file" 2>/dev/null)
  read -r CB_TOTAL CB_DONE CB_IN_FLIGHT <<< "$counts"
  CB_TODO=$((CB_TOTAL - CB_DONE - CB_IN_FLIGHT))
}

# Return the first unchecked todo item (stripped of "- [ ] " prefix).
# Usage: NEXT=$(next_todo_item "$FILE")
next_todo_item() {
  local file="$1"
  # Strip display prefix "- [ ] " but keep the "#" issue ref.
  # Sed pattern mirrors RE_CB_TODO minus trailing "#"; keep in sync if format changes.
  grep "$RE_CB_TODO" "$file" 2>/dev/null | head -1 | sed 's/^- \[ \] //'
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
