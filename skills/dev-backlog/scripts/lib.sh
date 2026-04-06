#!/bin/bash
# Shared library for dev-backlog bash scripts.
# Source this file: source "$(dirname "$0")/lib.sh"

# Checkbox regex patterns — integration contract with dev-relay.
# See: references/integration-contract.md
RE_CB_ANY='^\- \[.\] #'
RE_CB_DONE='^\- \[x\] #'
RE_CB_INFLIGHT='^\- \[~\] #'
RE_CB_TODO='^\- \[ \] #'

# Find the active sprint file (status: active in frontmatter).
# Usage: ACTIVE=$(find_active_sprint "$SPRINTS_DIR")
find_active_sprint() {
  local sprints_dir="$1"
  find "$sprints_dir" -maxdepth 1 -name "*.md" ! -name "_context.md" \
    -exec grep -l "^status: active" {} + 2>/dev/null | head -1
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
  # Strip display prefix "- [ ] " but keep the "#" issue ref
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
