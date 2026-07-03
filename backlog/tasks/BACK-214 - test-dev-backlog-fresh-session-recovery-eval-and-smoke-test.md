---
id: BACK-214
title: 'test(dev-backlog): fresh-session recovery eval and smoke test'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
Pin the substrate's acceptance property: a fresh agent session, given only the repo files, can orient — name the active sprint, the next actionable batch, and in-flight work with owners/pointers.

Source: docs/prd-2026-07-autonomous-execution.md section 4 (A4). Success criterion S3. This is the acceptance gate for A1/A2, not a feature.

Depends on #211 (JSON surfaces) and #212 (consumption contract).

## Acceptance Criteria
- [ ] Eval prompt added in the SKILL.md Eval Prompts section, per repo convention
- [ ] Smoke test pins the recovery property using files alone

Estimate: ~45min
