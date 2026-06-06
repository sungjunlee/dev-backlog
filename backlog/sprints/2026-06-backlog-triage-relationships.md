---
milestone: backlog-triage relationships
status: completed
started: 2026-06-06
due: TBD
objectives: [O4]
component: "triage-grooming"
---

# backlog-triage relationships

## Goal
Use snapshot v2 relationship fields in `triage-relate` without turning advisory relationship evidence into automatic close recommendations.

## Plan
- [x] #189 enhance(backlog-triage): emit comment and closing-PR relationship signals → PR #192

## Running Context
- #73 shipped collector-side v2 fields: `closing_prs` by default, `comments` behind `--with-comments`.
- Keep #189 non-mutating. Relationship edges may influence review priority, but they must not create stale/close actions.
- Optional fields must degrade silently when absent so old snapshots remain readable.

## Progress
- 2026-06-06: Started #189 after closing the completed #73 snapshot-v2 sprint locally.
- 2026-06-06: #189 implemented in PR #192. `triage-relate` now emits `comment-mentions` and advisory `merged-pr-link` edges from snapshot v2 fields.
- 2026-06-06: Sprint closed. 1/1 tasks completed.
