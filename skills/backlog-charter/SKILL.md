---
name: backlog-charter
argument-hint: "[create|amend|grill|reassess]"
description: "Create, amend, grill, and reassess the project spec axis: CHARTER.md plus spec/capabilities.md. Use to establish or evolve project direction, author capability contracts, review stale specs, recommend Learning Actions, or decide whether Behaviors/Constraints still match execution evidence. 프로젝트 축, 기준, 헌장, 능력 명세, stale spec, spec reassess."
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "dev-backlog, backlog-triage"
---

# Backlog Charter

Create and amend `CHARTER.md`, the opt-in project reference axis used to measure backlog work, sprint plans, and drift. This skill is rerunnable.

## Execution Contract

### Mode Router

Explicit modes win first:

| User intent | Mode | Boundary |
|-------------|------|----------|
| Create the project axis, baseline, charter, or first spec foundation | `create` | Only when repo-root `CHARTER.md` is absent, unless the user explicitly asks to replace it. |
| Update direction, objectives, decisions, or accepted charter wording | `amend` | Applies tier gates and may edit `CHARTER.md` after confirmation. |
| Create or refine `spec/capabilities.md`, capability contracts, Behaviors, or Hard Constraints | `grill` | Edits only the requested capability on rerun. |
| Check whether charter/capabilities/Learnings are stale or should change | `reassess` | Report-only; routes accepted fixes to amend, grill, or a Learning Action. |

When no mode is specified, route by intent first, then use file state only for generic charter requests: no repo-root `CHARTER.md` means create mode, and an existing repo-root `CHARTER.md` means amend mode. If the request mixes diagnosis and edits, run `reassess` first unless the user explicitly asks to apply a known change. If the request could affect both `CHARTER.md` and `spec/capabilities.md`, ask one bounded routing question before editing.

### Helper Scripts

Resolve helper scripts from the installed `backlog-charter` skill directory, not from the target repo. In a source checkout, that means the local `scripts/` directory beside this `SKILL.md`; in an installed skill, first locate the skill directory and run the same script from there. Always pass the target repo explicitly (`--path <target-repo>/CHARTER.md` or `--repo-root <target-repo>`) so helpers do not inspect the skill directory by accident. If a helper is unavailable, report **Missing Evidence** and continue with bounded file reads.

### Completion Contract

End every mode with a short summary:

- `create`: created files, unresolved assumptions, and the first suggested `grill` or `amend` follow-up.
- `amend`: accepted changes, refused/parked changes, proof cited for status advances, and size-check result.
- `grill`: capability blocks created or edited, predicates rejected or rewritten, constraints added, and follow-up Learning Actions if any.
- `reassess`: required report sections from the Reassess Mode dispatch contract, with one recommended next step.

## What CHARTER.md Is

`CHARTER.md` lives at the target repo root as a peer of `README.md`. It records what good looks like: the problem, approach, explicit non-goals, verifiable objectives, and immutable decision history the backlog is measured against.

Absence is supported. Projects opt in by creating the file; other skills degrade gracefully when it is missing. Keep the charter under a ~5-minute read. Operational know-how does not belong here; put rediscovery-prone HOW-knowledge in `_context.md`.

| File | Question it answers |
|------|---------------------|
| `CHARTER.md` | What good looks like / why (the yardstick) |
| `_context.md` | Operational facts you would otherwise rediscover (HOW-knowledge) |
| `CLAUDE.md` / `AGENTS.md` | How agents work in this repo (development harness; not product authority by default) |
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

1. Draft from repo signals: product/user-facing signals (`README.md`, open epics/issues, `CHANGELOG.md`) before development-harness signals (`CLAUDE.md`, `AGENTS.md`). Harness files may inform workflow conventions, local commands, and repo-specific guardrails, but they do not override README, CHARTER, issues, code structure, or user interview answers for product/capability authority unless they explicitly describe product boundaries. When signals conflict, surface the conflict in the interview rather than picking silently.
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

After applying an accepted amendment, bump `last_amended` to today and increment `revision`. Then run `check-size.js --path <target-repo>/CHARTER.md` from the installed skill's `scripts/` directory to confirm the 5-minute-read property still holds; collapse long `deferred` lists or oversized Decisions rationale if the script warns.

Amend mode can take a `backlog-triage` Alignment Check report as a seed of proposed changes. The report proposes; this skill applies through the gates.

See `references/amendment.md` for deep challenge and proof-gate heuristics.

## Grill Mode

Use grill mode to author `spec/capabilities.md`, the middle layer between `CHARTER.md` and the active sprint. Invoked as `backlog-charter grill` (greenfield: no `spec/capabilities.md` yet) or `backlog-charter grill <capability-slug>` (rerun: polish one capability without touching others). Capability slugs are strict routing handles used by sprint `component:` frontmatter; keep them lowercase and singular, then put nuance in Goal/Scope prose.

**On a brownfield repo** (existing code, no `spec/capabilities.md`), run `extract-signals.js --repo-root <target-repo> --json` from the installed skill's `scripts/` directory first. It draws from README, CLAUDE.md/AGENTS.md, top-level source dirs, the last 100 commit messages, and `CHARTER.md` Objectives, and reports raw capability signals with draft Goal + draft Scope. Use the draft as interview seed only; grill mode still pressure-tests every admitted capability through the admission test and then pressure-tests every Behavior and Hard Constraint through the 3-axis test before commit. The script labels signal authority: README/CHARTER/issues are product authority, source directories are repo-structure evidence, commit scopes are history, and CLAUDE.md/AGENTS.md are development-harness context. Harness context can seed questions about conventions and workflow, but it must not create accepted capability boundaries by itself. The script clusters by code organization (directory names, commit scopes), while real capabilities are functional contracts; expect grill mode to merge, split, or regroup raw signals rather than adopt them verbatim. The script never writes `spec/capabilities.md` itself — that decision belongs to grill.

`spec/capabilities.md` lives at the target repo root in `spec/`. Layout, mutation rules, and rationale are in [`docs/spec-system-design.md`](../../docs/spec-system-design.md). The single-file shape is intentional while the spec remains compact: target 5-10 capabilities, warn above 12 capabilities or 400 lines, and split only above 500 lines, above 15 capabilities, or when ownership boundaries demand separate review paths.

### Capability Admission Test

Before interviewing a candidate capability, decide whether it deserves to exist. Raw extraction signals are not accepted specs.

Admit a capability only when most of these are true:

- It is a repeated decision boundary, not just a directory name or commit scope.
- It owns a primary relay-learning destination.
- Its Goal can be stated as an observable user or operator outcome.
- Its Behaviors and Hard Constraints differ meaningfully from neighboring candidates.
- If two candidates share nearly all predicates, merge them.
- If one candidate needs more than five Behaviors to feel complete, split it along the contract boundary the extra Behaviors describe.

Use this as a bloat check before the per-capability flow. dev-backlog's five capabilities are contract surfaces; a large feature-first app may have many feature folders but only 5-10 durable capability contracts.

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
- `## Learnings` and `## Decisions` are **not** interview targets. Learnings are appended by the bounded `append-learnings` writer between magic markers (`<!-- LEARN:BEGIN -->` / `<!-- LEARN:END -->`); Decisions are append-only by convention. Grill mode never edits either, but it may recommend a user-approved Learning Action when a capability has more than 5-7 inline Learnings.

### Writing the File

On first run, copy `templates/capabilities.md` to `spec/capabilities.md` at the repo root, then walk the interview for one capability. On rerun (`grill <capability-slug>`), edit only the named capability block; leave the rest of the file untouched. If `spec/capabilities.md` does not exist on a rerun invocation, fall back to greenfield mode and surface the absence.

After applying an accepted change, do **not** bump a revision number on `spec/capabilities.md` — `git blame` is the source of truth (per design doc §"NOT in scope"). Note in the conversation which capability was edited.

See `references/capabilities.md` for additional grill heuristics (placeholder on day 1 — expand as findings accrue).

## Reassess Mode

Use reassess mode when the user asks whether `CHARTER.md` or `spec/capabilities.md` is stale, asks to review Learnings, wants a periodic spec health check, or when major model/tool/harness changes could alter how agents interpret repo context.

Reassess never edits files. It diagnoses drift and recommends next actions; accepted fixes must run through `backlog-charter amend`, `backlog-charter grill <capability>`, or a separate user-approved Learning Action.

Dispatch contract:

1. Resolve helper scripts from the installed dev-backlog skill directory; if unavailable, report **Missing Evidence**.
2. Start with bounded evidence: `capabilities-doctor.js --json`, `component-lint.js --json`, named CHARTER/capability sections, the active sprint, and at most the latest five completed sprint files.
3. Emit these report sections: **Evidence**, **No Change**, **Grill Candidates**, **Amend Candidates**, **Learning Actions**, **Missing Evidence**, **Recommended Next Step**.
4. Use `references/reassess.md` as the source of truth for evidence order, report shape, recommendation rules, Learning Actions, and stale-spec failure modes.

## References

- `references/create.md` — create-mode signals priority, conflict handling, interview checklist, seed-Decisions guidance.
- `references/amendment.md` — challenge checklist, proof-gate rules, no-rubber-stamp discipline, and bloat checks.
- `references/alignment.md` — shared work↔objective mapping logic consumed by `backlog-triage` and `dev-backlog`.
- `references/objectives.md` — verifiable-predicate examples (5 good, 5 bad), common rewrite patterns, 30-second test.
- `references/capabilities.md` — grill-mode heuristics for `spec/capabilities.md` authoring (placeholder; expand as findings accrue).
- `references/reassess.md` — report-only stale-spec reassessment: evidence sources, output shape, Learning Actions, and failure modes.
- `references/spec-system-research.md` — research grounding for the layered spec system (autonomous-agent failure taxonomy, control-theory framing, spec-language stability discipline).
