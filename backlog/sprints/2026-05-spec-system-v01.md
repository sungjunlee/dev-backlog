---
milestone: spec-system v0.1
status: completed
started: 2026-05-23
due: TBD
objectives: [O3, O4]
component: ""
---

# spec-system v0.1

## Goal
The layered spec system from `docs/spec-system-design.md` ships end-to-end: `spec/capabilities.md` template + grill mode (PR-1), brownfield bootstrap (PR-2), live-update wiring across dev-backlog + dev-relay (PR-3), and dev-backlog's own `spec/capabilities.md` is written via the new path (dogfood).

## Plan
Three implementation PRs followed by one dogfood, in the order locked by the design doc. Each PR validates the previous before scaffolding more onto it.

### PR-1 — Template + grill mode (foundation)
- [x] #101 feat(backlog-charter): capabilities.md template + grill mode in SKILL.md → PR #108 (merged). SKILL.md at 123 lines (under 250). 3-axis test inline. Also shipped `references/spec-system-research.md` per handoff recovery plan.

### PR-2 — Brownfield bootstrap
- [x] #102 feat(backlog-charter): extract-signals.js — brownfield capability draft → PR #109 (merged). 32 tests; smoke-tested on dev-backlog itself (5 capability candidates surfaced).

### PR-3 — Live-update wiring (cross-repo)
Both pieces of PR-3 are parallelizable but ship together. #104 lives in dev-relay; a mirror issue should be filed there before implementation starts.

- [x] #103 feat(dev-backlog): component frontmatter + component-lint.js → PR #116 (merged). sprint-init.js emits `component: ""`; 34 lint tests; component validation against `## Capability:` headers; D4 first-wins rule encoded.
- [x] #104 feat(dev-relay): append-learnings.js + relay-merge hook → [sungjunlee/dev-relay#516](https://github.com/sungjunlee/dev-relay/pull/516) (merged, dev-relay #515). 33 tests across 10 suites; markers-only writer; idempotent on run-id; graceful no-ops; loud failure on tampering; wired into `finalize-run.js` post-merge (failure does not block cleanup).

### Dogfood
- [x] #105 docs: dogfood spec/capabilities.md for dev-backlog itself → PR #110 (merged). 5 capability blocks at 23–30 lines each (175 total); 2 of 15 Behaviors rewritten on first 3-axis pass. 5 follow-up findings filed as #111–#115 under new milestone #7 `spec-system v0.1 dogfood polish`.

## Running Context
[Decisions and discoveries that carry across tasks in this sprint]

- **Design source of truth.** [`docs/spec-system-design.md`](../../docs/spec-system-design.md) is the locked architecture (M tier). All five locked decisions (M tier choice, single-file capabilities, zero new skill names, structurally-bounded `## Learnings`, all-5-issues-filed-now) trace to either a research finding or eng-review finding — do not re-litigate them in this sprint without new evidence.
- **3-axis predicate test (encode in #101 grill mode).** Every Behavior or Hard Constraint must pass Authority + Distributional + Manipulability. Failing the manipulability axis demands a *structural* restriction outside the spec, not just sharper prose. Source: design doc §"3-axis predicate test."
- **Anti-Goodhart structural defense (encode in PR-3).** Working agents must have zero write access to spec content except the structurally-bounded `## Learnings` append between magic markers. `append-learnings.js` is the only writer; any write outside the markers fails loud. Source: Manheim & Garrabrant adversarial mode + Langosco goal misgeneralization.
- **SKILL.md 250-line ceiling on `backlog-charter` is the L-tier promotion trigger.** If grill mode pushes it over, the documented escape hatch is extracting `spec-grill` and `spec-learn` as named skills — but do not pre-empt by compressing past readability. Source: design doc §"Migration path to L tier."
- **CHARTER objectives this sprint advances:** O3 (`<5-min reference axis usable`) — capability specs extend the 5-min property *below* CHARTER, not into it. O4 (`drift detectable without manual triage`) — `## Learnings` + `component-lint.js` are direct drift surfaces. Status advance still requires independent-project proof per Tier 2; do **not** advance on this sprint alone.
- **Research artifact recovery.** Three deep research syntheses from the design session (autonomous-agent failures, spec-language granularity, Goodhart/control-theory) live only in conversation history of the previous session. Recommended: save as `skills/backlog-charter/references/spec-system-research.md` as part of PR-1 (#101) so they survive future `/clear`s. The design doc references this file as a placeholder.
- **Cross-repo coordination.** PR-3 touches dev-relay. File a mirror issue in `sungjunlee/dev-relay` before implementing #104 so the cross-repo change is visible from both sides.
- 2026-07-05: `component:` cleared from retired `spec-grill` — the spec-* capabilities moved to craftkit with the skills (0.7.0, charter Decision 2026-07-04).

## Progress
[Timestamped log — update at end of each session/batch]

- 2026-05-23: Sprint kicked off via `sprint-init.js` from milestone #6 (`spec-system v0.1`); objectives [O3, O4] set. Plan ordering locked: #101 → #102 → (#103 + #104 in parallel) → #105 (with optional re-run after #102). Predecessor PRs #99, #100, #106, #107 all merged on main; design doc available at [`docs/spec-system-design.md`](../../docs/spec-system-design.md). v0.6 polish sprint closed.
- 2026-05-23 PM (2): #101 shipped as PR [#108](https://github.com/sungjunlee/dev-backlog/pull/108) — `templates/capabilities.md` + `## Grill Mode` section in `backlog-charter/SKILL.md` (123 lines, under 250) with 3-axis predicate test inline. Bonus: `references/spec-system-research.md` preserves the three research syntheses from the design session (autonomous-agent failures, spec-language stability, Goodhart/control-theory) — the doc the design's "Research grounding" section pointed to. Merged.
- 2026-05-23 PM (3): #102 shipped as PR [#109](https://github.com/sungjunlee/dev-backlog/pull/109) — `extract-signals.js` (~270 LOC) drafts capability candidates from README + CLAUDE.md + source root + last 100 commit scopes + CHARTER objectives. Deterministic, graceful-degrading, JSON/human output. 32 tests. SKILL.md (125 lines) now references the script as the brownfield grill-mode entry point. Smoke on dev-backlog itself surfaced 5 candidates (3 skills + 2 commit-only). Merged.
- 2026-05-23 PM (4): #105 dogfood shipped as PR [#110](https://github.com/sungjunlee/dev-backlog/pull/110) — first real `spec/capabilities.md` for dev-backlog itself. 5 capability blocks organized by **functional contract** (`sprint-execution` / `backlog-sync` / `charter-management` / `triage-grooming` / `task-progress-reporting`), not by skill directory — which is itself dogfood finding #111. 175 lines total, all blocks ≤30 lines. 2 of 15 Expected Behaviors rewritten after failing an axis on first pass (sprint-execution B1 failed manipulability; triage-grooming B1 failed authority); 13 passed first time. New milestone #7 `spec-system v0.1 dogfood polish` collects 5 follow-up findings #111–#115. Merged.
- 2026-05-23 PM (5): #103 shipped as PR [#116](https://github.com/sungjunlee/dev-backlog/pull/116) — sprint-init.js now emits `component:` alongside `objectives:`, and `component-lint.js` (34 tests; ~190 LOC) validates every sprint's `component:` value against `## Capability:` headers in `spec/capabilities.md`. D4 first-wins rule encoded. Active v0.1 sprint sets `component: "charter-management"` as proof of concept; full repo suite at 380 pass. Merged.
- 2026-05-23 PM (6): #104 shipped as [sungjunlee/dev-relay#516](https://github.com/sungjunlee/dev-relay/pull/516) (cross-repo, dev-relay #515) — `append-learnings.js` (33 tests) appends a schema-bound entry to the matching capability's `## Learnings` block between magic markers, after a successful merge. Structural anti-Goodhart defense: only writer for that section, refuses writes outside markers, fails loud on tampering, idempotent on run-id. `finalize-run.js` invokes it post-merge; failure does not block cleanup. Full relay-merge suite: 144 pass. **PR-3 cross-repo plan complete — all 5 v0.1 issues (#101, #102, #103, #104, #105) closed.**
- 2026-05-23: Sprint closed. 5/5 tasks completed.
