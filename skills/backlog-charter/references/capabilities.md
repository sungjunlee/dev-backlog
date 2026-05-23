# Grill-Mode Heuristics for `spec/capabilities.md`

Use this reference in `backlog-charter` grill mode after walking the per-capability interview flow in `SKILL.md`. It is a placeholder on day 1 — expand as real grill sessions surface findings that future authors should not have to re-discover.

The interview flow itself, the 3-axis predicate test, and the tier-gate discipline live in `SKILL.md`. This doc is for the *deltas* — concrete patterns that work, anti-patterns that look reasonable but burn an agent down the line, examples of capabilities that survived a grill round and ones that did not.

## What belongs here (planned)

- **Capability-naming patterns** — when to use a subsystem name (`sync-pull`) vs. a verb-phrase (`pulling open issues`) vs. an outcome (`fresh task mirror`). Bias: name the *contract*, not the implementation.
- **Goal-line worked examples** — diagnosis-side framing leaking into Goal is the most common first-draft failure. Three or four real grill rewrites of bad Goal lines into good ones.
- **3-axis test in action** — concrete predicates that fail the manipulability axis (and the structural restriction that fixed each one). Mostly TBD until PR-3 is dogfooded; until then, lean on `references/spec-system-research.md` for the theory.
- **Hard Constraint anti-patterns** — "never do X unless asked" is not a Hard Constraint (asking is the loophole). Hard Constraints are unconditional; if they have an escape clause, they belong in Behaviors instead.
- **Rerun protocol details** — what `grill <capability-name>` is allowed to touch and what it must leave alone. Especially: never re-grill `## Learnings` or `## Decisions`.
- **Capability-count guidance** — at what point this single file should be split via `split-capabilities.js`, and what the migration looks like in practice.

## What does not belong here

- **The 3-axis predicate test itself.** Lives in `SKILL.md` so it is always loaded with the skill.
- **The mutation discipline table.** Lives in `templates/capabilities.md` so authors see it when they open the file.
- **Research grounding.** Lives in `references/spec-system-research.md` — cite, do not duplicate.
- **Architecture rationale.** Lives in `docs/spec-system-design.md` — cite, do not duplicate.

## Until this file is rich

Run grill mode against `SKILL.md` alone. The interview flow, the 3-axis test, and the tier gates are sufficient for the first few capabilities. Capture surprises from real grill sessions back into this doc — the most valuable entries are the ones a single user already had to learn the hard way.
