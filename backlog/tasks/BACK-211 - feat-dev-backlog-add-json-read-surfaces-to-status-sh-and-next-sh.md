---
id: BACK-211
title: 'feat(dev-backlog): add --json read surfaces to status.sh and next.sh'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
`status.sh` / `next.sh` emit prose only; any external consumer must re-parse markdown to answer "what is in flight?". Add `--json` structured output.

Source: docs/prd-2026-07-autonomous-execution.md section 4 (A1). Success criteria S1, S7.

## Acceptance Criteria
- [ ] `status.sh --json` and `next.sh --json` emit: `schema_version`, active sprint (path, frontmatter, goal), plan items (checkbox state, issue number, PR annotation, run-id), next actionable batch, latest 5 progress entries, in-flight `[~]` items with age
- [ ] Human-readable output stays the default
- [ ] JSON shape documented in the integration contract and covered by the cross-project smoke gating
- [ ] Snapshots supported via shell redirection only; no snapshot store is built

Estimate: ~1hr
