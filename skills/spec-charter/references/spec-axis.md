# Spec Axis Boundary

Use this as the shared boundary reference for `spec-charter`, `spec-system-map`, `spec-grill`, `dev-backlog`, and `backlog-triage`.

## Files

| File | Role | Owned by |
| --- | --- | --- |
| `spec/charter.md` | Why the project exists, what good looks like, Non-Goals, Objectives, and project-wide Decisions. | `spec-charter` |
| `spec/system-map.md` | High-level system shape: runtime boundaries, core flows, storage/external systems, invariants, and pointers. | `spec-system-map` |
| `spec/capabilities.md` | Capability contracts: Goal, Scope, Expected Behaviors, Hard Constraints, Learnings, and Decisions. | `spec-grill` |
| `backlog/sprints/_context.md` | Operational facts, conventions, and gotchas that would otherwise be rediscovered. | `dev-backlog` |
| `backlog/sprints/*.md` | Sprint execution plan, Running Context, and Progress for current work. | `dev-backlog` |
| `backlog/tasks/*.md` | Thin GitHub Issue mirrors and AC checkboxes. | `dev-backlog` |
| `backlog/triage/*.md` | Derived advisory reports. | `backlog-triage` |
| `backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations. | `backlog-triage` |
| `CLAUDE.md` / `AGENTS.md` | Agent harness instructions and local development guardrails. | Repository maintainers |
| `README.md` | Outward-facing introduction and user-facing entrypoints. | Repository maintainers |

## Rules

- `spec/*` files are durable project, system, and capability contracts.
- GitHub Issues remain the source of truth for task definitions and acceptance criteria.
- Sprint files remain the execution hub for batching, context, progress, and handoff.
- Triage reports are derived artifacts; they may propose spec changes, but they do not mutate specs.
- Agent harness files can inform workflow and guardrails, but they are not product authority unless they explicitly describe product boundaries.
- Legacy root `CHARTER.md` is read only as a fallback for older repos; new and migrated charters use `spec/charter.md`.
- Spec skills may read task AC, sprint evidence, tests, docs, and commit history to understand reality, but they must not copy issue-specific AC, frozen Done Criteria, or review notes into durable specs.
