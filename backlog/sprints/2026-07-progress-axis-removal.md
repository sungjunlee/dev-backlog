---
milestone: 2026-07 subtraction and rule simplification
status: completed
started: 2026-07-28
due: TBD
scope: ["skills/dev-backlog/scripts/progress-sync*", "skills/dev-backlog/scripts/sprint-mirror*", "skills/dev-backlog/scripts/github-mirrors*"]
objectives: [O1]
component: ""
---

# progress-axis-removal

## Goal
The monthly Progress issue and the sprint mirror are gone — 3,758 lines removed with no
capability lost, because neither has had a user since the week it was built.

## Plan

### Batch 1 - Removal

- [x] #340 remove the progress-sync and sprint-mirror axis (~4hr) → PR #343 (merged, net −4,039)

## Running Context

- **Why they existed, established before anything was deleted.** v0.9.0's recurring lesson
  was that deleting code without knowing why it existed returns you to the same place.
  `sprint-mirror` comes from charter Decisions 2026-07-03 / spike #215 — a machine-managed
  GitHub issue mirror as the *optional* shared read surface, so sprint state is visible
  from a worktree without a state repo. `progress-sync` comes from epic #34, a monthly
  append-only Progress issue with idempotent month-end close. Both were deliberate,
  specified, and tested.
- **The evidence is that they are finished, not that they are unused externally.**
  `Progress: April 2026` (#46) is the **only** monthly Progress issue ever created — May,
  June and July have none. The four sprint mirrors (#230, #234, #237, #239) were all
  created 2026-07-03/04 during the SSOT spike and none since. No core lifecycle script
  invokes either. dev-relay, the named integration consumer, references neither.
  `task-progress-reporting`'s Learnings block is empty. Each feature ran during the window
  it was built in and then stopped, **including here**.
- **This is the first thing the adoption gate caught.** The `implemented`/`validated` split
  landed yesterday (#333, craftkit#165) precisely to make "built, proven by its own tests,
  never adopted" visible. This is that, at 3,758 lines — larger than the entire v0.9.0
  subtraction (2,556).
- **`parseMarkerMonth` must survive.** Two live consumers outside the axis:
  `sync-pull.js:29` and `backlog-triage/scripts/triage-collect.js:17`. It is marker
  parsing, not journaling — relocate it, do not delete it. Deleting it would break a
  sibling skill.
- **"Mirror" is two different things.** Task mirrors (`backlog/tasks/`, `sync-pull`) are
  core and untouched. Only the *sprint* mirror goes.
- **Spec impact is human-gated.** `task-progress-reporting` is removed entirely;
  `backlog-sync` loses its `sprint-mirror` in-scope line and three Expected Behaviors.
  Both need a human-gated `spec-grill` pass — never amend an Expected Behavior or Hard
  Constraint unattended (v0.8.0 #294 precedent). Tier-3 Decisions rows are **superseded,
  never deleted**.
- **The sibling track (`2026-07-rule-simplification.md`) also edits `capabilities.md`**, in
  the `sprint-execution` block. Sequence the two capability edits; do not run them
  concurrently.
- **Leave the historical issues closed and untouched** (#46, #230, #234, #237, #239). They
  are the record that this ran, and that record is the justification for removing it.
- **No replacement.** If worktree-visible sprint state is wanted again, the sprint file is
  committed at explicit boundaries and readable directly — which was already true when the
  mirror was built.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-28: Track opened as the subtraction half of the milestone. Partitioned by
  `scope:` rather than `component:` because the track deletes the very capability a
  component handle would point at — the first use of the `scope:` axis in this repo, and
  the case `references/process.md` describes as "no component axis fits".
- 2026-07-29: Sprint closed. 1/1 tasks completed.
