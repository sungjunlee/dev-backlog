---
id: BACK-209
title: 'chore(dev-backlog): remove dead Backlog.md config fields and reword compat docs'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
`init.sh` writes three config fields no script reads (`definition_of_done`, `auto_commit`, `date_format`), and README overstates the Backlog.md relationship. Demote Backlog.md from design ancestor to format-compat surface.

Source: docs/prd-2026-07-autonomous-execution.md section 7 (D2). Success criterion S6.

## Acceptance Criteria
- [ ] `init.sh` no longer emits the three dead fields; a fresh run produces no unread config fields
- [ ] README Design Choices reworded: task-file format is Backlog.md-compatible (not "Builds on Backlog.md")
- [ ] Charter gains a Non-Goal line stating new features are not constrained by Backlog.md conventions (applied via human-gated `spec-charter amend`)
- [ ] Smoke tests pass

Estimate: ~30min
