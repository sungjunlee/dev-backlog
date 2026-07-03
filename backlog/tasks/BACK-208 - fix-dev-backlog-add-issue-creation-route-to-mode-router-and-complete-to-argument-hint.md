---
id: BACK-208
title: 'fix(dev-backlog): add issue-creation route to Mode Router and complete to argument-hint'
status: To Do
labels:
  - bug
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
The skill description triggers on issue creation but the Mode Router has no matching route, and `argument-hint` omits `complete`.

Source: docs/prd-2026-07-autonomous-execution.md section 7 (D1).

## Acceptance Criteria
- [ ] Mode Router has an issue-creation route backed by the existing Create workflow in `references/process.md`
- [ ] `argument-hint` includes `complete`
- [ ] SKILL.md stays under 250 lines

Estimate: ~20min
