---
milestone: 2026-08 GitHub-native core simplification
status: active
started: 2026-07-31
due: TBD
objectives: [O10]
component: "tracker-task-truth"
---

# GitHub-native Core Simplification

## Goal
Make GitHub Issues the standalone task authority, preserve sprint continuity for complex work, and remove unproven mirror, tracker, planning, and memory complexity behind measured gates.

## Plan

### Batch 1 — Authority gate
- [x] #345 Define the GitHub-native authority contract and reduced product boundary (3d) → PR #351 (merged)

### Batch 2 — Resolver and independent evidence tracks
- [x] #346 Resolve effective task specs without GitHub task mirrors (8d) → PR #352 (merged)
- [ ] #349 Validate GitHub Projects as an optional planning projection (3d)

### Batch 3 — Mirrorless execution pilot
- [x] #347 Pilot mirrorless GitHub execution and retire task mirrors (two sprints across 2–3 consuming repositories) → PR #353 (merged)

### Batch 4 — Subtract unused compatibility machinery
- [~] #348 Subtract zero-adopter tracker and compatibility machinery (5d) [branch:codex/compatibility-subtraction]

### Batch 5 — Evidence-gated memory decision
- [~] #350 Benchmark historical retrieval before admitting project memory (4–6 week shadow period; earliest decision 2026-08-28) [run:memory-shadow-2026-07-31]

## Running Context
- GitHub Issues are canonical task definitions and lifecycle state for this milestone; sprint files carry only complex execution continuity.
- #345 is the contract gate for every other epic. #346 gates #347, and #347 gates #348.
- #349 remains an optional planning-projection experiment and must not enter the core Issue → PR or sprint path.
- Start #350 evidence collection after #345 so its 4–6 week clock overlaps implementation. Any productization decision waits for #347 pilot evidence.
- Stop #347 and repair #346 if mirrorless execution cannot recover acceptance criteria, task intent, lifecycle, or in-flight handoff state.
- Existing mirrors remain diagnostic and rollback material during the pilot, never runtime task-spec or lifecycle fallback. If the live Issue cannot resolve, stop and repair #346. Do not introduce new dual writes or committed automatic memory artifacts.

## Progress
- 2026-07-31: Opened the milestone execution track from GitHub issues #345–#350. Doctor reported no pre-existing active sprint and no blocking repository health failures.
- 2026-07-31: Started #345 on `codex/github-native-core-simplification`; authority-contract document and spec amendments are under implementation review.
- 2026-07-31: #345 completed via PR #351 after Node 379/379, smoke 187/187, Linux/Windows CI, Codex, and CodeRabbit review. Started #346 on `codex/effective-task-spec-resolver`.
- 2026-07-31: #346 implementation verified: live Issue #346 resolved without a mirror (7 AC, stable SHA-256 source revision), focused resolver/local concurrency tests passed 14/14, smoke passed 191/191, and backlog doctor passed. One pre-existing 6-second process-start barrier flaked only under the 7-minute full serial suite and passed both isolated reruns.
- 2026-07-31: #346 completed via PR #352. Final resolver coverage passed 16/16 plus Linux/Windows CI; iterative review fixed code examples, ordered/nested/lazy AC, HTML comments, and nested fence/list-container boundaries, ending with an independent no-findings review. Started #347 on `codex/mirrorless-pilot`.
- 2026-07-31: #347 pilot evidence captured from active sprint execution in `sungjunlee/aibris` and `sungjunlee/dear-scene`. Both recovered live AC, task intent, lifecycle, and in-flight pointers with zero resolver blockers or mirror writes; dear-scene exposed a stale 7-AC mirror against the live 8-AC Issue. GitHub setup now creates only `.tracker` plus `sprints/`, `sync-pull` requires `--legacy-export`, and mirrorless doctor/close coverage passes.
- 2026-07-31: #347 controlled transitions completed in aibris Issue #171 → PR #172 and dear-scene Issue #293 → PR #294. Both dedicated sprints closed through the real close script, both PRs merged and closed their Issues, live lifecycle re-resolved as `closed`, all 5/5 episode AC were checked, and existing task/completed mirrors had zero diff.
- 2026-07-31: #347 completed via PR #353 after Linux/Windows CI, focused 67/67, smoke 191/191, and a final independent no-findings review. Started #348 on `codex/compatibility-subtraction`.
- 2026-07-31: #348 removed the zero-adopter local tracker and generic/local design surface: four whole files and 1,909 exact lines. GitHub-only setup, no-fallback behavior, one-way Backlog.md import/export, and optional-integration absence are covered; focused regression tests passed 30/30 and the full Node suite passed.
- 2026-07-31: #348 independent review restored retained GitHub seam safety coverage for setup atomicity, public no-effect gates, availability/adapter/identity/capability contracts, and typed CLI errors. The final review reported no findings; focused tracker tests passed 18/18 and shell smoke passed 191/191.
- 2026-07-31: #350 shadow benchmark started with 20 pre-registered historical-retrieval questions across dev-backlog, dev-relay, and consumer repositories. The earliest four-week go/no-go date is 2026-08-28.
- 2026-07-31: #349 Projects scope escalation was refused pending explicit informed approval for persistent organization Project read/write access. No Project resource or local state was created.
