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

- [~] #332 test: canonical-store contract prose must match code (repo-local, not a doctor check) (~1.5hr) [run:issue-332-20260727134805650-be985b27]

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
- 2026-07-27: Sprint opened as track B of a two-track portfolio. Partitioned from track A
  on `component:` so the two can run concurrently through separate relay worktrees; this
  is the first time this repo has run 2+ active tracks, which is itself the adoption
  evidence craftkit#165 and #333 are about.
