---
id: BACK-274
title: 'feat: add backward-compatible tracker-neutral task references'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

Sprint plan parsing, progress matching, mirrors, and JSON currently assume numeric GitHub references such as `#42` and `issue_number`. Local canonical tasks need stable `BACK-42`-style references without breaking existing consumers.

## Goal

Introduce tracker-neutral task references and additive JSON identity while preserving every existing GitHub markdown and JSON contract.

## Acceptance Criteria

- [ ] The sprint parser accepts legacy GitHub `#N` references and local canonical `{PREFIX}-N` references without ambiguous partial matches.
- [ ] Machine state adds normalized tracker/task identity fields while retaining `issue_number` unchanged for GitHub entries.
- [ ] Existing GitHub sprint markdown renders byte-for-byte compatible plan references unless a caller opts into normalized fields.
- [ ] Progress age matching, exact task-file lookup, next-batch grouping, mirror rendering, and closeout use one normalized task-ref implementation.
- [ ] Tests cover `#1` vs `#11`, `BACK-1` vs `BACK-11`, decimal subtask IDs where supported, invalid refs, and mixed legacy fixtures.
- [ ] The actor integration contract documents additive fields, compatibility aliases, and local reference grammar.

## Non-Goals

- Rewriting historical sprint files.
- Removing `issue_number`.
- Implementing tracker persistence.

Depends on #272 and coordinates with #273. Parent: #270.
