---
milestone: ""
status: active
started: 2026-07-04
due: TBD
objectives: [O1]
component: "sprint-execution"
---

# Unattended Consumer Pilot

## Goal
A fresh-context agent, given only the consumer contract and repo files, produces a correct orientation/health report — proving the substrate serves unattended consumers end-to-end while dev-backlog itself stays trigger-free and report-only.

## Plan
### Batch 1 - contract + supervised run
- [ ] #238 pilot(dev-backlog): unattended consumer session — orient, doctor, mirror from files alone (~1.5hr)

## Running Context
- Charter guardrails: no daemon/trigger inside dev-backlog (Non-Goals); unattended sessions may run reassess (report-only) but never amend (O5 wording); mirror writes only marker-identified machine-managed bodies (backlog-sync Hard Constraint).
- Pilot run is delegated to a fresh-context sonnet subagent — fresh context IS the test condition; orchestrator verifies the report against ground truth.
- Findings feed any future O6 / trigger-ownership decision; they do not change specs in this sprint.

## Progress
- 2026-07-04: Sprint opened (committed at open). Contract authoring first, then the supervised fresh-agent run.
