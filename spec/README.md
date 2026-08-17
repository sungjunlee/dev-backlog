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

Human-gated: charter direction and capability Goal/Scope/Behaviors/Hard Constraints.
Decisions append-only (superseded rows → `docs/spec-history.md`). Learnings append
between `LEARN` markers. Do not copy Issue AC, sprint checkboxes, or review notes.
