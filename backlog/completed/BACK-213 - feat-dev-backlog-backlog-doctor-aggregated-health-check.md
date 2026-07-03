---
id: BACK-213
title: 'feat(dev-backlog): backlog-doctor aggregated health check'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
Health checks are scattered (`objectives-check.js`, `component-lint.js`, `capabilities-doctor.js`, smoke checks). One command should give one verdict on backlog state health, usable by CI, close flows, and future schedulers.

Source: docs/prd-2026-07-autonomous-execution.md section 4 (A3). Success criterion S2.

## Acceptance Criteria
- [ ] Aggregates: active-sprint invariant (exactly one, fail-loud), `objectives-check.js`, `component-lint.js`, `capabilities-doctor.js`, sprint file shape lint (required sections present, checkbox grammar parseable)
- [ ] Hard violations exit non-zero: ambiguous active sprint, unknown `component:` or objective ID, missing required section, unparseable checkbox grammar
- [ ] Soft signals warn only: unmoored `[~]` (no PR/branch/run-id pointer), stale `[~]` (`--stale-days` CLI flag, default 7 — a flag, not a config field), `_context.md` bloat
- [ ] Output: human summary plus `--json` with per-check verdicts
- [ ] Tests seed each violation and assert it is flagged

Estimate: ~2hr
