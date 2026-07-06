---
id: BACK-263
title: 'Epic: E2 spec-axis decoupling'
status: To Do
labels:
  - documentation
  - epic
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
Remove the runtime dependency on craftkit: inline a consumption-side degradation contract (spec-fallback.md) and demote every `../spec-charter/...` read to a "when installed" enhancement. craftkit stays the canonical authoring home (charter Decision 2026-07-04); the fallback is consumption-only with a ~1 page cap to prevent a second spec-axis authority.

Source: docs/prd-2026-07-adoption-hardening.md section 5, section 9. Success criteria S1, S2. Top risk: fallback fork (PRD section 11).

## Tasks
- [ ] #253 spec-fallback.md consumption-side degradation reference (A1)
- [ ] #254 backlog-triage Report Evidence re-point (A2, after #253)
- [ ] #255 backlog-boundaries and Core Contracts re-point (A3, after #253)

