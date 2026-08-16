---
milestone: 2026-08 review follow-ups
status: active
started: 2026-08-16
due: 2026-08-28
scope: ["docs/**", "spec/**", "skills/**"]
objectives: [O3, O4]
component: ""
---

# review-follow-ups

## Goal
The 2026-08-15 review's this-cycle findings are closed out: the #350 shadow gates are amended before the 2026-08-28 decision, charter O3 is resolved by measurement or demotion, and a conformance/doc-drift net exists for prompt-judged behavior.

## Plan

### Batch 1 — Deadline-bound gate amendment
- [x] #364 Amend the historical-retrieval-shadow gates before the 2026-08-28 decision (1d) → commit 5a1e8ce (direct to main)

### Batch 2 — O3 resolution
- [x] #363 Resolve charter O3 this cycle: measured on-track drill or demote into the O5 reassess loop (2d) [evidence:docs/o3-drill-2026-08-16.md] → charter rev 14 (O3 implemented, user-approved 2026-08-16)

### Batch 3 — Conformance net
- [~] #367 SKILL.md conformance suite: periodic fresh-session evals on Claude and Codex + doc-drift check (3d) [evidence:docs/conformance/2026-08-16-model-actions.md] — doc-drift net in CI; 4-channel model-actions conformance run done; cadence accepted; residual AC: full Eval-Prompts cross-model run at the next cadence checkpoint

## Running Context
- Track axis: `scope:` globs, deliberately mixed-axis against the active `2026-07-github-native-core-simplification` track (`component: "tracker-task-truth"`) — `scopesOverlap` treats mixed axes as disjoint, and that track's only remaining item is the `[~] #350` decision wait, not code. Do not touch that track's state from here.
- #364 amends `docs/historical-retrieval-shadow.md`, which is #350's protocol: the amendment is a pre-registered gate change (record change + date + rationale in the doc, charter-amend style) and must land before the 2026-08-28 decision window opens. It serves the other track's decision integrity but is executed here because the wait track admits no new work.
- #363: prefer Option A (timed on-track drill in 3–5 consumer repos) because it produces proof either way; any resulting charter status change is human-gated — this sprint delivers the evidence and the proposal, not the amend.
- #361 (organic question log) is deliberately NOT a sprint item: it is continuous evidence capture on #350, not batchable work. #370/#372 stay sprint-free Issue → PR per the admission rule. #362/#365 stay unplanned until #350 decides.
- Sprint composition follows the accepted grouping in `backlog/triage/2026-08-16-report.md`.

## Progress
- 2026-08-16: Sprint opened from triage report 2026-08-16. Milestone 20 created; #363/#364/#367 assigned. Doctor clean at open (mixed-axis disjoint from the #350 wait track).
- 2026-08-16: Batch 1 complete. #364 shadow-gate amendments A1 (auto no-go under 10 organic) + A2 (marginal recall/error over Arm B replaces the 20%-faster bar) landed in commit 5a1e8ce, direct to main per the narrow-scope direct-fix pattern; both node suites 0 fail, smoke 190/190. Pre-registration notice posted on #350; issue #364 closed. Sprint-adjacent: #361 dated capture plan posted + standing nudge added to `_context.md` (0/10, first-entry math means a 2026-08-28 go is already impossible — realistic paths are a ≤2026-09-11 decision or A1 auto no-go). Next: Batch 2 (#363 O3 resolution — Option A drill preferred).
- 2026-08-16: Batch 2 drill executed (#363 Option A). 5 consumer repos timed: median 4.8 s agent wall-clock, worst 7.5 s — 5-minute bar holds by two orders of magnitude where the O-predicate axis exists (4/5 assessable; sjlee-ops prose charter is structurally out of the method's denominator). Bonus finding: dear-scene has a 25-day stale-active m5 sprint. Evidence: `docs/o3-drill-2026-08-16.md`. Proposed O3 active → implemented amend posted on #363; charter untouched pending the human gate. #363 stays `[~]` until the amend decision.
- 2026-08-16: User approved the O3 amend ("권장대로 진행") — charter rev 13 → 14: O3 `[active]` → `[implemented]` with the drill as proof and the spec-charter-axis denominator; Decisions row appended (human gate satisfied by explicit approval). #363 closed. Batch 2 complete. Next: Batch 3 (#367) starting with the deterministic doc-drift check, fresh-session evals after.
- 2026-08-16: Batch 3 started (#367). `doc-drift-check.js` + 10-test suite landed: scans skills/*/SKILL.md, references/*.md, and _context.md for `.js`/`.sh` mentions against the scripts/ inventory; live repo clean (18 docs / 62 scripts / 0 dangling); the test suite includes a live-repo assertion so CI now carries the net permanently. Registered in references/scripts.md. Remaining: fresh-session conformance evals on Claude + Codex, cross-model comparison, cadence decision (proposal posted on #367: per release-tag + at reassess boundaries; dated reports under docs/conformance/).
- 2026-08-16: Sprint-free siblings + Batch 3 conformance run, executed via agent fan-out per user direction. #370 closed (v0.10.0 tagged at 65fcb7c with the wave's missing CHANGELOG entries; v1.0.0 reserved). #372 closed (735fc41, implemented by a sonnet subagent, reviewed + verified locally: triage 101 / node 382 / smoke 190 all green). #367 conformance run: 4 channels (opus, sonnet, codex gpt-5.6-sol, pi deepseek-v4-flash) over the frozen 2026-08-16 snapshot — wire 4/4 PASS, judgment sonnet ≥ codex > opus > pi, 3 rubric fixes identified (docs/conformance/2026-08-16-model-actions.md, commit 0021651). Cadence accepted. #367 residual: full Eval-Prompts cross-model run at the next cadence checkpoint — the sprint's only open item.
