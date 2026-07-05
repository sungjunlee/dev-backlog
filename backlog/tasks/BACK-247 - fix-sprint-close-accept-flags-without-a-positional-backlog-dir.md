---
id: BACK-247
title: 'fix(sprint-close): accept flags without a positional backlog-dir'
status: To Do
labels:
  - bug
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

`sprint-close.sh` resolves the backlog dir with `BACKLOG_DIR="${1:-backlog}"` (scripts/sprint-close.sh:17). When invoked as `sprint-close.sh --dry-run` (no positional), `--dry-run` becomes the backlog dir and the script exits "No sprints directory found." Every Node script in the repo parses flags position-independently; this is the only script that breaks. Hit live on 2026-07-05.

## Acceptance Criteria

- [ ] `sprint-close.sh --dry-run` from a repo with `backlog/` works (defaults positional to `backlog`)
- [ ] `sprint-close.sh backlog --dry-run` and `sprint-close.sh --dry-run backlog` both work
- [ ] Unknown `--*` flags produce a clear error instead of being silently treated as a directory
- [ ] smoke-test.sh covers the flag-only invocation
- [ ] SKILL.md usage line still accurate (update if the contract changes)
