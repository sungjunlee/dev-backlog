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

## Candidate Capability Boundaries

- `sprint-execution` - evidence: active sprint flow and completed-sprint invariant; owns sprint planning, in-flight state, and progress context; uncertainty: whether future relay learning writes should remain in this boundary.
- `backlog-sync` - evidence: GitHub Issues -> task mirror flow and explicit sync invariant; owns issue-to-task mirroring and local AC preservation; uncertainty: whether richer triage snapshots should stay separate.
- `triage-grooming` - evidence: advisory grooming flow and Decision Review use of spec evidence; owns issue classification, relationship, stale, alignment, and decision reports; uncertainty: whether closing-PR snapshot enrichment changes this contract.
- `spec-charter` - evidence: canonical `spec/charter.md` invariant and proof-gated direction flow; owns project axis lifecycle; uncertainty: how concrete downstream routing recommendations should be generated.
- `spec-system-map` - evidence: project-wide shape and boundary map flow; owns high-level system structure without module inventory; uncertainty: how much candidate boundary detail is useful before it becomes capability content.
- `spec-grill` - evidence: capability contract flow and compact capability invariant; owns capability admission, predicate pressure tests, and report-first boundary review; uncertainty: how evidence grouping should influence candidate naming.
- `task-progress-reporting` - evidence: progress helper scripts and GitHub Progress issue lifecycle; owns monthly progress issue updates and finalization; uncertainty: whether comment enrichment belongs here or in a separate integration boundary.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Spec-system rationale: [`../docs/spec-system-design.md`](../docs/spec-system-design.md)
