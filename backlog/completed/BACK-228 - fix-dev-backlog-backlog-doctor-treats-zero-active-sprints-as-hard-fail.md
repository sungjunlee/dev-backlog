---
id: BACK-228
title: 'fix(dev-backlog): backlog-doctor treats zero active sprints as hard fail'
status: To Do
labels:
  - bug
priority: medium
milestone: 2026-07 SSOT decision and O5 activation
created_date: '2026-07-03'
---
## Description
## Summary
`backlog-doctor.js` reports `[FAIL] active_sprint - No active sprint found` and exits non-zero when no sprint is active. Zero active sprints is the normal resting state between sprints (immediately after `sprint-close.sh`), not an ambiguity violation.

PRD `docs/prd-2026-07-autonomous-execution.md` section 4 (A3) defines the hard violation as **ambiguous** active sprint state (multiple actives / inconsistent guards), matching the #193 fail-loud semantics. Zero-active should be a soft signal at most.

Observed right after closing sprint 2026-07-execution-substrate: doctor exits 1 on an otherwise healthy repo.

## Why it matters
#216 wires doctor into `sprint-close.sh`; with current semantics the close flow would always end red. CI health probes between sprints would also fail spuriously.

## Acceptance Criteria
- [ ] Zero active sprints → `active_sprint` check reports pass or warn (documented choice), exit 0 when nothing else fails
- [ ] Multiple active sprints → still hard fail, non-zero exit
- [ ] Dependent checks (sprint_shape, in_flight_*) keep their current skip behavior
- [ ] Tests cover the zero-active and multi-active cases

Estimate: ~20min. Fold into #216 if convenient.
