---
id: BACK-50
title: 'refactor(progress-sync): split orchestration from GitHub, relay, and rendering logic'
status: To Do
labels:
  - enhancement
priority: medium
milestone:
created_date: '2026-04-16'
---
## Description
## Why

`progress-sync.js` has grown into a single file that handles CLI parsing, local backlog reads, relay manifest parsing, GitHub I/O, body rendering, comment reconciliation, and finalize behavior.

That makes every change high-context and high-blast-radius. The code is still working, but it is expensive to modify safely.

Depends on #49 so the metric semantics are clarified before the file is split.

## Scope

- Keep `progress-sync.js` as the thin orchestration + CLI entrypoint
- Extract GitHub I/O helpers into a focused module
- Extract relay manifest parsing and enrichment into a focused module
- Extract body/comment rendering into a focused module
- Preserve the current CLI behavior and output contract

## Acceptance Criteria

- `progress-sync.js` is materially smaller and easier to scan
- GitHub I/O, relay parsing, and rendering logic live in separate focused modules
- Existing unit tests still pass without behavior regressions
- A CLI-level smoke test covers the real command wiring with a mocked `gh` binary or equivalent fixture
- `node --test skills/dev-backlog/scripts/*.test.js` passes

## Out of Scope

- New features for progress-sync
- Rewriting the sprint/task contract
- Broad repo-wide parser or module-format changes

## Notes

This is a structural refactor, not a behavior change. The goal is lower blast radius and easier future maintenance.
