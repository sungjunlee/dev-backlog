---
milestone: 2026-06 execution guard and stale signals
status: completed
started: 2026-06-17
due: TBD
objectives: [O4]
component: "sprint-execution"
---

# Execution Guard And Stale Signals

## Goal
Agents can resume dev-backlog work from local sprint/task state without being misled by ambiguous active sprints, and backlog-triage can flag conservative obsolete candidates without turning advisory relationship evidence into unsafe mutations.

## Plan
### Batch 1 - execution-state guard
- [x] #193 fix(dev-backlog): fail loud on ambiguous active sprint state (~30min)

### Batch 2 - conservative stale/obsolete signals
- [x] #190 enhance(backlog-triage): add stale signals for merged PRs and closed duplicates (~20min)

### Batch 3 - spec/docs cleanup
- [x] #194 docs(spec): refresh spec-series tracking and boundary docs (~20min)

## Running Context
- Keep explicit sync: no background git pull and no silent GitHub mutation.
- Relationship evidence is advisory unless `triage-stale` explicitly converts it into a conservative obsolete signal.
- Active sprint references are protected from close / close-duplicate proposals.
- Relay runtime scripts are not present in this repo checkout, so this run uses direct implementation plus local review/verification.

## Progress
- 2026-06-18: Started `/goal` execution for milestone #9. Created active sprint from GitHub milestone and reordered work as #193 -> #190 -> #194.
- 2026-06-18: Implemented #193 active-sprint ambiguity guards across lib/next/status/context-hook/sprint-close/sprint-init and added smoke + node tests.
- 2026-06-18: Implemented #190 merged closing-PR and duplicate-of-closed stale signals, advisory-only merged-pr-link planning behavior, and active-sprint close protection.
- 2026-06-18: Completed #194 spec-series doc refresh; craft-critique pass found no follow-up edits. Verification: smoke-test, full node test suite, capabilities-doctor --strict, component-lint all pass.
- 2026-06-18: Sprint closed. 3/3 tasks completed.
