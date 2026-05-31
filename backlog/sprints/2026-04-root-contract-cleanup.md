---
milestone: April 2026 Root Contract Cleanup
status: completed
started: 2026-04-16
due: 2026-04-23
---

# Root Contract Alignment

## Goal
Bring the root repo instructions back in line with the current README and `SKILL.md` contract so agents starting from the repo root get accurate guidance.

## Plan
### Batch 1 - root instruction cleanup
- [x] #53 docs(root): refresh CLAUDE.md after README/SKILL role split (~20min) → PR #54 (merged)

## Running Context
- `README.md` is the human quick start; `skills/dev-backlog/SKILL.md` is the execution contract for agents
- Root repo instructions should avoid stale implementation-size notes when those details drift faster than the contract itself
- `sync-pull.js --update` preserves existing task bodies, so `BACK-46` is not the latest source of truth for the progress issue body after `progress-sync`

## Progress
- 2026-04-16 22:12 KST: Sprint opened for follow-up root instruction cleanup in `#53`.
- 2026-04-16 22:15 KST: Created GitHub issue `#53` and milestone `April 2026 Root Contract Cleanup`, refreshed the monthly progress issue `#46`, and noted that local progress task bodies stay stale under `sync-pull --update`.
- 2026-04-17 00:05 KST: Updated `CLAUDE.md` so root instructions describe the README/`SKILL.md` split correctly and removed the stale `~290 lines` note; `node --test skills/dev-backlog/scripts/*.test.js` stayed green.
- 2026-04-17 00:09 KST: Committed the `#53` docs cleanup on `codex-root-contract-cleanup`, pushed the branch, and opened PR #54 for review.
- 2026-04-17 00:14 KST: Addressed CodeRabbit's MD040 note by marking the `CLAUDE.md` project-structure fence as `text`; script tests remained green.
- 2026-04-17 07:54 KST: PR #54 merged to `main`; issue `#53` closed automatically via the PR body.
- 2026-04-17: Sprint closed. 1/1 tasks completed.
