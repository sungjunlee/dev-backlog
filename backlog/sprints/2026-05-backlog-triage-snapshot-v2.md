---
milestone: backlog-triage snapshot v2
status: completed
started: 2026-05-31
due: TBD
objectives: [O4]
component: "triage-grooming"
---

# backlog-triage snapshot v2

## Goal
Shape and implement #73 so backlog-triage can see closing PR links, optional comments, and bounded closed-issue context without weakening the explicit-sync model.

## Plan
Start with a short technical split before implementation. The issue is larger than a doc polish item because it touches collection schema and downstream scanners.

- [x] #73 enhance(backlog-triage): snapshot v2 schema for closing PRs, comments, and closed-issue scan → PR #191 (merged)

## Running Context
- Current `triage-relate` and `triage-stale` explicitly defer PR-merged and duplicate-of-closed signals until snapshot v2 fields exist.
- Keep default collection as one explicit collection step. Optional `--with-comments` and `--with-closed-issues` must be opt-in and visibly bounded.
- Downstream scanners should gate optional signals on snapshot features/schema rather than assuming fields exist.
- This sprint advances O4 only. Do not advance O4 to `validated` while #73 remains unshipped.

## Progress
- 2026-05-31: Open issue set synced locally; #73 mirror created under `backlog/tasks/`. Previous spec-grill dogfood sprint completed after PR #175 landed.
- 2026-06-06: #73 completed via PR #191. Collector v2 now emits explicit `schema_version: 2`; downstream analyzer work was split into #189 (relationships) and #190 (stale/obsolete signals).
- 2026-06-06: Sprint closed. 1/1 tasks completed.
