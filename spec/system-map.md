# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic helper scripts. GitHub Issues remain the canonical task source; local Markdown files provide execution context for humans and coding agents.

```text
GitHub Issues
  -> gh CLI explicit sync
  -> backlog/tasks/ thin mirror
  -> backlog/sprints/ active execution hub
  -> humans / Claude Code / Codex

spec/
  charter.md       project yardstick
  system-map.md    project structure map
  capabilities.md  capability contracts
```

## Runtime Boundaries

- `skills/dev-backlog/` owns sprint execution, task mirrors, and progress helper scripts.
- `skills/backlog-triage/` owns advisory issue grooming, charter Alignment reports, and spec-aware Decision Review.
- `skills/spec-charter/` owns `spec/charter.md` lifecycle and charter proof gates.
- `skills/spec-system-map/` owns this high-level system map.
- `skills/spec-grill/` owns `spec/capabilities.md` authoring.
- `spec/` holds durable project specs, not active sprint execution memory.

## Core Flows

1. **Sync:** `sync-pull.js` mirrors open GitHub Issues into `backlog/tasks/`.
2. **Plan:** sprint planning reads charter Objectives when present, then writes one active file under `backlog/sprints/`.
3. **Execute:** agents read the active sprint, update Plan state and Progress, and keep task context local.
4. **Groom:** `backlog-triage` produces advisory reports with classification, relationships, stale signals, Alignment, and Decision Review; mutations require explicit user action.
5. **Spec evolve:** `spec-charter`, `spec-system-map`, and `spec-grill` update durable project specs through their own gates.

## Storage And External Systems

- GitHub Issues: task source of truth.
- Git: versioned local Markdown artifacts and scripts.
- `gh` CLI: explicit GitHub read/write bridge.
- Node.js scripts: deterministic checks and sync helpers.
- Bash scripts: local workflow wrappers.

## Project-Wide Invariants

- No hidden server, database, daemon, or background sync.
- GitHub Issues define task intent; sprint files define execution context.
- `spec/charter.md` is canonical; root `CHARTER.md` is legacy fallback only.
- `spec/capabilities.md` remains compact enough to read at session start.
- Completed sprint files are immutable history.

## Accepted Capability Contracts

Accepted capability contracts live in [`capabilities.md`](capabilities.md). Current boundaries are:

- `sprint-execution` - sprint planning, in-flight state, progress context, and active/completed sprint invariants.
- `backlog-sync` - GitHub issue mirroring, local task cache format, and AC preservation.
- `triage-grooming` - advisory issue classification, relationships, stale signals, Alignment, Decision Review, and report/apply boundaries.
- `spec-charter` - project axis lifecycle and proof-gated charter mutation.
- `spec-system-map` - high-level system structure, runtime boundaries, flows, invariants, and durable pointers.
- `spec-grill` - capability admission, predicate pressure tests, and compact `spec/capabilities.md` contracts.
- `task-progress-reporting` - monthly GitHub Progress issue synchronization and finalization.

## Open Boundary Questions

No active unresolved boundary question is recorded in this map. New candidate boundaries should go through `spec-grill`; project-wide structure changes should go through `spec-system-map amend`.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Spec-system rationale: [`../docs/spec-system-design.md`](../docs/spec-system-design.md)
