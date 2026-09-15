---
milestone: backlog-charter dogfood polish
status: completed
started: 2026-05-23
due: 2026-05-30
objectives: [O3, O4]
---

# backlog-charter v0.6 polish

## Goal
Six dogfooding findings from the 2026-05-23 self-application of `backlog-charter` are closed: `backlog-charter` create mode has a teachable interview path with worked examples, and `dev-backlog` + `backlog-charter` ship two small drift-detection scripts (`check-size.js`, `objectives-check.js`). After this sprint, a second independent project running `backlog-charter create + amend` is one Tier-2 proof event away from advancing **O3** to `validated`.

## Plan
Docs-first, then features. Docs feed each other (interview checklist quotes the predicate examples), and the two scripts are small and self-contained so they can ship in parallel last.

### Batch 1 — Docs foundation (one session, ~1h)
Order matters: #95 supplies the worked examples that #93 references, and #94/#96 are independent polish on adjacent Create-mode sections.

- [x] #95 docs(backlog-charter): add good/bad verifiable-predicate examples for Objectives (~20min) → PR #99 (merged)
- [x] #93 enhance(backlog-charter): add interview checklist for create mode → PR #106 (merged, bundled #93+#94+#96)
- [x] #94 enhance(backlog-charter): document signals collection priority + conflict resolution → PR #106 (merged)
- [x] #96 docs(backlog-charter): seed-Decisions guidance for create mode → PR #106 (merged)

### Batch 2 — Drift-detection scripts (parallelizable, ~1h)
Both are small, self-contained, and CHARTER-aware. Either order works.

- [x] #97 feat(backlog-charter): check-size.js — warn on bloat above 5-min read → PR #107 (merged)
- [x] #98 feat(dev-backlog): objectives-check.js — verify sprint `objectives:` IDs exist in CHARTER → PR #107 (merged)

## Running Context
[Decisions and discoveries that carry across tasks in this sprint]

- **CHARTER objectives this sprint advances:** O3 (`<5-min reference axis usable`) via Batch 1 polish + #97 bloat guard; O4 (`drift detectable without manual triage`) via #98 sprint↔CHARTER ID check.
- **Proof-gate discipline (from previous session).** Do *not* advance O3/O4 status on this sprint alone — self-application isn't proof. Wait for an independent project to run `backlog-charter create + amend`. Recorded as a Decision in the closeout if relevant.
- **Lesson from 2026-05-22 relay dogfood (if Batch 2 is dispatched via `/relay`):** if orchestrator-side commit recovery happens, run `rebrand-evidence.js` **before** the first relay-review round — the state machine has no legal `changes_requested → review_pending` re-arm transition. Full background in `~/.craftkit/handoff/docs/dev-backlog-6001a2.md` ("What didn't work").

## Progress
- 2026-05-23 PM: Sprint kicked off via `sprint-init.js` from milestone #5; objectives [O3, O4] set; Plan organized into two batches (docs-first → scripts). #95 implemented directly (small docs work — `skills/backlog-charter/references/objectives.md`, 73 LOC) → PR [#99](https://github.com/sungjunlee/dev-backlog/pull/99) open, awaiting review.
- 2026-05-23 PM (2): #99 merged. Batch 1 (#93+#94+#96) shipped as one consolidated PR [#106](https://github.com/sungjunlee/dev-backlog/pull/106) — `skills/backlog-charter/references/create.md` (~106 LOC) covers signals priority, interview checklist, and seed-Decisions guidance; SKILL.md Create Mode steps now cite the new reference. Merged.
- 2026-05-23 PM (3): Batch 2 (#97+#98) shipped as PR [#107](https://github.com/sungjunlee/dev-backlog/pull/107). `check-size.js` (29 tests) wired into amend mode; `objectives-check.js` (24 tests) on-demand only. Full suite green: 314 pass / 1 skipped / 0 fail. Merged.
- 2026-05-23 PM (4): All 6 issues closed. Sprint complete.
- 2026-05-23: Sprint closed. 6/6 tasks completed.
