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
