---
milestone: 2026-09 subtraction wave 4
status: completed
started: 2026-09-18
due: TBD
scope: ["skills/**", "tests/**", "docs/**", "README.md", "CHANGELOG.md", "VERSION"]
---

# subtraction-wave-4

## Goal

The two keep-test candidates left open at v0.13.0 are gone — one implementation of the next batch (node) and no rollout gates in the smoke test — released as v0.14.0 (epic #467).

## Plan

### Batch 1 — parallel (disjoint files)

- [x] #468 next.sh / status.sh render text from sprint-state.js; delete bash sprint parsing → PR #473 (merged)
- [x] #469 smoke-test.sh: delete GATE_* / gated_assert scaffolding → PR #471 (merged)

### Batch 2 — release

- [x] #470 release v0.14.0: CHANGELOG, VERSION, conformance after-run, tag → PR #474 (merged)

## Running Context

- Keep test unchanged from #456. #468 is the one admitted refactor (a cut would remove the human text surface README points at); JSON stays byte-identical because dev-relay consumes it.
- Implementer/reviewer: #468 Opus subagent → Astra review; #469 session → Sol review; both via codex exec.
- Task-authority generalization (GitHub default / Backlog.md / GitLab) is proposal #472, charter-gated; not part of this wave.

## Progress

- 2026-09-18: sprint opened; epic #467, issues #468–#470, milestone 26.
- 2026-09-18: #469 merged (PR #471, Sol MERGE); #468 merged (PR #473, Astra DO NOT MERGE → direct fix: env-var regression, CHANGELOG claim, CLI exit-code tests; one Windows path-separator fix in my own test). Batch 2 (#470) started.
- 2026-09-18: #470 merged (PR #474; Astra cumulative RELEASE WITH EDITS → applied: test count, tests-total glob, renderer comment, CHANGELOG comparison target, smoke comment tense). Tag v0.14.0 + release published; epic #467 and milestone 26 closed.
  - 2026-09-18: Sprint closed. 3/3 tasks completed.
