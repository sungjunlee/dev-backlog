---
id: BACK-255
title: 'docs(dev-backlog): re-point backlog-boundaries and Core Contracts to local fallback (A3)'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

`skills/dev-backlog/references/backlog-boundaries.md` and the SKILL.md Core Contracts bullet route spec-axis boundary questions to the installed `spec-charter` skill's `references/spec-axis.md` — a cross-repo pointer that dangles without craftkit.

Source: docs/prd-2026-07-adoption-hardening.md §5 (A3). Depends on A1 (`spec-fallback.md`).

## Acceptance Criteria

- [ ] `backlog-boundaries.md` points spec-axis boundaries at `references/spec-fallback.md`; craftkit is named as the authoring home in "when installed" phrasing
- [ ] The SKILL.md Core Contracts bullet gets the same demotion (local pointer, craftkit as enhancement)
- [ ] No remaining unconditional `../spec-charter/` read instruction in `skills/dev-backlog/`

