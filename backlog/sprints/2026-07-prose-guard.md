---
milestone: 2026-07 adoption gate and track entry
status: active
started: 2026-07-27
due: TBD
objectives: [O9]
component: "tracker-task-truth"
---

# prose-guard

## Goal
A contract surface that names the wrong store as canonical fails a test in this repo's
CI, instead of shipping to `main` and being caught by a human read three surfaces later.

## Plan

### Batch 1 - Prose guard

- [~] #332 test: canonical-store contract prose must match code (repo-local, not a doctor check) (~1.5hr) [PR #334, review PASS]

## Running Context

- **This track is one half of the first real two-track dogfood.** The sibling track is
  `2026-07-track-entry.md` (`component: sprint-execution`, issues #331 and #333). Keep
  the file sets disjoint: this track owns the new test file only. It **reads**
  `SKILL.md`, `README.md`, and `spec/system-map.md` and must not edit them — the sibling
  track edits `SKILL.md`'s Plan step for #331.
- **Three drifts in two releases, zero test failures.** v0.8.0 `spec/system-map.md:79`;
  v0.9.0 #321's stale round-2 lock sentence in `docs/tracker-adapter-design.md`; v0.9.0
  #321's `SKILL.md` Core Contracts still calling local task files canonical records —
  false the moment #321 merged, and **shipped on `main`**. PR #327's body claimed the
  contract prose had landed; verification had stopped at the diffstat.
- **The tier decision is the point of this issue, not an aside.** The v0.9.0 sprint note
  proposed teaching `backlog-doctor` to check this. That is the wrong tier for the same
  reason `local` was: the doctor runs in the 19 **consuming** repos, but this prose lives
  in the skill bundle and is byte-identical everywhere. Checking it 19 times verifies
  nothing that checking it once here does not, and it would add consumer surface to catch
  an authoring mistake only makeable in this repo. Keep it repo-local; say why in the
  test header so the decision survives the next person who wants to move it.
- **The facts must come from code, not from a literal re-typed in the test.** Renaming
  `backlog/local-tracker.json` or `backlog/.tracker` has to fail this test, otherwise it
  is a second place to maintain the same claim — a co-authoritative source, which is the
  exact trap `tracker-task-truth`'s hard constraint forbids.
- **The regression proof is the acceptance criterion that matters.** Reverting the
  pre-#321 `SKILL.md` wording must make the test fail, with the output in the PR body. A
  guard that would not have caught the drift it exists for does not satisfy #332.
- **Not a documentation linter.** Only the canonical-store claim. If reliable matching
  needs more than ~90 lines, restructure the prose into a machine-checkable block and
  report that finding — do not grow the matcher.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-27: **The guard caught a live drift on its first execution — a fourth one, and
  the first a test found rather than a human read.** Round 1 could not go green because
  `README.md:22` said `local -> tasks/ + completed/ (canonical, no gh)` and `:38` said
  `canonical tasks in local`; both false since #321 merged, both shipped on `main`. README
  was read-only for the task, so the executor correctly left it — the fix landed on `main`
  as `9228a65` and the branch rebased onto it. Two adjacent stale claims were corrected in
  the same pass: "One active sprint file" predated multi-track, and two uses of "canonical
  tasks" were ambiguous in a repo whose contract is that task files are derived.
  Regression proof run in two variants; the second keeps the correct `.tracker` line and
  regresses only the canonical claim, failing with `SKILL.md:41 ... contradicts
  code-derived fact: backlog/local-tracker.json is canonical in local mode`.
  **Criterion 7 was my authoring error and was amended in the open**: it demanded the
  failing output "in the PR body", but this run publishes *after* internal review, so it
  was unsatisfiable at the moment it was checked. Now: recorded in run evidence at internal
  review, reproduced in the PR body at publication.
  Process cost worth remembering: I recovered the run to `review_pending` (the
  post-publication state) when `internal_review_pending` was meant, and there is no edge
  back — `publish-run` requires `publish_pending` and the whitelist has no reverse. The PR
  was created by hand to escape. Filed as a third entry point on dev-relay#755.
  PR #334, review verdict PASS with 0 findings, CI green on Ubuntu and Windows.
- 2026-07-27: Sprint opened as track B of a two-track portfolio. Partitioned from track A
  on `component:` so the two can run concurrently through separate relay worktrees; this
  is the first time this repo has run 2+ active tracks, which is itself the adoption
  evidence craftkit#165 and #333 are about.
