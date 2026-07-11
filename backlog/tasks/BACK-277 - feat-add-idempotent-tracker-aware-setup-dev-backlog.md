---
id: BACK-277
title: 'feat: add idempotent tracker-aware setup-dev-backlog'
status: Done
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

Tracker selection must be explicit and persistent. Detection may propose a safe initial value during setup but runtime must never change the configured tracker because a remote, CLI, or credential is temporarily unavailable.

## Goal

Add idempotent `setup-dev-backlog` behavior that initializes or repairs the minimum backlog structure and records one deliberate tracker choice without overwriting user state.

## Acceptance Criteria

- [x] Setup accepts an explicit `--tracker github|local` selection and persists it in `backlog/config.yml`.
- [x] Without an explicit selection, setup may recommend GitHub only when a usable GitHub remote and authenticated `gh` are detected; otherwise it recommends local and reports the evidence.
- [x] Non-interactive mode requires an explicit tracker or a documented deterministic default and never switches an existing selection.
- [x] Re-running setup is byte-idempotent when configuration and directories are already valid.
- [x] Existing config keys, task files, sprint files, and user-authored content are preserved.
- [x] Invalid configuration and unavailable selected providers produce actionable repair instructions.
- [x] Tests cover fresh GitHub, fresh local, rerun, partial structure, invalid tracker, missing `gh`, unauthenticated `gh`, and changed remote.

## Non-Goals

- Rewriting AGENTS.md or CLAUDE.md.
- Installing provider CLIs.
- Runtime auto-detection on every command.

Depends on #273 and #276. Parent: #270.
