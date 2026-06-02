---
name: spec-system-map
argument-hint: "[create|amend]"
description: "Create or amend spec/system-map.md as a high-level project system map. Use for architecture scope confusion, system shape, runtime boundaries, core flows, invariants, storage/external systems, or SYSTEM_MAP."
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, spec-grill, dev-backlog"
---

# Spec System Map

Create or amend `spec/system-map.md`, the high-level map of how the project is shaped. This is narrower than a generic `ARCHITECTURE.md`: it names project-wide structure, boundaries, flows, storage/external systems, invariants, and pointers to deeper docs.

## Boundary

| File | Role |
|------|------|
| `spec/charter.md` | Why / good state / Objectives / Decisions |
| `spec/system-map.md` | System shape / runtime boundaries / core flows / invariants / pointers |
| `spec/capabilities.md` | Capability-level contracts / Hard Constraints / Learnings |

Do not turn `system-map.md` into exhaustive module documentation, API reference, runbook, ADR log, or implementation notes. Demote subsystem detail to linked docs; promote only project-wide structure or invariants.

## Mode Router

- `create`: use when `spec/system-map.md` is absent or the user asks for a first system map.
- `amend`: use when the file exists and the user asks to update architecture shape, boundaries, flows, invariants, or links.

When no mode is specified, route by file state. Create `spec/` if needed.

## Create Mode

1. Read bounded signals: `spec/charter.md` if present, `README.md`, `AGENTS.md`/`CLAUDE.md`, top-level directories, package/config files, and existing docs that appear architecture-related.
2. Draft from `templates/system-map.md`; keep sections short and link out instead of expanding subsystem detail.
3. Include these sections: System Shape, Runtime Boundaries, Core Flows, Storage And External Systems, Project-Wide Invariants, Candidate Capability Boundaries, Where To Go Next.
4. If the repo is brownfield, explicitly mark uncertain boundaries as assumptions rather than inventing detail.
5. Use Candidate Capability Boundaries to hand off concrete, short candidates to `spec-grill`. Each candidate should name evidence, the contract surface it appears to own, and the uncertainty `spec-grill` must resolve.
6. Recommend asking `spec-grill` to review the candidate capability boundaries when the map reveals durable boundaries that are not yet in `spec/capabilities.md`.

## Amend Mode

1. Re-read `spec/system-map.md` and the concrete change evidence.
2. Update only project-wide shape, boundaries, flows, storage/external systems, invariants, or pointers.
3. Move low-level module details, endpoint lists, deployment commands, and temporary implementation notes out of the map.
4. If a change is really a capability contract, route it to `spec-grill`. If it changes why/good-state, route it to `spec-charter amend`.

## Quality Checks

Before finishing, verify:

- A reader can understand the project shape in under 5 minutes.
- Every section names current project-wide facts, not aspirational design.
- The map links to deeper docs instead of copying them.
- No subsystem gets more detail than the whole-system flow needs.
- Candidate Capability Boundaries are short handoff candidates, not a module inventory.
- No stale module-level TODOs, endpoint inventories, or runbook commands are included.

## Eval Prompts

Use these as quick pressure tests when changing the skill or a generated map:

- "Create a system map for an existing repo with many modules and no architecture docs." Expected: short `spec/system-map.md`, uncertainty labeled, subsystem details linked or deferred.
- "Update this map with a new helper function and endpoint." Expected: refuse or demote as too low-level unless it changes a project-wide flow or invariant.
- "Turn this ARCHITECTURE.md into spec/system-map.md." Expected: preserve high-level boundaries and flows, remove runbook/API/module inventories, add pointers.

## References

- `templates/system-map.md` — starting shape for `spec/system-map.md`.
- [`../spec-charter/SKILL.md`](../spec-charter/SKILL.md) — project charter lifecycle.
- [`../spec-grill/SKILL.md`](../spec-grill/SKILL.md) — capability-contract lifecycle.
