# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus deterministic Node/Bash helpers. One
configuration value selects canonical task truth; sprint Markdown remains the
shared execution hub in both modes.

```text
backlog/config.yml: tracker
        |
        v
tracker.js (configured-only resolve, availability, capability gate)
        |
        +-- github-tracker.js -> gh -> GitHub Issues (canonical)
        |                         `-> backlog/tasks/ derived mirrors
        |
        `-- local-tracker.js  -> backlog/tasks/ active canonical tasks
                                  backlog/completed/ closed canonical tasks

backlog/sprints/ (canonical execution hub)
        +-> sprint-state.js -> status.sh --json / next.sh --json
        +-> backlog-doctor.js
        `-> capability-gated GitHub mirror/progress transports
```

`setup-dev-backlog.js` persists a deliberate `github` or `local` choice. A
missing key remains GitHub for backward compatibility without rewriting the
config. Availability failure is never a selection mechanism, and runtime never
probes or falls back to the other adapter.

## Runtime Boundaries

- `skills/dev-backlog/scripts/tracker.js` owns configured resolution, the exact seven-operation adapter contract, identity validation, capability discovery/gating, and the shared unsupported-capability error/serializer.
- `github-tracker.js` owns required GitHub task lifecycle argv/translation. Named GitHub modules own milestones, sprint mirrors, Progress/PR/comments, and other optional transports.
- `local-tracker.js` owns the canonical local filesystem lifecycle and reports no optional provider capabilities. It never invokes `gh`.
- `task-ref.js` owns complete `#N` and `{PREFIX}-N[.M]` parsing/rendering. GitHub keeps numeric `issue_number`; local exposes `null` for that compatibility alias.
- `sprint-state.js` remains the single machine parser of sprint Markdown; `status.sh --json`, `next.sh --json`, mirror rendering, and doctor projections consume its state.
- `skills/backlog-triage/` owns advisory grooming. Provider enrichment/mutation remains capability-gated and explicit.
- Craftkit-installed spec authoring skills own human-gated changes to `spec/`; dev-backlog reads those files as optional yardsticks.

Detailed adapter mechanics, the pre-seam inventory, and the compatibility matrix
are single-sourced in [`docs/tracker-adapter-design.md`](../docs/tracker-adapter-design.md).

## Core Flows

1. **Setup:** create minimum directories and persist exactly one tracker; never migrate task files.
2. **Create/read/update/close:** call the configured adapter's required lifecycle and carry normalized `{ tracker, id, ref, url? }` identity.
3. **Materialize:** GitHub mode explicitly mirrors canonical issues through `sync-pull.js`; local mode already stores canonical Markdown and has no provider sync.
4. **Plan/orient:** write normalized refs into the active track's sprint file; consume state via `status.sh --json` / `next.sh --json` (`--track` selects among multiple disjoint-scope tracks).
5. **Complete:** close the canonical task, check the Plan, run `sprint-close.sh` (`--track` when multiple tracks are active), archive remaining checked task files, and retain sprint history.
6. **Publish/enrich:** milestones, PR relationships, sprint mirrors, Progress issues, comments, and closing semantics run only when reported. Unsupported requests return the shared typed error before effects.
7. **Groom/spec:** triage stays advisory by default; doctor/reassess may recommend spec work but do not mutate durable specs automatically.

## Storage And External Systems

- `backlog/config.yml`: the only tracker-selection authority plus Backlog.md settings.
- GitHub Issues: canonical task truth only for `tracker: github`.
- `backlog/tasks/` and `backlog/completed/`: derived GitHub mirrors or canonical local tasks according to the configured mode.
- `backlog/sprints/`: canonical execution state in both modes, committed at explicit boundaries.
- `gh`: GitHub-mode bridge only; acceptance tests replace it with an argv recorder and local tests trap it.
- Git: versioned Markdown, scripts, and durable specs.

## Project-Wide Invariants

- Exactly one configured adapter owns canonical task truth; no runtime fallback, co-authority, or background sync.
- Existing tracker-less repositories remain GitHub-backed with zero migration and unchanged `#N`, numeric aliases, mirror bytes, argv, milestones, mirrors, progress, comments, and closing behavior.
- Local mode implements only the core task lifecycle. It never fabricates provider semantics or URLs.
- Unsupported optional capabilities have stable code `TRACKER_CAPABILITY_UNSUPPORTED`, tracker, capability, message, and remediation; JSON and human boundaries share that one serializer contract.
- Sprint files remain the execution hub and completed sprint files are immutable history.
- Automation is report-only toward `spec/*`; `spec/charter.md` is canonical and root `CHARTER.md` is legacy fallback only.
- Helpers run on POSIX and Git-for-Windows Bash; native filesystem paths stay internal while stable serialized fields normalize to `/`; POSIX-only open-lock-replacement race tests are documented Windows skips.

## Executable Evidence

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` proves both full
cycles with real temporary files and subprocesses, no network, exact GitHub
compatibility evidence, local zero-provider evidence, body-preserving updates,
Done archive/final reads, and every optional-capability failure shape. This
implementation proof merged as PR #303 (2026-07-12); O8 and O9 are validated
(`charter.md:43-44`).

## Accepted Capability Contracts

- `sprint-execution` — plan state, context, progress, and active/completed sprint invariants.
- `tracker-task-truth` — configured ownership, normalized lifecycle/identity, capability discovery, and deterministic degradation.
- `backlog-sync` — explicit materialization/publication without overwriting human-authored content.
- `triage-grooming` — advisory classification, relationships, stale signals, Alignment, and Decision Review.
- `task-progress-reporting` — capability-gated monthly GitHub Progress synchronization/finalization.

## Open Boundary Questions

GitLab, Gitea, and Forgejo remain future candidates after the merged
`github`/`local` proof. They must fit the same authority and capability rules;
the current interface does not promise generic provider parity or a published
tracker-neutral shape.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Sprint execution contract: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
- Actor/JSON contract: [`../skills/dev-backlog/references/integration-contract.md`](../skills/dev-backlog/references/integration-contract.md)
- Adapter compatibility/proof: [`../docs/tracker-adapter-design.md`](../docs/tracker-adapter-design.md)
