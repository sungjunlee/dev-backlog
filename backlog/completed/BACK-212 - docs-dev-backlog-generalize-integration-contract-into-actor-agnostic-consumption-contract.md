---
id: BACK-212
title: 'docs(dev-backlog): generalize integration contract into actor-agnostic consumption contract'
status: To Do
labels:
  - documentation
priority: medium
milestone: 2026-07 execution substrate
created_date: '2026-07-03'
---
## Description
## Summary
`references/integration-contract.md` documents the machine-legible state machinery as a dev-relay pairing only. Re-scope it as a consumption contract for any long-running actor.

Source: docs/prd-2026-07-autonomous-execution.md section 4 (A2). Success criterion S7.

## Acceptance Criteria
- [ ] Read surface re-scoped from dev-relay pairing to any long-running actor (human, relay executor, external loop, analyzer)
- [ ] Write rules specified: appendable sections (`## Progress`, `## Running Context`); allowed transitions `[ ]` to `[~]`, and `[~]` to `[x]` only when the line's pointer resolves to a merged PR or verified completion recorded as a Progress entry; forbidden: sprint frontmatter status, Plan item deletion
- [ ] Trace grammar promoted to contract text: every `[~]` line carries a pointer (PR, branch, or run-id); a line without one is defined as unmoored; non-human Progress entries carry an actor tag compatible with the existing `[run:...]` grammar
- [ ] Grammar changes flagged as requiring dev-relay coordination before landing
- [ ] Open question resolved: contract stays inside integration-contract.md or splits into its own reference file

Estimate: ~45min
