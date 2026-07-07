---
id: BACK-261
title: 'feat(dev-backlog): checkbox-repair runbook and doctor message link (C3)'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

`backlog-doctor` flags unmoored `[~]` items, but the repair path (annotate with PR/branch/run pointer, or explicit "no work yet" note, or strike with a Progress entry) is dispersed across capabilities prose and the integration contract. No single page answers "the doctor warned — now what?"

Source: docs/prd-2026-07-adoption-hardening.md §7 (C3). Grammar itself unchanged.

## Acceptance Criteria

- [x] New `skills/dev-backlog/references/checkbox-repair.md`: detect (doctor warn / `--json` `unmoored: true`) -> repair (add `-> PR #N (state)`, `[branch:...]`, or `[run:...]` pointer; or explicit "no work yet" annotation; or strike + Progress entry)
- [x] `backlog-doctor.js` unmoored warn text names the runbook path
- [x] Doctor tests cover the updated message
- [x] SKILL.md or integration-contract links the runbook from the unmoored rule

