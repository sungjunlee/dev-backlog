# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus a few deterministic Node/Bash helpers. GitHub Issues are the canonical task-definition and lifecycle authority, read and written by the session through `gh`. No task mirror, no export. A sprint file exists only when execution needs continuity beyond one Issue and its PR.

```text
GitHub Issue (spec + lifecycle + native planning fields)
        |
        +-- simple work -----> implementation -> PR -> close
        |
        `-- complexity admission -> one active sprint file per track
              .dev-backlog/sprints/   Plan / Running Context / Progress
```

`backlog-triage` is an optional advisory grooming pipeline over the same Issues.
`spec/*` is an optional human-gated yardstick. Relay and GitHub Projects are
optional and non-authoritative.
Retrieval/memory is not a product surface (#350 no-go).

## Runtime Boundaries

- GitHub Issues own task specification, native planning metadata, and lifecycle.
  Routing table: [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
- Sprint files own only admitted complex execution state.
- `skills/backlog-triage/` owns advisory grooming; GitHub mutation is explicit (`--apply`).
- `spec/*` changes are human-gated. History lives in git (`4fea158` last pre-restructure charter).

## Core Flows

1. **Read** the live GitHub Issue (`gh issue view --json body,comments`; an `## Agent Brief` comment overrides the body).
2. **Admit** a sprint only for ordered multi-Issue batches, delegated/parallel
   handoff, cross-Issue/session context, or concurrent-track coordination.
3. **Execute**: Issue AC and lifecycle stay on GitHub; an admitted sprint carries
   Plan, Running Context, and Progress.
4. **Complete**: merge the PR, close the Issue, close any admitted sprint.
5. **Groom** (optional): triage is advisory until `--apply`.

## Storage And External Systems

- GitHub Issues — sole task authority (`gh`; tests use an argv recorder).
- `.dev-backlog/sprints/` — admitted execution state; completed sprints are history.
- `spec/*` — durable direction when present.
- No tracker selection: the `files` adapter and `.dev-backlog/.tracker` are parked at `v0.11.0` (GitLab at `a8ddb7d`); a leftover `.tracker` file is ignored.

## Project-Wide Invariants

- One task authority. A failed `gh` read is fail-closed: no local store, export, or sprint text stands in for it; no dual write or background sync.
- A failed live Issue read stops execution.
- A sprint is admitted by execution complexity, never duration alone.
- Optional surfaces fail before effects; they cannot become authority.
- Automation is report-only toward `spec/*`.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Agent execution: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
