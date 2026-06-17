---
id: BACK-193
title: 'fix(dev-backlog): fail loud on ambiguous active sprint state'
status: Done
labels:
  - bug
  - documentation
  - enhancement
priority: medium
milestone: 2026-06 execution guard and stale signals
created_date: '2026-06-17'
---
## Description
## Context

gosu-review and eng-review found a dogfood failure mode: a stale local checkout can make `status.sh` / `next.sh` point an agent at already-completed work. The current helper also treats “one active sprint” as a document invariant, but `find_active_sprint` can silently pick the first match with `head -1`.

This undermines dev-backlog's core contract: an agent should be able to orient from the active sprint without confidently doing the wrong work.

## Desired change

Make sprint execution state fail loud when it is ambiguous or stale enough to mislead an agent.

## Acceptance Criteria

- [x] `find_active_sprint` distinguishes 0, 1, and more than 1 active sprint files instead of silently choosing the first active file.
- [x] `next.sh` and `status.sh` surface multiple-active-sprint conflicts clearly and do not print a misleading next task in that state.
- [x] `sprint-init.js` refuses to create a new active sprint when another active sprint already exists, unless a deliberate explicit override is introduced and documented.
- [x] Tests cover 0 active, 1 active, multiple active, and sprint-init-with-existing-active cases.
- [x] The implementation preserves the explicit-sync model: no background pull or silent GitHub mutation.
- [x] `skills/dev-backlog/SKILL.md` and/or references document the fail-loud behavior if command output changes.
