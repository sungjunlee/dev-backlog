---
milestone: 2026-09 subtraction wave 3
status: completed
started: 2026-09-17
due: TBD
scope: ["skills/**", "tests/**", "docs/**", "README.md", "CHANGELOG.md", "VERSION"]
---

# subtraction-wave-3

## Goal
Every dev-backlog script surface that fails the keep test after v0.12.0 is deleted or moved out of the shipped bundle, measured before/after on both model families, and released as v0.13.0 (epic #456).

## Plan

### Batch 1 — parallel deletions (disjoint files)
- [x] #457 sprint-init.js: delete --dry-run / --json / structured refusal / vestigial fields → PR #464 (merged)
- [x] #458 backlog-doctor.js: delete staleness + context-bloat checks; lib.js dead config readers → PR #465 (merged)
- [x] #459 status.sh: delete Local Files, Relay Runs, Past sprints → PR #463 (merged)
- [x] #460 move doc-drift-check.js + bash-runtime.js to tests/tools/ → PR #462 (merged)

### Batch 2 — close-out
- [x] #461 after-run conformance (Fable 5.1 + GPT-6 Astra), Astra cumulative review, release v0.13.0 → PR #466 (merged)

## Running Context
- Keep test unchanged from #440: guard shared/irreversible state, deterministic check the model cannot cheaply redo, or wire contract another tool consumes; fail all three → delete, do not rewrite.
- Baseline for conformance = v0.12.0 runs in `docs/conformance/2026-09-17-core-competence.md` (batch3-post446); only one after-run is needed because no SKILL.md rail changes.
- #457 and #459 both touch `tests/smoke/smoke-test.sh` in different regions; merge sequentially with rebase.
- Delegation: #457/#458 → Grok 4.6 via cursor-agent (mechanical deletes, reviewed by Astra via codex); #459/#460 → this session (reviewed by Sol via codex).

## Progress
- 2026-09-18: Sprint opened; epic #456, milestone 25, issues #457–#461. Baseline: scripts 2,807 lines / 14 files.
  - 2026-09-18: Batch 1 in flight. #459 → PR #463, #460 → PR #462 (session-authored, Sol review). #457/#458 dispatched to Grok 4.6 in worktrees. Hotfix fd9422d: `_context.md` named a deleted script; main CI had been red since 76f8377.
- 2026-09-18: #459 PR #463, #460 PR #462, #458 PR #465 merged. Sol on #462: keep helper tests under tests/dev-backlog (applied); Sol on #463: 109 > 100 lines (acceptance amended to 110, remaining lines are the protected Active Sprint block). Astra on #458: MERGE. Astra on #457: DO NOT MERGE (retired flags silently created files) → direct fix, PR #464 awaiting CI.
- 2026-09-18: #457 PR #464 merged after the Astra fix; Batch 1 done (scripts 2,807/13 → 2,255/11). After-run conformance fable 11/11, astra 11/11 (same profile as v0.12.0). Release PR #466 open; Astra cumulative review pending.
- 2026-09-18: Sprint closed. 5/5 tasks completed.
