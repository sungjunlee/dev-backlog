# Backlog file boundaries

Use this as the shared boundary reference for `dev-backlog` and `backlog-triage`.

## Files

| File | Role | Owned by |
| --- | --- | --- |
| `backlog/sprints/_context.md` | Operational facts, conventions, and gotchas that would otherwise be rediscovered. | `dev-backlog` |
| `backlog/sprints/*.md` | Sprint execution plan, Running Context, and Progress for current work. | `dev-backlog` |
| `backlog/tasks/*.md` | Thin GitHub Issue mirrors and AC checkboxes. | `dev-backlog` |
| `backlog/triage/*.md` | Derived advisory reports. | `backlog-triage` |
| `backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations. | `backlog-triage` |

## Rules

- GitHub Issues remain the source of truth for task definitions and acceptance criteria.
- Sprint files remain the execution hub for batching, context, progress, and handoff.
- Triage reports are derived, advisory artifacts; they may propose spec changes, but they do not mutate specs.

The spec-side boundaries (`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`, and the legacy root `CHARTER.md` fallback policy) live in the `spec-charter` skill's `references/spec-axis.md`. As of 2026-07 the spec-* skills ship with craftkit (`npx skills add sungjunlee/craftkit`); when installed alongside this skill, they resolve at `../spec-charter/references/spec-axis.md`.
