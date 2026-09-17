# Tracker adapter ports

Frozen contract for `scripts/tracker.js`. Adapters (`github`, `files`)
satisfy this seam. Selection is configuration-only.
Runtime never switches adapters. Adapter failure is fail-closed.

## Selection

`TRACKER_KEYS` is the allowed `.tracker` / setup selection set. This release
freezes it at `["github", "files"]`.

- `selectTracker` / `resolveTracker` read the configured key and load that
  adapter only.
- Availability may reject the configured adapter (`TrackerUnavailableError`).
  It never chooses a different tracker, never consults a second registered
  adapter, and never falls back to local files or `sync-pull --legacy-export`.
- Changing trackers is an explicit `.tracker` rewrite at setup, not a runtime
  decision.

## Per-adapter surface

The concrete surface behind `SKILL.md`'s "configured tracker". Plan refs in a
sprint `## Plan` use the configured key's grammar.

| Key | CLI | Plan ref | Create | Close |
| --- | --- | --- | --- | --- |
| `github` (default) | `gh` | `#N` | `gh issue create` | `gh issue close` |
| `files` | `backlog` (Backlog.md CLI) | `BACK-N` | `backlog task create` | `backlog task edit <id> -s Done` |

Neither is a degraded fallback; each is a first-class configured
authority running the same Orient / Plan / Work / Complete loop. If the
configured CLI is missing or unauthenticated, the adapter is unavailable
(fail-closed). Never parse or write `backlog/tasks/*.md` as a product API, and
never make two trackers co-authority in one repo.

## Adding an adapter

A new key is admitted only for a measured consumer (charter rule) and must
satisfy `validateAdapter` on the same seven ops. The parked `gitlab` adapter
is retrievable at [`a8ddb7d`](https://github.com/sungjunlee/dev-backlog/commit/a8ddb7d)
for anyone who needs it.

## Required operations

`validateAdapter` requires an object whose own keys are exactly
`REQUIRED_ADAPTER_OPERATIONS`, each a function, with no extras:

| Operation | Role |
| --- | --- |
| `availability` | Probe the configured provider. |
| `capabilities` | Report optional capability names. |
| `list` | List tasks. |
| `read` | Read one task. |
| `create` | Create a task. |
| `update` | Update a task. |
| `close` | Close a task. |

`list` / `read` / `create` / `update` / `close` payloads are provider-specific.
Returned identities must pass `validateIdentity`.

## Availability report

`availability()` must return `{ available: boolean, reason? }` or throw.

- `available: true` → `resolveTracker` continues with that adapter.
- `available: false` → `TrackerUnavailableError`. `reason` must be a non-empty
  string; a missing reason is itself a failure.
- A throw, `undefined`, or a non-object / non-boolean report is also
  `TrackerUnavailableError`.
- The error always states that no fallback was attempted.

## Capabilities

`capabilities()` must return an array whose members are a subset of
`CAPABILITY_NAMES`, with no unknowns and no duplicates:

- `milestones`
- `pull-request-relationships`
- `comments`
- `closing-semantics`

Call optional work only through `invokeCapability`. An unsupported name raises
`UnsupportedTrackerCapabilityError` (`code: TRACKER_CAPABILITY_UNSUPPORTED`)
before the operation runs. The gate never switches trackers.

## Identity

`validateIdentity` accepts a plain object with exactly:

| Field | Rule |
| --- | --- |
| `tracker` | One of `TRACKER_KEYS` |
| `id` | Non-empty opaque string |
| `ref` | Non-empty string |
| `url` | Optional absolute `http(s)` URL |

Missing, empty, extra, inherited, or invalid fields raise
`TrackerIdentityError`.

## Fail-closed

There is no silent fallback to another adapter, `backlog/tasks/`,
`exports/github-issues/`, or any local file. Diagnose the configured tracker
and stop. Diagnostic export is opt-in (`sync-pull.js --legacy-export`) and is
not on orient / plan / work / complete.

Adapter implementations: `github-tracker.js`, `files-tracker.js` (Backlog.md
CLI only). Export layout: `file-format.md`. Authority routing:
`authority-contract.md`.
