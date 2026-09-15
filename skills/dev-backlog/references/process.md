# Process

Detailed workflow for each phase. `SKILL.md` has the summary; this file routes
the same core cycle through the configured tracker (GitHub Issues or the
Backlog.md CLI). Routing and optional-export boundaries live in
`authority-contract.md`.

## Setup

For a fresh repository, run `scripts/setup-dev-backlog.js --tracker github|files --non-interactive`. It creates `.dev-backlog/sprints/` and pins the chosen task authority; tracker selection rules live in `file-format.md`.

## Programmatic Lifecycle Boundary

Scripts and automation create/read/update/close tasks through the adapter
exported by `scripts/tracker.js` (resolve it from the target backlog directory;
do not import `github-tracker.js` or `files-tracker.js` directly). An agent
working interactively uses `gh` when `.tracker=github` (`github-sync.md`) or
the `backlog` CLI when `.tracker=files`; both routes write the same live task
in the configured tracker. Leftover `tasks/*.md` is never authority.

```js
const path = require("node:path");
const skillDir = "/resolved/dev-backlog-skill";
const backlogDir = ".dev-backlog"; // product default; positional [backlog-dir] is a test/override, not a second product root
const { readConfig } = require(path.join(skillDir, "scripts/lib.js"));
const { resolveConfiguredTracker } = require(path.join(skillDir, "scripts/tracker.js"));

const { adapter } = resolveConfiguredTracker(readConfig(backlogDir), { backlogDir });
```

Call `adapter.list({ state, limit })`, `adapter.read(selector)`,
`adapter.create(input)`, `adapter.update(selector, changes)`, or
`adapter.close(selector, options)`. Feed the returned normalized `ref` into the
sprint Plan. Runtime selectors are `#N` (github) or `BACK-N` (files). These exported adapter methods are the stable core lifecycle
API; shell/Node scripts such as `status.sh`, `sync-pull.js`, and
`sprint-close.sh` are workflow boundaries around it, not substitutes for task
create/read/update/close.

For Work and AC verification, use the higher-level read boundary:

```bash
node "$skillDir/scripts/effective-task-spec.js" "#42" --repo OWNER/REPO
```

It performs exactly one canonical adapter read and returns
`effective_spec`, normalized `acceptance_criteria`, `lifecycle`, `source_ref`,
and a stable SHA-256 `source_revision`/`source_digest`. Source precedence, in
order: an explicit repository-relative `spec_ref` (Issue-body marker
`<!-- dev-backlog:spec_ref path/to/spec.md -->` or `--spec-ref`), then a posted
Issue comment whose body starts with `## Agent Brief`, then the live task
body. For files tasks, a non-empty CLI `acceptanceCriteria` array is live AC.
A failed live-task read or explicit-spec load stops execution fail-closed; the resolver
never reads leftover `tasks/*.md`.

## Orient — Starting a Session

1. Complete **Setup** only when an admitted sprint is in play or this session is about to admit one (`SKILL.md` Plan rail) and `.dev-backlog/` is missing. Sprint-free Issue → PR does not create `.dev-backlog/` (`authority-contract.md`).
2. Read `.dev-backlog/sprints/_context.md` when present.
3. Find the active sprint(s). One track: read Goal, Plan, Running Context, and latest Progress. Multiple disjoint tracks: `status.sh`/`next.sh` render a portfolio; pass `--track <slug>` to work one track.
4. If no active sprint exists, list open tasks through the adapter and create a sprint only when complexity admission applies.
5. Use `status.sh --json` and `next.sh --json` for normalized `tracker`/`id`/`ref` state (`schema_version: 2`: `active_sprints[]` plus the retained single-track fields); GitHub keeps numeric `issue_number`.
6. If all Plan items are checked, proceed to **Complete** for that track.

`_context.md` plus the track's sprint file provide the execution picture; canonical task reads come from the configured adapter.

## Create — New Tasks

1. Create the task with acceptance criteria (`gh issue create` when github, patterns in `github-sync.md`; `backlog task create` / `adapter.create` when files).
2. Use its `#N` (github) or `BACK-N` (files) ref in the current sprint Plan when the work is admitted.
3. Continue directly from the created task.

## Plan — Sprint

When starting a new sprint:

1. `sprint-init.js` refuses a track whose scope overlaps an active track (`scopesOverlap` in `lib.js`; with 2+ active tracks an undeclared axis warns and allows). Complete the conflicting track rather than editing `status:` by hand.
2. Resolve optional `objectives:` and `component:` fields from the spec axis as described in `spec-fallback.md`; pass `sprint-init.js --component "slug"` for a declared capability, or mutually exclusive `--scope "glob[,glob]"` when no component axis fits.
3. List open tasks through the adapter.
4. GitHub may create/assign a milestone and run `sprint-init.js "topic" --milestone "Name"`; its `#N`, estimates, due date, argv, and JSON remain legacy-compatible. Files seeds due TBD and an empty Plan (add `BACK-N` refs by hand).
5. Set a one-sentence Goal, order mutually parallel-safe work into batches, put dependencies in later batches, and record estimates where useful.

## Work — Execute a Batch

1. Resolve each task through `effective-task-spec.js`; record or retain its
   `source_ref` and `source_revision` in the work handoff. A live-read failure
   is a stop condition.
2. Read the current batch and Running Context only when the work has an
   admitted sprint.
3. Update neutral task state through the configured adapter.
4. Do the work and verify every returned AC before checking it off.
5. Update the sprint Plan, Progress, and reusable Running Context only for
   admitted work.
6. Comments, PR relationships, milestones, and closing keywords are optional GitHub capabilities. Invoke them only after their capability gate succeeds.

Delegated work follows the relay Plan → Dispatch → Review → Merge flow; the
same normalized Plan refs remain the sprint anchor.

## Complete — Close Tasks and Sprint

Per task:

1. Re-resolve the effective task spec and verify all returned AC against the
   recorded source revision. If the source changed, review the new effective
   spec before completion.
2. Commit or merge the implementation and check the Plan item.
3. Call required `close` (`adapter.close`; files uses `backlog task edit` Done) to close the tracker task.
4. Use `Fixes #N`, comments, or closing relationships only when GitHub capability semantics are intentionally in scope.

For the whole sprint:

1. Run `scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]`. With multiple active tracks, `--track <slug>` picks which one to close; without it the close refuses as ambiguous. Pass `--close-milestone` only for a tracker that reports `milestones`; unsupported requests fail before doctor or file mutation.
2. The command sets `status: completed`, appends final Progress, and prints the
   doctor/reassess summary. Close does not touch `exports/github-issues/` or
   leftover `backlog/tasks/`. If leftover mirrors exist under the execution
   root's `tasks/`, close may archive only those. Close does not require or
   create task directories.
3. Promote durable Running Context to `_context.md`; retain the sprint file as history.

## Diagnostic Export — Explicit and One-Way

There is no pull step: re-run `effective-task-spec.js` when task content changes. `sync-pull.js --legacy-export` writes non-authoritative snapshots to `exports/github-issues/` for rollback or diagnostics only; it is not a Backlog.md compatibility layer and is not on orient / plan / work / complete. See `file-format.md`.

## Unsupported Optional Capabilities

`tracker.js` owns the typed failure and serializer. The stable public error has
`code`, `tracker`, `capability`, `message`, and `remediation`. JSON-capable
commands emit exactly one `{ "error": ... }` document and exit non-zero; human
boundaries show the same remediation. The gate runs before filesystem/provider
effects and never switches trackers.

## Quick Fix — Single Task, No Sprint

Read, update, and close the task through the adapter (github Issue or files CLI).
Create a sprint only when execution context needs to span work or sessions.

## Unplanned Work — Mid-Sprint Scope Change

- **Small (< 1hr):** use the Quick Fix path.
- **Current sprint:** add the normalized ref as a new batch and note the scope change in Progress.
- **Separate sprint:** when the new work's scope is disjoint from every active track, open a concurrent track with its own `component:`/`scope:`; when it overlaps, close the conflicting sprint first, then start another.

## Next — What to Work On

1. Read the active sprint and find the first unchecked batch (`next.sh --track <slug>` selects one track when a portfolio is active).
2. If it is done, list open tasks; create a sprint only when complexity admission applies.
3. Present the batch with its exact normalized refs and total estimate.
