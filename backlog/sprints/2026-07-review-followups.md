---
milestone: review-followups
status: active
started: 2026-07-05
due: 2026-07-05
objectives: [O1]
component: "sprint-execution"
---

# review-followups

## Goal
The four follow-ups from the writing-great-skills review round two (spec-* move aftermath + live-hit script bug) are fixed, and the CHANGELOG records the whole 2026-07-05 batch.

## Plan
### Batch 1 - independent fixes (parallel delegation)
- [ ] #247 fix(sprint-close): accept flags without a positional backlog-dir (~15min) — via relay
- [ ] #249 docs(spec-system-design): fix stale spec-* paths and dead research link (~30min) — via delegate/opencode
- [ ] #248 docs(integration-contract): component example uses removed spec-charter slug (~5min) — direct fix

### Batch 2 - after Batch 1 lands
- [ ] #250 chore(changelog): record 2026-07-05 doc-sync batch under Unreleased (~10min) — direct fix, needs final PR numbers

## Running Context
- craftkit#124 tracks the spec-system-research.md restore-or-drop decision; #249 cites dev-backlog git history (pre-cd31a2b) as interim.
- Delegation mix per user: relay for the code change (#247), opencode via /delegate for the doc rewrite (#249), direct fix for one-liners (#248, #250).

## Progress
- 2026-07-05: Sprint opened; issues #247-#250 created (plus craftkit#124) and mirrored locally.
