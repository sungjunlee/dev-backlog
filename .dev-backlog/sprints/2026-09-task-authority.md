---
milestone: 2026-09 task authority (wave 5)
status: completed
started: 2026-09-18
due: TBD
scope: ["skills/**", "tests/**", "docs/**", "spec/**", "README.md", "CLAUDE.md", "CHANGELOG.md", "VERSION"]
---

# task-authority

## Goal

The task authority is one `.dev-backlog/.tracker` line (absent = GitHub) and a three-verb table in SKILL.md; GitHub users see no change, Backlog.md users run with no GitHub at all, GitLab is a documented row; released as v0.15.0 (epic #472, charter rev 20).

## Plan

### Batch 1 — parallel (disjoint files: prose+spec vs scripts)

- [x] #475 charter rev 20, SKILL.md three-verb table, references/README/CLAUDE.md prose → PR #478 (merged)
- [x] #476 lib.js readTaskAuthority, sprint-state tracker field, --close-milestone guard, setup result line → PR #479 (merged)

### Batch 2 — evals, conformance, release

- [x] #477 eval scenarios, conformance before/after, release v0.15.0 → PR #480 (merged)

## Running Context

- Gate: user approved #472 verbatim on 2026-09-18; `spec/*` edits are therefore in scope for #475 (session-authored, Sol review).
- #476 is a Sonnet subagent (clear spec, ≤ 15 shipped lines); Astra review. No script may invoke `backlog` or `glab`.
- "Before" conformance for the two new scenarios runs the new eval file against the v0.14.0 SKILL.md (`git show v0.14.0:skills/dev-backlog/SKILL.md`).

## Progress

- 2026-09-18: sprint opened; epic #472, issues #475–#477, milestone 27.
- 2026-09-18: #475 merged (PR #478, Sol MERGE WITH EDITS → applied: GitLab exception stated, no gh-fixed task path, Backlog terminal-status note, stronger prose assertion). Conformance before/after done: new scenarios 12–13 FAIL on v0.14.0 SKILL.md → PASS on the new one, both models; 1–11 unchanged.
  
- 2026-09-18: #476 merged (PR #479; Astra DO NOT MERGE → direct fix: no github fallback on .tracker read errors, Object.hasOwn, dry-run covered; acceptance amended ≤ 15 → ≤ 30 shipped lines for readability). Batch 2 (#477) started.
- 2026-09-18: #477 merged (PR #480; Astra cumulative RELEASE WITH EDITS → applied: +56 script delta, fuller BREAKING note, files alias, parser parity, spec_ref precedence, README mkdir, eval 12 terminal status). Tag v0.15.0 + release published; epic #472 and milestone 27 closed.
- 2026-09-18: Sprint closed. 3/3 tasks completed.
