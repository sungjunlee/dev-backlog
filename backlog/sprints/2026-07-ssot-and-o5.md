---
milestone: 2026-07 SSOT decision and O5 activation
status: active
started: 2026-07-03
due: TBD
objectives: [O4, O5]
component: "sprint-execution"
---

# SSOT And O5

## Goal
The SSOT location question has a recorded charter Decision backed by a scored spike, and charter O5 is active: closing a sprint runs backlog-doctor and surfaces a reassess recommendation when signals fire, with no spec file mutated by automation.

## Plan
### Batch 1 - doctor close wiring (E4, #220)
- [ ] #228 fix(dev-backlog): backlog-doctor treats zero active sprints as hard fail (~20min, fold into #216 branch)
- [ ] #216 feat(dev-backlog): run backlog-doctor at sprint close with reassess signal (~45min)

### Batch 2 - SSOT spike (E3)
- [ ] #215 spike(dev-backlog): SSOT location decision - prototype sprint-to-issue mirror (timebox: half day; orchestrator-led analysis, not delegated)

### Batch 3 - O5 activation (E4, after Batch 1)
- [ ] #217 docs(spec): amend charter O5 deferred to active with signal-gated wording (~15min, human-gated spec-charter amend)

## Running Context
- Source PRD: `docs/prd-2026-07-autonomous-execution.md` (sections 5, 6, 8). Issue AC is authoritative.
- Epic #220 (E4) is a tracking issue, not a plan item; close it when #216 and #217 land.
- #228 is folded into the #216 branch: zero-active must not fail, or the close flow #216 builds would always end red.
- #215 outcome lands as a charter Decision row (Tier 3, append via human-approved wording) — prototype uses the progress-issue machinery (managed-body marker + comment upsert keys) against this sprint's own file.
- #217 waits for #216 evidence (one real doctor-at-close run) so the amend wording can cite it.
- Milestone 1 lesson applied: this sprint file is committed to main at open time.

## Progress
- 2026-07-03: Sprint created from milestone #11. Batch order: doctor wiring (#228+#216 delegated) → SSOT spike (#215, orchestrator-led) → O5 charter amend (#217, human-gated).
