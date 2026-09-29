#!/bin/bash
set -uo pipefail
# Close the active sprint: mark completed, remind about context.
#
# Usage: bash scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]
#
# With multiple active tracks, --track <slug> picks which one to close;
# without it the close refuses as ambiguous (a single active needs no flag).
#
# Steps:
#   1. Run backlog-doctor pre-close (read-only verdicts)
#   2. Set sprint status: completed + add Progress entry
#   3. Show Running Context entries (remind to promote to _context.md)
#   4. Optionally close GitHub milestone (--close-milestone)

# Resolve without `dirname` (restricted PATH / Windows Git Bash).
# Normalize backslashes first: `%/*` only strips `/`, so a Windows path
# would otherwise equal BASH_SOURCE and fall back to `.` (the caller's cwd).
_src="${BASH_SOURCE[0]//\\//}"
SCRIPT_DIR="${_src%/*}"
[ "$SCRIPT_DIR" = "$_src" ] && SCRIPT_DIR="."
SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd)"
source "$SCRIPT_DIR/lib.sh"

BACKLOG_DIR="${DEFAULT_BACKLOG_DIR:-.dev-backlog}"
DRY_RUN=false
CLOSE_MILESTONE=false
BACKLOG_DIR_SET=false
TRACK=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --close-milestone) CLOSE_MILESTONE=true ;;
    --track)
      shift
      TRACK="${1:-}"
      if [ -z "$TRACK" ]; then
        echo "Missing value for --track"
        exit 1
      fi
      ;;
    --track=*) TRACK="${1#--track=}" ;;
    --*)
      echo "Unknown argument: $1"
      exit 1
      ;;
    *)
      if $BACKLOG_DIR_SET; then
        echo "Unexpected argument: $1"
        exit 1
      fi
      BACKLOG_DIR="$1"
      BACKLOG_DIR_SET=true
      ;;
  esac
  shift
done

# Close a GitHub milestone by title. Fail-loud (#366): a failed lookup or PATCH
# returns non-zero so sprint-close aborts before marking the sprint completed.
# Already-closed milestones succeed without a PATCH.
close_github_milestone() {
  local name="$1" rows row number state
  rows=$(MS="$name" gh api --paginate \
    'repos/{owner}/{repo}/milestones?state=all&per_page=100' \
    --jq '.[] | select(.title==env.MS) | [.number, .state] | @tsv') || return 1
  row=$(printf '%s\n' "$rows" | grep -v '^[[:space:]]*$' | head -1)
  if [ -z "$row" ]; then
    echo "milestone not found: $name" >&2
    return 1
  fi
  number="${row%%$'\t'*}"
  state="${row##*$'\t'}"
  [ "$state" = "closed" ] && return 0
  gh api -X PATCH "repos/{owner}/{repo}/milestones/$number" -f state=closed >/dev/null || return 1
}

SPRINTS_DIR="$BACKLOG_DIR/sprints"

if [ ! -d "$SPRINTS_DIR" ]; then
  echo "No sprints directory found."
  exit 1
fi

if [ -n "$TRACK" ]; then
  ACTIVE=$(resolve_track "$SPRINTS_DIR" "$TRACK")
  RESOLVE_STATUS=$?
  # 2 = ambiguous selector; resolve_track already named the candidates.
  [ "$RESOLVE_STATUS" -eq 2 ] && exit 1
  if [ -z "$ACTIVE" ]; then
    echo "No active track matches '$TRACK'. Active tracks:"
    find_active_sprints "$SPRINTS_DIR" | while IFS= read -r sprint; do
      [ -z "$sprint" ] && continue
      echo "  - $(basename "$sprint" .md)"
    done
    exit 1
  fi
else
  FIND_ERR=$(mktemp)
  ACTIVE=$(find_active_sprint "$SPRINTS_DIR" 2>"$FIND_ERR")
  ACTIVE_STATUS=$?
  if [ "$ACTIVE_STATUS" -eq 3 ]; then
    cat "$FIND_ERR" >&2
    rm -f "$FIND_ERR"
    echo "Could not read the sprint files in $SPRINTS_DIR." >&2
    exit 1
  fi
  rm -f "$FIND_ERR"
  if [ "$ACTIVE_STATUS" -eq 2 ]; then
    echo "Multiple active sprints found. Refusing to close an ambiguous sprint:"
    find_active_sprints "$SPRINTS_DIR" | while IFS= read -r sprint; do
      echo "  - $(basename "$sprint")"
    done
    echo "Pass --track <slug> to close one track."
    exit 1
  fi

  if [ "$ACTIVE_STATUS" -ne 0 ]; then
    echo "No active sprint to close."
    exit 0
  fi
fi

SPRINT_NAME=$(basename "$ACTIVE" .md)
count_checkboxes "$ACTIVE"
echo "Closing sprint: $SPRINT_NAME ($CB_DONE/$CB_TOTAL done)"

# Warn if unchecked items remain
if [ "$CB_TODO" -gt 0 ] || [ "$CB_IN_FLIGHT" -gt 0 ]; then
  echo "Warning: $CB_TODO todo, $CB_IN_FLIGHT in-flight items remaining"
fi

# The status flip goes through the shared reader: every form it reads as
# active is rewritten, and a file it cannot close stops here, before Step 0
# touches GitHub. Usage: complete_sprint_file check|write FILE
complete_sprint_file() {
  node -e '
    const fs = require("node:fs");
    const { completedSprintContent } = require(process.argv[1]);
    const next = completedSprintContent(fs.readFileSync(process.argv[3], "utf-8"));
    if (next === null) process.exit(1);
    if (process.argv[2] === "write") fs.writeFileSync(process.argv[3], next);
  ' "$SCRIPT_DIR/sprint-state.js" "$1" "$2"
}
if ! complete_sprint_file check "$ACTIVE"; then
  echo "Cannot set status: completed in $ACTIVE; edit its frontmatter by hand." >&2
  exit 1
fi

# --- Step 0: Optional provider mutation runs BEFORE any local mutation ---
# Fail-loud contract (#366): if the GitHub milestone cannot be closed, the
# local sprint must remain active — never completed-with-open-milestone.
# There is no automatic retry and no fallback authority: fix GitHub access
# (rate limit / auth / outage) and re-run the close.
# The task authority guard runs even under --dry-run; only an absent .tracker
# defaults to github — an unreadable or irregular one is a hard stop.
if $CLOSE_MILESTONE; then
  TRACKER="$BACKLOG_DIR/.tracker"
  if [ ! -e "$TRACKER" ] && [ ! -L "$TRACKER" ]; then
    AUTHORITY=github
  elif [ ! -f "$TRACKER" ] || ! AUTHORITY=$(head -n1 "$TRACKER"); then
    echo "Refusing --close-milestone: cannot read task authority from $TRACKER."
    exit 1
  else
    BOM=$(printf '\357\273\277'); AUTHORITY="${AUTHORITY#"$BOM"}"
    AUTHORITY=$(printf '%s' "$AUTHORITY" | sed 's/\r$//;s/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
  fi
  if [ "$AUTHORITY" != "github" ]; then
    echo "Refusing --close-milestone: task authority is '$AUTHORITY' (.dev-backlog/.tracker); milestones are GitHub-only."
    exit 1
  fi
fi
# The milestone title comes from the shared frontmatter parser (read once, used
# by Step 0 and Step 4). An unquoted numeric or boolean title keeps its written
# text; a missing or structured value is no milestone.
if $CLOSE_MILESTONE; then
  CLOSE_MILESTONE_NAME=$(node -e '
    const fs = require("node:fs");
    const { parseFrontmatter } = require(process.argv[1]);
    const content = fs.readFileSync(process.argv[2], "utf-8");
    const milestone = parseFrontmatter(content).milestone;
    if (typeof milestone === "string") {
      console.log(milestone.trim());
    } else if (typeof milestone === "number" || typeof milestone === "boolean") {
      // The root line is the one whose removal changes the parsed root value;
      // a nested `milestone:` never qualifies.
      const lines = content.split("\n");
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (!/^[ \t]*milestone:/.test(lines[index])) continue;
        const without = lines.filter((_, lineIndex) => lineIndex !== index).join("\n");
        if (parseFrontmatter(without).milestone === milestone) continue;
        console.log(lines[index].replace(/^[ \t]*milestone:/, "").trim().replace(/^(["\x27])(.*)\1$/, "$2"));
        break;
      }
    }
  ' "$SCRIPT_DIR/sprint-state.js" "$ACTIVE")
fi
if $CLOSE_MILESTONE && ! $DRY_RUN; then
  if [ -z "$CLOSE_MILESTONE_NAME" ]; then
    echo "No milestone: frontmatter in $ACTIVE; cannot --close-milestone."
    exit 1
  fi
  if ! close_github_milestone "$CLOSE_MILESTONE_NAME"; then
    echo "Refusing to mark sprint completed: GitHub milestone '$CLOSE_MILESTONE_NAME' could not be closed."
    exit 1
  fi
fi

# --- Step 1: Run backlog-doctor ---
# The doctor runs before the status flip and only reads, so a dry-run prints the
# same verdicts. Whether to reassess the charter is a human call at close (#446).
TODAY=$(date +%Y-%m-%d)
DOCTOR_SUMMARY=$(node "$SCRIPT_DIR/backlog-doctor.js" "$BACKLOG_DIR" 2>&1)
DOCTOR_STATUS=$?

# --- Step 2: Set status: completed ---
if $DRY_RUN; then
  echo "[dry-run] Would set status: completed in $ACTIVE"
else
  if ! complete_sprint_file write "$ACTIVE"; then
    echo "Could not set status: completed in $ACTIVE; edit its frontmatter by hand." >&2
    exit 1
  fi
  # Append progress entry
  echo "- $TODAY: Sprint closed. $CB_DONE/$CB_TOTAL tasks completed." >> "$ACTIVE"
  echo "Set status: completed in $ACTIVE"
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
  MILESTONE="$CLOSE_MILESTONE_NAME"
  if [ -n "$MILESTONE" ]; then
    if $DRY_RUN; then
      echo "[dry-run] Would close milestone: $MILESTONE"
    else
      # Already closed in Step 0 (before local mutation); confirmation only.
      echo "Closed milestone: $MILESTONE"
    fi
  fi
fi

echo ""
echo "=== Backlog Doctor (pre-close) ==="
printf "%s\n" "$DOCTOR_SUMMARY"
if [ "$DOCTOR_STATUS" -ne 0 ]; then
  echo "Doctor exit code: $DOCTOR_STATUS (close flow continues; see doctor failures above)."
fi
echo ""
echo "Done."
