---
milestone: backlog-triage relationships
status: active
started: 2026-06-06
due: TBD
objectives: [O4]
component: "triage-grooming"
---

# backlog-triage relationships

## Goal
Use snapshot v2 relationship fields in `triage-relate` without turning advisory relationship evidence into automatic close recommendations.

## Plan
- [~] #189 enhance(backlog-triage): emit comment and closing-PR relationship signals → branch `codex/close-snapshot-v2-sprint`

## Running Context
- #73 shipped collector-side v2 fields: `closing_prs` by default, `comments` behind `--with-comments`.
- Keep #189 non-mutating. Relationship edges may influence review priority, but they must not create stale/close actions.
- Optional fields must degrade silently when absent so old snapshots remain readable.

## Progress
- 2026-06-06: Started #189 after closing the completed #73 snapshot-v2 sprint locally.
