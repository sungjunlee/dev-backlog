# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic Node/Bash helpers. GitHub Issues are the canonical task-definition and lifecycle authority; there is no required task mirror, only an optional legacy export behind an explicit flag. Sprint Markdown is created only for complex execution continuity; optional projections never accept independent writes.

```text
GitHub Issue (task spec + lifecycle + native planning fields)
        |                         gh CLI via github-tracker.js
        +-- simple work ----------------------> implementation -> PR -> close
        |
        `-- complexity admission -> one active sprint file per track
              backlog/sprints/      +-> Plan / Running Context / Progress
                                    +-> sprint-state.js -> status.sh / next.sh --json
                                    `-> backlog-doctor.js (health + reassess signal)

spec/* (human-gated durable decisions; history in docs/spec-history.md)
sync-pull --legacy-export (explicit one-way diagnostic/rollback projection)
retrieval / Projects / Relay / Backlog.md (optional, non-authoritative)
```

`setup-dev-backlog.js` persists `github` in `backlog/.tracker`; a missing file accepts only a legacy `tracker: github` config key, then defaults to GitHub. Any other selection fails; availability failure is never a selection mechanism or fallback trigger.

## Runtime Boundaries

- GitHub Issues own task specification, native planning metadata, and lifecycle. The full sole-owner table lives in [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
- Sprint files own only admitted complex execution state; `sprint-state.js` is the single machine parser of sprint Markdown, consumed by `status.sh --json`, `next.sh --json`, and doctor projections.
- `tracker.js` owns configured resolution, the adapter contract, and capability gating; `github-tracker.js` owns GitHub argv/translation; `task-ref.js` owns `#N` parsing plus historical Backlog.md filename parsing for explicit import/export.
- `skills/backlog-triage/` owns advisory grooming; provider mutation stays capability-gated and explicit.
- Craftkit-installed spec authoring skills own human-gated changes to `spec/`; dev-backlog reads those files as optional yardsticks.

The retained seam inventory and compatibility subtraction evidence are single-sourced in [`docs/compatibility-subtraction.md`](../docs/compatibility-subtraction.md).

## Core Flows

1. **Resolve:** read the live GitHub Issue as task specification and lifecycle authority (`effective-task-spec.js`).
2. **Admit:** keep self-contained Issue → PR work sprint-free; create a sprint only for ordered multi-Issue batches, delegated/parallel handoff, cross-Issue/session context, or concurrent-track coordination.
3. **Execute:** when admitted, update one track's Plan, Running Context, and Progress at explicit boundaries; task acceptance and lifecycle remain on the Issue.
4. **Complete:** merge the PR, close/update the Issue, and close any admitted sprint while retaining its committed history.
5. **Groom/spec:** triage stays advisory by default; doctor/reassess may recommend human-gated spec work but never mutate durable specs automatically.

## Storage And External Systems

- GitHub Issues: sole task-definition and lifecycle authority (bridge: `gh`; acceptance tests replace it with an argv recorder).
- `backlog/sprints/`: admitted complex execution state, committed at explicit boundaries; completed sprints are immutable history.
- `spec/*`: human-gated durable project, system, and capability decisions; `docs/spec-history.md` and git history hold the archive.
- `backlog/.tracker` and `backlog/config.yml`: GitHub selection and frozen legacy Backlog.md settings.
- `backlog/tasks/` and `backlog/completed/`: non-authoritative one-way legacy exports.

## Project-Wide Invariants

- GitHub Issues own task truth; no runtime fallback, co-authority, dual write, or background sync. Unknown tracker selections fail explicitly; GitHub unavailability never falls back to another store.
- Task projections are diagnostic/export material only. A failed live Issue read stops execution; stale projection bytes cannot authorize task work or lifecycle changes.
- Unsupported optional capabilities fail before effects with the stable `TRACKER_CAPABILITY_UNSUPPORTED` contract; JSON and human boundaries share one serializer.
- A sprint is admitted by execution complexity, never duration alone; the no-spec/no-Relay cold-adopter paths work both sprint-free and through a complete sprint cycle.
- Relay, GitHub Projects, Backlog.md, and retrieval/memory experiments remain optional, non-authoritative, and outside the core path.
- Automation is report-only toward `spec/*`; `spec/charter.md` is canonical and root `CHARTER.md` is legacy fallback only.
- Helpers run on POSIX and Git-for-Windows Bash; stable serialized fields normalize to `/`.

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` proves the full GitHub lifecycle and mirrorless cycle with real temporary files and subprocesses, no network, exact argv, and no Relay/craftkit/Projects/Backlog.md runtime dependency.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Actor/JSON contract: [`../skills/dev-backlog/references/integration-contract.md`](../skills/dev-backlog/references/integration-contract.md)
- Spec history archive: [`../docs/spec-history.md`](../docs/spec-history.md)
