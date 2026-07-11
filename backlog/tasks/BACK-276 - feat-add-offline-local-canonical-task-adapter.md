---
id: BACK-276
title: 'feat: add offline local canonical task adapter'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

The accepted direction requires local Backlog.md-compatible task files to act as canonical task truth, not as fake GitHub mirrors. This starts only after the core seam and task-reference contract are stable.

## Goal

Implement an offline local adapter that completes canonical task lifecycle and the core sprint cycle without `gh`, a network, or provider-only semantics.

## Acceptance Criteria

- [ ] Local list/read/create/update/close operations work against Backlog.md-compatible `backlog/tasks/` and `backlog/completed/` files.
- [ ] ID allocation is deterministic, collision-safe, prefix-aware, and preserves existing decimal subtask compatibility.
- [ ] Create and update preserve human-authored descriptions and AC checkbox state; close archives the exact task atomically.
- [ ] Local plan/work/complete uses normalized task refs and does not invoke `gh` or require GitHub authentication.
- [ ] Unsupported milestone, PR relationship, mirror, progress issue, comment, and close-keyword operations return actionable capability errors.
- [ ] Offline integration tests run with `gh` absent from `PATH` and prove create → plan → read/work state → complete/archive.
- [ ] Concurrent or duplicate ID allocation fails safely rather than overwriting a task.

## Non-Goals

- Bidirectional local/GitHub synchronization.
- Reimplementing Backlog.md CLI.
- GitLab/Gitea/Forgejo adapters.

Depends on #273 and #274; begins after GitHub regression proof in #275. Parent: #270.

