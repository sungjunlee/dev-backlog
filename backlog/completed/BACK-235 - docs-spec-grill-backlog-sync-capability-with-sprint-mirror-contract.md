---
id: BACK-235
title: 'docs(spec): grill backlog-sync capability with sprint-mirror contract'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-04'
---
## Description
## Summary
Reassess report 2026-07-04 (Grill Candidates): #231/PR #233 added the sprint-mirror sync surface implementing the SSOT Decision (charter rev.4), but the `backlog-sync` capability block in `spec/capabilities.md` predates it.

## Acceptance Criteria
- [ ] `backlog-sync` Scope mentions the sprint mirror issue surface
- [ ] Expected Behaviors gains the mirror contract: marker identity (`<!-- dev-backlog:sprint-mirror sprint=<slug> -->`), find-by-marker body upsert (idempotent), read-only mirror / local file canonical, explicit sync only, refuses no/ambiguous active sprint
- [ ] capabilities-doctor stays within budget
- [ ] Applied via spec-grill discipline (no drive-by edits to other capabilities)
