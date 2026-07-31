# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic Node/Bash helpers. The target
core reads task definition and lifecycle from GitHub Issues. Sprint Markdown is
created only for complex execution continuity; optional projections never
accept independent writes.

```text
GitHub Issue (task spec + lifecycle + native planning fields)
        |
        +-- simple work ----------------------> implementation -> PR -> close
        |
        `-- complexity admission -> one active sprint file per track
                                      +-> Plan / Running Context / Progress
                                      `-> explicit status/doctor projections

spec/* (human-gated durable decisions)
GitHub repository history (historical evidence)
retrieval / Projects / Relay / Backlog.md (optional, non-authoritative)
```

The following is the transition implementation shape, retained while the live
resolver, mirrorless pilot, and compatibility subtraction land:

```text
backlog/.tracker
        |
        v
tracker.js (configured-only resolve, availability, capability gate)
        |
        +-- github-tracker.js -> gh -> GitHub Issues (canonical)
        |                         `-> backlog/tasks/ derived mirrors
        |
        `-- local-tracker.js  -> backlog/local-tracker.json (canonical)
                                  `-> backlog/tasks/ + completed/ derived mirrors

backlog/sprints/ (canonical execution hub)
        +-> sprint-state.js -> status.sh --json / next.sh --json
        +-> backlog-doctor.js
        `-> capability-gated GitHub optional transports
```

`setup-dev-backlog.js` persists a deliberate `github` or `local` choice in
`.tracker`. A missing file falls back to a legacy `config.yml` key, then to
GitHub, without runtime mutation. Setup migrates the resolved legacy choice
without editing `config.yml`. Availability failure is never a selection
mechanism, and runtime never probes or falls back to the other adapter.
These compatibility paths are frozen; they do not alter the target authority
contract.

## Runtime Boundaries

- GitHub Issues own task specification, native planning metadata, and
  lifecycle. The full sole-owner table lives in
  [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
- Sprint files own only admitted complex execution state. Simple Issue → PR
  work has no separate sprint state.
- `skills/dev-backlog/scripts/tracker.js` owns configured resolution, the exact seven-operation adapter contract, identity validation, capability discovery/gating, and the shared unsupported-capability error/serializer.
- `github-tracker.js` owns required GitHub task lifecycle argv/translation. Named GitHub modules own milestones, PR relationships, comments, and other optional transports.
- `local-tracker.js` owns the canonical local JSON lifecycle and its one-way Markdown projection. It reports no optional provider capabilities and never invokes `gh`.
- `task-ref.js` owns complete `#N` and `{PREFIX}-N[.M]` parsing/rendering. GitHub keeps numeric `issue_number`; local exposes `null` for that compatibility alias.
- `sprint-state.js` remains the single machine parser of sprint Markdown; `status.sh --json`, `next.sh --json`, and doctor projections consume its state.
- `skills/backlog-triage/` owns advisory grooming. Provider enrichment/mutation remains capability-gated and explicit.
- Craftkit-installed spec authoring skills own human-gated changes to `spec/`; dev-backlog reads those files as optional yardsticks.

Detailed adapter mechanics, the pre-seam inventory, and the compatibility matrix
are single-sourced in [`docs/tracker-adapter-design.md`](../docs/tracker-adapter-design.md).

## Core Flows

1. **Resolve:** read the live GitHub Issue as task specification and lifecycle authority.
2. **Admit:** keep self-contained Issue → PR work sprint-free; create a sprint only for ordered multi-Issue batches, delegated/parallel handoff, cross-Issue/session context, or concurrent-track coordination.
3. **Execute:** when admitted, update one track's Plan, Running Context, and Progress at explicit boundaries; task acceptance and lifecycle remain on the Issue.
4. **Complete:** merge the PR, close/update the Issue, and close any admitted sprint while retaining its committed history.
5. **Project/retrieve:** Projects, Relay artifacts, mirrors, indexes, and summaries remain optional views that identify their upstream authority and never receive automatic state writes.
6. **Groom/spec:** triage stays advisory by default; doctor/reassess may recommend human-gated spec work but do not mutate durable specs automatically.

## Storage And External Systems

- GitHub Issues: sole task-definition, native planning metadata, and lifecycle authority.
- `backlog/sprints/`: admitted complex execution state, committed at explicit boundaries.
- `spec/*`: human-gated durable project, system, and capability decisions.
- GitHub repository history: original historical evidence.
- `backlog/.tracker`, `backlog/config.yml`, and `backlog/local-tracker.json`: frozen transition compatibility.
- `backlog/tasks/` and `backlog/completed/`: non-authoritative transition projections.
- `gh`: GitHub-mode bridge only; acceptance tests replace it with an argv recorder and local tests trap it.
- Git: versioned Markdown, scripts, and durable specs.

## Project-Wide Invariants

- GitHub Issues own task truth; no runtime fallback, co-authority, dual write, or background sync.
- Existing tracker-less repositories remain GitHub-backed with zero migration and unchanged `#N`, numeric aliases, task-mirror bytes, argv, milestones, comments, and closing behavior.
- Local compatibility is frozen pending staged retirement. It never fabricates provider semantics or URLs.
- Task projections are diagnostic/export material only. A failed live Issue read stops execution; stale projection bytes cannot authorize task work or lifecycle changes.
- Unsupported optional capabilities have stable code `TRACKER_CAPABILITY_UNSUPPORTED`, tracker, capability, message, and remediation; JSON and human boundaries share that one serializer contract.
- A sprint is triggered by execution complexity, never duration alone; the
  no-spec/no-Relay cold-adopter paths work both sprint-free and, when admitted,
  through a complete sprint cycle.
- Completed sprint files are immutable history.
- Automation is report-only toward `spec/*`; `spec/charter.md` is canonical and root `CHARTER.md` is legacy fallback only.
- Retrieval and memory output is disposable, source-attributed, and never written automatically to an authority.
- Helpers run on POSIX and Git-for-Windows Bash; native filesystem paths stay internal while stable serialized fields normalize to `/`; atomic-store replacement coverage runs without platform skips.

## Executable Evidence

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` proves both full
cycles with real temporary files and subprocesses, no network, exact GitHub
compatibility evidence, local zero-provider evidence, body-preserving updates,
Done archive/final reads, and every optional-capability failure shape. This
implementation proof merged as PR #303 (2026-07-12). It is transition evidence,
not a current objective or a reason to expand generic tracker compatibility.

## Accepted Capability Contracts

- `sprint-execution` — plan state, context, progress, and active/completed sprint invariants.
- `tracker-task-truth` — live GitHub Issue ownership and lifecycle, with frozen transition compatibility.
- `backlog-sync` — safe, non-authoritative transition projection pending retirement.
- `triage-grooming` — advisory classification, relationships, stale signals, Alignment, and Decision Review.

## Optional Boundaries

Relay, Matt Pocock skills, GitHub Projects, Backlog.md, and retrieval/memory
experiments may assist execution or present projections. None is required by
the Issue → PR or complex-sprint path, none owns product state, and no new
tracker adapter or committed memory/compiler work is admitted during this
milestone.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Actor/JSON contract: [`../skills/dev-backlog/references/integration-contract.md`](../skills/dev-backlog/references/integration-contract.md)
- Adapter compatibility/proof: [`../docs/tracker-adapter-design.md`](../docs/tracker-adapter-design.md)
