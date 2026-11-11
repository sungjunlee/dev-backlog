# Authority and routing contract

This reference maps each state class to one owner. The [SKILL.md Task
Authority section](../SKILL.md#task-authority) owns authority selection, CLI
verbs, task-specification precedence, and stop conditions; its Sprint
Admission section owns the decision to create a sprint.

## Authority and routing table

Each state class has one authority system. A projection may make that state
easier to view or retrieve, but it never accepts an independent write.

| State class | Sole authority | Write and read route | Non-authoritative surfaces |
| --- | --- | --- | --- |
| Task specification | The declared authority's task and acceptance criteria, resolved by SKILL.md | Use the Task Authority table's native CLI verbs and read back the live task | Sprint Plan text, project views, local copies |
| Task lifecycle | The declared authority's task state | Use the Task Authority table's Create and Close verbs | Sprint checkboxes, project-board fields |
| Planning fields | The declared authority's native metadata (labels, milestone, assignees, and relationships where it has them) | Use the authority's native fields; read them live | GitHub Projects views/fields, triage reports, sprint ordering |
| Complex execution state | One active sprint file for the admitted track | Update its Plan, Running Context, and Progress at explicit boundaries | Delegate run artifacts, PR tabs, chat history, status projections |
| Durable decisions | The bounded `spec/*` contract axis | Follow SKILL.md's Hard Constraints and route each decision to the matching spec file | Issues, sprint Running Context, `_context.md`, generated memory |

## File ownership

| File | Role | Owned by |
| --- | --- | --- |
| `.dev-backlog/sprints/_context.md` | Operational facts and gotchas | `dev-backlog` |
| `.dev-backlog/sprints/*.md` | Admitted-track Plan, Running Context, Progress | `dev-backlog` |
| `.dev-backlog/triage/*.md` | Derived advisory reports | `backlog-triage` |
| `.dev-backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations | `backlog-triage` |

## Optional boundaries

| Surface | Allowed role | Boundary |
| --- | --- | --- |
| GitHub Projects | Optional planning projection | May visualize Issue metadata; project-only fields cannot become task or lifecycle authority and the core flow must work without Projects |
| `backlog-triage` | Optional advisory GitHub Issue review | Reports are derived; only human-accepted actions reach GitHub through its apply rail |
| Spec axis | Optional durable project contract | Its absence does not block task work or the sprint cycle and it never becomes task authority |
| Delegation | Optional execution technique | Record admitted ownership and handoff in the same sprint Plan, Running Context, and Progress |
