---
milestone: 2026-08 GitHub-native core simplification
status: active
started: 2026-07-31
due: TBD
objectives: [O3]
component: "tracker-task-truth"
---

# GitHub-native Core Simplification

## Goal
Make GitHub Issues the standalone task authority, preserve sprint continuity for complex work, and remove unproven mirror, tracker, planning, and memory complexity behind measured gates.

## Plan

### Batch 1 — Authority gate
- [~] #345 Define the GitHub-native authority contract and reduced product boundary (3d) [branch:codex/github-native-core-simplification]

### Batch 2 — Resolver and independent evidence tracks
- [ ] #346 Resolve effective task specs without GitHub task mirrors (8d)
- [ ] #349 Validate GitHub Projects as an optional planning projection (3d)

### Batch 3 — Mirrorless execution pilot
- [ ] #347 Pilot mirrorless GitHub execution and retire task mirrors (two sprints across 2–3 consuming repositories)

### Batch 4 — Subtract unused compatibility machinery
- [ ] #348 Subtract zero-adopter tracker and compatibility machinery (5d)

### Batch 5 — Evidence-gated memory decision
- [ ] #350 Benchmark historical retrieval before admitting project memory (4–6 week shadow period)

## Running Context
- GitHub Issues are canonical task definitions and lifecycle state for this milestone; sprint files carry only complex execution continuity.
- #345 is the contract gate for every other epic. #346 gates #347, and #347 gates #348.
- #349 remains an optional planning-projection experiment and must not enter the core Issue → PR or sprint path.
- Start #350 evidence collection after #345 so its 4–6 week clock overlaps implementation. Any productization decision waits for #347 pilot evidence.
- Stop #347 and repair #346 if mirrorless execution cannot recover acceptance criteria, task intent, lifecycle, or in-flight handoff state.
- Existing mirrors remain read-only fallback during the pilot. Do not introduce new dual writes or committed automatic memory artifacts.

## Progress
- 2026-07-31: Opened the milestone execution track from GitHub issues #345–#350. Doctor reported no pre-existing active sprint and no blocking repository health failures.
- 2026-07-31: Started #345 on `codex/github-native-core-simplification`; authority-contract document and spec amendments are under implementation review.
