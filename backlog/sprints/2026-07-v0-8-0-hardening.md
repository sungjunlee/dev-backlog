---
milestone: v0.8.0 hardening and release
status: active
started: 2026-07-16
due: TBD
objectives: [O8, O9]
component: "sprint-execution"
---

# v0.8.0 Hardening

## Goal
Windows is a verified first-class execution path, the post-change spec signal is
reviewed, and the resulting release is ready to cut as v0.8.0.

## Plan
### Batch 1 - Platform contract

- [x] #311 fix: make Windows checkout and test execution first-class (~2hr) → PR #314 (merged)

### Batch 2 - Direction check [after:#311]

- [x] #312 docs: run the post-multi-track signal-driven reassessment (~45min) → report `backlog/triage/2026-07-20-reassess.md` + issue #315

### Batch 3 - Release [after:#311,#312]

- [ ] #315 spec: amend system-map stale O8/O9 evidence status (~20min)
- [ ] #313 release: prepare and cut v0.8.0 (~45min)

## Running Context
- Windows support means a normal Git checkout plus Node and Bash, not a
  documentation-only WSL escape hatch.
- Native filesystem paths stay native internally; stable serialized fields and
  Bash process boundaries normalize explicitly.
- Windows prevents replacing an open lock pathname; keep those POSIX race tests
  enforced on Ubuntu and document their Windows skip rather than weakening the
  production lock invariant.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-16: Created milestone 15 and issues #311-#313 from the repository
  review. Started #311 on `issue-311-windows-portability`.
- 2026-07-16: #311 local implementation verified on Windows: Node 685 tests
  (681 pass, 0 fail, 4 platform skips), Git for Windows Bash smoke exit 0,
  backlog doctor 8/8 pass. Independent review found four Important portability
  gaps; all were fixed and re-review returned Critical/Important 0. Awaiting
  Ubuntu + Windows Actions evidence before marking complete.
- 2026-07-16: Opened draft PR #314; monitoring Ubuntu and Windows Actions before
  moving it to ready-for-review.
- 2026-07-16: PR #314 Ubuntu and Windows Actions green. The first Windows run
  exposed three POSIX open-file replacement race tests; Windows now skips those
  impossible filesystem races while Ubuntu continues to enforce them. Full
  local Windows suite: 685 tests, 678 pass, 0 fail, 7 documented skips.
- 2026-07-16: #311 → PR #314 → independently reviewed twice (Critical/Important
  0 after fixes) → user-approved squash merge. Issue #311 closed; Batch 1
  complete and #312 is next.
- 2026-07-20: #312 reassessment run (analysis delegated to a subagent). Report
  `backlog/triage/2026-07-20-reassess.md`: backlog-doctor 8/8, capabilities-
  doctor ok (5 caps/198 lines), component-lint clean. One concrete drift —
  `system-map.md:79` stale O8/O9 status contradicting validated charter — filed
  as #315 (milestone 15, clear before/with the v0.8.0 tag). O6 stays
  `[deferred]` on a negative demand scan. No v0.8.0 blockers found. Deferred
  candidates stay recorded in the report only: charter O1 wording (human-gated),
  `tracker-task-truth` setup-idempotency grill line, optional Windows invariant
  line (can ride the #315 pass).
