---
id: BACK-215
title: 'spike(dev-backlog): SSOT location decision - prototype sprint-to-issue mirror'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 SSOT decision and O5 activation
created_date: '2026-07-03'
---
## Description
## Summary
`backlog/` state is only trustworthy in the worktree that owns it. Decide where shared sprint state lives before building sync tooling.

Source: docs/prd-2026-07-autonomous-execution.md section 5 (Workstream B). Success criterion S5. Timebox: half a day.

## Options
- (a) Status quo + mutation convention (null result, acceptable)
- (b) Separate state repo (submodule or sibling clone)
- (c) Sprint mirrored to a machine-managed GitHub Issue reusing the progress-issue machinery (managed-body marker + comment upsert keys) - leading candidate

## Acceptance Criteria
- [ ] Prototype option (c) against a real sprint; measure Running Context churn/noise cost
- [ ] Score (a)/(b)/(c) against: explicit-sync preservation, worktree/machine accessibility, offline editing, churn cost, reuse of existing machinery, migration cost
- [ ] Outcome recorded as a charter Decision row
- [ ] Implementation issues cut only after the decision
