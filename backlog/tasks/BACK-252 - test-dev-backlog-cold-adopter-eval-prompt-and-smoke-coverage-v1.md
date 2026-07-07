---
id: BACK-252
title: 'test(dev-backlog): cold-adopter eval prompt and smoke coverage (V1)'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

The 2026-07-06 multi-model review found a failure class (dangling `../spec-charter` reads, spec-field ceremony, buried minimum path) that one baseline test would have caught: a fresh agent, in a repo without craftkit and without spec files, trying to reach a first closed sprint. No eval or smoke case covers that scenario. Per writing-effective-skills discipline this gate lands first and is expected to fail (RED) against current HEAD; E2/E3 make it pass.

Source: docs/prd-2026-07-adoption-hardening.md §4 (V1). Success criteria S1, S2 (partial), S4 (fixture).

## Acceptance Criteria

- [x] SKILL.md Eval Prompts gains the cold-adopter case: no `backlog/`, no `spec/`, no root `CHARTER.md`, no craftkit skills installed, open GitHub issues exist; expected: bootstrap `backlog/`, route to `plan`, produce an active sprint with spec fields omitted, never chase a `../spec-charter/...` path
- [x] smoke-test.sh gains a spec-less fixture case: `sprint-init.js`, `objectives-check.js`, `component-lint.js`, `backlog-doctor.js` all pass with omitted spec fields (may land gated/expected-fail until #B3 issue merges)
- [x] smoke-test.sh gains a grep assertion over `skills/`: no unconditional required-read instruction of a `../spec-charter/` path (may land gated until A2/A3 merge)
- [x] The RED state against current HEAD is recorded in an issue comment before fixes land

