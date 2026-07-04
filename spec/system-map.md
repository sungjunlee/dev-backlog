# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic helper scripts. GitHub Issues remain the canonical task source; local Markdown files provide execution context for humans and coding agents.

```text
GitHub Issues
  -> gh CLI explicit sync
  -> backlog/tasks/ thin mirror
  -> backlog/sprints/ active execution hub
  -> humans / Claude Code / Codex

backlog/sprints/ (canonical, committed at explicit boundaries)
  -> sprint-state.js JSON  (status.sh --json / next.sh --json)
  -> backlog-doctor verdict (aggregated health, hard/soft severity)
  -> any actor: human, relay executor, external loop, analyzer
  -> sprint-mirror.js -> machine-managed GitHub mirror issue (read-only surface)

spec/
  charter.md       project yardstick
  system-map.md    project structure map
  capabilities.md  capability contracts
```

## Runtime Boundaries

- `skills/dev-backlog/` owns sprint execution, task mirrors, and progress helper scripts.
- `skills/backlog-triage/` owns advisory issue grooming, charter Alignment reports, and spec-aware Decision Review.
- The `spec-charter`/`spec-system-map`/`spec-grill` authoring skills ship with craftkit (installed as sibling skills, not in this repo); they own the `spec/charter.md`, `spec/system-map.md`, and `spec/capabilities.md` authoring gates.
- `spec/` holds durable project specs, not active sprint execution memory.

## Core Flows

1. **Sync:** `sync-pull.js` mirrors open GitHub Issues into `backlog/tasks/`.
2. **Plan:** sprint planning reads charter Objectives when present, then writes one active file under `backlog/sprints/`.
3. **Execute:** agents read the active sprint, update Plan state and Progress, and keep task context local.
4. **Read (machine):** any actor reads execution state through the JSON surfaces (`status.sh --json` / `next.sh --json`) and one `backlog-doctor` verdict instead of parsing markdown; `sprint-mirror.js` explicitly publishes the active sprint to a machine-managed mirror issue.
5. **Groom:** `backlog-triage` produces advisory reports with classification, relationships, stale signals, Alignment, and Decision Review; mutations require explicit user action.
6. **Spec evolve:** the craftkit-installed `spec-charter`, `spec-system-map`, and `spec-grill` skills update durable project specs through their own gates. Sprint close runs `backlog-doctor` and may recommend `spec-charter reassess` (signal-gated, report-only); reassess reports land as dated files under `backlog/triage/`.

## Storage And External Systems

- GitHub Issues: task source of truth.
- Git: versioned local Markdown artifacts and scripts.
- `gh` CLI: explicit GitHub read/write bridge.
- Node.js scripts: deterministic checks and sync helpers.
- Bash scripts: local workflow wrappers.

## Project-Wide Invariants

- No hidden server, database, daemon, or background sync.
- GitHub Issues define task intent; sprint files define execution context.
- The local sprint file is canonical and committed at explicit boundaries; GitHub-side mirrors (task files inbound, sprint mirror issue outbound) are derived surfaces.
- `sprint-state.js` is the single parser of sprint markdown for machine consumers; new tools consume its JSON (see the consumption contract) instead of re-parsing.
- Automation is report-only toward `spec/*`: doctor and reassess signals recommend; only human-gated `spec-charter amend` / `spec-grill` mutate specs.
- `spec/charter.md` is canonical; root `CHARTER.md` is legacy fallback only.
- `spec/capabilities.md` remains compact enough to read at session start.
- Completed sprint files are immutable history.

## Accepted Capability Contracts

Accepted capability contracts live in [`capabilities.md`](capabilities.md). Current boundaries are:

- `sprint-execution` - sprint planning, in-flight state, progress context, and active/completed sprint invariants.
- `backlog-sync` - bidirectional mirroring: GitHub issues into local task cache (AC preservation) and the active sprint out to a machine-managed mirror issue.
- `triage-grooming` - advisory issue classification, relationships, stale signals, Alignment, Decision Review, and report/apply boundaries.
- `task-progress-reporting` - monthly GitHub Progress issue synchronization and finalization.

The former `spec-charter`/`spec-system-map`/`spec-grill` capability contracts moved to craftkit with the skills themselves (0.7.0, charter Decision 2026-07-04).

## Open Boundary Questions

No active unresolved boundary question is recorded in this map. New candidate boundaries should go through `spec-grill`; project-wide structure changes should go through `spec-system-map amend`.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Machine consumption contract and JSON schema: [`../skills/dev-backlog/references/integration-contract.md`](../skills/dev-backlog/references/integration-contract.md)
- Spec-system rationale: [`../docs/spec-system-design.md`](../docs/spec-system-design.md)
