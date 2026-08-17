# Project Specs

Living contracts only. History: [`../docs/spec-history.md`](../docs/spec-history.md)
and git.

| File | Role |
| --- | --- |
| [`charter.md`](charter.md) | Why this exists, Objectives, project-wide Decisions. |
| [`system-map.md`](system-map.md) | Current system shape and invariants. |
| [`capabilities.md`](capabilities.md) | Per-capability Goal, scope, behaviors, constraints. |

Authoring skills (`spec-charter`, `spec-system-map`, `spec-grill`) live in
[craftkit](https://github.com/sungjunlee/craftkit). This repo consumes the
files; it does not ship the skills.

## Mutation

- Charter Problem/Approach/Non-Goals/Objectives: human-gated.
- Charter and capability Decisions: append-only; superseded rows move to
  `docs/spec-history.md` in a compaction pass.
- Capability Goal/Scope/Behaviors/Hard Constraints: human-gated.
- Capability Learnings: append-only between `LEARN` markers when a writer exists.

Do not copy Issue AC, sprint checkboxes, or review notes into `spec/*`.

Task truth stays in GitHub Issues. Complex execution stays in `backlog/sprints/`.
Routing: [`../skills/dev-backlog/references/authority-contract.md`](../skills/dev-backlog/references/authority-contract.md).
