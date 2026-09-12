---
name: dev-backlog
argument-hint: "[orient|create|plan|work|next|complete] [issue-number]"
description: Manage GitHub-backed sprint execution. Use for sprint planning or closing, next-work selection, 다음 작업, 이슈 만들어, 스프린트 계획, 백로그.
compatibility: Requires git, Node.js 18+, and gh CLI. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, spec-grill, backlog-triage, relay, relay-plan, relay-dispatch, relay-review, relay-merge"
---

# Dev Backlog

Real job: keep GitHub Issues as task-definition and lifecycle truth while using
`backlog/sprints/` only when complex execution needs a shared continuity,
progress, or handoff record.

README covers install and human quick start. This file is the agent execution contract: mode routing, file roles, must-do steps, and completion criteria.

## Mode Router

| User intent | Mode | Completion boundary |
| --- | --- | --- |
| "where are we?", "orient", "status" | `orient` | Any admitted sprint state is identified; otherwise the next live Issue is named without manufacturing a sprint. |
| "create issue", "new issue", "이슈 만들어" | `create` | A GitHub Issue is created and added to an active sprint Plan only when that work was admitted. |
| "plan sprint", "make sprint", or complex work with no active sprint | `plan` | One active sprint file exists with Goal and ordered Plan; `objectives:`/`component:` are present only when their backing spec files exist. |
| "work #N", "continue", "do next batch" | `work` | Live Issue AC is verified and lifecycle is updated; an admitted sprint is also updated when present. |
| "next", "다음 작업" | `next` | The next actionable batch or sprint-planning need is named. |
| "complete", "close sprint" | `complete` | Sprint/task state is finalized and rediscovery-prone context is promoted. |

If `backlog/` does not exist, run `scripts/setup-dev-backlog.js --tracker
github --non-interactive`; see `references/file-format.md`.

Related skills (none required for either core cycle): when installed, `spec-charter` (`spec/charter.md` and `spec/system-map.md`) and `spec-grill` (`spec/capabilities.md`) ship with craftkit (`npx skills add sungjunlee/craftkit`) and supply the optional spec axis; [`backlog-triage`](../backlog-triage/SKILL.md) provides advisory backlog review before sprint planning. Degradation when they are absent is specified in `references/spec-fallback.md`.

The state ownership, compatibility, and optional-integration boundary
are single-sourced in [`references/authority-contract.md`](references/authority-contract.md).

## Core Contracts

```
GitHub Issues               <- canonical task definition and lifecycle
backlog/sprints/            <- optional complex-execution hub (one active file per track)
backlog/sprints/_context.md <- cross-sprint project context
```

- One active track per scope: sprints with `status: active` must declare disjoint scopes (`component:` equality or `scope:` glob collision = overlap, decided by the shared `scopesOverlap` predicate). Disjoint tracks coexist as a portfolio; overlapping tracks fail loud; most repos run a single track, which behaves exactly as before.
- Start every session by reading `backlog/sprints/_context.md` and the active sprint file when present.
- GitHub Issues own task truth; decisions, progress, and cross-task context stay in an admitted sprint file.
- Completed sprints stay as the permanent execution record.
- Backlog-side file boundaries live in `references/backlog-boundaries.md`. Spec-axis boundaries and how `objectives:`/`component:` degrade when spec files are absent live in `references/spec-fallback.md` (in-bundle, always resolvable); their durable authoring home is craftkit's `spec-charter` skill, consulted when installed. Sprint `objectives:` reference charter Objective IDs, and `component:` is one primary capability handle from `spec/capabilities.md`.

## Sprint Admission

The default path is sprint-free Issue → implementation → PR → Issue closure.
Create a sprint only when execution complexity requires continuity beyond one
Issue and its PR: ordered multi-Issue batches, delegated or parallel handoff,
cross-Issue/session context, or concurrent track coordination. Duration,
estimate, milestone membership, and Relay presence alone do not trigger a
sprint. Once admitted, the sprint owns execution continuity only; the Issue
continues to own task specification and lifecycle.

## Sprint File Contract

Each active sprint file (one per track) in `backlog/sprints/YYYY-MM-<topic>.md` carries:

| Section / field | Purpose | Completion check |
| --- | --- | --- |
| `status: active` | Marks an active track | No other active sprint overlaps this track's scope. |
| `objectives: [O1]` | Charter Objective IDs advanced by the sprint | IDs exist and are actionable; omit the field entirely when no charter exists (see `references/spec-fallback.md`). |
| `component: "slug"` | Primary capability handle, relay-Learnings routing, and the track-scope key | Resolves to one capability whose `## Learnings` block receives relay-merge entries; omit the field entirely when no capabilities file exists. |
| `scope: ["glob"]` | Explicit path-glob track scope when no component axis fits (one axis per track, never both; never inferred) | Optional; declared via `sprint-init.js --scope`. When more than one track is active, every track must declare an axis or the doctor draws an informational warn. |
| `## Goal` | Sprint-level success statement | One sentence describing done state. |
| `## Plan` | Ordered batches with normalized task refs and estimates | Every planned task has a checkbox and a complete `#N` ref. |
| `## Running Context` | Decisions/gotchas affecting later tasks | Updated when work reveals reusable context. |
| `## Progress` | Timestamped execution log | Updated at session/batch boundaries. |

Plan checkbox states:

| Marker | Meaning | Set by |
| --- | --- | --- |
| `[ ]` | Not started | `sprint-init.js` or manual planning |
| `[~]` | In-flight: dispatched, PR under review, or actively worked | Manual or dev-relay |
| `[x]` | Done: merged or completed | Manual or dev-relay after verification |

Full sprint examples live in `references/file-format.md`.

## Execution Path

### Orient

1. Read `_context.md` if present.
2. Find the active sprint(s). If none exists, list live open Issues; route to `plan` only when the selected work meets a Sprint Admission trigger.
3. One active track: read its Goal, Plan, Running Context, and latest Progress. Multiple disjoint tracks: `next.sh`/`status.sh` render a portfolio (one stanza per track); use `--track <slug>` to work one track.
4. Identify the next unchecked Plan item per admitted track, or name the next live Issue for sprint-free work.

Done when you can name the next live Issue and, when a sprint exists, its
current state and next actionable batch.

### Create

Follow `references/process.md` → `## Create — New Issues`.

Done when the new task exists in GitHub and, only when the work was admitted to
a sprint, is added to the active Plan.

### Plan

1. Confirm that the work meets a Sprint Admission trigger. Otherwise keep the Issue → PR path sprint-free.
2. Resolve Objectives from `spec/charter.md`; fall back to legacy root `CHARTER.md`; omit the `objectives:` field entirely when both are absent (see `references/spec-fallback.md`).
3. List/inspect open Issues. Use milestone selection only when the GitHub adapter reports `milestones`.
4. Create the active sprint file with Goal, ordered Plan batches, estimates, and dependencies. Include `objectives:` and `component:` only when their backing spec files exist; use `sprint-init.js --component "slug"` when a capability axis exists, or mutually exclusive `--scope` globs when no component axis fits. Plan batches are execution waves: intra-batch items MUST be mutually parallel-safe (disjoint files, no ordering between them), dependent items MUST go in a later batch, and batch order is execution order.
5. A second active track is refused only when its scope overlaps an existing active track; declare a disjoint `component:`/`scope:` to run tracks concurrently. Once more than one track is active, any track without a declared axis warns and allows (disjointness cannot be proven against an undeclared scope).

Done when the sprint file is the track's execution hub and each planned issue has a clear batch position.

### Work

1. Resolve the live task with `effective-task-spec.js TASK_REF`. Its
   `effective_spec`, AC, lifecycle, `source_ref`, and content digest are the
   execution input: one explicit `spec_ref` wins, otherwise the live GitHub
   Issue body wins. If resolution fails, stop and report it.
2. If the work has an admitted sprint, read its current batch and Running Context.
3. Mark meaningful GitHub status before work when useful.
4. Implement directly or optionally delegate through dev-relay.
5. Verify every AC item before checking it off.
6. Update GitHub lifecycle and, only for admitted work, Plan checkbox, Running Context, and Progress. Use comments/PR relationships only after their capability gates succeed.

Done when verified work is reflected in GitHub Issue AC/lifecycle and, when
admitted, sprint progress.

### Complete

Per task: all AC checked, implementation merged or committed, Plan checked, and
Progress updated. `Fixes #N` and provider closing links apply only when GitHub's
`closing-semantics` capability is intentionally used.

For a whole sprint:

1. Run `sprint-close.sh`; it runs `backlog-doctor.js` before the status flip and prints any reassess recommendation in the close summary.
2. Set `status: completed` and write a final Progress entry.
3. Promote project-level Running Context entries to `_context.md`.
4. Leave the sprint file in place as the permanent record.

`sprint-close.sh` prints `backlog-doctor.js` JSON including `reassess_signal`.
Unattended sessions must never `amend` `spec/*`.

Done when there is no stale active sprint or rediscovery-prone context trapped in the closed sprint.

### Next

Read any active sprint and return its first unchecked actionable batch. If no
active sprint exists or it is done, inspect live Issues and recommend a sprint
only when the selected work meets a Sprint Admission trigger.

## Script Resolution

Resolve scripts from the installed `dev-backlog` skill directory, not from the target project. In a source checkout, that is the local `scripts/` directory beside this `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root.

Concrete pattern:

```bash
skill_dir="skills/dev-backlog" # source checkout; replace with the resolved installed skill dir
bash "$skill_dir/scripts/next.sh"
node "$skill_dir/scripts/sprint-init.js" "next-sprint" --dry-run
```

Core scripts (full flag inventory in `references/scripts.md`):

- `scripts/setup-dev-backlog.js` — bootstrap `backlog/`.
- `scripts/effective-task-spec.js` — resolve live task specification, AC,
  lifecycle, source, and stable digest from the live Issue (or one explicit
  `spec_ref`).
- `scripts/sprint-init.js` — create a milestone-backed sprint when supported.
- `scripts/next.sh` / `scripts/status.sh` — next actionable batch and tracker-neutral sprint state; portfolio view for N disjoint tracks, `--track <slug>` for one.
- `scripts/sprint-close.sh` — close the active sprint (`--track <slug>` when multiple tracks are active); prints the doctor/reassess summary.
- `scripts/backlog-doctor.js` — aggregate health checks; JSON includes `reassess_signal`.

## References

- `references/scripts.md` — full script/flag inventory beyond the core-path scripts above.
- `references/process.md` — detailed Orient/Create/Plan/Work/Complete/Quick Fix/Unplanned Work/Next workflow.
- `references/file-format.md` — sprint file shape, `backlog/` config, and the optional legacy export (`sync-pull.js --legacy-export`, rollback/diagnostics only).
- `references/github-sync.md` — `gh` CLI patterns for labels, milestones, and Issues.
- `references/integration-contract.md` — dev-relay interop paths, sections, and regex contracts.
- `references/checkbox-repair.md` — runbook for repairing an unmoored `[~]` after a doctor warn.
- `references/backlog-boundaries.md` — backlog-side file boundaries and ownership.
- `references/spec-fallback.md` — spec-axis degradation contract (in-bundle): `objectives:`/`component:` semantics and triage behavior when spec files are thin or absent.
- `references/authority-contract.md` — sole-owner state routing, sprint admission, product exclusions, and optional ecosystem boundaries.
- `tests/evals/dev-backlog.md` — fresh-session eval prompts (consumed by the #367 conformance cadence; not execution contract; source checkout only).
