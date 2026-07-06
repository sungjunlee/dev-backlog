---
id: BACK-253
title: 'docs(dev-backlog): add spec-fallback.md consumption-side degradation reference (A1)'
status: To Do
labels:
  - documentation
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

The spec-axis degradation rules (what `objectives:`/`component:`/Alignment/Decision Review mean when spec files or craftkit are absent) are spread across three reference files and a cross-repo pointer into craftkit's `spec-charter` skill. A cold adopter without craftkit has no locally resolvable contract.

Source: docs/prd-2026-07-adoption-hardening.md §5 (A1). Guard: this file is consumption-side only — authoring semantics stay in craftkit (charter Decision 2026-07-04); ~1 page hard cap to prevent a second spec-axis authority (the 2026-06/07 silent-fork failure mode).

## Acceptance Criteria

- [ ] New `skills/dev-backlog/references/spec-fallback.md` documents the four-combo degradation matrix (charter present/absent x capabilities present/absent) with `objectives:`/`component:` semantics per cell
- [ ] The legacy root `CHARTER.md` fallback rule is stated exactly once, in this file
- [ ] Triage Alignment and Decision Review behavior when charter/capabilities/system-map are missing is specified: skip with an explicit "skipped because X absent" report line, never silent
- [ ] One pointer names craftkit's `spec-charter` as the authoring home; its references are described as "when installed" enhancements, never required
- [ ] File stays at or under ~1 page (consumption-side scope only)

