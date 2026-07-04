---
id: BACK-236
title: 'docs(spec): amend system-map with the machine-read boundary'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 
created_date: '2026-07-04'
---
## Description
## Summary
Reassess report 2026-07-04 (System Map Candidates): `spec/system-map.md` predates milestone 10 and does not mention the machine-read path — `status.sh --json` / `next.sh --json` via `sprint-state.js`, `backlog-doctor` as the aggregated health probe, the sprint-close reassess signal, or the sprint-mirror surface.

## Acceptance Criteria
- [ ] Runtime Boundaries / Core Flows cover the machine-consumer path (any actor → JSON surfaces → doctor verdict; close → signal → dated reassess report)
- [ ] Project-Wide Invariants gains the single-parser rule (sprint-state.js owns sprint markdown parsing) and the report-only automation boundary (automation never mutates spec/*)
- [ ] Map stays high-level: pointers to integration-contract.md for schema detail, no script internals
- [ ] Applied via spec-system-map amend discipline
