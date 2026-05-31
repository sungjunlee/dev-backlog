---
id: BACK-53
title: 'docs(root): refresh CLAUDE.md after README/SKILL role split'
status: To Do
labels:
  - documentation
priority: medium
milestone: April 2026 Root Contract Cleanup
created_date: '2026-04-16'
---
## Description
## Why

`README.md` and `skills/dev-backlog/SKILL.md` were recently separated more cleanly into human quick start vs agent execution contract. The root `CLAUDE.md` still reflects older repo state, including an outdated SKILL line-count note and no mention of the new role split.

That makes the top-level repo instructions slightly misleading for agents and maintainers starting from the root.

## Scope

- Update `CLAUDE.md` so its project-structure note matches the current `SKILL.md` size budget
- Reflect the README vs `SKILL.md` role split in the root instructions
- Keep the root guidance aligned with the repo's current maintenance expectations

## Acceptance Criteria

- `CLAUDE.md` no longer claims outdated `SKILL.md` sizing details
- Root instructions clearly distinguish README quick-start guidance from `skills/dev-backlog/SKILL.md` execution-contract guidance
- No behavior or script contract changes
- Relevant tests remain green

## Out of Scope

- Broad documentation rewrite
- Script behavior changes
- Sprint/task markdown contract changes
