---
id: BACK-194
title: 'docs(spec): refresh spec-series tracking and boundary docs'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-06 execution guard and stale signals
created_date: '2026-06-17'
---
## Description
## Context

The current spec layer is structurally healthy, but a few tracking docs now lag behind the accepted shape:

- `skills/spec-charter/references/reassess.md` says callable spec-series skills are only `spec-charter` and `spec-grill`, omitting `spec-system-map`.
- `spec/system-map.md` still presents accepted capability handles under `Candidate Capability Boundaries`, including uncertainty that has since been resolved or moved into `spec/capabilities.md`.
- `docs/spec-system-design.md` historical dogfood numbers mention an older six-capability / 214-line snapshot while current `capabilities-doctor` reports seven capabilities / 258 lines.

## Desired change

Refresh spec-series docs without broad rewriting. Keep durable specs compact and avoid copying task-specific acceptance criteria into `spec/*`.

## Acceptance Criteria

- [x] `reassess.md` names the current callable spec-series surface: `spec-charter`, `spec-system-map`, and `spec-grill`.
- [x] `spec/system-map.md` no longer reads like accepted capabilities are still merely candidates; it points to `spec/capabilities.md` for accepted contracts and keeps only genuinely unresolved boundary questions.
- [x] `docs/spec-system-design.md` dogfood evidence is updated or explicitly marked historical so current health checks do not appear contradictory.
- [x] No task-specific AC, relay Done Criteria, or issue checklist text is copied into durable `spec/*` contracts.
- [x] `capabilities-doctor --strict` and `component-lint` remain clean.
