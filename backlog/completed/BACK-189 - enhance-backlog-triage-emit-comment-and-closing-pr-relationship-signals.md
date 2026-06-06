---
id: BACK-189
title: 'enhance(backlog-triage): emit comment and closing-PR relationship signals'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 
created_date: '2026-06-06'
---
## Description
## Context

#73 added the snapshot-v2 collector fields needed for richer relationship analysis: per-issue `closing_prs` is present by default and `comments` is available through `--with-comments`. The collector is ready, but `triage-relate.js` still emits only body-based mentions/blocks/depends-on and title duplicate candidates.

## Desired change

Teach `triage-relate.js` to use snapshot-v2 fields conservatively.

Suggested signals:
- comment-based mentions when `comments` is present
- a closing-PR relationship signal when `closing_prs` contains merged PR metadata

## Acceptance Criteria

- [x] Comment mention scanning runs only when issue `comments` arrays are present.
- [x] Comment-derived edges carry evidence that identifies comment source separately from issue body evidence.
- [x] Closing-PR edges use `closing_prs` and do not imply an automatic close recommendation by themselves.
- [x] Missing optional fields degrade cleanly without warnings or undefined-field behavior.
- [x] Relationship docs and tests cover both enabled and absent-field paths.
