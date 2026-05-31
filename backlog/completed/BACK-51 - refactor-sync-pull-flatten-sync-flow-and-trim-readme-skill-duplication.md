---
id: BACK-51
title: 'refactor(sync-pull): flatten sync flow and trim README/SKILL duplication'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone:
created_date: '2026-04-16'
---
## Description
## Why

`sync-pull.js` is still understandable, but its core flow is buried inside nested helpers within `run()`. At the same time, `README.md` and `skills/dev-backlog/SKILL.md` repeat a lot of the same system explanation, which increases documentation drift.

The code and docs are both good enough today. This issue is about reducing future maintenance cost without changing behavior.

Suggested order: after #49. This can run in parallel with #50 once the progress metric semantics are settled.

## Scope

- Flatten `sync-pull.js` by lifting key helpers to top-level functions
- Keep the task sync behavior unchanged
- Reduce repeated system-definition text between `README.md` and `SKILL.md`
- Reposition README toward product/quick-start and SKILL toward agent execution contract

## Acceptance Criteria

- `sync-pull.js` has a flatter, easier-to-scan control flow
- The current sync behavior and file format remain unchanged
- `README.md` and `SKILL.md` have clearer role separation and less duplicated explanation
- Existing tests pass, with new tests added only where the refactor needs protection
- `node --test skills/dev-backlog/scripts/*.test.js` passes

## Out of Scope

- New sync-pull features
- ESM migration or parser-framework changes
- Sprint markdown contract changes
- Large README repositioning beyond reducing duplication and clarifying responsibilities

## Notes

This is a maintenance cleanup issue. Minimal diff is preferred.
