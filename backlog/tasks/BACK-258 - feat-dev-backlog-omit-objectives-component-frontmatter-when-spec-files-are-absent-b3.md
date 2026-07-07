---
id: BACK-258
title: 'feat(dev-backlog): omit objectives/component frontmatter when spec files are absent (B3)'
status: Done
labels:
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

Sprints in repos with no `spec/` still carry `objectives: []` and `component: ""` — fields the agent must generate and lint scripts must special-case, meaning nothing. Empty ceremony for every spec-less adopter.

Source: docs/prd-2026-07-adoption-hardening.md §6 (B3). Grammar guard: frontmatter omission is the only touch; checkbox states, trace grammar, section headings, and JSON schemas are frozen.

## Acceptance Criteria

- [x] `sprint-init.js` omits `objectives:`/`component:` keys when the corresponding spec file (and legacy root `CHARTER.md` for objectives) is absent
- [x] `objectives-check.js`, `component-lint.js`, and `backlog-doctor.js` treat omission-when-spec-absent as pass; present-but-invalid IDs/slugs stay hard failures; omission-when-spec-present warns
- [x] `references/file-format.md` and `references/integration-contract.md` frontmatter tables mark both fields optional with the omission semantics
- [x] Existing sprints with `objectives: []` / `component: ""` remain valid (additive tolerance, no migration)
- [x] dev-relay's sprint frontmatter reads (if any) are confirmed tolerant of absent keys before landing; result recorded in an issue comment
- [x] Unit tests cover the new omission paths in all four scripts

