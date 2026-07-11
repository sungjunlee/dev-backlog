# Process

Detailed workflow for each phase. `SKILL.md` has the summary; this file routes
the same core cycle through the one tracker selected in `backlog/config.yml`.
Adapter mechanics and the compatibility proof have one implementation owner:
[Tracker Adapter Design Contract](../../../docs/tracker-adapter-design.md).

## Setup — Choose Canonical Task Truth

1. For a fresh repository, run `scripts/setup-dev-backlog.js --tracker github|local --non-interactive`.
2. For an existing tracker-less config, keep the deterministic GitHub default. Setup first pins that legacy GitHub authority; any later switch must be explicit.
3. Never infer selection from `gh`, authentication, remotes, existing task files, or an operation failure. Setup does not migrate task files.

## Required Core Lifecycle Invocation Boundary

The official create/read/update/close boundary for operators and agents is the
configured adapter exported by `scripts/tracker.js`. Resolve it from the target
backlog directory; do not import `github-tracker.js` or `local-tracker.js`
directly and do not select an adapter from runtime availability:

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
sprint Plan. GitHub selectors are `#N`; local selectors are
`{PREFIX}-N[.M]`. These exported adapter methods are the stable core lifecycle
API; shell/Node scripts such as `status.sh`, `sync-pull.js`, and
`sprint-close.sh` are workflow boundaries around it, not substitutes for task
create/read/update/close. Low-level storage and provider argv remain owned by
the linked Tracker Adapter Design Contract.

## Orient — Starting a Session

1. If `backlog/` does not exist, complete **Setup**.
2. Read `backlog/sprints/_context.md` when present.
3. Find the active sprint and read Goal, Plan, Running Context, and latest Progress.
4. If no active sprint exists, list open tasks through the configured adapter and proceed to **Plan**.
5. Use `status.sh --json` and `next.sh --json` for normalized `tracker`/`id`/`ref` state; GitHub keeps numeric `issue_number`, local returns `null`.
6. If all Plan items are checked, proceed to **Complete**.

Two sprint files at most (`_context.md` plus active sprint) provide the execution picture; canonical task reads come from the configured adapter.

## Create — New Tasks

1. Call the configured adapter's required `create` operation.
2. Use its returned normalized ref in the current sprint Plan when in scope: GitHub `#N`, local `{PREFIX}-N[.M]`.
3. In GitHub mode, explicitly materialize/refresh the thin task mirror with `sync-pull.js`. In local mode, create already wrote the canonical task file; do not call `gh`.

## Plan — Sprint

When starting a new sprint:

1. Refuse a new sprint while another is active; complete the existing sprint rather than flipping `status:` inline.
2. Resolve optional `objectives:` and `component:` fields from the spec axis as described in `spec-fallback.md`.
3. List open tasks from the configured adapter.
4. GitHub mode may create/assign a milestone and run `sprint-init.js "topic" --milestone "Name"`; its `#N`, estimates, due date, argv, and JSON remain legacy-compatible.
5. Local mode does not fabricate a milestone. Author the sprint file from normalized local refs returned by the adapter.
6. Set a one-sentence Goal, order mutually parallel-safe work into batches, put dependencies in later batches, and record estimates where useful.

## Work — Execute a Batch

1. Read the current batch and each canonical/mirrored task's Description and AC.
2. Update neutral task state through the configured adapter.
3. Do the work and verify every AC before checking it off.
4. Update the sprint Plan, Progress, and reusable Running Context.
5. In GitHub mode, comments, PR relationships, milestones, and closing keywords are optional provider capabilities. Invoke them only after their capability gate succeeds. Local mode reports none of them and must continue with the core lifecycle without provider calls.

Delegated work follows the relay Plan → Dispatch → Review → Merge flow; the
same normalized Plan refs remain the sprint anchor in either tracker mode.

## Complete — Close Tasks and Sprint

Per task:

1. Verify all AC.
2. Commit or merge the implementation and check the Plan item.
3. Call required `close`: GitHub closes the issue; local writes `status: Done` and archives the canonical file under `backlog/completed/`.
4. Use `Fixes #N`, comments, or closing relationships only when GitHub capability semantics are intentionally in scope.

For the whole sprint:

1. Run `scripts/sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]`. Pass `--close-milestone` only for a tracker that reports `milestones`; unsupported requests fail before doctor or file mutation.
2. The command sets `status: completed`, appends final Progress, archives checked active task files that remain, and prints the doctor/reassess summary.
3. Promote durable Running Context to `_context.md`; retain the sprint file as history.

## Sync — Explicit and Mode-Specific

- **GitHub:** `sync-pull.js` explicitly refreshes derived task mirrors. Provider writes such as labels, comments, mirrors, and Progress issues are explicit operations.
- **Local:** task files are canonical; there is no provider pull/push and no background sync.
- **Both:** an operation failure never changes `tracker:` or makes the other store authoritative.

See `github-sync.md` for GitHub-only command patterns.

## Unsupported Optional Capabilities

`tracker.js` owns the typed failure and serializer. The stable public error has
`code`, `tracker`, `capability`, `message`, and `remediation`. JSON-capable
commands emit exactly one `{ "error": ... }` document and exit non-zero; human
boundaries show the same remediation. The gate runs before filesystem/provider
effects and never switches trackers.

## Quick Fix — Single Task, No Sprint

Read, update, and close the task through the configured adapter. GitHub may use
its normal issue/closing behavior; local stays entirely in canonical Markdown.
Create a sprint only when execution context needs to span work or sessions.

## Unplanned Work — Mid-Sprint Scope Change

- **Small (< 1hr):** use the Quick Fix path.
- **Current sprint:** add the normalized ref as a new batch and note the scope change in Progress.
- **Separate sprint:** close the current sprint first, then start another.

## Next — What to Work On

1. Read the active sprint and find the first unchecked batch.
2. If it is done, list configured-tracker work or start the next sprint.
3. Present the batch with its exact normalized refs and total estimate.
