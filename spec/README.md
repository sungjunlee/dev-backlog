# Project Specs

Durable project-level specs live here. Root docs stay focused on entrypoints and agent instructions.

| File | Role |
| --- | --- |
| [`charter.md`](charter.md) | Why the project exists, what good looks like, Objectives, and project-wide Decisions. |
| [`system-map.md`](system-map.md) | High-level system shape: boundaries, flows, storage/external systems, invariants, and pointers. |
| [`capabilities.md`](capabilities.md) | Capability contracts: Goal, Scope, Expected Behaviors, Hard Constraints, Learnings, and Decisions. |

Use `spec-charter` for `charter.md`, `spec-system-map` for `system-map.md`, and `spec-grill` for `capabilities.md`. These authoring skills ship with [craftkit](https://github.com/sungjunlee/craftkit) (`npx skills add sungjunlee/craftkit`), not with this repo.

## Boundary

`spec/*` files hold durable project, system, and capability contracts. Task acceptance criteria stay in GitHub Issues and `backlog/tasks/` mirrors; sprint execution context stays in `backlog/sprints/`; relay Done Criteria, rubrics, and review notes stay in dev-relay run artifacts.

Spec skills may read task AC and sprint evidence to understand current reality, but they must not copy issue-specific AC, frozen Done Criteria, or review notes into durable specs.
