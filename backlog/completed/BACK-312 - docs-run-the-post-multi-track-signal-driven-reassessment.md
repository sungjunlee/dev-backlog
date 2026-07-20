---
id: BACK-312
title: 'docs: run the post-multi-track signal-driven reassessment'
status: To Do
labels:
  - documentation
priority: medium
milestone: v0.8.0 hardening and release
created_date: '2026-07-16'
---
## Description
## Problem

`backlog-doctor` currently fires the reassess signal because three sprints closed after the 2026-07-07 reassess report. The repository has no open issues, so the next direction should be selected through the project’s own signal-driven reassessment loop rather than invented ad hoc.

## Acceptance Criteria

- [ ] Run a report-only spec reassessment against the current charter, system map, capabilities, completed sprints, and release state.
- [ ] Record evidence for whether O6 remains deferred, should be shaped, or should be dropped.
- [ ] Identify any drift introduced by tracker adapters and multi-track sprints.
- [ ] Convert accepted recommendations into explicit GitHub issues; do not amend human-gated spec tiers without approval.
- [ ] A new dated reassess report clears or advances the current three-sprint signal.
