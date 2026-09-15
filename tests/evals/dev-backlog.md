# dev-backlog fresh-session eval prompts

- "Orient in a repo with one active sprint, `_context.md`, and a partially complete Plan." Expected: read both context files, name latest Progress, and return the first unchecked batch.
- "Plan a sprint whose scope overlaps a track that is already `status: active`." Expected: refuse, naming the conflicting track — declare a disjoint `component:`/`scope:` or complete the conflicting track first. Disjoint scopes are NOT refused; they open a second track.
- "Orient in a repo with two disjoint active tracks (`auth` scoped to `src/auth/**`, `billing` to `src/billing/**`), each with its own Plan." Expected: a portfolio view naming both tracks and each next batch; `next --track auth` returns auth's next batch deterministically.
- "Repo with no spec axis: open GitHub issues but no `.dev-backlog/`, no `spec/`, no root `CHARTER.md`, and no craftkit `spec-*` skills installed. Reach a first active sprint." Expected: bootstrap `.dev-backlog/`, route to `plan`, and create the sprint with `objectives:`/`component:` omitted (no spec axis to reference); never follow or require a `../spec-charter/...` path.
- "Repo with no spec axis: one self-contained GitHub issue, no `.dev-backlog/`, and no Relay." Expected: use the Issue → PR path without requiring a sprint, Projects board, generated memory, or optional skill.
- "Work issue #42 with no local task files and three live Issue AC checkboxes." Expected: run the effective task-spec resolver, verify its source digest and every AC, update GitHub state, and update Plan/Progress only if the work has an admitted sprint.
- "Fresh online session with no local task files." Expected: recover sprint continuity from `status.sh --json`/`next.sh --json`, then resolve task intent, AC, and lifecycle from the live Issue; resolves the task through the effective task-spec resolver (which owns source precedence).
- "Fresh session with only repo files available, no conversation history, and no GitHub access." Expected: recover execution continuity and every in-flight `[~]` owner/pointer from `status.sh --json`/`next.sh --json`, but stop before task execution or AC/lifecycle claims because the live task cannot resolve; never read a legacy export as fallback.
- "Close a sprint with Running Context that applies to future work and no local task files." Expected: promote durable context to `_context.md`, set the sprint completed, and finish without requiring or creating `backlog/tasks/`, `backlog/completed/`, or `exports/github-issues/`.
- "GitHub Issue changed during work." Expected: re-run the live effective
  task-spec resolver and review a changed source revision; do not write a
  local task file. Only an explicit rollback/diagnostic request runs
  `sync-pull.js --legacy-export`, with no background mutation.
