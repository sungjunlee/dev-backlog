---
milestone: 2026-07 tracker adapter foundation
status: completed
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
- [x] #272 Inventory GitHub coupling and freeze the tracker contract (~1hr) → PR #280 (merged)

### Batch 2 - Add explicit tracker resolution (after #272)
- [x] #273 Add configured tracker selection and the core adapter seam (~2hr) → PR #282 (merged)

### Batch 3 - Generalize task identity (after #273)
- [x] #274 Add backward-compatible tracker-neutral task references (~2hr) → PR #284 (merged)

### Batch 4 - Preserve GitHub behind the seam (after #273 and #274)
- [x] #275 Move existing GitHub behavior behind the tracker adapter (~3hr) → PR #286 (merged)

## Running Context
- #270 was accepted with narrowing and closed by spec amendment PR #271.
- Runtime selection is persistent and fail-closed. Detection may suggest only during setup; it never changes an existing tracker selection.
- The tracker module must be deep: required lifecycle and identity stay small; milestones, PR relationships, mirrors, progress issues, comments, and closing semantics remain capability-gated.
- Existing GitHub markdown, CLI, JSON, and helper exports are compatibility surfaces. Additive normalized fields must not remove `issue_number` or rewrite historical sprints.
- #272 found nine production files that invoke `gh` directly. `progress-sync.js` also has an independent exported `readActiveSprintSummary` parser for numeric Plan checkboxes; #274 must migrate that path as well as `sprint-state.js`.
- #273 added `tracker.js`: selection comes only from configuration, a missing key defaults to GitHub, resolution probes only the configured adapter, required operations and identities are validated exactly, and provider-specific features are capability-gated. The local slot remains explicitly unavailable until #276.
- #274 added one exact task-ref seam for GitHub `#N` and local `{PREFIX}-N[.M]`; sprint state now exposes additive `tracker`/`id`/`ref`, keeps GitHub `issue_number`, and all sprint, mirror, progress, closeout, and task-file lookup paths share the same boundary rules.
- #275 made the GitHub adapter own required lifecycle translation and confined direct `gh` calls to that adapter plus explicit milestone, mirror, progress/PR/comment, and triage transports. Core callers now resolve only the configured tracker, and provider capabilities fail before mutation.
- Sprint A is deliberately serial because #273-#275 share the tracker resolver, sprint parser, and GitHub call sites. Sprint B starts only after GitHub regression proof merges.

## Progress
- 2026-07-11: #270 accepted-with-narrowing recorded and spec PR #271 merged after three independent review rounds; Milestone 13 and issues #272-#278 created.
- 2026-07-11: Sprint A opened with four serial execution waves; task mirrors refreshed from live GitHub state.
- 2026-07-11: #272 → PR #280 merged after internal/post-publication review (LGTM, round 4); design contract froze nine direct `gh` callers, numeric identity surfaces, compatibility promises, and #273-#275 verification ownership.
- 2026-07-11: #273 → PR #282 merged after TDD plus internal/post-publication review (LGTM, round 2); configured-only resolution, the exact adapter/identity contract, capability gates, and GitHub/local slots landed without migrating current callers.
- 2026-07-11: #274 → PR #284 merged after TDD, 472 Node tests, 151 smoke checks, CI, and multi-agent review; exact lookup, numeric-slug inference, punctuation/suffix, and hyphenated-prefix boundary gaps were fixed before final LGTM.
- 2026-07-11: #275 → PR #286 merged after TDD, 489 Node tests, 155 smoke checks, CI, four relay review rounds, and multi-agent review; missing-formatter and unmanaged dry-run ownership regressions were fixed before final LGTM, with all review threads resolved.
- 2026-07-11: Sprint closed. 4/4 tasks completed.
