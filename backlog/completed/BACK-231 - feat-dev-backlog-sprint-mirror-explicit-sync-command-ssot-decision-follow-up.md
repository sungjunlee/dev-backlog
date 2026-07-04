---
id: BACK-231
title: 'feat(dev-backlog): sprint-mirror explicit sync command (SSOT decision follow-up)'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 
created_date: '2026-07-04'
---
## Description
## Summary
Implement the option-(c) half of the SSOT decision (charter Decision row, 2026-07-03; spike #215): an explicit command that publishes the active sprint to a machine-managed GitHub issue as a read-only shared surface.

## Contract (from the spike)
- Identity: `<!-- dev-backlog:sprint-mirror sprint=<slug> -->` managed-body marker; find-by-marker then body upsert (idempotent; 3-sync prototype produced 1 issue, 0 duplicates, ~0 timeline events).
- Renderer: consume `sprint-state.js --mode status --json` (schema_version 1); do not add another markdown parser.
- Body states clearly: local sprint file is canonical; mirror is read-only; sync is explicit (no daemon, no hook).
- Sync points (manual invocation): sprint open, batch/merge boundaries, sprint close. Close should mark the mirror body as final.
- Reuse `progress-sync-github.js` primitives where practical.

## Acceptance Criteria
- [ ] One command (script + SKILL.md one-liner) performs create-or-update of the mirror issue for the single active sprint
- [ ] Idempotent across repeated runs; refuses ambiguous active sprint state (doctor semantics)
- [ ] No silent GitHub mutation: command is explicit and reports what changed
- [ ] Tests cover renderer output and marker identity (gh calls mocked/fixtured per existing test patterns)

Prototype: scratchpad spike script from #215 (see #215 comment, 2026-07-03); demo artifact was issue #230.
