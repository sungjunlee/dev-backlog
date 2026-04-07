# Integration Contract: dev-relay ↔ dev-backlog

This document defines the exact interface that dev-relay depends on when reading and writing dev-backlog files. Changes to these patterns must be coordinated across both projects.

## File Paths

| What | Pattern | Example |
|------|---------|---------|
| Task files | `backlog/tasks/{PREFIX}-{N} - {slug}.md` | `backlog/tasks/BACK-42 - oauth-flow.md` |
| Active sprint | `backlog/sprints/*.md` with `status: active` | `backlog/sprints/2026-03-auth-system.md` |
| Cross-sprint context | `backlog/sprints/_context.md` | (always this exact name) |
| Completed tasks | `backlog/completed/{PREFIX}-{N} - {slug}.md` | `backlog/completed/BACK-38 - db-schema.md` |

**PREFIX** defaults to `BACK` and is configurable via `backlog/config.yml` → `task_prefix`.

## Sprint File Sections

dev-relay reads and writes specific `## ` sections in the active sprint file.

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

## Cross-Sprint Context (`_context.md`) Sections

dev-relay reads `_context.md` for project-level knowledge. The following `## ` headings are expected:

| Section | dev-relay reads | Purpose |
|---------|:-:|---------|
| `## Architecture Decisions` | Yes | Tech choices with date + sprint ref (e.g., "argon2 for password hashing (2026-03-22, Sprint W13)") |
| `## Conventions` | Yes | Recurring patterns (e.g., "All new endpoints need rate limiting middleware") |
| `## Known Gotchas` | Yes | Non-obvious pitfalls (e.g., "Safari doesn't send cookies on first redirect") |

relay-plan uses these sections as context when building scoring rubrics. relay-dispatch may include relevant conventions in the executor prompt. Sections may be empty or absent — treated as empty.

## Relay-Merge Sprint Update Format

When relay-merge completes a task, it updates the active sprint file in these specific formats:

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

### Run-ID Annotation (optional)

Sprint plan items may include a relay run-id for traceability back to the manifest:

```
- [x] #42 OAuth2 flow → PR #87 (merged) [run:issue-42-20260403120000000]
```

Regex for extraction:
```
/\[run:([^\]]+)\]$/
```

This is optional — items without `[run:...]` are valid. relay-merge appends it when a manifest exists.

## Progress Reporting Boundary

Monthly progress reporting is owned by `dev-backlog`, not `dev-relay`.

- Canonical engine: `skills/dev-backlog/scripts/progress-sync.js`
- Backlog-only mode: `node skills/dev-backlog/scripts/progress-sync.js --month YYYY-MM`
- Relay-enriched mode: `node skills/dev-backlog/scripts/progress-sync.js --month YYYY-MM --relay-manifest /abs/path/to/<run-id>.md`

Boundary rules:

- `dev-backlog` creates or updates the monthly progress issue body.
- `dev-backlog` reconciles only its own machine-managed progress comments on that issue.
- `dev-relay` may pass a relay manifest path to enrich matching merge or stuck entries with `run_id`, grade, rounds, actor/executor/reviewer, and richer stuck-state signals.
- `dev-relay` must not bypass `progress-sync.js` with a separate direct-to-GitHub reporting implementation.

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

- **No sprint file**: dev-relay skips sprint tracking entirely. Tasks still work standalone.
- **No `_context.md`**: ignored silently.
- **Missing section in sprint**: treated as empty.
- **No task file for an issue**: dev-relay reads directly from GitHub via `gh`.
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

This contract is unversioned. Breaking changes require:
1. Update this document
2. Update regex patterns in both dev-backlog (lib.sh, lib.js) and dev-relay
3. Run smoke tests in both projects
