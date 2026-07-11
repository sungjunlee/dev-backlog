---
id: BACK-273
title: 'feat: add configured tracker selection and core adapter seam'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

#272 freezes the tracker contract and compatibility matrix. The first runtime slice must add a real seam with two eventual adapters without changing existing GitHub behavior.

## Goal

Add explicit tracker configuration, fail-closed resolution, capability reporting, and a small adapter interface that core callers can consume.

## Acceptance Criteria

- [ ] `backlog/config.yml` supports exactly one explicit tracker value: `github` or `local`.
- [ ] Existing configurations without the new key retain GitHub behavior through a documented compatibility default; runtime never selects based on transient auth failure.
- [ ] One tracker resolver returns the selected adapter or an actionable configuration/availability error.
- [ ] The adapter interface matches #272 and exposes provider capabilities without optional forge semantics in the required method set.
- [ ] A GitHub adapter and local adapter slot both satisfy the interface contract, even if later issues complete their implementations.
- [ ] Unit tests cover valid selection, invalid selection, missing configuration compatibility, unavailable provider, and no silent fallback.
- [ ] Existing exported helper contracts remain available or have explicit compatibility shims.

## Non-Goals

- Moving every GitHub caller in this issue.
- Implementing local task persistence.
- Adding setup automation.

Depends on #272. Parent: #270.
