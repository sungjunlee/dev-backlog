# Spec System Design (v0.1)

**Status:** Approved (M tier) · **Date:** 2026-05-23 · **Author:** session capture
**Supersedes:** — · **Related:** [`CHARTER.md`](../CHARTER.md), [`skills/backlog-charter/`](../skills/backlog-charter/)

A layered, brownfield-friendly project spec system that survives multi-day autonomous agent execution without rubber-stamping itself into uselessness. This doc captures the chosen architecture, the research that grounds it, the build order, and the open questions deferred to follow-up specs.

---

## Problem

`CHARTER.md` works as a 5-min reference axis (north star + verifiable predicates + immutable decisions). But on real projects two gaps appear:

1. **No middle layer.** Between "the whole project's north star" and "this sprint's task list" there is no place to write *"this capability does X for the user, within these boundaries, and never violates Y."* Mid-day autonomous agents either over-interpret the charter or fly blind on per-capability specifics.
2. **No live-feedback path.** Learnings from completed work (a working pattern, a measured number, a discovered constraint) accrue in PR descriptions and disappear from the agent's reachable context within a sprint or two.

For autonomous runs that span days, this means: setpoint exists, sensor doesn't, controller drifts. Research-grounded framing in [Research](#research-grounding) below.

## Goals

- Layered: north star (CHARTER) → capability specs (new) → live learnings (new)
- Works greenfield and brownfield (signal extraction from existing repos)
- Detail level calibrated to *help* AI agents, not constrain them into Goodhart's law
- Lower layers can update live without human edit, via structurally bounded channels
- Interactive "grill-me" mode that pressure-tests specs into verifiable predicates
- Loose documents, strict handles: prose stays flexible; machine-routing fields stay small and stable
- Bias to simplicity: one new file family, zero new skill names

## Non-Goals

- Replace `CHARTER.md` (this extends it)
- Per-capability file proliferation on day 1 (strangler-fig path preserved, not paved)
- ADR ceremony before decision volume justifies it
- Autonomous spec self-editing by working agents (adversarial-Goodhart risk, see Research)
- Per-component versioning headers (git history suffices)

---

## Architecture (M tier — locked)

```
repo/
├─ CHARTER.md                ← Tier 1 (frozen-ish, 5-min read, north star)
├─ spec/
│  └─ capabilities.md        ← NEW: layered capability spec, single file
│     #
│     # ## Capability: <name>
│     #   Goal                          (frozen — amend-gated)
│     #   In-scope / Out-of-scope       (frozen — amend-gated)
│     #   Expected Behaviors            (human-gated, list)
│     #   Hard Constraints              (anti-adversarial bright-lines)
│     #   ## Learnings                  (LIVE once append writer is installed)
│     #     <!-- LEARN:BEGIN -->
│     #     - <date> (run #N): <one-line> [PR #X]
│     #     <!-- LEARN:END -->
│     #   ## Decisions                  (append-only by convention)
│     #
├─ backlog/                  ← unchanged (dev-backlog)
└─ src/
```

### Loose documents, strict handles

Agents need room to reason in prose. They also need stable coordinates when another agent resumes later. The split:

```
Free-form reasoning
  CHARTER prose
  capability Goal / Scope / Behaviors
  sprint Plan / Running Context

Strict handles
  objective IDs: O1, O2
  capability IDs: sprint-execution
  sprint component: one primary capability slug
  LEARN markers
  append-only Decisions / Learnings
```

The rule: constrain the address, not the thought. `component:` is a routing handle, so it is one primary capability slug. Multi-capability work belongs in sprint prose or Running Context, where agents can explain the secondary touches without making downstream writers guess.

### Mutation discipline per layer

| Layer | Who writes | When | Gate |
|---|---|---|---|
| `CHARTER.md` Problem/Approach/Non-Goals | human via `backlog-charter amend` | rarely | Tier 1 gate (existing) |
| `CHARTER.md` Objectives | human via amend; status advance proof-gated | when an objective is added/removed/proven | Tier 2 gate (existing) |
| `CHARTER.md` Decisions | append-only | when a non-trivial cross-cutting decision is made | Tier 3 (existing) |
| `spec/capabilities.md` Goal/Scope/Behaviors/HardConstraints per capability | human via `backlog-charter grill` (new mode) | when a capability's contract changes | challenge + confirm + apply |
| `spec/capabilities.md` `## Learnings` blocks | **`dev-relay/scripts/append-learnings.js`** | end of every successful relay run with a primary `component:` tag | structurally bounded append between magic markers; rejects anything else |
| `spec/capabilities.md` `## Decisions` blocks | human | when a capability-level decision is made | append-only by convention; promote to CHARTER Tier 3 if cross-cutting |

### Why single-file, not per-capability

For projects with <20 capabilities (the realistic majority), one `spec/capabilities.md` keeps everything legible and grep-able. Once a project exceeds ~500 lines or ownership boundaries demand it, a `split-capabilities.js` tool migrates to `spec/components/<name>.md` — but we don't pre-pave that road. Make-the-change-easy, then make the easy change (Beck).

---

## Research grounding

Full literature survey lives at [`references/spec-system-research.md`](../skills/backlog-charter/references/spec-system-research.md) (to be written; see follow-up issue). Three findings load-bear this design:

### 1. The 3-mode failure taxonomy for autonomous-agent specs

From Langosco et al. 2022 (goal misgeneralization) + Manheim & Garrabrant 2018 (Goodhart 4-mode) + Hadfield-Menell et al. 2017 (Inverse Reward Design):

- **Misspecification:** the spec is wrong, agent exploits as written. Defense: explicit verifiable predicates.
- **Goal misgeneralization:** spec is right, but agent's *internalized goal* diverges off-distribution. Defense: distributional robustness check in grill mode.
- **Adversarial Goodhart:** agent edits the measurement apparatus to satisfy the spec. Defense: structural — working agents have no write path to spec content except the bounded Learnings append. Until the append writer exists in the target repo, docs must describe this as a contract, not an already-enforced property.

### 2. Control-theory framing

A multi-day autonomous run with no in-loop ground-truth check is **open-loop control** and will drift. The CHARTER alone is a setpoint without a sensor. `## Learnings` is the minimum-viable sensor: each run feeds back a one-line ground-truth observation that the next run can read.

### 3. Spec-language stability discipline

Across OKRs, ADRs, Constitutional AI, and TLA+: the design choice most copied is **immutability after acceptance** (Nygard). `CHARTER.md` Tier 3 already enforces this; `spec/capabilities.md` extends it via append-only `## Learnings` and `## Decisions` sections.

### The 3-axis predicate test (for grill mode)

Before any capability Behavior or Hard Constraint is committed:

1. **Authority axis:** would the user be unhappy if an agent satisfied this *measurably* but in a way that ignored their intent? If yes → encode the missing intent as a Hard Constraint or a sharper Behavior.
2. **Distributional axis:** does this predicate hold in unseen code areas / unseen workloads? If no → restate as environment-independent.
3. **Manipulability axis:** can an agent satisfy this by editing the measurement channel rather than the system? If yes → add a structural restriction outside the spec.

---

## Implementation plan (3 PRs, ordered)

```
PR-1: template + SKILL.md extension (no executable code)
  ├─ docs/spec-system-design.md                    (this file)
  ├─ skills/backlog-charter/templates/capabilities.md  (NEW)
  ├─ skills/backlog-charter/SKILL.md               (+grill mode section)
  └─ CHARTER.md                                    (no change; just verify alignment)
       ↓
       (dogfood: write spec/capabilities.md for dev-backlog itself)
       ↓
PR-2: brownfield bootstrap (greenfield path also works)
  ├─ skills/backlog-charter/scripts/extract-signals.js   (NEW, ~80 LOC)
  ├─ skills/backlog-charter/scripts/extract-signals.test.js
  └─ skills/backlog-charter/SKILL.md               (+brownfield invocation)
       ↓
       (dogfood: run extract-signals on dev-relay → propose its spec/capabilities.md)
       ↓
PR-3: live-update wiring (cross-repo: dev-backlog + dev-relay)
  ├─ skills/dev-backlog/scripts/component-lint.js  (NEW, validates `component:` tags)
  ├─ skills/dev-backlog/SKILL.md                   (sprint task frontmatter: +component)
  ├─ (dev-relay repo) scripts/append-learnings.js  (NEW, ~50 LOC)
  ├─ (dev-relay repo) relay-merge hook integration
  └─ Component-tag conflict resolution rule: one primary capability slug; multi-component values fail lint
```

### Build-order rationale

1. **Template first** because the layered structure is the only innovation token; everything else (scripts, hooks) is plumbing. Validate the structure with a real dogfood (writing dev-backlog's own `spec/capabilities.md`) before building scaffolding around it.
2. **Bootstrap second** because brownfield extraction is the proof that this works on "any real repo, not just greenfield toys." Test against `dev-relay` (rich enough, real enough).
3. **Live-update last** because it's a cross-repo change touching `dev-relay`'s merge path. Highest blast radius, do it once the upstream pieces are solid.

---

## NOT in scope (deferred with rationale)

| Deferred | Rationale | Promotion trigger |
|---|---|---|
| Per-capability files (`spec/components/*.md`) | YAGNI; single file works for <20 capabilities | `spec/capabilities.md` > 500 lines OR ownership demands |
| ADR directory (`spec/decisions/*.md`) | CHARTER Decisions + per-capability `## Decisions` suffice | Cross-cutting decision volume > 10 in a quarter |
| Adversarial grill subagent (separate context) | Single-context grill is testable now; subagent dispatch is an innovation token | Observed self-rationalization in working agent |
| Cross-capability dependency graph | Over-engineering; readable from prose | Multiple capability authors complain about silent coupling |
| Per-capability `revision:` / `last_amended:` | `git blame` is the source of truth | Auditing demand from outside the team |
| Auto-promotion of O5 (CHARTER auto-reassess) | `## Learnings` is the manual feedback channel for now; auto-reassess deserves its own design doc | One full quarter of `## Learnings` data to inform the auto-reassess spec |

---

## Open questions

These are flagged for the implementation PRs, not blockers for committing to M:

- **D2** Naming: `spec/` (root) vs `docs/spec/` vs `.spec/`? Lean root — peer of `backlog/`. Confirm during PR-1.
- **D3** `spec/capabilities.md` size warning threshold — 500 lines or 700? Tunable in the lint script.
- **D4** Multi-component sprint task: resolved to one primary capability slug. Secondary touches are prose, not routing metadata.
- **D5** `component:` tag freeform string vs declared-only enum? Resolved to declared capability slug, with `component-lint.js` catching typos before they reach Learnings.

---

## Migration path to "L tier" (full Approach A) — if needed

Strangler-fig. None of these requires re-architecture, just expansion:

1. `spec/capabilities.md` outgrows comfort → `split-capabilities.js` migrates to `spec/components/<name>.md`. SKILL.md routes the same gates over the new file shape.
2. Decision volume justifies ADRs → `spec/decisions/<NNNN>-<slug>.md` with a tiny ADR template. Per-capability `## Decisions` sections become a "lite" entry point.
3. Working agent shows rationalization tells in grill mode → adversarial grill runs as a subagent with separate context. `backlog-charter` SKILL.md gains a `--adversarial-subagent` flag.
4. `spec-grill` / `spec-learn` extracted as named skills only if `backlog-charter`'s SKILL.md exceeds 250 lines and the modes feel forced.

Every L-tier feature is a YAGNI-violating addition until it's not. Defer until signal.

---

## Dogfood plan

The most authentic test of this spec system is applying it to projects we already understand:

1. **dev-backlog itself** (greenfield-ish — `CHARTER.md` exists, no capabilities file yet). Authors: us. Validates greenfield grill + the layered shape on a project we know cold.
2. **dev-relay** (brownfield — established code, no CHARTER yet). Validates the full brownfield path: `extract-signals.js` → grill → `spec/capabilities.md` written end-to-end. Also exercises live-update since dev-relay *is* the relay-merge surface.
3. **(optional, after both)** A real product repo from outside this workspace. Highest signal but lowest control. Worth doing once internal dogfood looks healthy.

Each dogfood produces:
- A `spec/capabilities.md` in the target repo
- Reusable signal feedback for spec-system v0.2 (more findings, like the CHARTER dogfood pattern that produced #93–#98)

---

## CHARTER alignment (self-check)

This design advances dev-backlog's own CHARTER Objectives:

- **O3 (active):** `<5-min reference axis usable` — capability specs *extend* the 5-min property below CHARTER. Not advance to validated on this; one more independent project required.
- **O4 (active):** `drift detectable without manual triage` — `## Learnings` + `component-lint.js` are direct drift-detection surfaces. Same proof-gate.
- **O5 (deferred):** `auto-reassess wired into relay-merge / sprint completion` — `## Learnings` append is the manual precursor. After v0.1 ships and accumulates data, O5 spec gets written with real evidence.
- **O6 (deferred):** `/goal completion-condition auto-emission from CHARTER + active sprint` — unchanged.

Status advance for any of these is gated on independent-project proof, per CHARTER Tier 2 discipline.
