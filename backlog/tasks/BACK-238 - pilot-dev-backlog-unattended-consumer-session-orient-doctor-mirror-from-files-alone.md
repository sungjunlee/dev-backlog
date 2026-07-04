---
id: BACK-238
title: 'pilot(dev-backlog): unattended consumer session — orient, doctor, mirror from files alone'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 
created_date: '2026-07-04'
---
## Description
## Summary
The execution-state substrate (PRD 2026-07, milestones 10-11) exists so long-running/unattended actors can consume sprint state without a human in the loop. This pilot exercises that promise end-to-end on the consumer side, without adding any daemon or trigger to dev-backlog itself (charter Non-Goals preserved).

## Scope
- Author a consumer session contract (`docs/unattended-consumer-pilot.md`): what an unattended session MAY do (orient via `status.sh --json` / `next.sh --json`, run `backlog-doctor`, sync `sprint-mirror`, run `spec-charter reassess` report-only) and MUST NOT do (amend/grill specs, dispatch/merge, any GitHub mutation beyond marker-identified mirror bodies).
- Run the pilot once, supervised: a **fresh-context agent** given only the contract + repo files produces an orientation/health report.
- Orchestrator verifies the report against ground truth (S3 at system level, not just smoke level).

## Acceptance Criteria
- [ ] Consumer contract doc committed under docs/, grounded in the integration contract (no new parsing rules invented)
- [ ] One supervised pilot run by a fresh-context agent using only files + the contract
- [ ] Pilot report names: active sprint (or none), doctor verdict, in-flight with pointers, reassess-signal state — all correct per orchestrator verification
- [ ] Findings recorded (what the substrate made easy, what was missing) — input for any future O6/trigger decision
- [ ] No spec mutation, no GitHub mutation except mirror bodies, trigger ownership stays external

Estimate: ~1.5hr
