# Workflow Patterns

Common patterns for GitHub Issues + sprint file workflow.

## Sprint Planning

1. **Collect** — `gh issue list --state open` + review ideas, bugs, feature requests
2. **Create milestone** — `gh api repos/{owner}/{repo}/milestones -f title="Sprint W13" -f due_on="2026-03-28"`
3. **Assign issues** — `gh issue edit <N> --milestone "Sprint W13"`
4. **Prioritize** — add `priority:high/medium/low` labels
5. **Pull to local** — sync milestone issues to `backlog/tasks/`
6. **Create sprint file** — run `uv run scripts/sprint-init.py "Sprint W13"` or write manually:
   - Set Goal (one sentence)
   - Order issues into Batches (group small tasks for one session)
   - Estimate time per task
   - Note dependencies

```bash
# View sprint issues
gh issue list --milestone "Sprint W13" --json number,title,labels --jq '.[] | "\(.number) \(.title)"'
```

## Session Start

1. Read `backlog/sprints/<current>.md` — the sprint file has everything
2. Find where you left off: last Progress entry + first unchecked batch
3. If a batch is mid-way, check the task file for AC progress

One file, full picture. No need to query GitHub unless you suspect changes.

## Session End

1. Update sprint file:
   - Check off completed items in Plan
   - Add Running Context entries for things that affect later tasks
   - Add Progress entry: date + what happened
2. Push meaningful updates to GitHub:
   - `gh issue comment <N> --body "summary"` for significant progress
   - `gh issue edit <N> --add-label "status:in-progress"` if status changed
3. Commit code with `Refs #<N>` messages

## Working a Batch

Small tasks grouped in one session:

1. Read sprint file → find the batch
2. Start first task → update GitHub label → read task file AC → do the work
3. Check off AC in task file → check off in sprint Plan → add Running Context if needed
4. Move to next task in batch — context carries naturally within the session
5. When batch done → Progress entry → push GitHub comments for the batch

## Single Issue (No Sprint)

Not everything needs a sprint. For a quick bug fix or one-off task:

1. Work directly from GitHub: `gh issue view <N>`
2. Optionally pull to local task file for AC tracking
3. No sprint file needed — just fix it, commit with `Fixes #<N>`, done
4. If you discover it's bigger than expected, create a sprint file then

The skill doesn't force sprints. Use them when multiple related tasks benefit from shared context and batching.

## Feature Breakdown

Turn a large feature into trackable issues:

1. **Define scope** — what's in, what's out
2. **Create parent issue** — the epic/umbrella
3. **Create sub-issues** — one per independent unit of work
4. **Set dependencies** — reference in sprint file Plan ordering
5. **Size check** — if any issue has 7+ acceptance criteria, split further

```bash
gh issue create -t "Auth: DB schema" -l "type:feature" -m "Sprint W13"
gh issue create -t "Auth: JWT service" -l "type:feature" -m "Sprint W13"
gh issue create -t "Auth: login endpoint" -l "type:feature" -m "Sprint W13"
```

## Bug Triage

Quick workflow for incoming bugs:

1. `gh issue create -t "Fix: login timeout" -l "type:bug,priority:high"`
2. If urgent: handle as Single Issue (no sprint needed)
3. If can wait: add to current sprint file's Plan, or queue for next sprint

## Backlog Review

Weekly or bi-weekly cleanup:

1. `gh issue list --state open` — scan all open issues
2. Close stale: `gh issue close <N> -c "No longer relevant"`
3. Re-prioritize: adjust priority labels
4. Check `status:blocked` — blocker resolved?
5. Assign unplanned issues to upcoming milestone

```bash
# Issues without milestone (unplanned)
gh issue list --state open --json number,title,milestone | jq '[.[] | select(.milestone == null)]'
```

## Sprint Retrospective

When a sprint closes:

1. `gh issue list --milestone "Sprint W13" --state closed` — what shipped
2. `gh issue list --milestone "Sprint W13" --state open` — what didn't
3. Review the sprint file's Running Context — what did we learn?
4. Add a final Progress entry summarizing the sprint
5. Close milestone: `gh api repos/{owner}/{repo}/milestones/{N} -X PATCH -f state="closed"`
6. Sprint file becomes a permanent record in `backlog/sprints/`
