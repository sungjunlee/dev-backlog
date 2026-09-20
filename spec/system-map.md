# dev-backlog System Map

## System Shape

dev-backlog is a skill suite plus a few deterministic Node/Bash helpers. One declared task authority — GitHub Issues by default, the Backlog.md CLI or GitLab by a one-line `.dev-backlog/.tracker` — is the canonical task-definition and lifecycle authority, read and written by the session through that authority's CLI (the only scripted writer is `triage-apply`, GitHub-only, under its human gate). No task mirror, no export. A sprint file exists only when execution needs continuity beyond one Issue and its PR.

```text
Task authority: GitHub Issue by default (spec + lifecycle + native planning fields)
        |
        +-- simple work -----> implementation -> PR -> close
        |
        `-- complexity admission -> one active sprint file per track
              .dev-backlog/sprints/   Plan / Running Context / Progress
```

`backlog-triage` is an optional, GitHub-only advisory grooming skill over the same Issues (a session-written report plus the human-gated `triage-apply`).
`spec/*` is an optional human-gated yardstick. GitHub Projects is optional and
non-authoritative; delegation to another agent is the session's choice; it adds no
delegation-specific state — delegated work is recorded in the same Plan
pointer, Running Context, and Progress as any other work.
Retrieval/memory is not a product surface (#350 no-go).

## Runtime Boundaries

- The declared task authority (GitHub Issues by default) owns task specification, native planning metadata, and lifecycle.
  Routing table: [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
- Sprint files own only admitted complex execution state.
- `skills/backlog-triage/` owns advisory grooming; GitHub mutation is explicit (`--apply`).
- `spec/*` changes are human-gated. History lives in git (`4fea158` last pre-restructure charter).

## Core Flows

1. **Read** the live task with the authority's Read verb (`gh issue view --json body,comments` by default; on GitHub an `## Agent Brief` comment overrides the body).
2. **Admit** a sprint only for ordered multi-Issue batches, delegated/parallel
   handoff, cross-Issue/session context, or concurrent-track coordination.
3. **Execute**: Issue AC and lifecycle stay on the task authority; an admitted sprint carries
   Plan, Running Context, and Progress.
4. **Complete**: merge the PR, close the Issue; close an admitted sprint only when every Plan item is `[x]` or the rest are struck or carried with a Progress entry (`sprint-close.sh` only warns).
5. **Groom** (optional): triage is advisory until `--apply`.

## Storage And External Systems

- Task authority — selected by `.dev-backlog/.tracker` when present, `github` when the file is absent: GitHub Issues (`gh`), the Backlog.md CLI, or GitLab (`glab`); sole task authority, read by the session, never by a script.
- `.dev-backlog/sprints/` — admitted execution state; completed sprints are history.
- `spec/*` — durable direction when present.
- `.dev-backlog/.tracker` — one line (`github` when absent, `backlog` or its legacy spelling `files`, `gitlab`); no adapter code: the `files` adapter stays parked at `v0.11.0`, the GitLab adapter at `a8ddb7d`.

## Project-Wide Invariants

- One task authority, declared by `.dev-backlog/.tracker` and never inferred from installed CLIs. A failed authority read is fail-closed: no local store, export, or sprint text stands in for it; no dual write or background sync.
- A failed live task read stops execution.
- A sprint is admitted by execution complexity, never duration alone.
- An unavailable optional surface (Projects, the spec axis) is reported and skipped before any effect; it never blocks the Issue → PR path and never becomes authority.
- Automation is report-only toward `spec/*`.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- Agent execution: [`../skills/dev-backlog/SKILL.md`](../skills/dev-backlog/SKILL.md)
