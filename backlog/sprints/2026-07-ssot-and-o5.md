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
- [x] #228 fix(dev-backlog): backlog-doctor treats zero active sprints as hard fail (~20min, folded into #216) → PR #229 (merged) [run:issue-216-20260703140629614-43632130]
- [x] #216 feat(dev-backlog): run backlog-doctor at sprint close with reassess signal (~45min) → PR #229 (merged) [run:issue-216-20260703140629614-43632130]

### Batch 2 - SSOT spike (E3)
- [~] #215 spike(dev-backlog): SSOT location decision - prototype sprint-to-issue mirror (timebox: half day; orchestrator-led analysis, not delegated) → findings on #215, Decision row pending human approval

### Batch 3 - O5 activation (E4, after Batch 1)
- [ ] #217 docs(spec): amend charter O5 deferred to active with signal-gated wording (~15min, human-gated spec-charter amend)

## Running Context
- Source PRD: `docs/prd-2026-07-autonomous-execution.md` (sections 5, 6, 8). Issue AC is authoritative.
- Epic #220 (E4) is a tracking issue, not a plan item; close it when #216 and #217 land.
- #228 is folded into the #216 branch: zero-active must not fail, or the close flow #216 builds would always end red.
- #215 outcome lands as a charter Decision row (Tier 3, append via human-approved wording) — prototype uses the progress-issue machinery (managed-body marker + comment upsert keys) against this sprint's own file.
- #217 waits for #216 evidence (one real doctor-at-close run) so the amend wording can cite it.
- Milestone 1 lesson applied: this sprint file is committed to main at open time.
- objectives: starts as [O4] because objectives-check rightly flags referencing deferred O5 as drift; add O5 to this frontmatter as part of #217 once the charter amend activates it.

## Progress
- 2026-07-03: Sprint created from milestone #11. Batch order: doctor wiring (#228+#216 delegated) → SSOT spike (#215, orchestrator-led) → O5 charter amend (#217, human-gated).
- 2026-07-03: #216+#228 → PR #229 → reviewed (LGTM, round 1) → merged. Verified live: zero-active now warns; sprint-close --dry-run emits doctor pre-close block and reassess signal ("2 warnings, 12 sprints since last reassess → recommend spec-charter reassess"). #215 spike executed: mirror issue #230, 3 idempotent syncs, ~0 timeline noise; recommendation (a)+(c), reject (b); findings on #215. Decision row and O5 amend wording pending human approval.
- 2026-07-03: capabilities-doctor warning noted: sprint-execution has 8 inline Learnings (keep 7) — prune/promote oldest entry at next capability edit.
