---
milestone: 2026-08 GitHub-native core simplification
status: active
started: 2026-07-31
due: TBD
objectives: [O10]
component: "tracker-task-truth"
---

# Admitted Sprint (test fixture)

Canonical shape of an admitted sprint file. It lives here because completed
sprint files are disposable (2026-09-20) and this repo keeps none of its own.

## Goal
Make the declared task authority standalone, preserve sprint continuity for
complex work, and remove unproven mirror, tracker, and memory complexity behind
measured gates.

## Plan

### Batch 1 — Authority gate
- [x] #345 Define the authority contract and reduced product boundary → PR #351 (merged)

### Batch 2 — Resolver and evidence
- [x] #346 Resolve effective task specs without task mirrors → PR #352 (merged)
- [~] #349 Validate an optional planning projection → PR #355 (reviewing)

### Batch 3 — Subtraction
- [ ] #348 Subtract zero-adopter compatibility machinery

## Running Context
- The live task is canonical for definition, AC, and lifecycle; this file carries only execution continuity.
- #345 is the contract gate for every other epic. #346 gates #347, and #347 gates #348.
- Existing mirrors are diagnostic and rollback material only, never a runtime task-spec or lifecycle substitute. If the live task cannot resolve, stop and repair #346.

## Progress
- 2026-07-31: Opened the track from #345-#350; the doctor reported no pre-existing active sprint.
- 2026-07-31: #345 completed via PR #351. Started #346.
