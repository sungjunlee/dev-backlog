---
id: BACK-260
title: 'docs(dev-backlog): compress reassess accounting to one sentence + pointer (C2)'
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

The Complete-mode reassess paragraph in SKILL.md carries detailed accounting (same-day coverage, dry-run counting, threshold rules) that is already documented in `references/integration-contract.md` § Backlog Doctor JSON Surface — duplicated deep detail in the always-loaded contract.

Source: docs/prd-2026-07-adoption-hardening.md §7 (C2). Gate: S5 (shared with C1).

## Acceptance Criteria

- [ ] The SKILL.md reassess paragraph shrinks to one sentence plus a pointer to the integration-contract section
- [ ] No accounting semantics are lost from the reference side (integration-contract remains the single detailed home)
- [ ] The "unattended sessions may run reassess but never amend" rule survives in SKILL.md

