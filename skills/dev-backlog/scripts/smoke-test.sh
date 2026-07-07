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

assert_json_eval() {
  local label="$1" output="$2" script="$3"
  local status
  set +e
  printf "%s" "$output" | node -e "$script"
  status=$?
  set -e
  assert_equals "$label" "$status" "0"
}

# ============================================================
# backlog-doctor live-repo smoke test
# ============================================================

REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
set +e
OUT=$(cd "$REPO_ROOT" && node "$SCRIPT_DIR/backlog-doctor.js" --json 2>&1)
STATUS=$?
set -e
assert_equals "doctor live: exit code" "$STATUS" "0"
assert_json_eval "doctor live: json check families" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
const names = new Set((j.checks || []).map((check) => check.name));
for (const name of [
  "active_sprint",
  "objectives_check",
  "component_lint",
  "capabilities_doctor",
  "sprint_shape",
  "in_flight_trace",
]) {
  if (!names.has(name)) process.exit(1);
}
if (j.schema_version !== 1 || !Array.isArray(j.checks) || j.exit_hint === "fail") {
  process.exit(1);
}
'
assert_json_eval "doctor live: reassess_signal shape" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
const s = j.reassess_signal;
if (!s || typeof s.fired !== "boolean" || typeof s.reason !== "string") process.exit(1);
if (typeof s.sprints_since_last_report !== "number") process.exit(1);
if (s.latest_report !== null && typeof s.latest_report !== "string") process.exit(1);
'

# ============================================================
# fresh-session recovery live-repo smoke test
# ============================================================

STATUS_JSON=$(cd "$REPO_ROOT" && bash "$SCRIPT_DIR/status.sh" --json)
NEXT_JSON=$(cd "$REPO_ROOT" && bash "$SCRIPT_DIR/next.sh" --json)
RECOVERY_JSON=$(printf '{"status":%s,"next":%s}' "$STATUS_JSON" "$NEXT_JSON")
assert_json_eval "recovery live: files-only state is orientable" "$RECOVERY_JSON" '
const recovery = JSON.parse(require("fs").readFileSync(0, "utf8"));
const { status, next } = recovery;
if (status.schema_version !== 1 || next.schema_version !== 1) {
  process.exit(1);
}
const sprintPath = status.active_sprint && status.active_sprint.path;
if (!sprintPath) {
  // Between sprints: the orientable answer is "no active sprint" — both
  // surfaces must agree and report no plan/in-flight state.
  const restingOk = !next.active_sprint
    && (!Array.isArray(status.plan_items) || status.plan_items.length === 0)
    && (!Array.isArray(status.in_flight) || status.in_flight.length === 0);
  process.exit(restingOk ? 0 : 1);
}
if (!next.active_sprint || next.active_sprint.path !== sprintPath) {
  process.exit(1);
}
const planItems = Array.isArray(status.plan_items) ? status.plan_items : [];
const hasTodo = planItems.some((item) => item.state === "todo");
const hasInFlight = planItems.some((item) => item.state === "in_flight");
const sprintComplete = planItems.length > 0 && planItems.every((item) => item.state === "done");
if (hasTodo) {
  if (!next.next_batch || !Array.isArray(next.next_batch.items) || next.next_batch.items.length === 0) {
    process.exit(1);
  }
} else if (!sprintComplete && !hasInFlight) {
  process.exit(1);
}
const inFlight = Array.isArray(status.in_flight) ? status.in_flight : null;
if (!inFlight) process.exit(1);
const inFlightPlanItems = planItems.filter((item) => item.state === "in_flight");
if (inFlight.length !== inFlightPlanItems.length) process.exit(1);
for (const item of inFlight) {
  const hasPr = item.pr && item.pr.number != null;
  const hasBranch = item.branch != null && item.branch !== "";
  const hasRun = item.run_id != null && item.run_id !== "";
  if (!hasPr && !hasBranch && !hasRun) process.exit(1);
}
'

# Deterministic fixture: in-flight-only sprint keeps the pointer guarantee
# observable even when the live repo has no [~] items.
RECOVERY_FIXTURE_DIR="$TEST_DIR/recovery-backlog"
mkdir -p "$RECOVERY_FIXTURE_DIR/sprints"
cat > "$RECOVERY_FIXTURE_DIR/sprints/2026-01-recovery-fixture.md" << 'EOF'
---
milestone: recovery fixture
status: active
started: 2026-01-01
due: TBD
objectives: []
component: ""
---

# Recovery Fixture

## Goal
Fixture sprint with only in-flight work.

## Plan
- [x] #1 Done item → PR #10 (merged)
- [~] #2 In-flight item → PR #11 (reviewing) [run:issue-2-fixture]

## Running Context
- none

## Progress
- 2026-01-01: #2 dispatched.
EOF
FIXTURE_STATUS=$(node "$SCRIPT_DIR/sprint-state.js" --mode status "$RECOVERY_FIXTURE_DIR")
FIXTURE_NEXT=$(node "$SCRIPT_DIR/sprint-state.js" --mode next "$RECOVERY_FIXTURE_DIR")
FIXTURE_JSON=$(printf '{"status":%s,"next":%s}' "$FIXTURE_STATUS" "$FIXTURE_NEXT")
assert_json_eval "recovery fixture: in-flight-only sprint orientable without next batch" "$FIXTURE_JSON" '
const recovery = JSON.parse(require("fs").readFileSync(0, "utf8"));
const { status, next } = recovery;
if (!status.active_sprint || !status.active_sprint.path) process.exit(1);
const planItems = Array.isArray(status.plan_items) ? status.plan_items : [];
if (planItems.some((item) => item.state === "todo")) process.exit(1);
const inFlight = Array.isArray(status.in_flight) ? status.in_flight : [];
if (inFlight.length !== 1) process.exit(1);
const item = inFlight[0];
const hasPr = item.pr && item.pr.number != null;
const hasRun = item.run_id != null && item.run_id !== "";
if (!hasPr || !hasRun) process.exit(1);
if (next.next_batch && Array.isArray(next.next_batch.items) && next.next_batch.items.length > 0) {
  process.exit(1);
}
'

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

rm "$TEST_DIR/sprints/active.md"
set +e
OUT=$(find_active_sprint "$TEST_DIR/sprints")
STATUS=$?
set -e
assert_equals "find: no active exit code" "$STATUS" "1"
assert_equals "find: no active output" "$OUT" ""

cat > "$TEST_DIR/sprints/active-a.md" << 'EOF'
---
status: active
---
EOF

cat > "$TEST_DIR/sprints/active-b.md" << 'EOF'
---
status: active
---
EOF

ERR="$TEST_DIR/find-active-error.txt"
set +e
OUT=$(find_active_sprint "$TEST_DIR/sprints" 2>"$ERR")
STATUS=$?
set -e
assert_equals "find: multiple active exit code" "$STATUS" "2"
assert_equals "find: multiple active stdout empty" "$OUT" ""
assert_contains "find: multiple active error heading" "$(cat "$ERR")" "Multiple active sprint files found"
assert_contains "find: multiple active lists first" "$(cat "$ERR")" "active-a.md"
assert_contains "find: multiple active lists second" "$(cat "$ERR")" "active-b.md"

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

OUT=$(bash "$SCRIPT_DIR/status.sh" --json "$TEST_DIR/backlog")
assert_json_eval "status json: structured state" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (
  j.schema_version !== 1 ||
  !j.active_sprint ||
  j.active_sprint.frontmatter.status !== "active" ||
  j.active_sprint.goal !== "Test the checkbox parsing." ||
  !Array.isArray(j.plan_items) ||
  j.plan_items.length !== 5 ||
  !Array.isArray(j.latest_progress) ||
  !Array.isArray(j.in_flight) ||
  j.in_flight[0].issue_number !== 3 ||
  typeof j.in_flight[0].age_days !== "number"
) process.exit(1);
'

OUT=$(bash "$SCRIPT_DIR/next.sh" --json "$TEST_DIR/backlog")
assert_json_eval "next json: next batch" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (
  j.schema_version !== 1 ||
  !("next_batch" in j) ||
  !j.next_batch ||
  j.next_batch.heading !== "### Batch 3 — Remaining" ||
  !Array.isArray(j.next_batch.items) ||
  j.next_batch.items[0].issue_number !== 4
) process.exit(1);
'

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

# --- Multiple active sprints ---
cat > "$TEST_DIR/backlog/sprints/2026-03-active-a.md" << 'EOF'
---
status: active
---

## Plan
- [ ] #1 Task A
EOF

cat > "$TEST_DIR/backlog/sprints/2026-03-active-b.md" << 'EOF'
---
status: active
---

## Plan
- [ ] #2 Task B
EOF

set +e
OUT=$(bash "$SCRIPT_DIR/next.sh" "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "next multiple-active: exit code" "$STATUS" "1"
assert_contains "next multiple-active: message" "$OUT" "Multiple active sprints found"
assert_contains "next multiple-active: lists first" "$OUT" "2026-03-active-a.md"
assert_contains "next multiple-active: lists second" "$OUT" "2026-03-active-b.md"

OUT=$(bash "$SCRIPT_DIR/status.sh" "$TEST_DIR/backlog" 2>&1)
assert_contains "status multiple-active: warning" "$OUT" "Multiple active sprints found"
assert_contains "status multiple-active: lists first" "$OUT" "2026-03-active-a.md"
assert_contains "status multiple-active: lists second" "$OUT" "2026-03-active-b.md"

set +e
OUT=$(bash "$SCRIPT_DIR/next.sh" --json "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "next json multiple-active: exit code" "$STATUS" "1"
assert_contains "next json multiple-active: error" "$OUT" "Multiple active sprint files found"

set +e
OUT=$(bash "$SCRIPT_DIR/status.sh" --json "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "status json multiple-active: exit code" "$STATUS" "1"
assert_contains "status json multiple-active: error" "$OUT" "Multiple active sprint files found"

OUT=$(bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog" 2>&1)
assert_contains "hook multiple-active: warning" "$OUT" "Multiple active sprints found"

rm "$TEST_DIR/backlog/sprints/2026-03-active-a.md" "$TEST_DIR/backlog/sprints/2026-03-active-b.md"

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

# ============================================================
# context-hook.sh tests
# ============================================================

# Restore active sprint for hook tests
cat > "$TEST_DIR/backlog/sprints/2026-03-test.md" << 'EOF'
---
milestone: Test Sprint
status: active
started: 2026-03-30
due: 2026-04-05
---

# Test Sprint

## Goal
Test context hook.

## Plan
- [x] #1 Setup DB (~15min)
- [x] #2 Seed data (~10min)
- [~] #3 OAuth2 flow (~2hr) → PR #87 (reviewing)
- [ ] #4 Rate limiting (~30min)
- [ ] #5 Input validation (~20min)

## Running Context

## Progress
EOF

OUT=$(bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog")
assert_contains "hook: sprint name" "$OUT" "[Sprint: 2026-03-test]"
assert_contains "hook: done count" "$OUT" "2/5 done"
assert_contains "hook: in-flight" "$OUT" "1 in-flight"
assert_contains "hook: next item" "$OUT" "Next: #4 Rate limiting"

# Hook exits 0
bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog"
assert_equals "hook: exit code 0" "$?" "0"

# No active sprint — silent exit 0
rm "$TEST_DIR/backlog/sprints/2026-03-test.md"
OUT=$(bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog")
assert_equals "hook: no sprint = empty" "$OUT" ""
bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog"
assert_equals "hook: no sprint exit 0" "$?" "0"

# No sprints dir — silent exit 0
rm -rf "$TEST_DIR/backlog/sprints"
OUT=$(bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog")
assert_equals "hook: no dir = empty" "$OUT" ""

# All done — no next item
mkdir -p "$TEST_DIR/backlog/sprints"
cat > "$TEST_DIR/backlog/sprints/2026-03-done.md" << 'EOF'
---
status: active
---

## Plan
- [x] #1 Task A
- [x] #2 Task B
EOF

OUT=$(bash "$SCRIPT_DIR/context-hook.sh" "$TEST_DIR/backlog")
assert_contains "hook all-done: count" "$OUT" "2/2 done"
assert_not_contains "hook all-done: no Next" "$OUT" "Next:"

# ============================================================
# integration contract pattern tests
# ============================================================

# Checkbox regex matches all three states (using lib.sh constants)
assert_equals "contract: [ ] matches" "$(echo '- [ ] #1 Task' | grep -c "$RE_CB_ANY")" "1"
assert_equals "contract: [~] matches" "$(echo '- [~] #2 Task' | grep -c "$RE_CB_ANY")" "1"
assert_equals "contract: [x] matches" "$(echo '- [x] #3 Task' | grep -c "$RE_CB_ANY")" "1"

# Issue number extraction
assert_equals "contract: issue number" \
  "$(echo '- [x] #42 OAuth2 flow (~2hr) → PR #87 (merged)' | sed "s/${RE_CB_ANY}\([0-9]*\).*/\1/")" "42"

# Section heading regex
assert_equals "contract: Plan heading" \
  "$(echo '## Plan' | grep -c '^## Plan[ 	]*$')" "1"
assert_equals "contract: Running Context heading" \
  "$(echo '## Running Context' | grep -c '^## Running Context[ 	]*$')" "1"

# Relay-merge progress log format
assert_equals "contract: progress log" \
  "$(echo '- 2026-03-25 10:50: #38 dispatched → PR #87 → reviewed (LGTM, round 1) → merged' | grep -c '#[0-9]* dispatched → PR #[0-9]*')" "1"

# Run-ID annotation extraction
assert_equals "contract: run-id extraction" \
  "$(echo '- [x] #42 OAuth2 flow → PR #87 (merged) [run:issue-42-20260403120000000]' | sed 's/.*\[run:\([^]]*\)\]$/\1/')" "issue-42-20260403120000000"

# Run-ID is optional (no annotation = line unchanged by sed, grep finds 0)
assert_equals "contract: no run-id is valid" \
  "$(echo '- [x] #42 OAuth2 flow → PR #87 (merged)' | grep -c '\[run:')" "0"

# Extraction sed on line without run-id returns original line (no false positive)
assert_equals "contract: run-id extraction on absent annotation" \
  "$(echo '- [x] #42 OAuth2 flow → PR #87 (merged)' | sed 's/.*\[run:\([^]]*\)\]$/\1/')" \
  "- [x] #42 OAuth2 flow → PR #87 (merged)"

# _context.md section headings
assert_equals "contract: Architecture Decisions heading" \
  "$(echo '## Architecture Decisions' | grep -c '^## Architecture Decisions[ 	]*$')" "1"
assert_equals "contract: Conventions heading" \
  "$(echo '## Conventions' | grep -c '^## Conventions[ 	]*$')" "1"
assert_equals "contract: Known Gotchas heading" \
  "$(echo '## Known Gotchas' | grep -c '^## Known Gotchas[ 	]*$')" "1"

# ============================================================
# sprint-close.sh tests
# ============================================================

# Setup fresh environment for sprint-close tests
rm -rf "$TEST_DIR/backlog"
mkdir -p "$TEST_DIR/backlog/sprints" "$TEST_DIR/backlog/tasks" "$TEST_DIR/backlog/completed"

cat > "$TEST_DIR/backlog/sprints/2026-03-auth.md" << 'EOF'
---
milestone: Auth Sprint
status: active
started: 2026-03-22
due: 2026-03-28
---

# Auth Sprint

## Goal
Ship auth.

## Plan
- [x] #1 DB schema
- [x] #2 OAuth flow

## Running Context
- argon2 for hashing (decided in #1)
- test DB: docker-compose.test.yml

## Progress
- 2026-03-22: Batch 1 done.
EOF

# Create matching task files
cat > "$TEST_DIR/backlog/tasks/BACK-1 - db-schema.md" << 'EOF'
---
id: BACK-1
title: DB schema
status: In Progress
---
EOF
cat > "$TEST_DIR/backlog/tasks/BACK-2 - oauth-flow.md" << 'EOF'
---
id: BACK-2
title: OAuth flow
status: In Progress
---
EOF
# Task not in sprint — should NOT be moved
cat > "$TEST_DIR/backlog/tasks/BACK-99 - unrelated.md" << 'EOF'
---
id: BACK-99
title: Unrelated
status: To Do
---
EOF

cat > "$TEST_DIR/backlog/sprints/2026-03-other-active.md" << 'EOF'
---
status: active
---

## Plan
- [x] #50 Other task
EOF

set +e
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "close multiple-active: exit code" "$STATUS" "1"
assert_contains "close multiple-active: refuses ambiguous close" "$OUT" "Refusing to close an ambiguous sprint"
assert_contains "close multiple-active: lists first" "$OUT" "2026-03-auth.md"
assert_contains "close multiple-active: lists second" "$OUT" "2026-03-other-active.md"
rm "$TEST_DIR/backlog/sprints/2026-03-other-active.md"

# --- dry-run test ---
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" --dry-run 2>&1)
assert_contains "close dry-run: would set completed" "$OUT" "Would set status: completed"
assert_contains "close dry-run: would move task" "$OUT" "BACK-1"
assert_contains "close dry-run: shows context entries" "$OUT" "argon2"
assert_contains "close dry-run: runs doctor" "$OUT" "=== Backlog Doctor (pre-close) ==="
assert_contains "close dry-run: doctor result appears" "$OUT" "[PASS] active_sprint"
assert_contains "close dry-run: reassess verdict appears" "$OUT" "Reassess signal:"
# Verify nothing actually changed
assert_contains "close dry-run: file unchanged" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "active"
assert_equals "close dry-run: task not moved" "$(ls "$TEST_DIR/backlog/tasks/" | wc -l | tr -d ' ')" "3"

# --- dry-run flag/order parsing tests ---
set +e
OUT=$(cd "$TEST_DIR" && bash "$SCRIPT_DIR/sprint-close.sh" --dry-run 2>&1)
STATUS=$?
set -e
assert_equals "close dry-run flag-only: exit code" "$STATUS" "0"
assert_contains "close dry-run flag-only: would set completed" "$OUT" "Would set status: completed"
assert_contains "close dry-run flag-only: runs doctor" "$OUT" "=== Backlog Doctor (pre-close) ==="
assert_contains "close dry-run flag-only: defaults to backlog" "$OUT" "backlog/sprints/2026-03-auth.md"
assert_contains "close dry-run flag-only: file unchanged" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "active"

set +e
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" --dry-run "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "close dry-run flag-first positional: exit code" "$STATUS" "0"
assert_contains "close dry-run flag-first positional: would set completed" "$OUT" "Would set status: completed"
assert_contains "close dry-run flag-first positional: runs doctor" "$OUT" "=== Backlog Doctor (pre-close) ==="
assert_contains "close dry-run flag-first positional: file unchanged" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "active"

set +e
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" --bogus "$TEST_DIR/backlog" 2>&1)
STATUS=$?
set -e
assert_equals "close unknown flag: exit code" "$STATUS" "1"
assert_contains "close unknown flag: message" "$OUT" "Unknown argument: --bogus"
assert_contains "close unknown flag: file unchanged" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "active"

set +e
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" "$TEST_DIR/other-backlog" --dry-run 2>&1)
STATUS=$?
set -e
assert_equals "close extra positional: exit code" "$STATUS" "1"
assert_contains "close extra positional: message" "$OUT" "Unexpected argument: $TEST_DIR/other-backlog"
assert_contains "close extra positional: file unchanged" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "active"

# --- actual close ---
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" 2>&1)
assert_contains "close: set completed" "$OUT" "status: completed"
assert_contains "close: moved tasks" "$OUT" "BACK-1"
assert_contains "close: context reminder" "$OUT" "argon2"
assert_contains "close: doctor result appears" "$OUT" "[PASS] active_sprint"
assert_contains "close: reassess verdict appears" "$OUT" "Reassess signal:"

# Verify sprint file updated
assert_contains "close: frontmatter updated" "$(grep '^status:' "$TEST_DIR/backlog/sprints/2026-03-auth.md")" "completed"

# Verify tasks moved
assert_equals "close: tasks dir has 1 left" "$(ls "$TEST_DIR/backlog/tasks/" | wc -l | tr -d ' ')" "1"
assert_equals "close: unrelated stayed" "$(ls "$TEST_DIR/backlog/tasks/")" "BACK-99 - unrelated.md"
assert_equals "close: completed has 2" "$(ls "$TEST_DIR/backlog/completed/" | wc -l | tr -d ' ')" "2"

# --- ambiguous issue number test (#1 must not match #11) ---
rm -rf "$TEST_DIR/backlog"
mkdir -p "$TEST_DIR/backlog/sprints" "$TEST_DIR/backlog/tasks" "$TEST_DIR/backlog/completed"

cat > "$TEST_DIR/backlog/sprints/2026-03-ambig.md" << 'EOF'
---
status: active
---

## Plan
- [x] #1 Short task

## Running Context

## Progress
EOF

cat > "$TEST_DIR/backlog/tasks/BACK-1 - short-task.md" << 'EOF'
---
id: BACK-1
---
EOF
cat > "$TEST_DIR/backlog/tasks/BACK-11 - longer-task.md" << 'EOF'
---
id: BACK-11
---
EOF

bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" >/dev/null 2>&1
assert_equals "ambig: BACK-1 moved" "$(ls "$TEST_DIR/backlog/completed/" 2>/dev/null | grep -c 'BACK-1 ')" "1"
assert_equals "ambig: BACK-11 NOT moved" "$(ls "$TEST_DIR/backlog/tasks/" 2>/dev/null | grep -c 'BACK-11')" "1"

# --- no active sprint ---
OUT=$(bash "$SCRIPT_DIR/sprint-close.sh" "$TEST_DIR/backlog" 2>&1)
assert_contains "close: no active sprint" "$OUT" "No active sprint"

# ============================================================
# cold-adopter portability (adoption-hardening V1, PRD 2026-07)
# ============================================================
# A fresh agent in a repo with NO spec/, NO root CHARTER.md, and NO craftkit
# spec-* skills must still reach a first closed sprint. Some targets are RED at
# introduction and turn GREEN when their fix lands; those are gated as
# expected-fail so CI stays green while the baseline is recorded. Flip the gate
# (env var → 1) when the named issue merges; an XPASS reminder fires if the fix
# lands before the gate is flipped.

XFAIL=0
XPASS=0
GATE_B3="${GATE_B3:-0}"      # #258: sprint-init omits spec fields when no spec files
GATE_A2A3="${GATE_A2A3:-0}"  # #254/#255: drop required ../spec-charter reads from skills/

# gated_assert LABEL GATE RESULT("pass"|"fail")
#   GATE=1 → enforced like a normal assertion (feeds PASS/FAIL).
#   GATE=0 → expected-fail: RESULT=fail is the known-RED baseline (XFAIL, ok);
#            RESULT=pass means the fix landed early (XPASS) — flip the gate.
gated_assert() {
  local label="$1" gate="$2" result="$3"
  if [ "$gate" = "1" ]; then
    if [ "$result" = "pass" ]; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
      echo "FAIL: $label"
    fi
  else
    if [ "$result" = "pass" ]; then
      XPASS=$((XPASS + 1))
      echo "XPASS: $label — fix appears to have landed; set its gate to 1 to enforce."
    else
      XFAIL=$((XFAIL + 1))
    fi
  fi
}

# Build a genuinely spec-less project: run scripts with cwd inside it so spec
# resolution finds nothing (scripts resolve their own path via SCRIPT_DIR).
COLD_DIR="$TEST_DIR/cold-adopter"
mkdir -p "$COLD_DIR/backlog/sprints" "$COLD_DIR/backlog/tasks" "$COLD_DIR/backlog/completed"
cat > "$COLD_DIR/backlog/sprints/2026-01-cold.md" << 'EOF'
---
milestone: cold fixture
status: active
started: 2026-01-01
due: TBD
---

# Cold Adopter Sprint

## Goal
Reach a first closed sprint with no spec files present.

## Plan
- [ ] #1 First task

## Running Context
- none

## Progress
- 2026-01-01: opened.
EOF

# GREEN now: charter/capability checks degrade gracefully, never hard-fail.
OUT=$(cd "$COLD_DIR" && node "$SCRIPT_DIR/objectives-check.js" --json 2>/dev/null)
assert_json_eval "cold: objectives-check degrades (no charter, no drift)" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (j.charterFound !== false) process.exit(1);
if (!Array.isArray(j.drift) || j.drift.length !== 0) process.exit(1);
'
OUT=$(cd "$COLD_DIR" && node "$SCRIPT_DIR/component-lint.js" --json 2>/dev/null)
assert_json_eval "cold: component-lint degrades (no capabilities, no issues)" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (j.capabilitiesFound !== false) process.exit(1);
if (!Array.isArray(j.issues) || j.issues.length !== 0) process.exit(1);
'

# GREEN now: a valid spec-less sprint is fully healthy (fields simply absent).
set +e
OUT=$(cd "$COLD_DIR" && node "$SCRIPT_DIR/backlog-doctor.js" --json 2>/dev/null)
STATUS=$?
set -e
assert_equals "cold: doctor exit code on spec-less repo" "$STATUS" "0"
assert_json_eval "cold: doctor passes on spec-less active sprint" "$OUT" '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (j.exit_hint === "fail") process.exit(1);
const bad = (j.checks || []).filter((c) => c.status === "fail");
if (bad.length !== 0) process.exit(1);
'

# RED until #258 (B3): sprint-init must OMIT objectives:/component: when there
# is no spec axis, rather than emitting empty `objectives: []` / `component: ""`.
# Use a fresh spec-less dir with an empty sprints/ so init isn't refused as a
# second active sprint.
COLD_INIT_DIR="$TEST_DIR/cold-init"
mkdir -p "$COLD_INIT_DIR/backlog/sprints" "$COLD_INIT_DIR/backlog/tasks"
set +e
INIT_JSON=$(cd "$COLD_INIT_DIR" && node "$SCRIPT_DIR/sprint-init.js" "cold-probe" --dry-run --json 2>/dev/null)
set -e
if printf "%s" "$INIT_JSON" | node -e '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
const emitsSpecFields = /^objectives:/m.test(j.content) || /^component:/m.test(j.content);
process.exit(emitsSpecFields ? 1 : 0);
'; then B3_RES="pass"; else B3_RES="fail"; fi
gated_assert "cold: sprint-init omits spec fields when no spec files (#258 B3)" "$GATE_B3" "$B3_RES"

# RED until #254/#255 (A2/A3): no skill file may carry an unconditional
# required-read of a cross-repo ../spec-charter/ path (dangles for adopters
# without craftkit). Re-pointing to a local fallback clears this.
if grep -rlF "../spec-charter/" "$REPO_ROOT/skills/" >/dev/null 2>&1; then
  A2A3_RES="fail"   # still coupled → RED
else
  A2A3_RES="pass"
fi
gated_assert "cold: skills/ carry no required ../spec-charter read (#254/#255 A2/A3)" "$GATE_A2A3" "$A2A3_RES"

# --- Results ---
echo ""
TOTAL=$((PASS + FAIL))
echo "$TOTAL tests: $PASS passed, $FAIL failed"
if [ "$((XFAIL + XPASS))" -gt 0 ]; then
  echo "adoption-hardening gates: $XFAIL xfail (expected RED), $XPASS xpass (flip the gate)"
fi
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
