---
name: backlog-charter
argument-hint: "[create|amend]"
description: Create and amend CHARTER.md — a durable per-project reference axis (problem, approach, non-goals, verifiable objectives, decisions) that sprints and backlog triage are measured against. Use to establish or evolve project direction, 프로젝트 축, 기준, 헌장.
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "dev-backlog, backlog-triage"
---

# Backlog Charter

Create and amend `CHARTER.md`, the opt-in project reference axis used to measure backlog work, sprint plans, and drift. This skill is rerunnable and routes on file state: no repo-root `CHARTER.md` means create mode; an existing repo-root `CHARTER.md` means amend mode.

## What CHARTER.md Is

`CHARTER.md` lives at the target repo root as a peer of `README.md`. It records what good looks like: the problem, approach, explicit non-goals, verifiable objectives, and immutable decision history the backlog is measured against.

Absence is supported. Projects opt in by creating the file; other skills degrade gracefully when it is missing. Keep the charter under a ~5-minute read. Operational know-how does not belong here; put rediscovery-prone HOW-knowledge in `_context.md`.

| File | Question it answers |
|------|---------------------|
| `CHARTER.md` | What good looks like / why (the yardstick) |
| `_context.md` | Operational facts you would otherwise rediscover (HOW-knowledge) |
| `CLAUDE.md` | How to work in this repo (conventions) |
| `README.md` | Outward-facing introduction |

## 3 Tiers

| Tier | Sections | Mutation discipline | Rationale |
|------|----------|---------------------|-----------|
| **1 · Direction** | Problem, Approach, Non-Goals | Human-gated: propose → confirm → apply. Slowest-moving — the core that survives if scope shrinks. | A stable core is what makes the moving parts meaningful. |
| **2 · Predicates** | Objectives | Status advance (`active`→`validated`/`deferred`) requires **proof**. Adding/removing an objective is human-gated. | "You cannot evolve the axis to declare victory — you must prove it." (gsd-2) |
| **3 · History** | Decisions | **Append-only.** Never edit or delete a row; reverse via a new `supersedes` row. | Provenance is immutable. |

A stable core makes the moving parts meaningful. This tiering prevents the axis from self-evolving into a rubber-stamp: direction changes are gated, objective status requires proof, and history is frozen.

## Create Mode

Use create mode when `CHARTER.md` is absent at the repo root, or when invoked as `backlog-charter create` and no charter exists.

1. Draft from repo signals: `README.md`, `CLAUDE.md`, open epics/issues, and recent commits.
2. Interview the user to fill and sharpen Problem, Approach, Non-Goals, and initial Objectives.
3. Write repo-root `CHARTER.md` from `templates/charter.md` with `revision: 1` and today's `last_amended`.

Objective conventions:

- State objectives as verifiable predicates, not tasks.
- Mixed rigor is allowed: a runnable check is ideal, but an observable statement is acceptable.
- Use `O<n>` IDs for traceability.
- Never reuse a removed objective ID; new objectives take the next free number.
- Record provenance with `src:` (`user`, `inferred`, or `execution`).

See `references/objectives.md` for 5 good and 5 bad worked examples, common rewrite patterns, and a 30-second predicate test.

## Amend Mode

Use amend mode when `CHARTER.md` exists at the repo root, or when invoked as `backlog-charter amend`.

First re-read the current `CHARTER.md`. Direct hand-edits are allowed because it is the user's file; this skill is the disciplined path for applying the tier gates.

Apply the 3-tier discipline:

- Tier 1 plus objective add/remove: surface stale or weak items, challenge them, propose concrete diffs, confirm with the user, then apply. Do not rubber-stamp.
- Tier 2 status advance: require proof for `active` → `validated` or `deferred`; cite a merged PR, passing check, or relay run whose Done Criteria match the predicate. Without proof, refuse the advance and flag it.
- Tier 3 Decisions: append only. Never edit or delete an existing row; a reversal is a new row with `supersedes`.

After applying an accepted amendment, bump `last_amended` to today and increment `revision`.

Amend mode can take a `backlog-triage` Alignment Check report as a seed of proposed changes. The report proposes; this skill applies through the gates.

See `references/amendment.md` for deep challenge and proof-gate heuristics.

## References

- `references/amendment.md` — challenge checklist, proof-gate rules, no-rubber-stamp discipline, and bloat checks.
- `references/alignment.md` — shared work↔objective mapping logic consumed by `backlog-triage` and `dev-backlog`.
- `references/objectives.md` — verifiable-predicate examples (5 good, 5 bad), common rewrite patterns, 30-second test.
