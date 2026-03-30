#!/bin/bash
# Shared library for dev-backlog bash scripts.
# Source this file: source "$(dirname "$0")/lib.sh"

# Find the active sprint file (status: active in frontmatter).
# Usage: ACTIVE=$(find_active_sprint "$SPRINTS_DIR")
find_active_sprint() {
  local sprints_dir="$1"
  find "$sprints_dir" -maxdepth 1 -name "*.md" ! -name "_context.md" \
    -exec grep -l "^status: active" {} \; 2>/dev/null | head -1
}

# Count checkbox states in a sprint file.
# Sets: CB_TOTAL, CB_DONE, CB_IN_FLIGHT, CB_TODO
# Usage: count_checkboxes "$FILE"
count_checkboxes() {
  local file="$1"
  CB_TOTAL=$(grep -c '^\- \[.\] #' "$file" 2>/dev/null) || CB_TOTAL=0
  CB_DONE=$(grep -c '^\- \[x\] #' "$file" 2>/dev/null) || CB_DONE=0
  CB_IN_FLIGHT=$(grep -c '^\- \[~\] #' "$file" 2>/dev/null) || CB_IN_FLIGHT=0
  CB_TODO=$((CB_TOTAL - CB_DONE - CB_IN_FLIGHT))
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
