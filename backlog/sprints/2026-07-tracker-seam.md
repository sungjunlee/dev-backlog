---
milestone: 2026-07 tracker adapter foundation
status: active
started: 2026-07-11
due: 2026-07-15
objectives: [O8, O9]
component: "tracker-task-truth"
---

# Tracker Seam and GitHub Compatibility

## Goal
Existing GitHub users retain compatible behavior while core sprint execution gains an explicit, capability-gated tracker seam and stable tracker-neutral task identity.

## Plan

### Batch 1 - Freeze the deep interface
- [ ] #272 Inventory GitHub coupling and freeze the tracker contract (~1hr)

### Batch 2 - Add explicit tracker resolution (after #272)
- [ ] #273 Add configured tracker selection and the core adapter seam (~2hr)

### Batch 3 - Generalize task identity (after #273)
- [ ] #274 Add backward-compatible tracker-neutral task references (~2hr)

### Batch 4 - Preserve GitHub behind the seam (after #273 and #274)
- [ ] #275 Move existing GitHub behavior behind the tracker adapter (~3hr)

## Running Context
- #270 was accepted with narrowing and closed by spec amendment PR #271.
- Runtime selection is persistent and fail-closed. Detection may suggest only during setup; it never changes an existing tracker selection.
- The tracker module must be deep: required lifecycle and identity stay small; milestones, PR relationships, mirrors, progress issues, comments, and closing semantics remain capability-gated.
- Existing GitHub markdown, CLI, JSON, and helper exports are compatibility surfaces. Additive normalized fields must not remove `issue_number` or rewrite historical sprints.
- Sprint A is deliberately serial because #273-#275 share the tracker resolver, sprint parser, and GitHub call sites. Sprint B starts only after GitHub regression proof merges.

## Progress
- 2026-07-11: #270 accepted-with-narrowing recorded and spec PR #271 merged after three independent review rounds; Milestone 13 and issues #272-#278 created.
- 2026-07-11: Sprint A opened with four serial execution waves; task mirrors refreshed from live GitHub state.
