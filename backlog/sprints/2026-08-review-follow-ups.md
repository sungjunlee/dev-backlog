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
- [ ] #364 Amend the historical-retrieval-shadow gates before the 2026-08-28 decision (1d)

### Batch 2 — O3 resolution
- [ ] #363 Resolve charter O3 this cycle: measured on-track drill or demote into the O5 reassess loop (2d)

### Batch 3 — Conformance net
- [ ] #367 SKILL.md conformance suite: periodic fresh-session evals on Claude and Codex + doc-drift check (3d)

## Running Context
- Track axis: `scope:` globs, deliberately mixed-axis against the active `2026-07-github-native-core-simplification` track (`component: "tracker-task-truth"`) — `scopesOverlap` treats mixed axes as disjoint, and that track's only remaining item is the `[~] #350` decision wait, not code. Do not touch that track's state from here.
- #364 amends `docs/historical-retrieval-shadow.md`, which is #350's protocol: the amendment is a pre-registered gate change (record change + date + rationale in the doc, charter-amend style) and must land before the 2026-08-28 decision window opens. It serves the other track's decision integrity but is executed here because the wait track admits no new work.
- #363: prefer Option A (timed on-track drill in 3–5 consumer repos) because it produces proof either way; any resulting charter status change is human-gated — this sprint delivers the evidence and the proposal, not the amend.
- #361 (organic question log) is deliberately NOT a sprint item: it is continuous evidence capture on #350, not batchable work. #370/#372 stay sprint-free Issue → PR per the admission rule. #362/#365 stay unplanned until #350 decides.
- Sprint composition follows the accepted grouping in `backlog/triage/2026-08-16-report.md`.

## Progress
- 2026-08-16: Sprint opened from triage report 2026-08-16. Milestone 20 created; #363/#364/#367 assigned. Doctor clean at open (mixed-axis disjoint from the #350 wait track).
