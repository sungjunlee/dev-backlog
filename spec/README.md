# Project Specs

Living contracts only. Retired Objective IDs (O3, O5–O9) are never reused;
full texts live at git
[`4fea158`](https://github.com/sungjunlee/dev-backlog/blob/4fea158/spec/charter.md).

| File | Role |
| --- | --- |
| [`charter.md`](charter.md) | Why this exists, Objectives, project-wide Decisions. |
| [`system-map.md`](system-map.md) | Current system shape and invariants. |
| [`capabilities.md`](capabilities.md) | Per-capability Goal, scope, behaviors, constraints. |

Authoring skills (`spec-charter`, `spec-grill`) live in
[craftkit](https://github.com/sungjunlee/craftkit). `spec-charter` owns
`spec/charter.md` and `spec/system-map.md`. This repo consumes the files; it
does not ship the skills.

## Mutation

Human-gated: charter direction and capability Goal/Scope/Behaviors/Hard Constraints.
Decisions append-only (historical rows stay in the table; git is the archive).
Learnings append between `LEARN` markers. Do not copy Issue AC, sprint
checkboxes, or review notes.
