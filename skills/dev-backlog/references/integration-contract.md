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

## Graceful Degradation

- **No sprint file**: dev-relay skips sprint tracking entirely. Tasks still work standalone.
- **No `_context.md`**: ignored silently.
- **Missing section in sprint**: treated as empty.
- **No task file for an issue**: dev-relay reads directly from GitHub via `gh`.

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
