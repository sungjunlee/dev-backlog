---
milestone: Lightening 2: runtime retirement
status: planned
started: TBD
due: TBD
component: "lightening"
---

# Lightening 2: runtime retirement

## Goal
Redundant shell, setup, and compatibility surfaces are retired or explicitly bounded while retained guarantees pass their outcome checks.

## Plan

### Batch 1
- [ ] #498 Retire the shell runtime and sprint-close orchestration (estimate: L)

### Batch 2
- [ ] #499 Retire automatic legacy migration and setup ceremony (consumer-gated) (estimate: S (M if a consumer needs migration))

### Batch 3
- [ ] #500 Sprint-state JSON v3 and one shared track reader for the doctor (estimate: M)

## Running Context
- Task definition and acceptance criteria live on the linked GitHub issues; read them live before execution.
- Parent epic: #504. Milestone: https://github.com/sungjunlee/dev-backlog/milestone/29
- These sprints share code and documentation; only one is active at a time.
- Exit: Runtime removals preserve retained guarantees, Windows coverage passes, and any retained migration path has a documented removal condition.
- Activate only after Lightening 1: lean contract and baseline closes.
- This is an inactive blueprint. Run sprint-init.js with this topic and component lightening, copy Goal and Plan into the new active file, then remove this blueprint.

## Progress
- 2026-09-27: Published issues and milestone; queued this blueprint; no implementation has started.
