# Backlog file boundaries

Use this as the shared boundary reference for `dev-backlog` and `backlog-triage`.

## Files

| File | Role | Owned by |
| --- | --- | --- |
| `backlog/sprints/_context.md` | Operational facts, conventions, and gotchas that would otherwise be rediscovered. | `dev-backlog` |
| `backlog/sprints/*.md` | Complex execution Plan, Running Context, and Progress for an admitted track. | `dev-backlog` |
| `backlog/tasks/*.md` | Non-authoritative GitHub Issue projections retained during migration. | `dev-backlog` |
| `backlog/triage/*.md` | Derived advisory reports. | `backlog-triage` |
| `backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations. | `backlog-triage` |

## Rules

- GitHub Issues remain the source of truth for task definitions and acceptance criteria.
- Sprint files own batching, context, progress, and handoff only after work meets a complexity admission trigger; simple Issue → PR work is sprint-free.
- Task projections are never read as authority or dual-written; new mirror features are frozen pending staged retirement.
- Triage reports are derived, advisory artifacts; they may propose spec changes, but they do not mutate specs.

The spec-side boundaries (`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`, and the legacy root `CHARTER.md` fallback) and how they degrade when thin or absent are covered by [`spec-fallback.md`](spec-fallback.md) — it ships in this bundle and is always resolvable. Their durable authoring home is craftkit's `spec-charter` skill (`npx skills add sungjunlee/craftkit`); when installed, its `references/spec-axis.md` deepens the boundaries — an enhancement, never required.

The sole-owner routing table and optional ecosystem boundaries are in
[`authority-contract.md`](authority-contract.md).
