# Integration Contract: dev-backlog Actor Consumption

Decision note (2026-07): this actor-agnostic contract stays in `skills/dev-backlog/references/integration-contract.md` because `dev-relay` already consumes this path; re-scoping it in place preserves compatibility and avoids a split reference.

This document defines the exact file interface that any long-running actor can depend on when reading and writing dev-backlog files. Actors include humans, relay executors, external loops, analyzers, and future automation. `dev-relay` is one named consumer profile of the general contract, not the definition of the audience.

Changes to checkbox, annotation, path, or section patterns parsed by `dev-relay` must be coordinated with `dev-relay` before landing.

## Read Surface

Any actor consuming dev-backlog state should treat these files as the stable read surface:

- `backlog/sprints/*.md` with `status: active` is the active execution hub: frontmatter identifies lifecycle and routing state; `## Goal`, `## Plan`, `## Running Context`, and `## Progress` identify the current objective, work queue, reusable discoveries, and execution trace.
- `backlog/sprints/_context.md` is cross-sprint project memory. Its sections provide durable context for future sessions and analyzers.
- `backlog/tasks/` and `backlog/completed/` are GitHub issue mirrors. Task files carry issue bodies and local Acceptance Criteria checkboxes; sprint files remain the execution log.
- `spec/capabilities.md`, when present, is an optional capability-level learning target addressed by active sprint frontmatter `component:`.

The sections below define the path, heading, checkbox, and annotation grammar. Consumers may read more prose, but they must not require additional headings or rewritten formats to orient from files alone.

## Structured JSON Read Surface

Actors that need machine-readable sprint state should prefer the opt-in JSON surfaces over parsing markdown directly:

```bash
bash skills/dev-backlog/scripts/status.sh --json
bash skills/dev-backlog/scripts/next.sh --json
```

Both commands emit one JSON document to stdout with `schema_version: 1`. Human-readable output remains the default when `--json` is absent. Snapshots are supported through normal shell redirection only, for example `status.sh --json > sprint-state.json`; dev-backlog does not create timestamped snapshot files or maintain a snapshot store.

Ambiguous active sprint state is fail-loud in JSON mode: the command exits non-zero and writes the error to stderr instead of emitting partial JSON. Missing `## ` sections degrade to empty strings or arrays as shown below.

Top-level schema:

| Field | Type | Meaning |
|-------|------|---------|
| `schema_version` | integer | Schema version for this JSON contract; starts at `1`. |
| `active_sprint` | object or `null` | Active sprint metadata, or `null` when no active sprint is found. |
| `plan_items` | array | Parsed `## Plan` checkbox items from the active sprint. |
| `next_batch` | object or `null` | First batch with `[ ]` items, or flat unchecked items when no batch heading exists. |
| `latest_progress` | array | Most recent five `## Progress` bullet entries, newest first. |
| `in_flight` | array | `[~]` plan items plus file-derived age metadata. |

`active_sprint` fields:

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | Active sprint file path as resolved by the command. |
| `frontmatter` | object | Parsed sprint frontmatter fields such as `status`, `started`, `due`, `objectives`, and `component`. |
| `goal` | string | Trimmed text from `## Goal`; empty string when absent. |

`plan_items[]` fields:

| Field | Type | Meaning |
|-------|------|---------|
| `line` | string | Original plan line. |
| `checkbox_state` | string | Exact marker content: `" "`, `"~"`, or `"x"`. |
| `state` | string | Normalized state: `todo`, `in_flight`, or `done`. |
| `issue_number` | integer | GitHub issue number parsed with `/^\- \[.\] #(\d+)/`. |
| `title` | string | Plan title after removing parsed PR, branch, and run annotations. |
| `batch_heading` | string or `null` | Current `### Batch...` heading, if any. |
| `pr` | object or `null` | `{ "number": N, "state": "..." }` from `→ PR #N (state)` when present. |
| `run_id` | string or `null` | Value from trailing `[run:...]` when present. |
| `branch` | string or `null` | Value from `[branch:...]` when present. |
| `unmoored` | boolean | `true` for `[~]` items without PR, branch, or run pointer. |

`next_batch` is either `null` or:

| Field | Type | Meaning |
|-------|------|---------|
| `heading` | string or `null` | The first `### Batch...` heading containing unchecked `[ ]` work, or `null` for flat plans. |
| `items` | array | The unchecked `plan_items` in that batch. For flat plans, all unchecked items. |

`latest_progress[]` entries are objects with:

| Field | Type | Meaning |
|-------|------|---------|
| `line` | string | Original `## Progress` bullet. |
| `date` | string or `null` | Leading `YYYY-MM-DD` parsed from the bullet, when present. |

`in_flight[]` entries include every `plan_items[]` field plus:

| Field | Type | Meaning |
|-------|------|---------|
| `age_days` | integer or `null` | Calendar days since the age basis date. |
| `age_source` | string or `null` | `progress` when based on a progress entry, `started` when falling back to frontmatter. |
| `age_basis_date` | string or `null` | The `YYYY-MM-DD` date used to compute `age_days`. |

Age heuristic: for each `[~]` item, find the earliest dated `## Progress` bullet that mentions the item's issue number as `#N`; if none exists, fall back to sprint frontmatter `started:` when it is a `YYYY-MM-DD` date. `age_days` is the calendar-day distance from that basis date to the command run's local calendar date. Emit `null` for `age_days`, `age_source`, and `age_basis_date` when neither resolves. The basis date is selected only from sprint file content; no GitHub state, relay manifest, file mtime, or markdown prose outside these fields participates.

### Backlog Doctor JSON Surface

Schedulers, CI checks, and close flows that need one deterministic health verdict should use:

```bash
node skills/dev-backlog/scripts/backlog-doctor.js --json [--stale-days N] [backlog-dir]
```

Default human output is one line per check. `--json` emits:

| Field | Type | Meaning |
|-------|------|---------|
| `schema_version` | integer | Schema version for the doctor JSON contract; starts at `1`. |
| `checks` | array | Per-check verdicts in stable order. |
| `exit_hint` | string | `fail` when any check failed, `warn` when no checks failed but at least one warned, otherwise `pass`. CLI exit is non-zero only for `fail`. |

Each `checks[]` entry has:

| Field | Type | Meaning |
|-------|------|---------|
| `name` | string | Stable identifier: `active_sprint`, `objectives_check`, `component_lint`, `capabilities_doctor`, `sprint_shape`, `in_flight_trace`, `in_flight_staleness`, or `context_bloat`. |
| `status` | string | `pass`, `warn`, or `fail`. |
| `detail` | object | Check-specific details. `detail.summary` is always a human-readable one-line summary. |

Hard failures include ambiguous active sprint state, no active sprint while sprint files exist, objective/component drift, capabilities-doctor hard triggers, missing required active-sprint sections, and unparseable Plan checkbox lines. Soft warnings include unmoored `[~]` items, `[~]` items older than `--stale-days` (default `7`), capabilities-doctor warnings, and `_context.md` bloat. `_context.md` bloat warns above `200` lines; the threshold is deliberately generous so this signal means "promote or compact durable context soon," not "rewrite immediately."

## File Paths

| What | Pattern | Example |
|------|---------|---------|
| Task files | `backlog/tasks/{PREFIX}-{N} - {slug}.md` | `backlog/tasks/BACK-42 - oauth-flow.md` |
| Active sprint | `backlog/sprints/*.md` with `status: active` | `backlog/sprints/2026-03-auth-system.md` |
| Cross-sprint context | `backlog/sprints/_context.md` | (always this exact name) |
| Completed tasks | `backlog/completed/{PREFIX}-{N} - {slug}.md` | `backlog/completed/BACK-38 - db-schema.md` |

**PREFIX** defaults to `BACK` and is configurable via `backlog/config.yml` → `task_prefix`.

## Sprint File Sections

Every actor reads the same `## ` sections in the active sprint file. Writes are limited by [Write Rules](#write-rules). The `dev-relay` columns are retained as the current named consumer profile and remain normative for `dev-relay`.

| Section | dev-relay reads | dev-relay writes | Purpose |
|---------|:-:|:-:|---------|
| `## Plan` | Yes | Yes | Checkbox list of issues; state transitions |
| `## Running Context` | Yes | Yes | Append learnings from completed tasks |
| `## Progress` | No | Yes | Append structured log entries |
| `## Goal` | Yes | No | Sprint success criteria (read-only context) |

### Section heading regex

```
/^## (Plan|Running Context|Progress|Goal)[ \t]*$/
```

Extraction: read lines between the matched `## ` heading and the next `## ` heading (or EOF). See `lib.sh:extract_section()` for the canonical implementation.

## Write Rules

These rules are observable from files alone and apply to any actor mutating sprint state under this integration contract:

- An actor may append new bullets to `## Progress` and `## Running Context`.
- An actor may update a `## Plan` line only to perform a permitted checkbox transition and add or update a trace pointer.
- `[ ]` → `[~]` is allowed when the actor starts active work, dispatches the task, or records external in-flight ownership. The resulting `[~]` line must carry a pointer defined in [Trace Grammar](#trace-grammar).
- `[~]` → `[x]` is allowed only when the line's pointer resolves to evidence: a merged PR annotation, or a verified completion recorded as a `## Progress` entry. The actor must append a `## Progress` entry naming the issue, pointer, and verification/merge evidence.
- Actors must preserve existing Plan item text except for checkbox state and additive trace annotations.
- Actors must not change sprint frontmatter `status:` under this contract. Sprint lifecycle workflows own `status: active` and `status: completed`.
- Actors must not delete Plan items, rewrite Plan items into a different task, remove trace pointers, or rewrite historical `## Progress` / `## Running Context` entries.

## Sprint Frontmatter: Component Routing

The optional `component:` field is one primary routing handle into `spec/capabilities.md`.

```yaml
component: "spec-charter"
```

Rules:

- Empty string means there is no capability Learnings target.
- Non-empty values must match exactly one `## Capability: <slug>` heading in `spec/capabilities.md`.
- Comma-separated values are invalid. If a sprint touches secondary areas, write that in `## Running Context` or sprint prose.
- `component-lint.js` owns validation on the dev-backlog side.

This is intentionally stricter than normal markdown prose. The field is an address for downstream writers, not a place to explain scope.

## Checkbox States

Sprint plan items use this format:

```
- [ ] #42 OAuth2 flow (~2hr)
- [~] #42 OAuth2 flow (~2hr) → PR #87 (reviewing)
- [x] #42 OAuth2 flow (~2hr) → PR #87 (merged)
```

| Marker | Meaning | Regex | Set by |
|--------|---------|-------|--------|
| `[ ]` | Not started | `^\- \[ \] #` | sprint-init.js, manual |
| `[~]` | In-flight (PR open/reviewing) | `^\- \[~\] #` | dev-relay dispatch |
| `[x]` | Done (merged/completed) | `^\- \[x\] #` | dev-relay merge, manual |

### Issue number extraction

```
/^\- \[.\] #(\d+)/
```

Captures the GitHub issue number from any checkbox state.

### PR annotation (appended by dev-relay)

```
/→ PR #(\d+) \((\w+)\)$/
```

Appended when dispatching: `→ PR #87 (reviewing)`. Updated on merge: `→ PR #87 (merged)`.

## Trace Grammar

Every `[~]` Plan line must carry at least one pointer that lets a later reader find the live work:

- PR pointer: `→ PR #N (state)`, using the existing PR annotation format.
- Branch pointer: `[branch:<git-ref>]`, where `<git-ref>` is a Git branch name with no whitespace or `]`.
- Run pointer: `[run:<run-id>]`, using the existing run-id annotation format.

A `[~]` line with none of those pointers is **unmoored**. Historical unmoored lines should be read conservatively as in-flight but unattributable; the upcoming `backlog-doctor` consumer will flag them for repair.

Non-human `## Progress` entries must include an actor tag:

```
- YYYY-MM-DD HH:MM: [actor:<actor-id>] #N action summary → pointer [run:<run-id>]
```

`<actor-id>` matches `[A-Za-z0-9][A-Za-z0-9._/-]{0,79}`. The actor tag is a strictly additive bracketed annotation compatible with the existing `[run:...]` grammar. When both tags are present, place `[actor:...]` before trailing `[run:...]` so the existing run-id extraction remains valid.

## Task File Structure

```yaml
---
id: {PREFIX}-{N}
title: {escaped title}
status: {To Do|In Progress|In Review|Blocked|Done}
labels: [{label list}]
priority: {critical|high|medium|low}
milestone: {milestone title}
created_date: 'YYYY-MM-DD'
---

## Description
{issue body}

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Criteria 1
- [x] Criteria 2
<!-- AC:END -->
```

dev-relay reads AC via LLM context from whatever structure the body provides. The `<!-- AC:BEGIN/END -->` markers are a convention, not machine-parsed by dev-relay.

Task-file AC is the issue mirror and local progress surface. It is not the relay review anchor by itself. relay-plan freezes Done Criteria and rubrics in the relay run artifacts, and relay-review evaluates against that frozen snapshot. `spec/*` files may read task AC or frozen Done Criteria as evidence for durable rules, but must not copy issue-specific AC, rubrics, or review notes into charter, system-map, or capability specs.

## Cross-Sprint Context (`_context.md`) Sections

Actors read `_context.md` for project-level knowledge. The following `## ` headings are expected:

| Section | dev-relay reads | Purpose |
|---------|:-:|---------|
| `## Architecture Decisions` | Yes | Tech choices with date + sprint ref (e.g., "argon2 for password hashing (2026-03-22, Sprint W13)") |
| `## Conventions` | Yes | Recurring patterns (e.g., "All new endpoints need rate limiting middleware") |
| `## Known Gotchas` | Yes | Non-obvious pitfalls (e.g., "Safari doesn't send cookies on first redirect") |

`dev-relay` profile: `relay-plan` uses these sections as context when building scoring rubrics. `relay-dispatch` may include relevant conventions in the executor prompt. Sections may be empty or absent — treated as empty.

The following sections define the `dev-relay` consumer profile. They specialize the general read, write, and trace rules above without narrowing the contract for other actors.

## Relay-Merge Sprint Update Format

When `relay-merge` completes a task, it updates the active sprint file in these specific formats:

**Plan section** — mark checkbox done with PR annotation:
```
- [x] #N Task name → PR #M (merged)
```

**Progress section** — structured log with review rounds:
```
- YYYY-MM-DD HH:MM: #N dispatched → PR #M → reviewed (LGTM, round R) → merged
```

**Running Context section** — append learnings:
```
- Topic: concise discovery. (e.g., "OAuth2: PKCE flow using jose library")
```

## Capability Learnings Append Contract

When `spec/capabilities.md` exists and the active sprint has a primary `component:` value, `relay-merge` may append one capability-level Learning after a successful run. This is the `dev-relay` capability-learning writer profile, not permission for working agents or other actors to edit the capability spec.

Inputs:

| Field | Meaning |
|---|---|
| `component` | Primary capability slug from sprint frontmatter |
| `date` | `YYYY-MM-DD` append date |
| `run_id` | Relay run identifier, when available |
| `summary` | One-line observation from the completed run |
| `pr` | Merged PR number, when available |

Target:

```
spec/capabilities.md
  ## Capability: <component>
    ### Learnings
    <!-- LEARN:BEGIN -->
    - YYYY-MM-DD (run <run_id>): <summary> [PR #N]
    <!-- LEARN:END -->
```

Required behavior:

- Reject missing `spec/capabilities.md`; do not silently create it.
- Reject unknown `component` values.
- Reject duplicate, missing, or nested `LEARN` markers in the target capability block.
- Reject writes that would modify text outside the marker pair.
- Prefer idempotency for the same `run_id`; if exact idempotency is impossible, document the rerun behavior in the relay result.
- If the append succeeds but commit/push does not happen, surface that explicitly. A local-only Learning is not durable project state.

Until the append writer is installed in the target repo, docs should describe this as a contract to implement, not as an already-enforced property.

### Run-ID Annotation (optional)

Sprint plan items may include a relay run-id for traceability back to the manifest:

```
- [x] #42 OAuth2 flow → PR #87 (merged) [run:issue-42-20260403120000000]
```

Regex for extraction:
```
/\[run:([^\]]+)\]$/
```

This is optional — items without `[run:...]` are valid when another trace pointer is present. `relay-merge` appends it when a manifest exists.

## Progress Reporting Boundary

Monthly progress reporting is owned by `dev-backlog`, not `dev-relay`. This profile defines how `dev-relay` may enrich the dev-backlog-owned reporting flow.

- Canonical engine: `skills/dev-backlog/scripts/progress-sync.js`
- Backlog-only mode: `node skills/dev-backlog/scripts/progress-sync.js --month YYYY-MM`
- Relay-enriched mode: `node skills/dev-backlog/scripts/progress-sync.js --month YYYY-MM --relay-manifest /abs/path/to/<run-id>.md`
- Month finalization mode: `node skills/dev-backlog/scripts/progress-sync.js --month YYYY-MM --finalize`

Boundary rules:

- `dev-backlog` creates or updates the monthly progress issue body.
- `dev-backlog` may finalize a month's issue by rendering the month-end block from source data and closing the issue idempotently.
- `dev-backlog` reconciles only its own machine-managed progress comments on that issue.
- `dev-relay` may pass a relay manifest path to enrich matching merge or stuck entries with `run_id`, grade, rounds, actor/executor/reviewer, and richer stuck-state signals.
- `dev-relay` must not bypass `progress-sync.js` with a separate direct-to-GitHub reporting implementation.
- Neighbor links are rendered from the month being synced only. If `Previous` or `Next` month issues already exist, the synced month's body may include both links; syncing one month does not mutate neighboring month issues.

### Progress comment identity

Backlog-only comments use month-scoped keys:

```
YYYY-MM/merge/pr-<N>
YYYY-MM/stuck/<task-file>
```

When relay metadata is present, `dev-backlog` upgrades matching entries to relay-scoped keys while preserving the backlog-only key as an alias for reconciliation:

```
run/<run-id>/merge
run/<run-id>/stuck
```

This allows comment upserts to stay idempotent and prevents duplicate machine comments when a backlog-only entry is later enriched by relay data.

## Graceful Degradation

- **No sprint file**: actors skip sprint tracking entirely. Tasks still work standalone.
- **No `_context.md`**: ignored silently.
- **Missing section in sprint**: treated as empty.
- **No task file for an issue**: actors that can access GitHub may read directly via `gh`; `dev-relay` does this today.
- **No relay manifest path**: progress reporting stays backlog-only.

## Cross-Project Smoke Test

The following patterns must be parseable by both projects. Run from dev-backlog root:

```bash
# Verify checkbox regex matches all three states
echo '- [ ] #1 Task' | grep -c '^\- \[.\] #'   # → 1
echo '- [~] #2 Task' | grep -c '^\- \[.\] #'   # → 1
echo '- [x] #3 Task' | grep -c '^\- \[.\] #'   # → 1

# Verify section extraction
# (uses lib.sh extract_section — tested in smoke-test.sh)

# Verify issue number extraction
echo '- [x] #42 OAuth2 flow (~2hr) → PR #87 (merged)' | \
  sed 's/^\- \[.\] #\([0-9]*\).*/\1/'           # → 42

# Verify PR annotation extraction
echo '- [~] #42 OAuth2 flow → PR #87 (reviewing)' | \
  grep -oP '→ PR #(\d+) \((\w+)\)'               # → PR #87 (reviewing)
```

These patterns are also validated by `scripts/smoke-test.sh` (checkbox counting tests).

## Versioning

This contract is unversioned, but its checkbox and annotation grammar is compatibility-sensitive. Any change to grammar parsed by `dev-relay` regexes must be coordinated with `dev-relay` before landing; prefer strictly additive grammar that preserves existing matches.

Breaking changes require:
1. Update this document
2. Update regex patterns in both dev-backlog (lib.sh, lib.js) and dev-relay
3. Run smoke tests in both projects
