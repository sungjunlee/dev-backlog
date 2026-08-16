---
milestone: 2026-07 subtraction and rule simplification
status: completed
started: 2026-07-28
due: TBD
objectives: [O1, O3, O7]
component: "sprint-execution"
---

# rule-simplification

## Goal
The tool stops failing its own health check, the disjointness rule is stated in its shorter
true form, and O8 stops implying that someone should go find `local` a user.

## Plan

### Batch 1 - Generator/checker agreement

- [x] #339 fix(sprint-init): generated sprints fail backlog-doctor's own sprint_shape check (~45min) → PR #342 (merged)

### Batch 2 - Scopeless rule [after:#339]

- [x] #337 apply rule B: warn when 2+ tracks are active and any is scopeless (~2hr) → PR #344 (merged)

### Batch 3 - Charter follow-up [after:#340]

- [x] #341 spec: O8 implemented by design + predicate drops deleted mirror/progress (~30min) → charter revision 11

## Running Context

- **Governing principle this cycle: essence-first, remove surface, do not add machinery.**
  A proposed craftkit "decay rule" (auto-flag objectives sitting at `implemented`) was
  **dropped** for exactly this reason — building a machine to make a decision later is
  machinery; making the decision now is essence. #341 makes it.
- **The sibling track is `2026-07-progress-axis-removal.md`**, partitioned by `scope:`
  rather than `component:` on purpose: it deletes the `task-progress-reporting` capability,
  so a component handle pointing at it would be circular. This track owns `sprint-init.js`,
  `backlog-doctor.js`, `SKILL.md`, `spec/charter.md`, and `capabilities.md`'s
  `sprint-execution` block. The sibling owns the progress/mirror scripts and
  `capabilities.md`'s `task-progress-reporting` + `backlog-sync` blocks — **both tracks
  touch `capabilities.md`; sequence those two edits, never run them concurrently.**
- **#339 was found by using the tool in an unfamiliar repo**, not by reading it. Running
  `sprint-init` then `backlog-doctor` in investanza produced a `sprint_shape` failure on a
  file the tool had just written. This repo never saw it because every sprint here is
  hand-edited seconds after creation — the authoring repo was the one place the bug was
  invisible. Both sprints in this milestone reproduced it again at creation.
- **#331 is already paying off, measurably.** Opening these two tracks produced
  `warnings: []`. Opening yesterday's two tracks, before `--component` existed, produced
  `Active track(s) without component:/scope: (...); cannot prove the new sprint is disjoint.`
  Same operation, same repo, one flag apart.
- **#337 chose B because it is the shorter true rule**, not only the more correct one:
  "when more than one track is active, every track must declare an axis" versus "warn when
  two or more active tracks are scopeless". Four surfaces change together through the one
  shared `sprintScopeKey`/`scopesOverlap` path; the `capabilities.md` Expected Behavior is
  **human-gated** (v0.8.0 #294 precedent).
- **#341 must not quietly undo #333.** O8 stays `[implemented]`; the change states *why*
  adoption is not expected, and does not relabel the goalposts to reach `[validated]`.
- **#341 now waits on #340, and gained a second job.** O8's predicate reads "GitHub's
  existing task, milestone, **mirror**, **progress**, and closing-link behavior remains
  backward compatible" — and #340 deletes the mirror and progress behavior. Landing #341
  first would leave the charter guaranteeing backward compatibility for code that no longer
  exists. One human-gated amend covering both the adoption posture and the predicate
  cleanup, after #340, is cheaper and more honest than two.
  Dropping those two words is **not** weakening a predicate to fit its proof (which the
  criteria forbid): it is removing a reference to deleted behavior. State that distinction
  explicitly in the amend, or the next reader cannot tell the two apart.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-29: Milestone complete, 4/4. **The cycle removed a net 4,039 lines and added no
  capability**, on top of v0.9.0's 2,556. `capabilities.md` went 5 capabilities → 4.
  Rule B is live and its message names the undeclared track by filename, verified on main:
  one declared plus one scopeless track warns, and all 18 consuming repos show zero
  `active_sprint` verdict changes.
  **Six review findings across the milestone; four were mine, not the executors'.** A
  criterion that was unsatisfiable in the order I wrote it (#332 round 1), a scope fence
  that put #337's contract change on #340's branch, and — three separate times — a
  verification narrower than the claim I drew from it: a grep keyed on script names that
  missed `README.md:101`, a second one that missed `README.md:116`, and a SKILL.md-only
  check reported as "the docs are done" while four other surfaces still described the pair
  rule. The reviewer caught every one. The durable lesson is not "grep harder": when a
  concept is removed or redefined, the sweep must enumerate **the concept** across every
  surface, not the token the author happens to remember writing.
  Two other corrections worth keeping. I claimed the two tracks had disjoint file sets and
  they did not — both touched `lib.js`; a trial merge proved them compatible, but after the
  fact. And the reviewer was right that **serializing** the two capability edits, not
  co-locating them, is what made them conflict-free — #337's edit landed on a different
  region of `capabilities.md` with zero conflict once #340 was in main.
- 2026-07-28: Milestone opened after a workspace-wide reassessment under an explicit
  essence-first mandate. Two findings reframed the plan. The "5 stale sprints" cleanup I
  had recommended shrank to **1** on measurement — consumer-B is actively developed (last
  commit 8h before triage), beopjalal is on a live `codex/issue-1104` work branch, and
  print-play-learn (37 files) and yookahyu-calc (5) carry uncommitted user work; only
  investanza was genuinely dormant, and its sprint is now closed. And the largest
  subtraction candidate in the repo turned out not to be `local` (597 lines) but the
  progress/mirror axis at **3,758**, which the sibling track removes.
- 2026-07-29: Sprint closed. 3/3 tasks completed.
