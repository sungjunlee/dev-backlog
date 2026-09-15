# Backlog file boundaries

Use this as the shared boundary reference for `dev-backlog` and `backlog-triage`.

## Files

| File | Role | Owned by |
| --- | --- | --- |
| `.dev-backlog/sprints/_context.md` | Operational facts, conventions, and gotchas that would otherwise be rediscovered. | `dev-backlog` |
| `.dev-backlog/sprints/*.md` | Complex execution Plan, Running Context, and Progress for an admitted track. | `dev-backlog` |
| `exports/github-issues/*.md` | Diagnostic/rollback snapshots from explicit `--legacy-export`. Never execution or runtime authority; not under `.dev-backlog/`. | operator (opt-in) |
| `backlog/tasks/*.md` | Leftover operator / Backlog.md tree. The skill does not write here and never treats it as a product parser API; when `.tracker=files`, the `backlog` CLI owns this tree. | Backlog.md / operator |
| `.dev-backlog/triage/*.md` | Derived advisory reports. | `backlog-triage` |
| `.dev-backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations. | `backlog-triage` |

## Rules

- GitHub Issues remain the source of truth for task definitions and acceptance criteria when `.tracker=github`.
- When `.tracker=files`, the Backlog.md CLI is the source of truth; Plan refs are `BACK-N`. The skill never parses or writes `backlog/tasks/*.md` as a product API.
- When `.tracker=gitlab`, GitLab Issues via `glab` are the source of truth; Plan refs are `gitlab#N`.
- Sprint files own batching, context, progress, and handoff only after work meets a complexity admission trigger; simple Issue → PR work is sprint-free.
- Task projections are never read as authority; new mirror features are frozen pending staged retirement. Adapter failure is fail-closed.
- `exports/github-issues/*.md` is an opt-in diagnostic snapshot from `sync-pull.js --legacy-export`. It is not product authority and is not under `.dev-backlog/`.
- `backlog/tasks/*.md` is leftover operator or Backlog.md files. The skill does not write there and never uses it as execution or runtime authority, even when `.tracker=files` (the CLI owns that tree).
- Triage reports are derived, advisory artifacts; they may propose spec changes, but they do not mutate specs.

The spec-side boundaries (`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`, and the legacy root `CHARTER.md` fallback) and how they degrade when thin or absent are covered by [`spec-fallback.md`](spec-fallback.md) — it ships in this bundle and is always resolvable. Their durable authoring home is craftkit's `spec-charter` skill (`npx skills add sungjunlee/craftkit`); when installed, its `references/spec-axis.md` deepens the boundaries — an enhancement, never required.

The sole-owner routing table and optional ecosystem boundaries are in
[`authority-contract.md`](authority-contract.md).
