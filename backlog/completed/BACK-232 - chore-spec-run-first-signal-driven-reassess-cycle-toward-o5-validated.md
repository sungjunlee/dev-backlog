---
id: BACK-232
title: 'chore(spec): run first signal-driven reassess cycle toward O5 validated'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 
created_date: '2026-07-04'
---
## Description
## Summary
O5 is active (charter revision 4) but promotion to validated requires evidence of one full **signal → reassess → amend** cycle in dogfooding. The signal has already fired twice (sprint closes on 2026-07-03/04 recommended reassess: doctor warnings + 12 closed sprints since last report ≥ threshold 3).

## Acceptance Criteria
- [ ] `spec-charter reassess` run produces a dated report at `backlog/triage/YYYY-MM-DD-reassess.md` (report-only)
- [ ] Report findings triaged; any proposed charter changes applied only via human-gated `spec-charter amend`
- [ ] If the full cycle completes (signal → reassess → human-approved amend), O5 status moves active → validated with the cycle cited as proof
- [ ] Next sprint-close signal counter resets (sprints-since-last-reassess computed from the new dated report)

Estimate: ~45min. Report-only automation boundary preserved throughout.
