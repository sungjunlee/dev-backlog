#!/bin/bash
set -euo pipefail
# Smoke tests for bash scripts: lib.sh, next.sh, status.sh.
# Verifies checkbox parsing, section extraction, and status output.
#
# Usage: bash scripts/smoke-test.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

source "$SCRIPT_DIR/lib.sh"

PASS=0
FAIL=0

assert_contains() {
  local label="$1" output="$2" expected="$3"
  if echo "$output" | grep -qF "$expected"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label"
    echo "  expected to contain: $expected"
    echo "  got: $output"
  fi
}

assert_not_contains() {
  local label="$1" output="$2" unexpected="$3"
  if echo "$output" | grep -qF "$unexpected"; then
    FAIL=$((FAIL + 1))
    echo "FAIL: $label"
    echo "  expected NOT to contain: $unexpected"
    echo "  got: $output"
  else
    PASS=$((PASS + 1))
  fi
}

assert_equals() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label"
    echo "  expected: $expected"
    echo "  got: $actual"
  fi
}

# ============================================================
# lib.sh unit tests
# ============================================================

# --- extract_section tests ---

cat > "$TEST_DIR/sections.md" << 'EOF'
## Goal
Test the parsing.

## Plan
- [ ] #1 Item A
- [x] #2 Item B

## Running Context
- Decision A
- Decision B

## Progress
- 2026-03-30: Done.
EOF

OUT=$(extract_section "$TEST_DIR/sections.md" "Goal")
assert_equals "extract: Goal section" "$OUT" "Test the parsing."

OUT=$(extract_section "$TEST_DIR/sections.md" "Plan")
assert_contains "extract: Plan has items" "$OUT" "[ ] #1"

OUT=$(extract_section "$TEST_DIR/sections.md" "Running Context")
assert_contains "extract: Running Context" "$OUT" "Decision A"

# Last section (no next ##) — must not lose content
OUT=$(extract_section "$TEST_DIR/sections.md" "Progress")
assert_contains "extract: last section" "$OUT" "2026-03-30: Done."

# Empty section
cat > "$TEST_DIR/empty-section.md" << 'EOF'
## Goal

## Plan
- [ ] #1 Task
EOF

OUT=$(extract_section "$TEST_DIR/empty-section.md" "Goal")
assert_equals "extract: empty section" "$OUT" ""

# Missing section
OUT=$(extract_section "$TEST_DIR/sections.md" "Nonexistent")
assert_equals "extract: missing section" "$OUT" ""

# Section with trailing whitespace in heading
cat > "$TEST_DIR/trailing.md" << 'TEOF'
## Goal
Content here.

## Plan
TEOF

OUT=$(extract_section "$TEST_DIR/trailing.md" "Goal")
assert_equals "extract: trailing whitespace heading" "$OUT" "Content here."

# --- count_checkboxes tests ---

cat > "$TEST_DIR/checkboxes.md" << 'EOF'
- [x] #1 Done
- [x] #2 Also done
- [~] #3 In flight
- [ ] #4 Todo
- [ ] #5 Also todo
EOF

count_checkboxes "$TEST_DIR/checkboxes.md"
assert_equals "count: total" "$CB_TOTAL" "5"
assert_equals "count: done" "$CB_DONE" "2"
assert_equals "count: in-flight" "$CB_IN_FLIGHT" "1"
assert_equals "count: todo" "$CB_TODO" "2"

# Empty file
cat > "$TEST_DIR/empty.md" << 'EOF'
No checkboxes here.
EOF

count_checkboxes "$TEST_DIR/empty.md"
assert_equals "count: empty total" "$CB_TOTAL" "0"
assert_equals "count: empty done" "$CB_DONE" "0"

# --- find_active_sprint tests ---

mkdir -p "$TEST_DIR/sprints"
cat > "$TEST_DIR/sprints/completed.md" << 'EOF'
---
status: completed
---
EOF

cat > "$TEST_DIR/sprints/active.md" << 'EOF'
---
status: active
---
EOF

cat > "$TEST_DIR/sprints/_context.md" << 'EOF'
status: active
EOF

OUT=$(find_active_sprint "$TEST_DIR/sprints")
assert_contains "find: returns active file" "$OUT" "active.md"
assert_not_contains "find: excludes _context.md" "$OUT" "_context.md"
assert_not_contains "find: excludes completed" "$OUT" "completed.md"

# ============================================================
# next.sh integration tests
# ============================================================

mkdir -p "$TEST_DIR/backlog/sprints"
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
---
milestone: Test Sprint
status: active
started: 2026-03-30
due: 2026-04-05
---

# Test Sprint

## Goal
Test the checkbox parsing.

## Plan
### Batch 1 — Done
- [x] #1 Setup DB (~15min)
- [x] #2 Seed data (~10min)

### Batch 2 — In flight
- [~] #3 OAuth2 flow (~2hr) → PR #87 (reviewing)

### Batch 3 — Remaining
- [ ] #4 Rate limiting (~30min)
- [ ] #5 Input validation (~20min)

## Running Context
- Test context entry

## Progress
- 2026-03-30: Batch 1 done.
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "next: progress count" "$OUT" "2/5 done"
assert_contains "next: in-flight count" "$OUT" "1 in-flight"
assert_contains "next: remaining count" "$OUT" "2 remaining"
assert_contains "next: shows in-flight item" "$OUT" "[~] #3"
assert_contains "next: shows next batch item" "$OUT" "[ ] #4"
assert_not_contains "next: does not show done items as next" "$OUT" "[ ] #1"

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TEST_DIR/backlog")
assert_contains "status: shows in-flight" "$OUT" "1 in-flight"
assert_contains "status: shows in-flight item" "$OUT" "[~] #3"
assert_contains "status: shows next up" "$OUT" "Next up:"
assert_contains "status: shows sprint name" "$OUT" "2026-03-test"
assert_contains "status: shows percentage" "$OUT" "40%"

# --- All done ---
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
---
milestone: Test Sprint
status: active
started: 2026-03-30
due: 2026-04-05
---

# Test Sprint

## Goal
All done test.

## Plan
- [x] #1 Task A
- [x] #2 Task B

## Running Context

## Progress
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "all-done: ready to close" "$OUT" "All items checked"
assert_contains "all-done: 2/2" "$OUT" "2/2 done"

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TEST_DIR/backlog")
assert_contains "status all-done: ready message" "$OUT" "ready to close sprint"
assert_contains "status all-done: 100%" "$OUT" "100%"

# --- All in-flight ---
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
---
milestone: Test Sprint
status: active
started: 2026-03-30
due: 2026-04-05
---

# Test Sprint

## Goal
All dispatched.

## Plan
- [~] #1 Task A → PR #10 (reviewing)
- [~] #2 Task B → PR #11 (reviewing)

## Running Context

## Progress
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "all-inflight: shows in-flight" "$OUT" "2 in-flight"
assert_contains "all-inflight: 0 remaining" "$OUT" "0 remaining"
assert_not_contains "all-inflight: not ready to close" "$OUT" "All items checked"

# --- Flat plan (no batch headers) ---
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
---
milestone: Test Sprint
status: active
started: 2026-03-30
due: 2026-04-05
---

# Test Sprint

## Goal
Flat plan.

## Plan
- [x] #1 Done task
- [~] #2 In-flight task → PR #20
- [ ] #3 Remaining task

## Running Context

## Progress
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "flat: counts correct" "$OUT" "1/3 done"
assert_contains "flat: in-flight" "$OUT" "1 in-flight"
assert_contains "flat: remaining" "$OUT" "1 remaining"
assert_contains "flat: shows in-flight item" "$OUT" "[~] #2"
assert_contains "flat: shows next item" "$OUT" "[ ] #3"

# --- Malformed sprint file (missing frontmatter) ---
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
status: active

# No Frontmatter Sprint

## Plan
- [ ] #1 Task A
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "malformed: still finds active" "$OUT" "Sprint:"
assert_contains "malformed: counts tasks" "$OUT" "0/1 done"

# --- No active sprint ---
rm "$TEST_DIR/backlog/sprints/2026-03-test.md"
cat > "$TEST_DIR/backlog/sprints/2026-02-past.md" << 'EOF'
---
status: completed
---
EOF

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog")
assert_contains "no-active: message" "$OUT" "No active sprint"

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TEST_DIR/backlog")
assert_contains "status no-active: message" "$OUT" "no active sprint"

# --- status.sh: local files section ---
mkdir -p "$TEST_DIR/backlog/tasks"
cat > "$TEST_DIR/backlog/tasks/BACK-1.md" << 'EOF'
---
status: To Do
---
EOF
cat > "$TEST_DIR/backlog/tasks/BACK-2.md" << 'EOF'
---
status: In Progress
---
EOF

mkdir -p "$TEST_DIR/backlog/completed"
cat > "$TEST_DIR/backlog/completed/BACK-0.md" << 'EOF'
done
EOF

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TEST_DIR/backlog")
assert_contains "status: task count" "$OUT" "Tasks: 2 total"
assert_contains "status: todo count" "$OUT" "1 To Do"
assert_contains "status: inprog count" "$OUT" "1 In Progress"
assert_contains "status: completed count" "$OUT" "Completed: 1"

# --- Results ---
echo ""
TOTAL=$((PASS + FAIL))
echo "$TOTAL tests: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
