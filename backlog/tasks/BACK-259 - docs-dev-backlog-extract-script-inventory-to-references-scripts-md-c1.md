---
id: BACK-259
title: 'docs(dev-backlog): extract script inventory to references/scripts.md (C1)'
status: To Do
labels:
  - documentation
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

The ~25-line script/flag inventory in SKILL.md is reference material living in the always-loaded execution contract — token debt flagged independently by all three reviewers on 2026-07-06.

Source: docs/prd-2026-07-adoption-hardening.md §7 (C1). Gate: S5 — combined with C2, SKILL.md drops >=30 lines net while every pre-existing eval prompt still passes.

## Acceptance Criteria

- [ ] New `skills/dev-backlog/references/scripts.md` carries the full script/flag table
- [ ] SKILL.md keeps the script-resolution rule (2-3 lines) plus one-line mentions of the six core scripts (`init.sh`, `sync-pull.js`, `sprint-init.js`, `next.sh`/`status.sh`, `sprint-close.sh`, `backlog-doctor.js`) and a pointer to `references/scripts.md`
- [ ] Every pre-existing SKILL.md eval prompt still passes

