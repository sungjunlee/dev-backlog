---
id: BACK-49
title: 'refactor(progress-sync): align summary semantics and remove dead completed-state paths'
status: To Do
labels:
  - enhancement
priority: medium
milestone:
created_date: '2026-04-16'
---
## Description
## Why

`progress-sync.js` currently mixes two different meanings for the same metric. The rendered summary says `Merged / completed`, but the implementation only counts month-scoped merged PRs. Dead code still reads `backlog/completed/`, even though that value no longer affects the result.

This makes the command harder to reason about and raises the risk of future regressions when someone assumes completed backlog files are part of the metric.

## Scope

- Align the progress summary wording with the actual source of truth
- Remove dead `completed/`-based paths from `progress-sync.js`
- Remove or update tests that still imply `completed/` affects the summary
- Keep the existing CLI contract and JSON shape stable unless a field is genuinely misleading

## Acceptance Criteria

- `progress-sync.js` no longer reads `backlog/completed/` if that data does not affect output
- The summary wording matches the actual metric being computed
- Regression tests lock in the intended metric semantics
- `node --test skills/dev-backlog/scripts/*.test.js` passes
- No user-facing behavior changes beyond wording or dead-path removal

## Out of Scope

- Splitting `progress-sync.js` into multiple modules
- Changing sprint or task file formats
- Broader documentation cleanup

## Notes

This should land first. It makes the meaning of the command explicit before any structural refactor.
