---
milestone: April 2026 Maintenance Cleanup
status: completed
started: 2026-04-16
due: 2026-04-23
---

# Script Simplification Cleanup

## Goal
Reduce maintenance cost in the script layer without changing user-visible behavior or weakening test coverage.

## Plan
### Batch 1 - progress-sync semantics (land first)
- [x] #49 Align summary semantics and remove dead completed-state paths (~45min)

### Batch 2 - progress-sync structure (after #49)
- [x] #50 Split orchestration from GitHub, relay, and rendering logic (~2hr)

### Batch 3 - sync-pull + docs cleanup (can run after #49)
- [x] #51 Flatten sync-pull flow and trim README/SKILL duplication (~90min)

## Running Context
- Land `#49` before `#50`; `#51` can proceed in parallel once the metric wording is settled
- Keep CLI flags and JSON output stable unless the issue explicitly changes the contract
- Add protection at the command/contract boundary, not only internal function-level tests
- `#46` is a meta progress issue, not part of this sprint's execution scope
- `progress-sync` summary field `merged` is month-scoped merged PR count; `backlog/completed/` is not an input and should stay out of future refactors
- `progress-sync.js` is now a thin entrypoint over `progress-sync-github.js`, `progress-sync-relay.js`, and `progress-sync-render.js`; keep the CLI smoke test updated when changing command wiring
- Keep README focused on human/product quick start; keep `SKILL.md` as the agent contract and full script/structure reference to limit drift

## Progress
- 2026-04-16: Sprint created for cleanup issues #49, #50, and #51.
- 2026-04-16 21:43 KST: #49 completed. Aligned progress issue and CLI summary wording to month-scoped merged PRs, removed dead `completed/` summary plumbing, and added boundary tests that fail if completed-backlog state re-enters the metric.
- 2026-04-16 21:51 KST: #50 completed. Split `progress-sync` GitHub I/O, relay parsing, and rendering into focused modules, kept `progress-sync.js` as the orchestration entrypoint with re-exported test surface, and added a real CLI smoke test using a mocked `gh` binary.
- 2026-04-16 22:00 KST: #51 completed. Flattened `sync-pull.js` by lifting task-file sync helpers to top-level functions and trimmed README/SKILL duplication so README stays quick-start oriented while SKILL remains the execution contract.
- 2026-04-16: Sprint closed. 3/3 tasks completed.
