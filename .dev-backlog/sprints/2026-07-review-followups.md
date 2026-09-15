---
milestone: review-followups
status: completed
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
- [x] #247 fix(sprint-close): accept flags without a positional backlog-dir (~15min) — via relay → PR #251 (merged) [run:issue-247-20260705054603535-f8fa8f1d]
- [x] #249 docs(spec-system-design): fix stale spec-* paths and dead research link (~30min) — via delegate/opencode, fell back to sonnet subagent
- [x] #248 docs(integration-contract): component example uses removed spec-charter slug (~5min) — direct fix

### Batch 2 - after Batch 1 lands
- [x] #250 chore(changelog): record 2026-07-05 doc-sync batch under Unreleased (~10min) — direct fix, needs final PR numbers

## Running Context
- craftkit#124 tracks the spec-system-research.md restore-or-drop decision; #249 cites dev-backlog git history (pre-cd31a2b) as interim.
- Delegation mix per user: relay for the code change (#247), opencode via /delegate for the doc rewrite (#249), direct fix for one-liners (#248, #250).
- opencode one-shot `opencode run` (default model) hung with zero stdout for 45min on #249 and was killed; work fell back to a sonnet subagent. Second opencode failure mode after the glm-5.2 review-verdict one — prefer subagent/relay for edits until diagnosed.

## Progress
- 2026-07-05: Sprint opened; issues #247-#250 created (plus craftkit#124) and mirrored locally.
- 2026-07-05 15:00: #247 dispatched → PR #251 → reviewed (LGTM, round 1) → merged. Learnings appended to sprint-execution manually (finalize dirty-worktree path).
- 2026-07-05 15:00: #248 direct fix committed (05845e5 after rebase onto merged PR #251).
- 2026-07-05 15:30: #249 done (17d0fc8) — opencode delegate hung (killed, no output), sonnet subagent completed it. #250 done (63fe23c). Tests: node 415 pass / smoke 135 pass.
- 2026-07-05: Sprint closed. 4/4 tasks completed.
