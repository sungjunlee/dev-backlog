---
milestone: ""
status: completed
started: 2026-07-04
due: TBD
objectives: [O3]
component: "backlog-sync"
---

# Spec Followups

## Goal
The durable specs catch up with the shipped substrate: the backlog-sync capability records the sprint-mirror contract and the system map shows the machine-read boundary, so a fresh reader of spec/ sees the system as it actually is.

## Plan
### Batch 1 - spec catch-up (orchestrator-led, from 2026-07-04 reassess report)
- [x] #235 docs(spec): grill backlog-sync capability with sprint-mirror contract (~30min) → capabilities.md (backlog-sync widened to bidirectional; Decision row)
- [x] #236 docs(spec): amend system-map with the machine-read boundary (~30min) → system-map.md (Read (machine) flow + 3 invariants)

## Running Context
- Source: reassess report backlog/triage/2026-07-04-reassess.md (Grill Candidates, System Map Candidates). Issue AC is authoritative.
- Spec edits are judgment work, not delegated implementation; applied through spec-grill / spec-system-map discipline with diffs surfaced before landing.
- objectives: O3 (the <5-min reference axis stays truthful); component backlog-sync as the primary capability touched.

## Progress
- 2026-07-04: Sprint opened (committed at open). Both items sourced from the first signal-driven reassess report.
- 2026-07-04: #235 done via spec-grill discipline — key call: rather than weakening backlog-sync's read-only bright line, the capability widened to bidirectional mirroring with the constraint narrowed to its real invariant (human-authored GitHub content untouchable; machine writes only to dev-backlog:sprint-mirror marker bodies). #236 done via spec-system-map amend — machine-read path, close-time reassess signal, single-parser and report-only-automation invariants. Both auto-closed by Fixes. Closing sprint.
- 2026-07-04: Sprint closed. 2/2 tasks completed.
