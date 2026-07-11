---
id: BACK-275
title: 'refactor: move existing GitHub behavior behind the tracker adapter'
status: Done
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

After #273 and #274 establish the seam and identity contract, existing GitHub behavior must move behind the adapter with no intended user-visible change.

## Goal

Make the GitHub adapter the sole owner of canonical GitHub task operations and provider capabilities while preserving current commands, output, and mutation safety.

## Acceptance Criteria

- [x] Core task lifecycle callers no longer invoke `gh` directly; GitHub task calls live behind the adapter seam.
- [x] `sync-pull`, sprint planning from milestones, status/orientation, task creation/update/close, and closeout retain current behavior and messages.
- [x] Optional milestone, PR relationship, sprint mirror, progress issue, and comment behavior is exposed only through declared GitHub capabilities or explicitly GitHub-scoped modules.
- [x] Existing public helper exports and dependency-injection test seams remain compatible.
- [x] Golden regression fixtures cover current GitHub command argv, markdown task files, sprint plan lines, and JSON output.
- [x] No human-authored GitHub content can be overwritten beyond existing marker-gated behavior.
- [x] Full Node tests, smoke tests, and GitHub-mocked CLI tests pass.

## Non-Goals

- Local task persistence.
- Tracker-neutral triage beyond consuming the core list/read surface.
- New GitHub features.

Depends on #273 and #274. Parent: #270.
