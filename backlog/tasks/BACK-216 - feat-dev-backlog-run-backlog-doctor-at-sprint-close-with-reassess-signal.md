---
id: BACK-216
title: 'feat(dev-backlog): run backlog-doctor at sprint close with reassess signal'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 SSOT decision and O5 activation
created_date: '2026-07-03'
---
## Description
## Summary
Spec files rot silently; `spec-charter reassess` runs only when a human remembers. Surface drift at completion boundaries, signal-gated and report-only.

Source: docs/prd-2026-07-autonomous-execution.md section 6 (Workstream C). Success criterion S4. Depends on #213 (backlog-doctor).

## Acceptance Criteria
- [ ] `sprint-close.sh` runs `backlog-doctor` as part of closing
- [ ] Complete-mode contract in SKILL.md gains one step: if doctor emits warnings, or 3+ sprints have closed since the last dated reassess report (`backlog/triage/YYYY-MM-DD-reassess.md`), the close summary recommends `spec-charter reassess`
- [ ] Sprint count since last reassess is computed from files alone; no new state field
- [ ] Unattended sessions may run reassess (report-only) but never `amend`
- [ ] No spec file is mutated by automation

Estimate: ~45min
