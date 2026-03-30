#!/bin/bash
set -euo pipefail
# Smoke tests for next.sh and status.sh.
# Verifies [ ], [x], and [~] checkbox states are parsed correctly.
#
# Usage: bash scripts/smoke-test.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

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

# --- Test 1: Mixed states ([ ], [x], [~]) ---
mkdir -p "$TMPDIR/backlog/sprints"
cat > "$TMPDIR/backlog/sprints/2026-03-test.md" << 'EOF'
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

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TMPDIR/backlog")
assert_contains "next: progress count" "$OUT" "2/5 done"
assert_contains "next: in-flight count" "$OUT" "1 in-flight"
assert_contains "next: remaining count" "$OUT" "2 remaining"
assert_contains "next: shows in-flight item" "$OUT" "[~] #3"
assert_contains "next: shows next batch item" "$OUT" "[ ] #4"
assert_not_contains "next: does not show done items as next" "$OUT" "[ ] #1"

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TMPDIR/backlog")
assert_contains "status: shows in-flight" "$OUT" "1 in-flight"
assert_contains "status: shows in-flight item" "$OUT" "[~] #3"
assert_contains "status: shows next up" "$OUT" "Next up:"

# --- Test 2: All done ---
cat > "$TMPDIR/backlog/sprints/2026-03-test.md" << 'EOF'
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

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TMPDIR/backlog")
assert_contains "all-done: ready to close" "$OUT" "All items checked"
assert_contains "all-done: 2/2" "$OUT" "2/2 done"

# --- Test 3: All in-flight (nothing to show as "next") ---
cat > "$TMPDIR/backlog/sprints/2026-03-test.md" << 'EOF'
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

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TMPDIR/backlog")
assert_contains "all-inflight: shows in-flight" "$OUT" "2 in-flight"
assert_contains "all-inflight: 0 remaining" "$OUT" "0 remaining"
assert_not_contains "all-inflight: not ready to close" "$OUT" "All items checked"

# --- Test 4: No batch headers (flat plan) ---
cat > "$TMPDIR/backlog/sprints/2026-03-test.md" << 'EOF'
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

OUT=$(bash "$SCRIPT_DIR/next.sh" "$TMPDIR/backlog")
assert_contains "flat: counts correct" "$OUT" "1/3 done"
assert_contains "flat: in-flight" "$OUT" "1 in-flight"
assert_contains "flat: remaining" "$OUT" "1 remaining"
assert_contains "flat: shows in-flight item" "$OUT" "[~] #2"
assert_contains "flat: shows next item" "$OUT" "[ ] #3"

# --- Results ---
echo ""
TOTAL=$((PASS + FAIL))
echo "$TOTAL tests: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
