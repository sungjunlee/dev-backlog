# Process

Detailed workflow for each phase. SKILL.md has the summary; this file has the full steps.

## Orient — Starting a Session

1. If `backlog/` doesn't exist → Bootstrap: `mkdir -p backlog/{sprints,tasks,completed}`
2. Read `backlog/sprints/_context.md` if it exists — project-level knowledge.
3. Find the active sprint: the file in `backlog/sprints/` with `status: active` in frontmatter.
4. If no active sprint → check GitHub for open issues → proceed to **Plan — Sprint**.
5. Read sprint file — plan, progress, running context. You now know where you are.
6. Find where you left off: last Progress entry + first unchecked item in Plan.
7. If all Plan items are checked → proceed to **Complete** (close sprint).

Two files at most (`_context.md` + active sprint), full picture.

## Create — New Issues

1. Create on GitHub: `gh issue create -t "Title" -l "labels" -m "milestone"`
2. Pull to local task file: `gh issue view <N> --json` → write `backlog/tasks/`
3. Add to current sprint's Plan if it belongs in this sprint

## Plan — Sprint

When starting a new sprint:

0. If an active sprint exists, set its `status: completed` and write a final Progress entry first.
1. Create GitHub milestone: `gh api repos/{owner}/{repo}/milestones -f title="Sprint W13" -f due_on="2026-03-28"`
2. Assign issues: `gh issue edit <N> --milestone "Sprint W13"`
3. Pull issues to `backlog/tasks/`
4. **Create sprint file** in `backlog/sprints/`:
   - Set Goal (one sentence)
   - Order issues into Batches — group small tasks that can run in one session
   - Estimate time per task to help decide batching
   - Note any dependencies between tasks

## Work — Execute a Batch

**Option A: Do it yourself (Claude Code)**
1. Read sprint file → find current batch
2. For each issue in the batch:
   - Update GitHub label: `gh issue edit <N> --add-label "status:in-progress"`
   - Read task file for AC and description
   - Do the work.
   - Verify: run tests, confirm each AC item is met, then check off AC in the task file.
   - Commit with `Fixes #<N>` (one commit per issue)
   - Add to sprint file's **Running Context** when you discover something that affects later tasks
3. When batch is done:
   - Update sprint file Plan checkboxes
   - Add Progress entry with date and summary
   - Push meaningful updates to GitHub: `gh issue comment <N> --body "summary"`

**Option B: Delegate to Codex (via dev-relay)**
1. Read sprint file → find current batch
2. For each issue: extract AC from task file → Done Criteria
3. Follow the **dev-relay** skill's dispatch process (Plan + Contract → Dispatch → Review → Merge)
4. After each merge, update sprint file: Plan checkbox, Progress entry, Running Context

Small tasks in a batch flow naturally — finish one, check it off, start the next.

## Complete — Close Issues

Per issue:
1. All AC checked in task file
2. Commit/PR with `Fixes #<N>`
3. Check off in sprint Plan + add Progress entry

When the whole sprint closes:
1. Set sprint `status: completed`, write a final Progress entry
2. Move completed task files: `backlog/tasks/` → `backlog/completed/`
3. Review Running Context — promote project-level entries to `_context.md`
4. The sprint file becomes a permanent record. Don't delete it.

## Sync — GitHub ↔ Local

**Pull** (GitHub → Local): `gh issue list` → update task files. Do this at sprint start and when issues change.
**Push** (Local → GitHub): status label updates, progress comments, closing issues. Do this at meaningful milestones.

See `references/github-sync.md` for detailed commands.

## Quick Fix — Single Issue, No Sprint

Not everything needs a sprint. For a one-off bug fix or quick task:

1. `gh issue view <N>` — read the issue directly
2. Do the work, commit with `Fixes #<N>`
3. Done. No sprint file, no local task file needed.

If you discover it's bigger than expected, that's when you create a sprint file.

## Unplanned Work — Mid-Sprint Scope Change

- **Small (< 1hr):** Use Quick Fix above — no sprint file change needed.
- **Belongs in current sprint:** Add to the Plan as a new batch at the current position. Note in Progress: "Scope change: #50 added (urgent bug from QA)"
- **Big enough for its own sprint:** Close current sprint early → start a new one.

## Next — What to Work On

1. Read sprint file → find first unchecked batch
2. If current sprint is done, check GitHub for unplanned work or start next sprint
3. Present: "Next up: Batch 3 (#43 Rate limiting + #44 Input validation, ~50min total)"
