# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic helper scripts. Exactly one
configured tracker adapter is the canonical task source for a repository;
local Markdown files provide execution context for humans and coding agents.
GitHub is the current compatibility baseline, and `local` is the accepted
alternative to be proven before additional forge adapters are considered.

```text
Configured tracker (`github` or `local`)
  -> tracker task interface + capability report
  -> canonical or derived backlog/tasks/ files
  -> backlog/sprints/ active execution hub
  -> humans / Claude Code / Codex

backlog/sprints/ (canonical, committed at explicit boundaries)
  -> sprint-state.js JSON  (status.sh --json / next.sh --json)
  -> backlog-doctor verdict (aggregated health, hard/soft severity)
  -> any actor: human, relay executor, external loop, analyzer
  -> optional publisher capability -> machine-managed mirror (read-only surface)

spec/
  charter.md       project yardstick
  system-map.md    project structure map
  capabilities.md  capability contracts
```

## Runtime Boundaries

- `skills/dev-backlog/` owns tracker selection, the normalized task lifecycle, sprint execution, task-file materialization, and progress helper scripts.
- Tracker adapters own provider/local mechanics and capability discovery; core sprint code consumes their small task interface instead of invoking a provider CLI directly.
- `skills/backlog-triage/` owns advisory task grooming, charter Alignment reports, and spec-aware Decision Review when the selected tracker exposes the required capabilities.
- The `spec-charter`/`spec-system-map`/`spec-grill` authoring skills ship with craftkit (installed as sibling skills, not in this repo); they own the `spec/charter.md`, `spec/system-map.md`, and `spec/capabilities.md` authoring gates.
- `spec/` holds durable project specs, not active sprint execution memory.

## Core Flows

1. **Select/probe:** setup persists exactly one tracker choice; runtime loads that choice, probes availability, and reports capabilities without silently selecting a different tracker.
2. **Materialize:** the selected tracker lists canonical tasks; GitHub mode explicitly mirrors them into `backlog/tasks/`, while local mode reads and writes canonical task files directly.
3. **Plan:** sprint planning reads charter Objectives when present, then writes one active file under `backlog/sprints/` using stable tracker-neutral task references.
4. **Execute:** agents read the active sprint, update Plan state and Progress, and keep task context local.
5. **Read (machine):** any actor reads execution state through the JSON surfaces (`status.sh --json` / `next.sh --json`) and one `backlog-doctor` verdict instead of parsing markdown; provider-specific publishers run only when their capability is available.
6. **Groom:** `backlog-triage` produces advisory reports with classification, relationships, stale signals, Alignment, and Decision Review from supported tracker evidence; mutations require explicit user action.
7. **Spec evolve:** the craftkit-installed `spec-charter`, `spec-system-map`, and `spec-grill` skills update durable project specs through their own gates. Sprint close runs `backlog-doctor` and may recommend `spec-charter reassess` (signal-gated, report-only); reassess reports land as dated files under `backlog/triage/`.

## Storage And External Systems

- Configured tracker (`github` or `local`): exactly one task source of truth.
- `backlog/config.yml`: persisted tracker selection and local task-file configuration.
- Git: versioned local Markdown artifacts and scripts.
- `gh` CLI: explicit GitHub-adapter read/write bridge; never required by local mode.
- Node.js scripts: deterministic checks and sync helpers.
- Bash scripts: local workflow wrappers.

## Project-Wide Invariants

- No hidden server, database, daemon, or background sync.
- Exactly one configured adapter defines task intent; sprint files define execution context.
- Tracker selection is explicit and persistent. Detection may suggest an initial value during setup, but runtime never falls back to another adapter.
- The local sprint file is canonical and committed at explicit boundaries; tracker-side mirrors and publications are derived surfaces.
- Optional capabilities fail clearly when unsupported; the core interface never invents milestone, PR-link, mirror, or close-keyword semantics.
- `sprint-state.js` is the single parser of sprint markdown for machine consumers; new tools consume its JSON (see the consumption contract) instead of re-parsing.
- Automation is report-only toward `spec/*`: doctor and reassess signals recommend; only human-gated `spec-charter amend` / `spec-grill` mutate specs.
- `spec/charter.md` is canonical; root `CHARTER.md` is legacy fallback only.
- `spec/capabilities.md` remains compact enough to read at session start.
- Completed sprint files are immutable history.

## Accepted Capability Contracts

Accepted capability contracts live in [`capabilities.md`](capabilities.md). Current boundaries are:

- `sprint-execution` - sprint planning, in-flight state, progress context, and active/completed sprint invariants.
- `tracker-task-truth` - explicit tracker selection, normalized task lifecycle and identity, capability discovery, and provider degradation.
- `backlog-sync` - explicit canonical-task materialization and optional machine-managed publication without overwriting human-authored content.
- `triage-grooming` - advisory issue classification, relationships, stale signals, Alignment, Decision Review, and report/apply boundaries.
- `task-progress-reporting` - monthly GitHub Progress issue synchronization and finalization.

The former `spec-charter`/`spec-system-map`/`spec-grill` capability contracts moved to craftkit with the skills themselves (0.7.0, charter Decision 2026-07-04).

## Open Boundary Questions

The accepted adapter seam must still prove backward-compatible task references and JSON fields while supporting local canonical IDs. GitLab, Gitea, and Forgejo remain candidates only after the `github`/`local` seam passes the dual-mode sprint-cycle proof. New candidate boundaries should go through `spec-grill`; project-wide structure changes should go through `spec-system-map amend`.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Machine consumption contract and JSON schema: [`../skills/dev-backlog/references/integration-contract.md`](../skills/dev-backlog/references/integration-contract.md)
- Spec-system rationale: [`../docs/spec-system-design.md`](../docs/spec-system-design.md)
