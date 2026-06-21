---
name: spec-charter
argument-hint: "[create|amend|reassess]"
description: "Create, amend, and reassess spec/charter.md as the project-wide spec axis. Use to establish or evolve project direction, Objectives, Non-Goals, Decisions, stale spec findings, project charter, 기준, 헌장, 방향성, spec axis."
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-system-map, spec-grill, dev-backlog, backlog-triage"
---

# Spec Charter

Create and amend `spec/charter.md`, the opt-in project reference axis used to measure backlog work, sprint plans, and drift. This skill is rerunnable.

`spec/charter.md` is the first layer, not the whole large-repo spec. On existing/brownfield repos, finish create mode by recommending `spec-system-map` for `spec/system-map.md` and `spec-grill` for `spec/capabilities.md` from real repo signals.

## Execution Contract

### Mode Router

Explicit modes win first:

| User intent | Mode | Boundary |
|-------------|------|----------|
| Create the project axis, baseline, charter, or first spec layer | `create` | Only when neither `spec/charter.md` nor legacy root `CHARTER.md` exists, unless the user explicitly asks to replace it. |
| Update direction, objectives, decisions, or accepted charter wording | `amend` | Applies tier gates and may edit the resolved charter after confirmation. |
| Check whether charter/capabilities/Learnings are stale or should change | `reassess` | Report-only; routes accepted fixes to `spec-charter amend`, `spec-grill`, or a Learning Action. |

When no mode is specified, route by intent first, then use file state only for generic charter requests: prefer `spec/charter.md`; fall back to legacy root `CHARTER.md`; if neither exists, use create mode. If the user asks for capability contracts, component boundaries, or `spec/capabilities.md`, route to `spec-grill`.

### Helper Scripts

Resolve helper scripts from the installed `spec-charter` skill directory, not from the target repo. In a source checkout, that means the local `scripts/` directory beside this `SKILL.md`; in an installed skill, first locate the skill directory and run the same script from there. Always pass the target repo explicitly (`--path <target-repo>/spec/charter.md`) so helpers do not inspect the skill directory by accident. If a helper is unavailable, report **Missing Evidence** and continue with bounded file reads.

### Completion Contract

End every mode with a short summary:

- `create`: created files, unresolved assumptions, and a concrete next natural-language action. On brownfield repos, recommend creating `spec/system-map.md` before asking `spec-grill` to review capability boundaries.
- `amend`: accepted changes, refused/parked changes, proof cited for status advances, and size-check result.
- `reassess`: required report sections from the Reassess Mode dispatch contract, with one recommended next natural-language action.

When recommending follow-up spec work, do not require users to memorize downstream arguments such as `map`, `fill`, or `audit`. Prefer plain actions like "create the system map" or "ask spec-grill to review candidate capability boundaries." Include 2-5 candidate boundary names only when they are supported by evidence from README, `spec/system-map.md`, scripts, tests, docs, or recent commit scopes.

## What spec/charter.md Is

`spec/charter.md` lives in the target repo's project spec directory. It records what good looks like: the problem, approach, explicit non-goals, verifiable objectives, and immutable decision history the backlog is measured against.

Absence is supported. Projects opt in by creating the file; other skills degrade gracefully when it is missing. Legacy root `CHARTER.md` is read as a fallback and should be migrated deliberately. Keep the charter under a ~5-minute read. Operational know-how does not belong here; put rediscovery-prone HOW-knowledge in `_context.md`.

Use `references/spec-axis.md` as the shared boundary for charter, system-map, capabilities, sprint context, task mirrors, triage reports, harness files, and README authority.

## 3 Tiers

| Tier | Sections | Mutation discipline | Rationale |
|------|----------|---------------------|-----------|
| **1 · Direction** | Problem, Approach, Non-Goals | Human-gated: propose -> confirm -> apply. Slowest-moving: the core that survives if scope shrinks. | A stable core is what makes the moving parts meaningful. |
| **2 · Predicates** | Objectives | Status advance (`active` -> `validated`/`deferred`) requires **proof**. Adding/removing an objective is human-gated. | You cannot evolve the axis to declare victory; you must prove it. |
| **3 · History** | Decisions | **Append-only.** Never edit or delete a row; reverse via a new `supersedes` row. | Provenance is immutable. |

This tiering prevents the axis from self-evolving into a rubber-stamp: direction changes are gated, objective status requires proof, and history is frozen.

## Create Mode

Use create mode when neither `spec/charter.md` nor legacy root `CHARTER.md` exists, or when invoked as `spec-charter create` and no charter exists.

1. Draft from repo signals: product/user-facing signals (`README.md`, open epics/issues, `CHANGELOG.md`) before development-harness signals (`CLAUDE.md`, `AGENTS.md`). Harness files may inform workflow conventions, local commands, and repo-specific guardrails, but they do not override README, charter, issues, code structure, or user interview answers for product/capability authority unless they explicitly describe product boundaries. When signals conflict, surface the conflict in the interview rather than picking silently.
2. Interview the user to fill and sharpen Problem, Approach, Non-Goals, and initial Objectives. Follow the checklist in `references/create.md`: Problem framing options, the wedge test for Approach, Non-Goals elicitation, and Objective framing that cites `references/objectives.md`.
3. Create `spec/` if needed, then write `spec/charter.md` from `templates/charter.md` with `revision: 1` and today's `last_amended`. The Decisions table may be left empty. Seed 3-5 rows only when prior design docs, ADRs, or notable merged PRs already record direction; whatever lands becomes immutable from revision 2.
4. If the target repo is brownfield, recommend `spec-system-map` as the next step when `spec/system-map.md` is absent. After the map exists, recommend asking `spec-grill` to review candidate capability boundaries. Brownfield signals include existing source roots (`src/`, `app/`, `lib/`, `packages/`, `skills/`), commit history, tests/scripts/config, open issues, or multiple top-level feature/workflow surfaces.

Objective conventions:

- State objectives as verifiable predicates, not tasks.
- Mixed rigor is allowed: a runnable check is ideal, but an observable statement is acceptable.
- Use `O<n>` IDs for traceability.
- Never reuse a removed objective ID; new objectives take the next free number.
- Record provenance with `src:` (`user`, `inferred`, or `execution`).

See `references/objectives.md` for worked examples, rewrite patterns, and a 30-second predicate test.

## Amend Mode

Use amend mode when `spec/charter.md` exists, legacy root `CHARTER.md` exists, or when invoked as `spec-charter amend`.

First re-read `spec/charter.md`. If it is absent but root `CHARTER.md` exists, read that legacy file, state that the canonical path is now `spec/charter.md`, and recommend migrating before or during the accepted amendment. Direct hand-edits are allowed because it is the user's file; this skill is the disciplined path for applying the tier gates.

Apply the 3-tier discipline:

- Tier 1 plus objective add/remove: surface stale or weak items, challenge them, propose concrete diffs, confirm with the user, then apply. Do not rubber-stamp.
- Tier 2 status advance: require proof for `active` -> `validated` or `deferred`; cite a merged PR, passing check, or relay run whose Done Criteria match the predicate. Without proof, refuse the advance and flag it.
- Tier 3 Decisions: append only. Never edit or delete an existing row; a reversal is a new row with `supersedes`.

After applying an accepted amendment, bump `last_amended` to today and increment `revision`. Then run `check-size.js --path <target-repo>/spec/charter.md` from the installed skill's `scripts/` directory to confirm the 5-minute-read property still holds; collapse long `deferred` lists or oversized Decisions rationale if the script warns.

Amend mode can take a `backlog-triage` Alignment Check report as a seed of proposed changes. The report proposes; this skill applies through the gates.

See `references/amendment.md` for deep challenge and proof-gate heuristics.

## Reassess Mode

Use reassess mode when the user asks whether `spec/charter.md`, `spec/system-map.md`, or `spec/capabilities.md` is stale, asks to review Learnings, wants a periodic spec health check, or when major model/tool/harness changes could alter how agents interpret repo context.

Reassess never edits files. It diagnoses drift and recommends next actions; accepted fixes must run through `spec-charter amend`, `spec-system-map amend`, `spec-grill <capability>`, or a separate user-approved Learning Action.

If reassess finds that `spec/system-map.md` is missing on a brownfield repo, recommend creating the system map before capability grilling. If `spec/system-map.md` exists and `spec/capabilities.md` is missing or thin, recommend asking `spec-grill` to review the candidate capability boundaries. Name concrete candidates only when evidence supports them; otherwise say which evidence is missing.

Dispatch contract:

1. Resolve helper scripts from the installed dev-backlog skill directory; if unavailable, report **Missing Evidence**.
2. Start with bounded evidence: `capabilities-doctor.js --json`, `component-lint.js --json`, named charter, system-map, or capability sections, the active sprint, and at most the latest five completed sprint files.
3. Emit these report sections: **Evidence**, **No Change**, **System Map Candidates**, **Grill Candidates**, **Amend Candidates**, **Learning Actions**, **Missing Evidence**, **Recommended Next Step**.
4. Use `references/reassess.md` as the source of truth for evidence order, report shape, recommendation rules, Learning Actions, and stale-spec failure modes.

## References

- `references/create.md` — create-mode signals priority, conflict handling, interview checklist, seed-Decisions guidance.
- `references/amendment.md` — challenge checklist, proof-gate rules, no-rubber-stamp discipline, and bloat checks.
- `references/alignment.md` — shared work-to-objective mapping logic consumed by `backlog-triage` and `dev-backlog`.
- `references/objectives.md` — verifiable-predicate examples, common rewrite patterns, 30-second test.
- `references/reassess.md` — report-only stale-spec reassessment: evidence sources, output shape, Learning Actions, and failure modes.
- `references/spec-axis.md` — shared file-boundary and authority rules for the spec axis and backlog artifacts.
- [`../spec-system-map/SKILL.md`](../spec-system-map/SKILL.md) — companion skill for authoring `spec/system-map.md`.
- [`../spec-grill/SKILL.md`](../spec-grill/SKILL.md) — companion skill for authoring `spec/capabilities.md`.
