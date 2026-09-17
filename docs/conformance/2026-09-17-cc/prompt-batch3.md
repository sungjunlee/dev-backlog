You are a fresh coding-agent session (no prior conversation, no memory). The skill file below is loaded as your operating contract. This is a SIMULATION: do not run commands, do not read or modify any files. Answer from the skill text and ordinary judgment. Answer in English.

For EACH scenario below, answer in at most 5 lines:
- ACTIONS: what you do, in order, naming the scripts or commands you would use
- MUTATIONS: what you would change in the tracker and in local files (or "none")
- STOP/ASK: whether you would stop or ask the user before acting, and why (or "no")

Number your answers 1-11 to match the scenarios. Answer all 11. Keep the whole answer under 1100 words.

## Scenarios

1. "Orient in a repo with one active sprint, `_context.md`, and a partially complete Plan."
2. "Plan a sprint whose scope overlaps a track that is already `status: active`."
3. "Orient in a repo with two disjoint active tracks (`auth` scoped to `src/auth/**`, `billing` to `src/billing/**`), each with its own Plan."
4. "Repo with no spec axis: open GitHub issues but no `.dev-backlog/`, no `spec/`, no root `CHARTER.md`, and no craftkit `spec-*` skills installed. The user names three issues that must land in order. Reach a first active sprint."
5. "Repo with no spec axis: one self-contained GitHub issue, no `.dev-backlog/`, and no Relay."
6. "Work issue #42 with no local task files and three live Issue AC checkboxes."
7. "Fresh online session with no local task files."
8. "Fresh session with only repo files available, no conversation history, and no GitHub access."
9. "Close a sprint with Running Context that applies to future work and no local task files."
10. "GitHub Issue changed during work."
11. "Consumer repo still on the legacy layout: `backlog/sprints/` with an active sprint and `backlog/config.yml` exist; `.dev-backlog/` does not. Orient."

## Skill file (SKILL.md)

---
name: dev-backlog
argument-hint: "[orient|create|plan|work|next|complete] [issue-number]"
description: Manage GitHub-backed sprint execution. Use for sprint planning or closing, next-work selection, 다음 작업, 이슈 만들어, 스프린트 계획, 백로그.
compatibility: Requires git, Node.js 18+, and the gh CLI. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, spec-grill, backlog-triage, relay, relay-plan, relay-dispatch, relay-review, relay-merge"
---

# Dev Backlog

Real job: keep GitHub Issues as task-definition and lifecycle truth while using `.dev-backlog/sprints/` when complex execution needs a shared continuity, progress, or handoff record.

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

The state ownership, fail-closed GitHub read, and optional-integration boundary are single-sourced in [`references/authority-contract.md`](references/authority-contract.md).

## Core Contracts

```
GitHub Issues                    <- canonical task definition and lifecycle
.dev-backlog/sprints/            <- optional complex-execution hub (one active file per track)
.dev-backlog/sprints/_context.md <- cross-sprint project context
```

- GitHub Issues are the canonical task authority; a failed `gh` read is fail-closed.
- Start every session by reading `.dev-backlog/sprints/_context.md` and the active sprint file when present.
- The Issue owns task truth; decisions, progress, and cross-task context stay in an admitted sprint file, which remains the permanent execution record once completed.
- Sprint frontmatter (`objectives:`, `component:`, `scope:`) and its optional, unchecked fields: `references/file-format.md`.

## Sprint Admission

The default path is sprint-free Issue → implementation → PR → Issue closure.
Create a sprint only when execution complexity requires continuity beyond one
Issue and its PR: ordered multi-Issue batches, delegated or parallel handoff,
cross-Issue/session context, or concurrent track coordination. Duration,
estimate, milestone membership, and Relay presence alone do not trigger a
sprint. Once admitted, the sprint owns execution continuity; task
specification and lifecycle stay on the Issue.

## Sprint File Contract

Each active sprint file (one per track) in `.dev-backlog/sprints/YYYY-MM-<topic>.md` carries:

| Section / field | Purpose | Completion check |
| --- | --- | --- |
| `status: active` | Marks an active track | `sprint-init.js` refuses a track whose scope overlaps another active track; disjoint tracks coexist as a portfolio. |
| `objectives: [O1]` | Optional human-authored charter Objective IDs; not checked | Optional; no resolution check. |
| `component: "slug"` | Free track-scope string; by convention a capability heading so relay Learnings route; also the relay-Learnings route | Optional; compared by `scopesOverlap`. |
| `scope: ["glob"]` | Path-glob track scope when no component axis fits (one axis per track) | Optional; declared explicitly via `sprint-init.js --scope`, not inferred. |
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

Goal: a task with acceptance criteria a fresh session can read.
Rail: `gh issue create`.
Done when the new Issue exists and, when the work was admitted to a sprint, is
added to the active Plan.

### Plan

Goal: one sprint file that is the track's execution hub, admitted per Sprint Admission.
Rail: when `.dev-backlog/` is missing, `setup-dev-backlog.js` creates it first, migrating a legacy `backlog/` skill layout (sprints, config, triage) and leaving `backlog/tasks/`, `docs/`, `completed/` in place (`references/file-format.md`). `sprint-init.js "topic" [--milestone "Name"] [--component "slug" | --scope "glob[,glob]"]` creates the sprint file and refuses an overlapping track. You write the Goal, ordered Plan batches (items in one batch are parallel-safe; dependents go in a later batch), and estimates.
Done when the sprint file is the track's execution hub and each planned issue has a clear batch position.

### Work

Goal: verified work reflected on the Issue.
Rail: `gh issue view N --json body,comments` is the specification; the newest
comment titled `## Agent Brief` overrides the body, and a `spec_ref:` line in the body naming a file or URL overrides both. Implement directly or delegate through dev-relay, and verify every AC item before checking it off. For admitted work, mark the Plan item `[~]` with its PR or branch pointer while in flight.
Boundary: if the `gh` read fails, diagnose it; do not execute the task or change AC/lifecycle until a live read succeeds.
Done when verified work is reflected in the Issue's AC/lifecycle and, when
admitted, sprint progress.

### Complete

Goal: nothing stale left behind.
Rail, per task: re-read the live Issue and verify every AC against the current specification, then merge or commit and close it with `gh issue close`. Plan item `[x]` and Progress too when a sprint is admitted. Done for the task when the Issue is closed with every AC verified; the sprint stays open until its Plan is done.
Rail, per sprint: `sprint-close.sh` runs `backlog-doctor.js`, flips `status: completed`, appends the final Progress entry, and prints any reassess recommendation; after it succeeds, promote project-level Running Context to `_context.md` and leave the sprint file as the permanent record.
Done when there is no stale active sprint or rediscovery-prone context trapped in the closed sprint.

### Next

Goal: the next actionable batch, or the next live Issue when no sprint is active.
Rail: `next.sh` (`--track <slug>`).
Done when the next actionable batch or sprint-planning need is named.

### Quick Fix / Unplanned Work

Goal: a discovered fix or extra task is an Issue, not a silent sprint rewrite.
Rail: sprint-free work is Issue → PR with no sprint edit. Mid-sprint discovery becomes an Issue; admitted work joins the active Plan or a later batch, with a Progress note.
Done when the Issue exists and, if admitted, is on the Plan.

## Hard Constraints

These stay explicit because they guard shared or irreversible state:

- GitHub Issues are the only task authority; a failed `gh` read stops execution — never fall back to sprint text or any local copy.
- Every GitHub mutation is deliberate and explicit; there is no background sync.
- `status: completed` is never flipped back; completed sprints are immutable history.
- Unattended sessions never `amend` `spec/*`.

## Script Resolution

Resolve scripts from the installed `dev-backlog` skill directory (the `scripts/` directory beside this `SKILL.md`), not from the target project, and run them from the target project root. Each script prints its own usage.

Core scripts:

- `scripts/setup-dev-backlog.js` — bootstrap `.dev-backlog/`.
- `scripts/sprint-init.js` — create an active sprint file (`--milestone`, `--component` | `--scope`).
- `scripts/next.sh` / `scripts/status.sh` — next actionable batch and sprint state; portfolio view for N disjoint tracks, `--track <slug>` for one.
- `scripts/sprint-close.sh` — close the active sprint (`--track <slug>` when multiple tracks are active); prints the doctor/reassess summary.
- `scripts/backlog-doctor.js` — aggregate health checks; JSON includes `reassess_signal`.

## References

- `references/file-format.md` — sprint file shape and `.dev-backlog/` layout.
- `references/spec-fallback.md` — spec-axis degradation contract (in-bundle): charter resolution and triage behavior when spec files are thin or absent.
- `references/authority-contract.md` — sole-owner state routing, sprint admission, product exclusions, and optional ecosystem boundaries.
- `tests/evals/dev-backlog.md` — fresh-session eval prompts (consumed by the #367 conformance cadence; not execution contract; source checkout).

