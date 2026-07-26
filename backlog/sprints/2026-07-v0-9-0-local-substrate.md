---
milestone: v0.9.0 local substrate redesign
status: active
started: 2026-07-26
due: TBD
objectives: [O8, O9]
component: "tracker-task-truth"
---

# v0-9-0-local-substrate

## Goal
`local` is one storage substrate presenting the same normalized interface a remote tracker does —
JSON canonical, markdown derived, no lock — so adding the next tracker stays a ~170-line translator
and the three Windows lock-race skips are gone.

## Plan

### Batch 1 - Design gate (blocking)

- [x] #320 design: re-tier the tracker adapters — local as storage substrate, remotes as translators (~45min) → PR #326 (merged)

### Batch 2 - Local substrate [after:#320]

- [~] #321 refactor(local-tracker): JSON canonical store + atomic rename; drop the frontmatter YAML round-trip and the allocation lock (~4hr) [run:issue-321-20260726133041404-0f223745] [branch:issue-321]

### Batch 3 - Selection file [after:#321]

- [ ] #322 refactor(setup): move tracker selection to backlog/.tracker; delete the config.yml YAML tokenizer (~3hr)

### Batch 4 - Contract + release [after:#321,#322]

- [ ] #323 docs: align contract surfaces with the local substrate redesign + record the adapter size budget (~1hr)
- [ ] #324 release: prepare and cut v0.9.0 (~45min)

## Running Context

- **This is a subtraction release.** No new user-facing capability. Success is measured in code
  removed, contract clarity, and Windows fidelity — not features added. Reject scope that adds
  surface, including new adapters (gitlab/jira/linear come *after* the tier rule is proven, not in
  this sprint).
- **The seam is not the problem.** `tracker.js` (346 lines) is well-factored: minimal required
  operations, capability gating, configured-only resolution, typed errors. Do not refactor it beyond
  what the selection-source change in #322 requires.
- **The asymmetry that motivates the sprint:** `github-tracker.js` is 172 lines (a translator);
  `local-tracker.js` is 1,391 (a transactional file DB + YAML serializer). Every future tracker is
  the first kind. `local` was placed in the wrong tier.
- **Three YAML implementations exist today.** `lib.js:parseSimpleYaml` (~80 lines, reads
  `config.yml`, used everywhere — **keep**), the `setup-dev-backlog.js` tokenizer (395 lines, writes
  the tracker key — **delete via #322**), and the `local-tracker.js` frontmatter round-trip (~200
  lines — **delete via #321**). The zero-dependency rule (no `package.json`; skills run without
  `npm install`) is correct and stays; what was wrong was hand-writing a YAML parser to set one key.
- **The lock is the sole cause of the Windows divergence.** Three tests carry
  `t.skip("Windows prevents replacing an open lock pathname; Ubuntu covers this POSIX race")`.
  Atomic rename behaves identically on both platforms, so #321 deletes those skips rather than
  re-documenting them. Windows support gets cheaper *and* more honest — total Windows-specific code
  is only 68 lines (`bash-runtime.js` 44 + `portable-path.js` 24) plus one CI job, and it stays.
- **`local` has zero adopters.** Across 19 repos consuming dev-backlog, exactly one `config.yml`
  carries a `tracker:` key and its value is the default `github` (this repo's own). No local store
  exists anywhere. That is why the canonical-shape change ships without a migration path — and why
  the window to make it is now.
- **Co-authoritative trap.** The `tracker-task-truth` hard constraint forbids treating two task
  stores as co-authoritative. The derived markdown mirror must therefore never be parsed back as
  truth. State it in the design (#320), enforce it in code (#321), assert it in contract prose (#323).
- **Survives the format change** (PR #298 Learnings): exact-ID allocation across active + completed,
  fail-closed control-character/injection validation, crash-recoverable close/archive semantics.
  Dropping any of these is a regression, not a simplification.
- **Spec escalation rule.** The canonical-shape change reads as an implementation choice, so a
  `Decisions` row in `spec/capabilities.md` suffices. If review finds it touches an Expected
  Behavior or Hard Constraint, it escalates to a human-gated `spec-grill` pass — never amend an
  invariant unattended (the v0.8.0 #294 precedent).
- **Batches 2 and 3 are deliberately serial.** They are conceptually independent but both touch
  `tracker.js` and `tracker-cycle.acceptance.test.js`, so they are not intra-batch parallel-safe.
- **multi-track is explicitly out of scope and stays.** It is unused today (0 files with `scope:`,
  0 repos with 2+ active tracks) but costs ~0 while unused (single-track output is byte-identical
  per PRD G4), reverting it would need a human-gated capabilities amendment, and in-repo parallelism
  is wanted — the real gap is the entry path to opening a second track, which belongs with the O3
  portfolio work, not here.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-26: Sprint planned from a workspace-wide complexity review. Milestone 16 and issues
  #320-#324 filed. Evidence behind the plan: 19 repos consume dev-backlog (tamgu_note 24 sprints,
  dev-backlog 23, dev-relay 18, beopjalal 16, ...) so adoption is real, but every v0.8.0 axis has
  zero consumers — `local` unused, `tracker:` set in 1 of 18 configs (to the default), `scope:` in 0
  files, 0 repos with 2+ active tracks. Diagnosis: the charter validates objectives on
  implementation proof, not on adoption, so surface accumulates while every health signal stays
  green. Response chosen: keep the generalization direction (more trackers *are* wanted), fix the
  tier model so it stays cheap, and record a 200-line adapter budget as the durable guard.
- 2026-07-26: Batch 1 done. #320 → PR #326 (merged `150a8fe`). `docs/tracker-adapter-design.md`
  gains an "Adapter Tiers (v0.9.0)" section: three tiers (seam ~350 / remote translator ≤200 /
  storage substrate ≤600), the budget rule ("an adapter over 200 lines is not an adapter, it is a
  substrate — stop and re-tier"), the local JSON canonical shape with a binding co-authoritative
  rule (a derived mirror is never parsed back as truth), the `backlog/.tracker` selection source
  with its legacy fallback, the Windows consequence (the lock is the sole divergence cause; the 3
  skips get deleted, not re-documented), the surviving PR #298 Learnings, and a dated
  no-migration posture. The `#273-#278` runtime section carries a forward pointer so it cannot be
  read as current on the two superseded points. Batch 2 (#321) is next.
