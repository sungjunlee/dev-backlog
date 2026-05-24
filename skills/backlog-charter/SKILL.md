---
name: backlog-charter
argument-hint: "[create|amend|grill]"
description: Create and amend CHARTER.md — a durable per-project reference axis (problem, approach, non-goals, verifiable objectives, decisions) that sprints and backlog triage are measured against. Also runs grill mode to author the middle-layer spec/capabilities.md (goal, scope, behaviors, hard constraints). Use to establish or evolve project direction, 프로젝트 축, 기준, 헌장, 능력 명세.
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

1. Draft from repo signals: `README.md` ≻ `CLAUDE.md` ≻ open epics/issues ≻ recent commits ≻ `CHANGELOG.md`. When signals conflict, surface the conflict in the interview rather than picking silently.
2. Interview the user to fill and sharpen Problem, Approach, Non-Goals, and initial Objectives. Follow the checklist in `references/create.md` — Problem framing options, the wedge test for Approach, Non-Goals elicitation, and Objective framing that cites `references/objectives.md`.
3. Write repo-root `CHARTER.md` from `templates/charter.md` with `revision: 1` and today's `last_amended`. The Decisions table may be left empty — seed 3–5 rows only when prior design docs, ADRs, or notable merged PRs already record direction; remember that whatever lands becomes immutable from revision 2.

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

After applying an accepted amendment, bump `last_amended` to today and increment `revision`. Then run `node skills/backlog-charter/scripts/check-size.js` to confirm the 5-minute-read property still holds; collapse long `deferred` lists or oversized Decisions rationale if the script warns.

Amend mode can take a `backlog-triage` Alignment Check report as a seed of proposed changes. The report proposes; this skill applies through the gates.

See `references/amendment.md` for deep challenge and proof-gate heuristics.

## Grill Mode

Use grill mode to author `spec/capabilities.md`, the middle layer between `CHARTER.md` and the active sprint. Invoked as `backlog-charter grill` (greenfield: no `spec/capabilities.md` yet) or `backlog-charter grill <capability-slug>` (rerun: polish one capability without touching others). Capability slugs are strict routing handles used by sprint `component:` frontmatter; keep them lowercase and singular, then put nuance in Goal/Scope prose.

**On a brownfield repo** (existing code, no `spec/capabilities.md`), run `node skills/backlog-charter/scripts/extract-signals.js --json` first. It draws from README, CLAUDE.md/AGENTS.md, top-level source dirs, the last 100 commit messages, and `CHARTER.md` Objectives, and proposes capability candidates with signals + draft Goal + draft Scope. Use the draft as the interview seed; grill mode still pressure-tests every Behavior and Hard Constraint through the 3-axis test before commit. The script clusters by code organization (directory names, commit scopes), while real capabilities are functional contracts; expect grill mode to merge, split, or regroup draft candidates rather than adopt them verbatim. The script never writes `spec/capabilities.md` itself — that decision belongs to grill.

`spec/capabilities.md` lives at the target repo root in `spec/`. Layout, mutation rules, and rationale are in [`docs/spec-system-design.md`](../../docs/spec-system-design.md). The single-file shape is intentional for projects with under ~20 capabilities; `split-capabilities.js` migrates to per-capability files once that threshold is crossed.

### Per-Capability Interview Flow

For each capability, walk the user through this order — do not skip ahead:

1. **Goal** — one sentence: what the user can observe when this works. Diagnosis-side framing belongs in CHARTER; capability Goal is the observable outcome.
2. **In-scope / Out-of-scope** — what this capability owns, and the boundary it deliberately respects. Out-of-scope is as important as in-scope: it prevents creep.
3. **Expected Behaviors** — three verifiable predicates. Each one must pass the 3-axis test below. Reject and rewrite until it does.
4. **Hard Constraints** — two bright-lines this capability never crosses, even if asked. Adversarial-Goodhart defenses live here.

Stop at three Behaviors and two Hard Constraints per capability on the first pass; more is bloat and harder to keep falsifiable. Add later via rerun.

### The 3-Axis Predicate Test

Every Behavior and Hard Constraint must pass all three axes before it is committed. Research grounding is in the design doc; the test in operation:

1. **Authority axis.** Would the user be unhappy if an agent satisfied this *measurably* but in a way that ignored their intent? If yes, the predicate is under-specified — encode the missing intent as a sharper Behavior or promote it to a Hard Constraint. (Defends against misspecification.)
2. **Distributional axis.** Does this predicate hold in unseen code areas or unseen workloads? If no, restate it as environment-independent — or scope it to the conditions where it holds. (Defends against goal misgeneralization.)
3. **Manipulability axis.** Can an agent satisfy this by editing the measurement channel rather than the system? If yes, the predicate is gameable — add a *structural* restriction outside the spec, not just sharper prose. (Defends against adversarial Goodhart.)

A predicate that passes all three is committable. A predicate that fails any axis is rewritten or split — never rubber-stamped.

### Tier Gates

Grill mode applies the same challenge + confirm + apply discipline used by amend mode:

- Goal / In-scope / Out-of-scope are Tier-1-equivalent: challenge before applying. Default to no change.
- Behaviors / Hard Constraints are Tier-2-equivalent: each must pass the 3-axis test. The test is the proof gate.
- `## Learnings` and `## Decisions` are **not** interview targets. Learnings are appended by the bounded `append-learnings` writer between magic markers (`<!-- LEARN:BEGIN -->` / `<!-- LEARN:END -->`); Decisions are append-only by convention. Grill mode never edits either.

### Writing the File

On first run, copy `templates/capabilities.md` to `spec/capabilities.md` at the repo root, then walk the interview for one capability. On rerun (`grill <capability-slug>`), edit only the named capability block; leave the rest of the file untouched. If `spec/capabilities.md` does not exist on a rerun invocation, fall back to greenfield mode and surface the absence.

After applying an accepted change, do **not** bump a revision number on `spec/capabilities.md` — `git blame` is the source of truth (per design doc §"NOT in scope"). Note in the conversation which capability was edited.

See `references/capabilities.md` for additional grill heuristics (placeholder on day 1 — expand as findings accrue).

## References

- `references/create.md` — create-mode signals priority, conflict handling, interview checklist, seed-Decisions guidance.
- `references/amendment.md` — challenge checklist, proof-gate rules, no-rubber-stamp discipline, and bloat checks.
- `references/alignment.md` — shared work↔objective mapping logic consumed by `backlog-triage` and `dev-backlog`.
- `references/objectives.md` — verifiable-predicate examples (5 good, 5 bad), common rewrite patterns, 30-second test.
- `references/capabilities.md` — grill-mode heuristics for `spec/capabilities.md` authoring (placeholder; expand as findings accrue).
- `references/spec-system-research.md` — research grounding for the layered spec system (autonomous-agent failure taxonomy, control-theory framing, spec-language stability discipline).
