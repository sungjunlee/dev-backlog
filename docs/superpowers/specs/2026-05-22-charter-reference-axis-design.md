# CHARTER — Durable Project Reference Axis — Design

**Date:** 2026-05-22
**Status:** Approved design — ready for implementation plan
**Target repo:** `dev-backlog`

## Context & Motivation

The dev-backlog + dev-relay suite handles long-running task execution well, but a
gap surfaced as projects grow older and larger: there is **no durable
project-level reference artifact**. Epics and issues accumulate bottom-up; every
new sprint derivation re-analyzes the backlog from scratch; and there is no
stable yardstick to answer "is this project still going the right way?"

Two felt problems trace to the same missing artifact:

- **Drift / disorientation** — without a top-down reference, the backlog drifts
  with no way to detect it. Sprint derivation is repeated subjective
  re-interpretation. ("Am I on track?" is unanswerable.)
- **Unsafe long autonomy** — a multi-day autonomous `/goal` run needs a durable,
  verifiable anchor to survive context resets; a one-sentence prose sprint goal
  is the `/goal` evaluator-gaming failure mode waiting to happen.

The diagnosis is **not** a missing containment layer ("an objective that holds 3
sprints"). It is a missing **reference axis** — orthogonal to the containment
hierarchy — that epics, sprints, and "on track" checks are all *measured
against*. dev-relay already proves the pattern at the leaf level (frozen Done
Criteria + scored rubric + independent review). This design lifts that pattern
to the project level.

Prior-art survey (spec-kit Constitution, compound-engineering `STRATEGY.md`,
GSD/gsd-2 `PROJECT.md`+`REQUIREMENTS.md`, ceos V/TO, conductor `product.md`,
goal-md `GOAL.md`, Fractal) converged on a single design: one lean per-project
axis file with graded self-evolution. Tools that own the whole lifecycle
(Fractal, gsd-2) were rejected as integration targets — they conflict with the
GitHub-Issues-anchored dev-backlog model. Patterns are absorbed, not integrated.

## Goal

Add an opt-in, per-project **CHARTER.md** reference axis plus the lean tooling
to create it, keep it honestly self-evolving, and measure the backlog against
it — so every sprint derivation anchors to a stable yardstick and drift becomes
visible.

## Scope

**In scope (this spec):**

- `CHARTER.md` — a 3-tier reference-axis artifact + its template
- `backlog-charter` — a new rerunnable skill that creates and amends `CHARTER.md`
- dev-backlog `sprint-init` reads `CHARTER.md` (sprint ↔ objective traceability)
- backlog-triage gains an **Alignment Check** measured against `CHARTER.md`
- a shared `alignment.md` reference consumed by both skills
- graceful degradation when no `CHARTER.md` exists

**Out of scope (deferred to a follow-up spec):**

- Automated `reassess` wired into `relay-merge` / sprint completion — this spec
  delivers the *manual* self-evolution loop only
- `/goal` completion-condition emission from `CHARTER.md` + sprint
- Independent-review routing of charter mutations (relay-review style)
- Mandatory issue ↔ objective tagging

## Artifact — `CHARTER.md`

**Name & location:** `CHARTER.md` at repo root (a peer of `README.md`, so the
axis is visible). A project charter — purpose, scope, boundaries, objectives —
describes the file literally, not metaphorically.

**Opt-in:** per project. Absence is a supported state; tooling degrades
gracefully (see Edge Cases).

**Property to protect:** under ~5-minute read. Operational know-how does not
belong here — see Document Roles.

### Schema

```markdown
---
last_amended: 2026-05-22
revision: 3
---

# <Project> Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
<1-2 sentences: the problem this project exists to solve. Diagnosis only,
no solution language.>

## Approach           <!-- Tier 1 · Direction (human-gated) -->
<1-2 sentences: the guiding policy — how the problem is being solved.>

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- <something deliberately not done> — <reason>

## Objectives         <!-- Tier 2 · Predicates (add/remove human-gated; status proof-gated) -->
- O1 [active]    <verifiable predicate, e.g. "a user can log in with Google"> · src: user
- O2 [validated] <predicate> · src: execution
- O3 [deferred]  <predicate> — <why deferred>

## Decisions          <!-- Tier 3 · History (immutable, append-only) -->
| date       | decision   | rationale   | supersedes |
|------------|------------|-------------|------------|
| 2026-05-01 | <decision> | <rationale> | —          |
```

### The 3 tiers (decay rate = mutation discipline)

| Tier | Sections | Mutation discipline | Rationale |
|------|----------|---------------------|-----------|
| **1 · Direction** | Problem, Approach, Non-Goals | Human-gated: propose → confirm → apply. Slowest-moving — the core that survives if scope shrinks. | A stable core is what makes the moving parts meaningful. |
| **2 · Predicates** | Objectives | Status advance (`active`→`validated`/`deferred`) requires **proof**. Adding/removing an objective is human-gated. | "You cannot evolve the axis to declare victory — you must prove it." (gsd-2) |
| **3 · History** | Decisions | **Append-only.** Never edit or delete a row; reverse via a new `supersedes` row. | Provenance is immutable. |

The tiered discipline is the safeguard against the axis self-evolving into a
rubber-stamp ("the agent fixing its own telescope"): refinement is cheap, a
direction change is gated, history is frozen.

### Objective conventions

- Stated as **verifiable predicates** ("a user can X"), never tasks
  ("implement X").
- **Mixed rigor allowed** — a runnable check is ideal, but an "observable"
  statement is acceptable (mirrors relay rubric's automated + evaluated
  factors). Not everything has a natural scalar metric.
- `O<n>` IDs are for traceability (sprints and the Alignment Check reference
  them). A removed objective's ID is **never reused** — this avoids stale
  references in old sprint files. New objectives take the next free number.
- `src:` records provenance (`user` / `inferred` / `execution`).

## Skill — `backlog-charter`

A new skill in the `dev-backlog` repo (third skill, alongside `dev-backlog` and
`backlog-triage`; `backlog-` prefix matches `backlog-triage`). It owns the
create and amend lifecycle of `CHARTER.md`. Rerunnable — it routes on
`CHARTER.md` file state.

**Structure:** `SKILL.md` + `templates/charter.md` + `references/`
(amendment-challenge guidance, and the shared `alignment.md` — see Integration).
Prompt-driven; scripts kept minimal (e.g. a revision-bump helper if warranted).

### Create mode (`CHARTER.md` absent)

1. Draft from repo signals — `README.md`, `CLAUDE.md`, open epics/issues,
   recent commits.
2. Interview the user to fill and sharpen Problem, Approach, Non-Goals, and the
   initial Objectives.
3. Write `CHARTER.md` with `revision: 1`.

### Amend mode (`CHARTER.md` present)

Re-read `CHARTER.md` and current state, then enforce the 3-tier discipline:

- **Tier 1 + objective add/remove:** surface stale/weak sections, **challenge**
  them (re-apply pushback — never rubber-stamp), propose concrete diffs, confirm
  with the user, apply.
- **Tier 2 status advance:** require **proof** — cite the merged PR, passing
  check, or relay run that validates the predicate. Without proof, refuse the
  advance and flag it.
- **Tier 3 Decisions:** append-only. Add new decisions; never touch existing
  rows; reversal is a new `supersedes` row.
- Bump `last_amended` and `revision`.

`backlog-charter` is the **disciplined write path**. Direct hand-edits of
`CHARTER.md` are allowed (it is the user's markdown file, single source of
truth — no reconciliation machinery needed); the skill is simply the path that
enforces tier discipline, the challenge step, and the proof gate.

### Self-evolution loop

The amend mode closes a **detect → propose → gated-apply** loop, human-triggered
in this spec's scope:

1. `backlog-triage` Alignment Check **detects** drift (orphan work, neglected
   objectives, contradictions).
2. The triage report **proposes** concrete `CHARTER.md` changes.
3. The user runs `backlog-charter` amend, which can take those proposals as a
   seed and **applies** them through the tier gates.

This is the "natural self-evolution" requirement satisfied without making the
axis freely writable or freezing it read-only. (The *automated* trigger —
running this loop at `relay-merge` — is deferred to a follow-up spec; in this
spec the human is the gate, so gsd-2's "self-judging reassessment" weakness does
not apply.)

## Integration

### dev-backlog `sprint-init` reads `CHARTER.md`

`sprint-init` gains one step: read the `active` Objectives, and derive the
sprint as the projection of those objectives onto not-yet-done work. The sprint
file records which objectives it advances in its frontmatter —
`objectives: [O1, O3]` (frontmatter is the canonical location, since sprint
files already carry frontmatter and it is machine-readable). This replaces
from-scratch backlog re-interpretation with "read CHARTER, the gap is the
sprint."

### backlog-triage Alignment Check

`backlog-triage` gains a CHARTER-aware pass. It reads `CHARTER.md`, maps every
open issue/epic to objective ID(s), and adds to the triage report:

- **orphan work** — an issue mapping to no objective → flag ("add an objective,
  or drop the issue?")
- **neglected objective** — an `active` objective with no open issue advancing
  it → flag
- **contradiction** — an issue that violates a Non-Goal → flag (highest
  severity)
- **coverage line** — e.g. `"7/9 open issues → objectives ✓ · O3 has no work ⚠"`
- **proposed CHARTER changes** — the findings above, formatted as a seed for
  `backlog-charter` amend

`backlog-triage` stays **advisory by default** (its current behavior): it
reports; all `CHARTER.md` mutations go through `backlog-charter` amend (gated).
Issue → objective mapping is **semantic inference** — issues are not required to
be tagged with objective IDs (a user may note IDs in issue bodies, but this is
optional; keeping Core lightweight).

### Shared `alignment.md` reference

The work ↔ objective mapping logic and severity rules live in one file —
`backlog-charter/references/alignment.md` — consumed by both `backlog-triage`
(Alignment Check) and dev-backlog `sprint-init`. One definition of the logic,
two consumers (mirrors how dev-relay shares `rubric-*.md` across skills).

### Graceful degradation

When `CHARTER.md` does not exist, `sprint-init` and `backlog-triage` behave
exactly as they do today, simply omitting the alignment section. The axis is
opt-in end to end.

## Edge Cases & Error Handling

- **No `CHARTER.md`** — graceful no-op (see above).
- **Stale CHARTER** (old `last_amended`, many sprints since) — `backlog-triage`
  flags: "CHARTER not amended in N sprints — consider re-running
  `backlog-charter`."
- **Status advance without proof** — `backlog-charter` refuses to move
  `active`→`validated` and flags it (telescope safeguard).
- **Issue contradicts a Non-Goal** — `backlog-triage` flags highest severity;
  resolution is either dropping the issue or amending the Non-Goal (gated).
  Never auto-resolved — only surfaced.
- **Objective not verifiable** — create/amend challenges "can this be made
  checkable?" but accepts an "observable" statement (mixed rigor); does not
  block.
- **CHARTER hand-edited outside the skill** — not an error; it is the user's
  file. The next `backlog-charter` amend re-reads current state and applies
  discipline going forward. No reconciliation machinery (single source of
  truth).
- **Objective ID reuse** — a removed objective's ID is never reused; new
  objectives take the next free number.
- **CHARTER bloat** — amend challenges any violation of the ~5-minute-read
  property; `deferred` objectives can be collapsed or moved into Decisions.

## Testing

The work is largely prompt/skill (markdown), so scripts are minimal. Any helper
script (revision bump, an objective parser for `sprint-init`) gets a
`node --test` suite and is exercised with `--dry-run` first, per the
dev-backlog/dev-relay convention. Skill behavior is verified manually: create
mode on a repo with no CHARTER, amend mode on an existing one, the 3-tier gates
(attempting a status advance without proof must be refused), and graceful
degradation (sprint-init/triage with no CHARTER present).

## Document Roles

Added to clarify that `CHARTER.md` does not overlap existing docs:

| File | Question it answers |
|------|---------------------|
| `CHARTER.md` | What good looks like / why (the yardstick) |
| `_context.md` | Operational facts you would otherwise rediscover (HOW-knowledge) |
| `CLAUDE.md` | How to work in this repo (conventions) |
| `README.md` | Outward-facing introduction |

## Prior Art

Patterns absorbed (not integrated):

- **compound-engineering `STRATEGY.md`** — one lean rerunnable skill + one
  one-page template; "anchor, not plan"; rerun challenges stale sections.
- **gsd-2** — typed predicate contract; proof-gated status; layered
  immutability (decisions immutable / requirements semi-mutable); the
  stability-biased reassessment ritual. Its DB-authoritative reconciliation
  machinery is explicitly *not* absorbed (single-source markdown has no
  projection to drift).
- **ceos V/TO** — nested horizons with per-layer decay rates; the bidirectional
  alignment check (orphan work / neglected goals / contradictions).
- **conductor** — completion-triggered write-back (informs the deferred
  automated-reassess spec).
- **goal-md** — verifiable fitness function; outcome-vs-instrument separation.
- **spec-kit** — constitution as a gate; read-only `/analyze` drift scan.
