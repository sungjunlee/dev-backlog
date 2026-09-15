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
`.dev-backlog/sprints/` only when complex execution needs a shared continuity,
progress, or handoff record.

README covers install and human quick start. This file is the agent execution contract: mode routing, file roles, deterministic rails, and stop conditions.

## Mode Router

| User intent | Mode |
| --- | --- |
| "where are we?", "orient", "status" | `orient` |
| "create issue", "new issue", "이슈 만들어" | `create` |
| "plan sprint", "make sprint", or admitted work with no active sprint | `plan` |
| "work #N", "continue", "do next batch" | `work` |
| "next", "다음 작업" | `next` |
| "complete", "close sprint" | `complete` |

Related skills (none required for either core cycle): when installed, `spec-charter` (`spec/charter.md` and `spec/system-map.md`) and `spec-grill` (`spec/capabilities.md`) ship with craftkit (`npx skills add sungjunlee/craftkit`) and supply the optional spec axis; [`backlog-triage`](../backlog-triage/SKILL.md) provides advisory backlog review before sprint planning. Degradation when they are absent is specified in `references/spec-fallback.md`.

The state ownership, fail-closed tracker, and optional-integration boundary
are single-sourced in [`references/authority-contract.md`](references/authority-contract.md).
Tracker adapter ports: [`references/adapter-ports.md`](references/adapter-ports.md).

## Core Contracts

```
GitHub Issues                    <- canonical task definition and lifecycle
.dev-backlog/sprints/            <- optional complex-execution hub (one active file per track)
.dev-backlog/sprints/_context.md <- cross-sprint project context
```

- Start every session by reading `.dev-backlog/sprints/_context.md` and the active sprint file when present.
- GitHub Issues own task truth; decisions, progress, and cross-task context stay in an admitted sprint file.
- Completed sprints stay as the permanent execution record.
- Sprint frontmatter (`objectives:`, `component:`, `scope:`) and how each field degrades when its spec file is absent: `references/file-format.md`.

## Sprint Admission

The default path is sprint-free Issue → implementation → PR → Issue closure.
Create a sprint only when execution complexity requires continuity beyond one
Issue and its PR: ordered multi-Issue batches, delegated or parallel handoff,
cross-Issue/session context, or concurrent track coordination. Duration,
estimate, milestone membership, and Relay presence alone do not trigger a
sprint. Once admitted, the sprint owns execution continuity only; the Issue
continues to own task specification and lifecycle.

## Sprint File Contract

Each active sprint file (one per track) in `.dev-backlog/sprints/YYYY-MM-<topic>.md` carries:

| Section / field | Purpose | Completion check |
| --- | --- | --- |
| `status: active` | Marks an active track | `sprint-init.js` refuses a track whose scope overlaps another active track; disjoint tracks coexist as a portfolio. |
| `objectives: [O1]` | Charter Objective IDs advanced by the sprint | Optional; IDs resolve against `spec/charter.md`. |
| `component: "slug"` | One capability slug from `spec/capabilities.md`; also the relay-Learnings route and a track-scope axis | Optional; resolves to one `## Capability:` heading. |
| `scope: ["glob"]` | Path-glob track scope when no component axis fits (one axis per track) | Optional; declared explicitly via `sprint-init.js --scope`, never inferred. |
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

Each mode is a goal, its deterministic rail, and a stop condition. Order
everything else yourself.

### Orient

Goal: know where execution stands and what comes next.
Rail: `status.sh` / `next.sh` (`--json`; `--track <slug>` for one track of a portfolio). `_context.md` and the active sprint file are the readable picture.
Done when you can name the next live Issue and, when a sprint exists, its current state and next actionable batch.

### Create

Goal: a GitHub Issue with acceptance criteria the resolver can read.
Rail: `gh issue create` patterns in `references/github-sync.md`.
Done when the new task exists in GitHub and, only when the work was admitted to a sprint, is added to the active Plan.

### Plan

Goal: one sprint file that is the track's execution hub, admitted per Sprint Admission.
Rail: when `.dev-backlog/` is missing, `setup-dev-backlog.js --tracker github --non-interactive` creates it first (`references/file-format.md`). `sprint-init.js "topic" [--milestone "Name"] [--component "slug" | --scope "glob[,glob]"]` creates the sprint file and refuses an overlapping track. You write the Goal, ordered Plan batches (items in one batch are parallel-safe; dependents go in a later batch), and estimates.
Done when the sprint file is the track's execution hub and each planned issue has a clear batch position.

### Work

Goal: verified work reflected in GitHub.
Rail: `effective-task-spec.js TASK_REF` returns the effective specification, AC, lifecycle, `source_ref`, and digest; the resolver decides source precedence (explicit `spec_ref`, posted `## Agent Brief` comment, Issue body). Implement directly or delegate through dev-relay, and verify every AC item before checking it off. For admitted work, mark the Plan item `[~]` with its PR or branch pointer while in flight.
Boundary: if resolution fails, diagnose it, but do not execute the task or change AC/lifecycle until live resolution succeeds.
Done when verified work is reflected in GitHub Issue AC/lifecycle and, when admitted, sprint progress.

### Complete

Goal: nothing stale left behind.
Rail, per task: re-resolve and verify every AC against the current effective specification, then merge or commit and close the Issue (Plan item `[x]` and Progress too when a sprint is admitted). Done for the task when the Issue is closed with every AC verified; the sprint stays open until its Plan is done.
Rail, per sprint: `sprint-close.sh` runs `backlog-doctor.js`, flips `status: completed`, appends the final Progress entry, and prints any reassess recommendation; after it succeeds, promote project-level Running Context to `_context.md` and leave the sprint file as the permanent record.
Done when there is no stale active sprint or rediscovery-prone context trapped in the closed sprint.

### Next

Goal: the next actionable batch, or the next live Issue when no sprint is active.
Rail: `next.sh` (`--track <slug>`).
Done when the next actionable batch or sprint-planning need is named.

## Hard Constraints

These stay explicit because they guard shared or irreversible state:

- Exactly one configured tracker (`.tracker` is setup-only); runtime never switches adapters.
- Every GitHub mutation is deliberate and explicit; there is no background sync.
- Configured tracker failure is fail-closed: stop and repair; never fall back to local files or a diagnostic export.
- `status: completed` is never flipped back; completed sprints are immutable history.
- Unattended sessions never `amend` `spec/*`.

## Script Resolution

Resolve scripts from the installed `dev-backlog` skill directory (the `scripts/` directory beside this `SKILL.md`), not from the target project, and run them from the target project root. Invocation pattern: `references/scripts.md`.

Core scripts (full flag inventory in `references/scripts.md`):

- `scripts/setup-dev-backlog.js` — bootstrap `.dev-backlog/`.
- `scripts/effective-task-spec.js` — resolve live task specification, AC,
  lifecycle, source, and stable digest from the live Issue (or one explicit
  `spec_ref`).
- `scripts/sprint-init.js` — create an active sprint file (`--milestone`, `--component` | `--scope`).
- `scripts/next.sh` / `scripts/status.sh` — next actionable batch and tracker-neutral sprint state; portfolio view for N disjoint tracks, `--track <slug>` for one.
- `scripts/sprint-close.sh` — close the active sprint (`--track <slug>` when multiple tracks are active); prints the doctor/reassess summary.
- `scripts/backlog-doctor.js` — aggregate health checks; JSON includes `reassess_signal`.

## References

- `references/scripts.md` — full script/flag inventory beyond the core-path scripts above.
- `references/process.md` — detailed Orient/Create/Plan/Work/Complete/Quick Fix/Unplanned Work/Next workflow.
- `references/adapter-ports.md` — tracker adapter port contract (required ops, fail-closed availability, capability gates).
- `references/file-format.md` — sprint file shape, `.dev-backlog/` config, and the optional diagnostic export (`sync-pull.js --legacy-export`).
- `references/github-sync.md` — `gh` CLI patterns for labels, milestones, and Issues.
- `references/integration-contract.md` — dev-relay interop paths, sections, and regex contracts.
- `references/checkbox-repair.md` — runbook for repairing an unmoored `[~]` after a doctor warn.
- `references/backlog-boundaries.md` — backlog-side file boundaries and ownership.
- `references/spec-fallback.md` — spec-axis degradation contract (in-bundle): `objectives:`/`component:` semantics and triage behavior when spec files are thin or absent.
- `references/authority-contract.md` — sole-owner state routing, sprint admission, product exclusions, and optional ecosystem boundaries.
- `tests/evals/dev-backlog.md` — fresh-session eval prompts (consumed by the #367 conformance cadence; not execution contract; source checkout only).
