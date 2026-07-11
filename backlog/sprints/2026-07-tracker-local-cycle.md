---
milestone: 2026-07 tracker adapter foundation
status: active
started: 2026-07-11
due: 2026-07-15
objectives: [O8, O9]
component: "tracker-task-truth"
---

# Offline Local Tracker and Dual-Mode Proof

## Goal
The same core sprint cycle is executable and documented in backward-compatible GitHub mode and fully offline local mode, with one explicit canonical tracker and deterministic capability failures.

## Plan

### Batch 1 - Implement local canonical persistence
- [ ] #276 Add offline local canonical task adapter (~3hr)

### Batch 2 - Persist a deliberate setup choice (after #276)
- [ ] #277 Add idempotent tracker-aware setup-dev-backlog (~2hr)

### Batch 3 - Prove both modes and align docs (after #276 and #277)
- [ ] #278 Prove GitHub and local core sprint cycles end to end (~2hr)

## Running Context
- Sprint A closed after PRs #280, #282, #284, and #286. GitHub is now the frozen compatibility baseline behind the configured adapter seam.
- Exactly one configured tracker is canonical. Runtime never switches on failure; task files are canonical only in local mode and remain GitHub mirrors in GitHub mode.
- Local mode owns required list/read/create/update/close only. Milestones, PR relationships, mirrors, progress issues, comments, and closing semantics must fail with actionable capability errors.
- Local refs use the configured `{PREFIX}-N[.M]` grammar and the shared exact parser. Allocation must inspect both active and completed tasks and never overwrite on collision or concurrency.
- Setup may detect evidence only to recommend an initial choice. Existing selection is immutable unless the user explicitly changes it, and re-runs preserve all user-authored content byte-for-byte.
- #278 is the milestone proof leaf: it must exercise both full core cycles and reconcile docs/objective evidence only after runtime tests exist.

## Progress
- 2026-07-11: Sprint B opened as three serial batches after Sprint A and GitHub regression baseline completed; live issues #276-#278 remain the task source of truth.
