# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic Node/Bash helpers. The target
core reads task definition and lifecycle from GitHub Issues. There is no required task mirror. Sprint Markdown is
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

The implementation shape is GitHub-only:

```text
backlog/.tracker
        |
        v
tracker.js (configured-only resolve, availability, capability gate)
        |
        `-- github-tracker.js -> gh -> GitHub Issues (canonical)
                                  `-> explicit one-way legacy export

backlog/sprints/ (canonical execution hub)
        +-> sprint-state.js -> status.sh --json / next.sh --json
        +-> backlog-doctor.js
        `-> capability-gated GitHub optional transports
```

`setup-dev-backlog.js` persists `github` in `.tracker`. A missing file accepts
only a legacy `tracker: github` config key, then defaults to GitHub without
runtime mutation. Any other selection fails. Availability failure is never a
selection mechanism or fallback trigger.

## Runtime Boundaries

- GitHub Issues own task specification, native planning metadata, and
  lifecycle. The full sole-owner table lives in
  [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
- Sprint files own only admitted complex execution state. Simple Issue → PR
  work has no separate sprint state.
- `skills/dev-backlog/scripts/tracker.js` owns configured resolution, the exact seven-operation adapter contract, identity validation, capability discovery/gating, and the shared unsupported-capability error/serializer.
- `github-tracker.js` owns required GitHub task lifecycle argv/translation. Named GitHub modules own milestones, PR relationships, comments, and other optional transports.
- `task-ref.js` owns complete `#N` runtime parsing/rendering plus historical Backlog.md filename parsing for explicit import/export. GitHub keeps numeric `issue_number`.
- `sprint-state.js` remains the single machine parser of sprint Markdown; `status.sh --json`, `next.sh --json`, and doctor projections consume its state.
- `skills/backlog-triage/` owns advisory grooming. Provider enrichment/mutation remains capability-gated and explicit.
- Craftkit-installed spec authoring skills own human-gated changes to `spec/`; dev-backlog reads those files as optional yardsticks.

The retained seam inventory and compatibility subtraction evidence are
single-sourced in
[`docs/compatibility-subtraction.md`](../docs/compatibility-subtraction.md).

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
- `backlog/.tracker` and `backlog/config.yml`: GitHub selection and frozen legacy Backlog.md settings.
- `backlog/tasks/` and `backlog/completed/`: non-authoritative one-way legacy exports.
- `gh`: GitHub bridge; acceptance tests replace it with an argv recorder.
- Git: versioned Markdown, scripts, and durable specs.

## Project-Wide Invariants

- GitHub Issues own task truth; no runtime fallback, co-authority, dual write, or background sync.
- Existing tracker-less repositories remain GitHub-backed with zero migration and unchanged `#N`, numeric aliases, task-mirror bytes, argv, milestones, comments, and closing behavior.
- Unknown tracker selections fail explicitly; GitHub unavailability never falls back to another store.
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

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` proves the full
GitHub lifecycle and mirrorless cycle with real temporary files and
subprocesses, no network, exact argv, live effective-spec reads, and no
Relay/Matt/craftkit/Projects/Backlog.md runtime dependency.

## Accepted Capability Contracts

- `sprint-execution` — plan state, context, progress, and active/completed sprint invariants.
- `tracker-task-truth` — live GitHub Issue ownership and lifecycle.
- `backlog-sync` — explicit, one-way, non-authoritative legacy export.
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
- Compatibility subtraction/proof: [`../docs/compatibility-subtraction.md`](../docs/compatibility-subtraction.md)
