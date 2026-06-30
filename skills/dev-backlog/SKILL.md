---
name: dev-backlog
argument-hint: "[orient|plan|work|next|sync] [issue-number]"
description: Manage GitHub-Issue-backed sprint execution. Use for issue mirrors, sprint planning or closing, next-work selection, progress sync, milestone-backed backlog work, 다음 작업, 이슈 만들어, 스프린트 계획, 백로그.
compatibility: Requires gh CLI and git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, spec-grill, backlog-triage, relay, relay-plan, relay-dispatch, relay-review, relay-merge"
---

# Dev Backlog

Real job: keep GitHub Issues as the task source of truth while using `backlog/sprints/` as the local execution hub for planning, context, progress, and handoff.

README covers install and human quick start. This file is the agent execution contract: mode routing, file roles, must-do steps, and completion criteria.

Related skills: [`spec-charter`](../spec-charter/SKILL.md) for `spec/charter.md`, [`spec-system-map`](../spec-system-map/SKILL.md) for `spec/system-map.md`, [`spec-grill`](../spec-grill/SKILL.md) for `spec/capabilities.md`, and [`backlog-triage`](../backlog-triage/SKILL.md) for advisory backlog review before sprint planning.

## Mode Router

| User intent | Mode | Completion boundary |
| --- | --- | --- |
| "where are we?", "orient", "status" | `orient` | Active sprint, latest progress, and next unchecked batch are identified. |
| "plan sprint", "make sprint", "start work" with no active sprint | `plan` | One active sprint file exists with Goal, ordered Plan, `objectives:`, and `component:`. |
| "work #N", "continue", "do next batch" | `work` | Issue AC is verified, task/sprint state is updated, and GitHub receives a meaningful status signal. |
| "next", "다음 작업" | `next` | The next actionable batch or sprint-planning need is named. |
| "sync", "pull issues", "refresh backlog" | `sync` | GitHub/local mirrors are explicitly refreshed; no silent background sync. |
| "complete", "close sprint" | `complete` | Sprint/task state is finalized and rediscovery-prone context is promoted. |

If `backlog/` does not exist, bootstrap it with `mkdir -p backlog/{sprints,tasks,completed}` and create `backlog/config.yml`; see `references/file-format.md`.

## Core Contracts

```
GitHub (source of truth — what to do)
  Issues, Milestones, Labels, Comments, PR links
       ↕  gh CLI (sync is always explicit)
Local (execution hub — how to do it)
  backlog/sprints/   <- working files: plan, context, notes, progress
  backlog/tasks/     <- thin GitHub issue mirrors and AC checkboxes
```

- Exactly one sprint file may have `status: active`; scripts warn/refuse ambiguous active sprint state.
- Start every session by reading `backlog/sprints/_context.md` and the active sprint file when present.
- Keep task files thin. AC checkboxes may update there; decisions, progress, and cross-task context stay in the sprint file.
- Completed sprints stay as the permanent execution record.
- Spec-axis boundaries live in `../spec-charter/references/spec-axis.md`; sprint `objectives:` reference charter Objective IDs, and `component:` is one primary capability handle from `spec/capabilities.md`.

## Sprint File Contract

One active sprint file in `backlog/sprints/YYYY-MM-<topic>.md` carries:

| Section / field | Purpose | Completion check |
| --- | --- | --- |
| `status: active` | Marks the single active sprint | No other sprint is active. |
| `objectives: [O1]` | Charter Objective IDs advanced by the sprint | IDs exist and are actionable, or `[]` when no charter exists. |
| `component: "slug"` | Primary capability and relay-Learnings routing handle | Resolves to one capability whose `## Learnings` block receives relay-merge entries, or empty when no target exists. |
| `## Goal` | Sprint-level success statement | One sentence describing done state. |
| `## Plan` | Ordered batches with issue refs and estimates | Every planned task has a checkbox and issue number. |
| `## Running Context` | Decisions/gotchas affecting later tasks | Updated when work reveals reusable context. |
| `## Progress` | Timestamped execution log | Updated at session/batch boundaries. |

Plan checkbox states:

| Marker | Meaning | Set by |
| --- | --- | --- |
| `[ ]` | Not started | `sprint-init.js` or manual planning |
| `[~]` | In-flight: dispatched, PR under review, or actively worked | Manual or dev-relay |
| `[x]` | Done: merged or completed | Manual or dev-relay after verification |

Full sprint and task-file examples live in `references/file-format.md`.

## Execution Path

### Orient

1. Read `_context.md` if present.
2. Find the single active sprint; if none exists, inspect open GitHub issues and route to `plan`.
3. Read the active sprint's Goal, Plan, Running Context, and latest Progress.
4. Identify the next unchecked Plan item or route to `complete` when all items are done.

Done when you can name the current sprint state and the next actionable batch.

### Plan

1. Resolve Objectives from `spec/charter.md`; fall back to legacy root `CHARTER.md`; use `objectives: []` when both are absent.
2. Pull/inspect open issues and assign the sprint milestone when applicable.
3. Create one active sprint file with Goal, ordered Plan batches, estimates, dependencies, `objectives:`, and `component:`.
4. Refuse to create a second active sprint until the previous one is completed.

Done when the sprint file is the single active execution hub and each planned issue has a clear batch position.

### Work

1. Read the current batch and each task file's Description and AC.
2. Mark meaningful GitHub/local status before work when useful.
3. Implement or delegate through dev-relay.
4. Verify every AC item before checking it off.
5. Update Plan checkbox, Running Context, Progress, and GitHub issue comments/labels as appropriate.

Done when verified work is reflected in task AC, sprint progress, and GitHub state.

### Complete

Per issue: all AC checked, implementation merged or committed with `Fixes #N`, Plan checked, and Progress updated.

For a whole sprint:

1. Set `status: completed` and write a final Progress entry.
2. Move completed task files from `backlog/tasks/` to `backlog/completed/`.
3. Promote project-level Running Context entries to `_context.md`.
4. Leave the sprint file in place as the permanent record.

Done when there is no stale active sprint or rediscovery-prone context trapped in the closed sprint.

### Sync

- Pull GitHub -> local at sprint start and when issues change.
- Push local -> GitHub at meaningful milestones: status labels, progress comments, closing issues.
- Never mutate GitHub silently; sync is an explicit action.

Done when the user can tell which direction changed and what was updated.

### Next

Read the active sprint and return the first unchecked actionable batch. If no active sprint exists or the sprint is done, say whether to plan the next sprint or inspect unplanned GitHub work.

## Script Resolution

Resolve scripts from the installed `dev-backlog` skill directory, not from the target project. In a source checkout, that is the local `scripts/` directory beside this `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root.

Concrete pattern:

```bash
skill_dir="skills/dev-backlog" # source checkout; replace with the resolved installed skill dir
bash "$skill_dir/scripts/next.sh"
node "$skill_dir/scripts/sprint-init.js" "next-sprint" --dry-run
```

Useful scripts:

- `scripts/init.sh [project-name]` — bootstrap `backlog/` with config and directories.
- `scripts/next.sh` — show the next actionable batch.
- `scripts/status.sh` — summarize sprint file + GitHub state.
- `scripts/sync-pull.js [PREFIX] [--update] [--dry-run] [--json] [--limit N]` — pull open GitHub issues into `backlog/tasks/`.
- `scripts/sprint-init.js "topic" [--milestone "Name"] [--dry-run] [--json]` — create one active sprint skeleton; refuses a second active sprint.
- `scripts/progress-sync.js [--month YYYY-MM] [--dry-run] [--json] [--relay-manifest PATH] [--finalize]` — sync monthly progress issue.
- `scripts/sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]` — close the single active sprint.
- `scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]` — verify sprint Objective IDs.
- `scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]` — verify sprint `component:` handles.
- `scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]` — check `spec/capabilities.md` compactness and Learnings markers.

## References

- `references/process.md` — detailed Orient/Create/Plan/Work/Complete/Sync/Quick Fix/Unplanned Work/Next workflow.
- `references/file-format.md` — Backlog.md-compatible config/task format and sprint examples.
- `references/github-sync.md` — `gh` CLI patterns for labels, milestones, and sync.
- `references/workflow-patterns.md` — planning, bug triage, feature breakdown, retrospectives.
- `references/integration-contract.md` — dev-relay interop paths, sections, and regex contracts.

## Eval Prompts

- "Orient in a repo with one active sprint, `_context.md`, and a partially complete Plan." Expected: read both context files, name latest Progress, and return the first unchecked batch.
- "Plan a sprint when another sprint is already `status: active`." Expected: refuse or complete the old sprint first; never create a second active sprint.
- "Work issue #42 whose task file has three AC checkboxes." Expected: verify each AC before checking it off, then update Plan, Progress, and GitHub state.
- "Close a sprint with Running Context that applies to future work." Expected: promote durable context to `_context.md`, set sprint completed, and move completed task files.
- "Sync local backlog after GitHub issues changed." Expected: run explicit pull/update logic and report what changed; no background mutation.
