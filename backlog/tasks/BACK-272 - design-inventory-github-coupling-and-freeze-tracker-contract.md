---
id: BACK-272
title: 'design: inventory GitHub coupling and freeze tracker contract'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

Issue #270 and PR #271 accepted one explicitly configured canonical tracker per repository, initially `github` and `local`. Runtime work must begin with an evidence-backed inventory because GitHub identity and `gh` calls are spread across sprint parsing, sync, progress, mirrors, closeout, and triage.

## Goal

Freeze the smallest deep tracker module interface, its capability model, and the backward-compatibility matrix before runtime extraction begins.

## Suggested Direction

- inventory every direct GitHub call and numeric issue-ID assumption by caller
- separate required task lifecycle from optional forge capabilities
- define normalized task identity (`tracker`, stable `id`, display `ref`, optional URL)
- define configuration, availability, unsupported-capability, and no-fallback errors
- record the compatibility matrix for existing CLI, markdown, JSON, and exported helper surfaces

## Acceptance Criteria

- [ ] A durable design reference inventories direct `gh` coupling and numeric `#N` assumptions with current owning callers.
- [ ] The required tracker interface contains only list/read/create/update/close, stable identity/link data, availability probing, and capability reporting.
- [ ] Optional milestones, PR relationships, mirrors, progress issues, comments, and close-keyword behavior are capability-gated rather than required.
- [ ] The compatibility matrix names every existing GitHub CLI, markdown, JSON, and exported helper surface that must remain stable.
- [ ] Runtime selection is explicitly persistent and fail-closed; detection is setup-only and never causes a silent adapter switch.
- [ ] The design passes `git diff --check` and relevant spec/component validation.

## Non-Goals

- Implementing an adapter.
- Adding GitLab, Gitea, or Forgejo.
- Changing existing runtime output.

Parent: #270
