---
name: dev-backlog
argument-hint: "[orient|create|plan|work|next|sync|complete] [issue-number]"
description: Manage configured-tracker-backed sprint execution. Use for GitHub mirrors or offline local tasks, sprint planning or closing, next-work selection, progress sync, 다음 작업, 이슈 만들어, 스프린트 계획, 백로그.
compatibility: Requires git and Node.js 18+; GitHub mode also requires gh CLI. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, spec-grill, backlog-triage, relay, relay-plan, relay-dispatch, relay-review, relay-merge"
---

# Dev Backlog

Real job: keep exactly one configured tracker as canonical task truth while
using `backlog/sprints/` as the local execution hub for planning, context,
progress, and handoff.

README covers install and human quick start. This file is the agent execution contract: mode routing, file roles, must-do steps, and completion criteria.

## Mode Router

| User intent | Mode | Completion boundary |
| --- | --- | --- |
| "where are we?", "orient", "status" | `orient` | Active sprint, latest progress, and next unchecked batch are identified. |
| "create issue", "new issue", "이슈 만들어" | `create` | A task is created in the configured canonical tracker and added to the current sprint Plan when in scope. |
| "plan sprint", "make sprint", "start work" with no active sprint | `plan` | One active sprint file exists with Goal, ordered Plan, `objectives:`, and `component:`. |
| "work #N", "work BACK-N", "continue", "do next batch" | `work` | Task AC is verified and configured-tracker plus sprint state are updated. |
| "next", "다음 작업" | `next` | The next actionable batch or sprint-planning need is named. |
| "sync", "pull issues", "refresh backlog" | `sync` | GitHub mirrors are explicitly refreshed; local canonical files need no provider sync. |
| "complete", "close sprint" | `complete` | Sprint/task state is finalized and rediscovery-prone context is promoted. |

If `backlog/` does not exist, run `scripts/setup-dev-backlog.js --tracker
github|local --non-interactive`; see `references/file-format.md`. Never infer a
tracker from availability.

Related skills (none required for either core cycle): when installed, `spec-charter` (`spec/charter.md`), `spec-system-map` (`spec/system-map.md`), and `spec-grill` (`spec/capabilities.md`) ship with craftkit (`npx skills add sungjunlee/craftkit`) and supply the optional spec axis; [`backlog-triage`](../backlog-triage/SKILL.md) provides advisory backlog review before sprint planning. Degradation when they are absent is specified in `references/spec-fallback.md`.

## Core Contracts

```
backlog/config.yml (one tracker: github | local)
  github -> GitHub Issues canonical; backlog/tasks/ are explicit mirrors
  local  -> backlog/tasks/ + completed/ are canonical; zero provider calls

backlog/sprints/ <- shared execution hub in both modes
```

- Exactly one sprint file may have `status: active`; scripts warn/refuse ambiguous active sprint state.
- Start every session by reading `backlog/sprints/_context.md` and the active sprint file when present.
- Task files are thin mirrors in GitHub mode and canonical records in local mode. In both modes, decisions, progress, and cross-task context stay in the sprint file.
- A missing `tracker:` key is the zero-migration GitHub compatibility default. Runtime failure never changes the selected tracker.
- Optional provider capabilities are not part of the core lifecycle. Unsupported requests fail before effects through the shared typed error contract in `tracker.js`; public JSON surfaces emit one structured error and human surfaces include the same remediation.
- Completed sprints stay as the permanent execution record.
- Backlog-side file boundaries live in `references/backlog-boundaries.md`. Spec-axis boundaries and how `objectives:`/`component:` degrade when spec files are absent live in `references/spec-fallback.md` (in-bundle, always resolvable); their durable authoring home is craftkit's `spec-charter` skill, consulted when installed. Sprint `objectives:` reference charter Objective IDs, and `component:` is one primary capability handle from `spec/capabilities.md`.

## Sprint File Contract

One active sprint file in `backlog/sprints/YYYY-MM-<topic>.md` carries:

| Section / field | Purpose | Completion check |
| --- | --- | --- |
| `status: active` | Marks the single active sprint | No other sprint is active. |
| `objectives: [O1]` | Charter Objective IDs advanced by the sprint | IDs exist and are actionable; omit the field entirely when no charter exists (see `references/spec-fallback.md`). |
| `component: "slug"` | Primary capability and relay-Learnings routing handle | Resolves to one capability whose `## Learnings` block receives relay-merge entries; omit the field entirely when no capabilities file exists. |
| `## Goal` | Sprint-level success statement | One sentence describing done state. |
| `## Plan` | Ordered batches with normalized task refs and estimates | Every planned task has a checkbox and complete `#N` or `{PREFIX}-N[.M]` ref. |
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
2. Find the single active sprint; if none exists, list open tasks through the configured adapter and route to `plan`.
3. Read the active sprint's Goal, Plan, Running Context, and latest Progress.
4. Identify the next unchecked Plan item or route to `complete` when all items are done.

Done when you can name the current sprint state and the next actionable batch.

### Create

Follow `references/process.md` → `## Create — New Issues`.

Done when the new task exists in the configured canonical store and is added to
the active sprint Plan when in scope. GitHub mode may explicitly refresh its
local mirror; local mode already wrote the canonical task file.

### Plan

1. Resolve Objectives from `spec/charter.md`; fall back to legacy root `CHARTER.md`; omit the `objectives:` field entirely when both are absent (see `references/spec-fallback.md`).
2. List/inspect open tasks. Use milestone selection only when the configured adapter reports `milestones`; local planning writes normalized refs directly and does not fabricate one.
3. Create one active sprint file with Goal, ordered Plan batches, estimates, dependencies, `objectives:`, and `component:`. Plan batches are execution waves: intra-batch items MUST be mutually parallel-safe (disjoint files, no ordering between them), dependent items MUST go in a later batch, and batch order is execution order.
4. Refuse to create a second active sprint until the previous one is completed.

Done when the sprint file is the single active execution hub and each planned issue has a clear batch position.

### Work

1. Read the current batch and each task file's Description and AC.
2. Mark meaningful GitHub/local status before work when useful.
3. Implement or delegate through dev-relay.
4. Verify every AC item before checking it off.
5. Update Plan checkbox, Running Context, Progress, and neutral task state. Use comments/PR relationships only after their capability gates succeed.

Done when verified work is reflected in task AC, sprint progress, and the configured canonical task state.

### Complete

Per task: all AC checked, implementation merged or committed, Plan checked, and
Progress updated. `Fixes #N` and provider closing links apply only when GitHub's
`closing-semantics` capability is intentionally used.

For a whole sprint:

1. Run `sprint-close.sh`; it runs `backlog-doctor.js` before the status flip and prints any reassess recommendation in the close summary.
2. Set `status: completed` and write a final Progress entry.
3. Move completed task files from `backlog/tasks/` to `backlog/completed/`.
4. Promote project-level Running Context entries to `_context.md`.
5. Leave the sprint file in place as the permanent record.

`sprint-close.sh` prints `backlog-doctor.js`'s `reassess_signal`, which recommends `spec-charter reassess` when the doctor warns/fails or 3+ sprints have closed since the last dated reassess report — full accounting in `references/integration-contract.md` § Backlog Doctor JSON Surface. Unattended sessions may run `reassess` (report-only) but must never run `amend`.

Done when there is no stale active sprint or rediscovery-prone context trapped in the closed sprint.

### Sync

- GitHub: pull canonical issues into mirrors at sprint start and when they change; provider writes remain explicit.
- Local: task files are already canonical; do not call `gh` or manufacture a push/pull step.
- Never perform background sync or switch trackers after a failure.

Done when the user can tell which direction changed and what was updated.

### Next

Read the active sprint and return the first unchecked actionable batch. If no active sprint exists or the sprint is done, say whether to plan the next sprint or inspect unplanned configured-tracker work.

## Script Resolution

Resolve scripts from the installed `dev-backlog` skill directory, not from the target project. In a source checkout, that is the local `scripts/` directory beside this `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root.

Concrete pattern:

```bash
skill_dir="skills/dev-backlog" # source checkout; replace with the resolved installed skill dir
bash "$skill_dir/scripts/next.sh"
node "$skill_dir/scripts/sprint-init.js" "next-sprint" --dry-run
```

Core scripts (full flag inventory in `references/scripts.md`):

- `scripts/init.sh` — bootstrap `backlog/`.
- `scripts/setup-dev-backlog.js` — persist the explicit canonical tracker without migrating task files.
- `scripts/sync-pull.js` — materialize configured open tasks; in GitHub mode, preserve legacy mirrors.
- `scripts/sprint-init.js` — create a milestone-backed sprint when supported; local plans are authored from normalized refs.
- `scripts/next.sh` / `scripts/status.sh` — next actionable batch and tracker-neutral sprint state.
- `scripts/sprint-close.sh` — close the active sprint; prints the doctor/reassess summary.
- `scripts/backlog-doctor.js` — aggregate health checks; JSON includes `reassess_signal`.

## References

- `references/scripts.md` — full script/flag inventory beyond the core-path scripts above.
- `references/process.md` — detailed Orient/Create/Plan/Work/Complete/Sync/Quick Fix/Unplanned Work/Next workflow.
- `references/file-format.md` — Backlog.md-compatible config/task format and sprint examples.
- `references/github-sync.md` — `gh` CLI patterns for labels, milestones, and sync.
- `references/workflow-patterns.md` — planning, bug triage, feature breakdown, retrospectives.
- `references/integration-contract.md` — dev-relay interop paths, sections, and regex contracts.
- `references/checkbox-repair.md` — runbook for repairing an unmoored `[~]` after a doctor warn.
- `references/backlog-boundaries.md` — backlog-side file boundaries and ownership.
- `references/spec-fallback.md` — spec-axis degradation contract (in-bundle): `objectives:`/`component:` semantics and triage behavior when spec files are thin or absent.

## Eval Prompts (fresh-session recovery)

- "Orient in a repo with one active sprint, `_context.md`, and a partially complete Plan." Expected: read both context files, name latest Progress, and return the first unchecked batch.
- "Plan a sprint when another sprint is already `status: active`." Expected: refuse or complete the old sprint first; never create a second active sprint.
- "(Multi-track target — PRD 2026-07-multi-track-sprints, gated on #291/#293/#295) Orient in a repo with two disjoint active tracks (`auth` scoped to `src/auth/**`, `billing` to `src/billing/**`), each with its own Plan." Expected: a portfolio view naming both tracks and each next batch; `next --track auth` returns auth's next batch deterministically; `backlog-doctor` passes because scopes are disjoint. Once this lands, the prior bullet's single-active refusal narrows to *overlapping-scope* tracks; disjoint tracks coexist.
- "Cold adopter: a repo with open GitHub issues but no `backlog/`, no `spec/`, no root `CHARTER.md`, and no craftkit `spec-*` skills installed. Reach a first active sprint." Expected: bootstrap `backlog/`, route to `plan`, and create the sprint with `objectives:`/`component:` omitted (no spec axis to reference); never follow or require a `../spec-charter/...` path.
- "Work issue #42 whose task file has three AC checkboxes." Expected: verify each AC before checking it off, then update Plan, Progress, and GitHub state.
- "Fresh session with only repo files available, no conversation history, and no GitHub access." Expected: use `status.sh --json` and `next.sh --json` to name the active sprint, next actionable batch, and every in-flight `[~]` item with its owner/pointer (PR, branch, or run-id); if `--json` is unavailable, read the sprint file directly.
- "Close a sprint with Running Context that applies to future work." Expected: promote durable context to `_context.md`, set sprint completed, and move completed task files.
- "Sync local backlog after GitHub issues changed." Expected: run explicit pull/update logic and report what changed; no background mutation.
