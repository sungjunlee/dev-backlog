---
id: BACK-248
title: 'docs(integration-contract): component example uses removed spec-charter slug'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

`skills/dev-backlog/references/integration-contract.md:174` shows `component: "spec-charter"` as the example, but that capability block was removed from `spec/capabilities.md` on 2026-07-05 (04fd2cb, follow-up to the 0.7.0 craftkit move). The same doc requires the value to "match exactly one `## Capability: <slug>` heading", so the example now violates its own contract.

## Acceptance Criteria

- [ ] Example uses a live slug from `spec/capabilities.md` (e.g. `sprint-execution`)
- [ ] No other removed-slug examples remain in the file
