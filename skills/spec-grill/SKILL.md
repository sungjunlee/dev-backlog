---
name: spec-grill
argument-hint: "[natural-language request]"
description: "Create or refine spec/capabilities.md by grilling existing repo signals into capability contracts, Behaviors, and Hard Constraints. Use after spec-charter on existing repos, or when users ask for capability specs, component contracts, middle-layer specs, repo capability boundaries, 능력 명세, or grill."
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, dev-backlog, backlog-triage"
---

# Spec Grill

Author `spec/capabilities.md`, the middle layer between `spec/charter.md` and the active sprint. `spec-grill` is not a file generator; it pressure-tests existing repo signals into durable capability contracts.

Use this after `spec-charter create` on existing/brownfield repos, or whenever the user asks to define capability boundaries, component contracts, Behaviors, or Hard Constraints.

## Execution Contract

### Intent Router

Do not require users to memorize arguments. Interpret the user's request and choose the safest matching route. Power-user aliases such as `map`, `fill`, `audit`, and exact capability slugs are accepted, but they are optional shorthand, not the primary workflow.

| User intent | Route | Writes? |
|-------------|-------|---------|
| No argument, ambiguous capability request, or "look at the capabilities" | **Grill Report**: diagnose current evidence and recommend next action. | No |
| "Find capability candidates", "map repo capability boundaries", or `map` | **Candidate Boundary Report**: collect raw candidates and classify them as accepted / rejected / merged / split candidates. | No |
| "Add the next missing capability", "fill the missing capability", or `fill` | **Next Capability Proposal**: propose exactly one missing capability and ask for confirmation before editing. | Only after confirmation |
| Mentions a known capability slug or natural-language capability area | **Specific Capability Review**: resolve the mention to one capability or candidate and deep-review only that block or candidate. | No by default |
| "Audit capabilities", "find overlap", "find stale contracts", "find weak predicates", or `audit` | **Capability Audit Report**: report stale, overlapping, weak, or unsupported capability predicates. | No |

If intent is unclear, prefer report-only. If the user asks for an edit while evidence is weak, emit the report first, identify the missing evidence, and ask before writing.

Capability slugs are strict routing handles used by sprint `component:` frontmatter. Keep them lowercase and singular, then put nuance in Goal/Scope prose.

### Helper Scripts

Resolve helper scripts from the installed `spec-grill` skill directory, not from the target repo. In a source checkout, that means the local `scripts/` directory beside this `SKILL.md`. Always pass the target repo explicitly (`--repo-root <target-repo>`) so helpers do not inspect the skill directory by accident.

On a brownfield repo with no `spec/capabilities.md`, or when candidate evidence is requested, run `extract-signals.js --repo-root <target-repo> --json` first. The script reports raw capability evidence. It never writes `spec/capabilities.md`; admission, merging, splitting, and naming belong to this skill.

### Completion Contract

End every run with a short summary:

- capability blocks created or edited
- predicates rejected or rewritten
- constraints added
- raw candidates merged/split/refused
- behaviors promoted to constraints
- missing proof or evidence
- follow-up Learning Actions if any

### Grill Report Contract

Use this report shape for no-arg, ambiguous, candidate-discovery, and audit routes unless the user asks for a shorter answer:

```md
## Grill Report

### Evidence Read
- <file/script/signal and what it proves>

### Evidence Missing
- <missing charter/system-map/tests/docs/surface that weakens confidence>

### Raw Candidates
- <candidate> - evidence: <signals>; caveat: <why it is not accepted yet>

### Accepted / Rejected / Merged / Split Candidates
- Accepted: <candidate> - <reason>
- Rejected: <candidate> - <reason>
- Merged: <candidate A> + <candidate B> -> <candidate C> - <reason>
- Split: <candidate> -> <candidate A>, <candidate B> - <reason>

### Sharp Questions
- <candidate>: <pressure question that must be answered before editing>

### 3-Axis Predicate Findings
- Rejected predicates: <predicate> - failed <axis>
- Rewritten predicates: <before> -> <after>
- Behaviors promoted to constraints: <behavior> -> <constraint>
- Missing proof/evidence: <predicate> - needs <test/doc/runtime invariant/receipt>

### Proposed Next Capability
- <slug> - <why this is the next safest contract to write or revise>

### Recommended Edit
- <specific edit command or "no edit yet">
```

Separate diagnosis from mutation. The report can recommend edits, but it must not edit `spec/capabilities.md` unless the user clearly asked for editing or confirms the proposed edit.

## Brownfield Signal Rules

`extract-signals.js` draws from README, `spec/charter.md` with legacy root `CHARTER.md` fallback, `spec/system-map.md`, `CLAUDE.md`/`AGENTS.md`, top-level source dirs, skill files, script surfaces, docs, tests, and recent commit messages.

Use the draft as interview seed only. The script labels signal authority:

- README/charter/issues are product authority.
- source directories are repo-structure evidence.
- commit scopes are history.
- `CLAUDE.md`/`AGENTS.md` are development-harness context.

Harness context can seed questions about conventions and workflow, but it must not create accepted capability boundaries by itself. The script clusters evidence from code organization and command surfaces, while real capabilities are functional contracts; expect grill mode to merge, split, or regroup raw signals rather than adopt them verbatim.

## File Shape

`spec/capabilities.md` lives at the target repo root in `spec/`. The single-file shape is intentional while the spec remains compact: target 5-10 capabilities, warn above 12 capabilities or 400 lines, and split only above 500 lines, above 15 capabilities, or when ownership boundaries demand separate review paths.

The file's mutation discipline:

- Goal / In-scope / Out-of-scope: human-gated through this skill.
- Expected Behaviors / Hard Constraints: human-gated and must pass the 3-axis predicate test.
- `## Learnings`: not an interview target; appended only by the bounded Learnings writer between magic markers.
- `## Decisions`: append-only by convention; promote cross-cutting decisions to `spec/charter.md` through `spec-charter amend`.

## Capability Admission Test

Before interviewing a candidate capability, decide whether it deserves to exist. Raw extraction signals are not accepted specs.

Admit a capability only when most of these are true:

- It is a repeated decision boundary, not just a directory name or commit scope.
- It owns a primary relay-learning destination.
- Its Goal can be stated as an observable user or operator outcome.
- Its Behaviors and Hard Constraints differ meaningfully from neighboring candidates.
- If two candidates share nearly all predicates, merge them.
- If one candidate needs more than five Behaviors to feel complete, split it along the contract boundary the extra Behaviors describe.

Use this as a bloat check before the per-capability flow. A large feature-first app may have many feature folders but only 5-10 durable capability contracts.

## Per-Capability Interview Flow

For each capability, walk the user through this order; do not skip ahead:

1. **Goal** — one sentence: what the user can observe when this works. Diagnosis-side framing belongs in the charter; capability Goal is the observable outcome. Do not run Goals through the 3-axis predicate test; use plain-language observability instead.
2. **In-scope / Out-of-scope** — what this capability owns, and the boundary it deliberately respects. Out-of-scope prevents creep.
3. **Expected Behaviors** — three verifiable predicates. Each one must pass the 3-axis test below. Reject and rewrite until it does.
4. **Hard Constraints** — two bright-lines this capability never crosses, even if asked. Adversarial-Goodhart defenses live here.

Stop at three Behaviors and two Hard Constraints per capability on the first pass; more is bloat and harder to keep falsifiable. Add later via rerun.

## The 3-Axis Predicate Test

Every Behavior and Hard Constraint must pass all three axes before it is committed:

1. **Authority axis.** Would the user be unhappy if an agent satisfied this measurably but in a way that ignored their intent? If yes, encode the missing intent as a sharper Behavior or promote it to a Hard Constraint.
2. **Distributional axis.** Does this predicate hold in unseen code areas or unseen workloads? If no, restate it as environment-independent or scope it to the conditions where it holds.
3. **Manipulability axis.** Can an agent satisfy this by editing the measurement channel rather than the system? If yes, add a structural restriction outside the spec, not just sharper prose.

A predicate that passes all three is committable. A predicate that fails any axis is rewritten or split, never rubber-stamped.

Classify positive normal outcomes as Expected Behaviors. Classify bright-line negations and anti-Goodhart guards as Hard Constraints. When both forms fit, prefer the Hard Constraint only when the negative form protects against an optimization or data-loss shortcut.

## Writing Rules

When the user accepts a first capability edit and `spec/capabilities.md` is absent, copy `templates/capabilities.md` to `spec/capabilities.md` at the repo root, then write only the accepted capability. On rerun, edit only the named capability block and leave the rest of the file untouched.

After applying an accepted change, do not bump a revision number on `spec/capabilities.md`; `git blame` is the source of truth. Note in the conversation which capability was edited. Echo charter Decisions at capability level only when they explain a Behavior or Hard Constraint; promote cross-cutting capability Decisions through `spec-charter amend`.

See `references/capabilities.md` for additional grill heuristics and [`../spec-charter/SKILL.md`](../spec-charter/SKILL.md) for the project-wide charter layer.
