# Process

Detailed workflow for each phase. `SKILL.md` has the summary; this file routes
the same core cycle through GitHub Issues. Routing and optional-export
boundaries live in `authority-contract.md`.

## Setup — Choose Canonical Task Truth

1. For a fresh repository, run `scripts/setup-dev-backlog.js --tracker github --non-interactive`.
2. With no `.tracker`, accept only a legacy `tracker: github` value from `config.yml`; with neither, keep the deterministic GitHub default. Setup writes `github` to `.tracker` without editing `config.yml`.
3. Never infer selection from `gh`, authentication, remotes, existing task files, or an operation failure. Setup does not migrate task files.

## Required Core Lifecycle Invocation Boundary

The official create/read/update/close boundary for operators and agents is the
adapter exported by `scripts/tracker.js`. Resolve it from the target backlog
directory; do not import `github-tracker.js` directly and do not select from
runtime availability:

```js
const path = require("node:path");
const skillDir = "/resolved/dev-backlog-skill";
const backlogDir = "backlog"; // or the custom backlog directory in use
const { readConfig } = require(path.join(skillDir, "scripts/lib.js"));
const { resolveConfiguredTracker } = require(path.join(skillDir, "scripts/tracker.js"));

const { adapter } = resolveConfiguredTracker(readConfig(backlogDir), { backlogDir });
```

Call `adapter.list({ state, limit })`, `adapter.read(selector)`,
`adapter.create(input)`, `adapter.update(selector, changes)`, or
`adapter.close(selector, options)`. Feed the returned normalized `ref` into the
sprint Plan. Runtime selectors are `#N`. These exported adapter methods are the stable core lifecycle
API; shell/Node scripts such as `status.sh`, `sync-pull.js`, and
`sprint-close.sh` are workflow boundaries around it, not substitutes for task
create/read/update/close.

For Work and AC verification, use the higher-level read boundary:

```bash
node "$skillDir/scripts/effective-task-spec.js" "#42" --repo OWNER/REPO
```

It performs exactly one canonical adapter read and returns
`effective_spec`, normalized `acceptance_criteria`, `lifecycle`, `source_ref`,
and a stable SHA-256 `source_revision`/`source_digest`. An explicit repository
relative `spec_ref` wins when the Issue contains
`<!-- dev-backlog:spec_ref path/to/spec.md -->`; otherwise the live Issue body
is selected. A failed Issue read or explicit-spec load stops execution. The
resolver reads the live Issue (or one explicit `spec_ref`); it does not read
task files.

## Orient — Starting a Session

1. If `backlog/` does not exist, complete **Setup**.
2. Read `backlog/sprints/_context.md` when present.
3. Find the active sprint(s). One track: read Goal, Plan, Running Context, and latest Progress. Multiple disjoint tracks: `status.sh`/`next.sh` render a portfolio; pass `--track <slug>` to work one track.
4. If no active sprint exists, list open Issues and create a sprint only when complexity admission applies.
5. Use `status.sh --json` and `next.sh --json` for normalized `tracker`/`id`/`ref` state (`schema_version: 2`: `active_sprints[]` plus the retained single-track fields); GitHub keeps numeric `issue_number`.
6. If all Plan items are checked, proceed to **Complete** for that track.

`_context.md` plus the track's sprint file provide the execution picture; canonical task reads come from the configured adapter.

## Create — New Tasks

1. Call the configured adapter's required `create` operation.
2. Use its returned `#N` ref in the current sprint Plan when in scope.
3. Continue directly from the created Issue.

## Plan — Sprint

When starting a new sprint:

1. Refuse a new sprint only when its scope overlaps an existing active track (`component:` equality or `scope:` glob collision — `sprint-init.js` checks via the shared `scopesOverlap` predicate); disjoint-scope tracks coexist. Complete a conflicting track rather than flipping `status:` inline. Once more than one track is active, any track without a declared axis warns and allows (disjointness cannot be proven against an undeclared scope).
2. Resolve optional `objectives:` and `component:` fields from the spec axis as described in `spec-fallback.md`; pass `sprint-init.js --component "slug"` for a declared capability, or mutually exclusive `--scope "glob[,glob]"` when no component axis fits.
3. List open Issues through the adapter.
4. GitHub may create/assign a milestone and run `sprint-init.js "topic" --milestone "Name"`; its `#N`, estimates, due date, argv, and JSON remain legacy-compatible.
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
3. Call required `close` to close the GitHub Issue.
4. Use `Fixes #N`, comments, or closing relationships only when GitHub capability semantics are intentionally in scope.

For the whole sprint:

1. Run `scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]`. With multiple active tracks, `--track <slug>` picks which one to close; without it the close refuses as ambiguous. Pass `--close-milestone` only for a tracker that reports `milestones`; unsupported requests fail before doctor or file mutation.
2. The command sets `status: completed`, appends final Progress, and prints the
   doctor/reassess summary. Close does not require or create task directories.
   When checked legacy GitHub export files happen to exist, it archives only
   those files.
3. Promote durable Running Context to `_context.md`; retain the sprint file as history.

## Sync / Legacy Export — Explicit and One-Way

- **GitHub core:** there is no pull step. Re-run `effective-task-spec.js` when
  Issue content changes and review a changed source revision.
- **GitHub rollback/diagnostics:** `sync-pull.js --legacy-export` explicitly
  writes non-authoritative projections. It is outside setup, orient, plan,
  work, and complete.
- Compatible Markdown import is human-reviewed input to create or amend a
  GitHub Issue; it is not a runtime read path.
- An operation failure never changes `.tracker` or makes an export authoritative.

See `github-sync.md` for GitHub-only command patterns.

## Unsupported Optional Capabilities

`tracker.js` owns the typed failure and serializer. The stable public error has
`code`, `tracker`, `capability`, `message`, and `remediation`. JSON-capable
commands emit exactly one `{ "error": ... }` document and exit non-zero; human
boundaries show the same remediation. The gate runs before filesystem/provider
effects and never switches trackers.

## Quick Fix — Single Task, No Sprint

Read, update, and close the Issue through the adapter and normal GitHub
issue/closing behavior.
Create a sprint only when execution context needs to span work or sessions.

## Unplanned Work — Mid-Sprint Scope Change

- **Small (< 1hr):** use the Quick Fix path.
- **Current sprint:** add the normalized ref as a new batch and note the scope change in Progress.
- **Separate sprint:** when the new work's scope is disjoint from every active track, open a concurrent track with its own `component:`/`scope:`; when it overlaps, close the conflicting sprint first, then start another.

## Next — What to Work On

1. Read the active sprint and find the first unchecked batch (`next.sh --track <slug>` selects one track when a portfolio is active).
2. If it is done, list open Issues or start the next sprint.
3. Present the batch with its exact normalized refs and total estimate.
