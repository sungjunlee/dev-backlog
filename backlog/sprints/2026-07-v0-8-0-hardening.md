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

- [~] #311 fix: make Windows checkout and test execution first-class (~2hr) [branch:issue-311-windows-portability]

### Batch 2 - Direction check [after:#311]

- [ ] #312 docs: run the post-multi-track signal-driven reassessment (~45min)

### Batch 3 - Release [after:#311,#312]

- [ ] #313 release: prepare and cut v0.8.0 (~45min)

## Running Context
- Windows support means a normal Git checkout plus Node and Bash, not a
  documentation-only WSL escape hatch.
- Native filesystem paths stay native internally; stable serialized fields and
  Bash process boundaries normalize explicitly.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-16: Created milestone 15 and issues #311-#313 from the repository
  review. Started #311 on `issue-311-windows-portability`.
- 2026-07-16: #311 local implementation verified on Windows: Node 685 tests
  (681 pass, 0 fail, 4 platform skips), Git for Windows Bash smoke exit 0,
  backlog doctor 8/8 pass. Independent review found four Important portability
  gaps; all were fixed and re-review returned Critical/Important 0. Awaiting
  Ubuntu + Windows Actions evidence before marking complete.
