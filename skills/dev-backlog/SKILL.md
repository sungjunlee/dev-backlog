---
name: dev-backlog
description: Manage development work through GitHub Issues + local sprint files. GitHub Issues/Milestones are the source of truth for task definitions; local sprint files are where execution happens — batching, ordering, notes, context, and progress tracking. Use whenever the user wants to create issues, plan sprints, check what to work on, review progress, sync with GitHub, or manage milestones. Triggers on "what should I work on", "create an issue", "plan sprint", "show backlog", "sync tasks", "다음 작업", "이슈 만들어", "스프린트 계획", "백로그". Even if the user just mentions tasks or issues casually, consider whether this skill applies.
version: 0.3.0
triggers:
  - "create an issue"
  - "create a task"
  - "what should I work on"
  - "show backlog"
  - "plan sprint"
  - "sync tasks"
  - "이슈 만들어"
  - "백로그"
  - "스프린트"
  - "다음 작업"
---

# Dev Backlog

Two layers, each with a clear job:

```
GitHub (source of truth — what to do)
  Issues, Milestones, Labels, Comments, PR links
  Defines tasks. Visible to collaborators. Persists across tools.
       ↕  gh CLI (sync is always explicit)
Local (execution hub — how to do it)
  backlog/sprints/   ← THE working file. Plan, context, notes, progress.
  backlog/tasks/     ← Thin mirror of GitHub issues (sync cache).
```

**The sprint file is where you live during execution.** Start every session by reading it. Update it as you work. It carries context across tasks and sessions.

---

## Directory Structure

```
backlog/
├── sprints/              # Sprint execution (the core)
│   ├── _context.md      # Cross-sprint persistent context
│   ├── 2026-03-auth-system.md        # Active (status: active)
│   └── 2026-02-api-v2-migration.md   # Past (status: completed)
├── tasks/                # GitHub issue mirror (thin sync)
│   ├── BACK-42 - OAuth.md
│   └── BACK-43 - Rate-limit.md
├── completed/            # Archived done tasks
└── config.yml            # Project config
```

Setup: see `references/file-format.md` for config.yml and task file format.
GitHub labels: see `references/github-sync.md` for one-time label setup.
Optional CLI: `npm i -g backlog.md && backlog init`

### sprints/ Rules

- **One active sprint at a time.** The file with `status: active` is the current sprint.
- **Naming: `YYYY-MM-<topic>.md`** — date prefix로 시기 추적 + topic으로 내용 파악.
  - 과제 중심: `2026-03-auth-system.md`, `2026-04-payment-integration.md`
  - 기간 중심: `2026-03-W13-misc.md`, `2026-03-tech-debt.md`
  - 파일명만 보고 "언제 무슨 일을 했는지" 알 수 있어야 함.
- **`_context.md`** holds knowledge that outlives any single sprint — architecture decisions, conventions, recurring gotchas. Sprint-specific context stays in the sprint file's Running Context; project-level context goes here.
- **Completed sprints stay.** They're the record of what happened, what was decided, and why. Don't delete them.

---

## Sprint File Format

The sprint file in `backlog/sprints/` is the execution hub. One file per sprint.

```markdown
---
milestone: Sprint W13
status: active
started: 2026-03-22
due: 2026-03-28
---

# Auth + API Foundation

## Goal
One sentence: what's true when this sprint is done.

## Plan
Ordered batches. Small tasks grouped into one session.

### Batch 1 — DB + seed (one session)
- [x] #38 DB schema setup (~15min)
- [x] #39 Seed data script (~10min)

### Batch 2 — Core auth
- [ ] #42 OAuth2 flow (~2hr)

### Batch 3 — Hardening (one session)
- [ ] #43 Rate limiting (~30min)
- [ ] #44 Input validation (~20min)

### Batch 4 — Verification
- [ ] #45 Integration tests (~1hr)

## Running Context
Carries across all tasks in this sprint. Add entries as you learn things.
- argon2 for hashing (decided in #42 — GPU resistant, memory-hard)
- rate limit middleware: middleware/rateLimit.ts
- test DB: docker-compose.test.yml
- IMPORTANT: token refresh must use sliding window, not fixed expiry

## Progress
- 2026-03-22 AM: Batch 1 done. Schema + seed in one session.
- 2026-03-22 PM: #42 started. 3/5 AC done. Token refresh logic remaining.
- 2026-03-23 AM: #42 complete. Started Batch 3.
```

### What each section does

| Section | Purpose | When to update |
|---------|---------|---------------|
| **Goal** | Sprint-level success criteria | Once, at planning |
| **Plan** | Ordered batches with issue refs + time estimates | At planning; adjust if scope changes |
| **Running Context** | Decisions, conventions, gotchas that span tasks | During work — whenever you learn something that affects later tasks |
| **Progress** | Timestamped log of what happened | End of each session or batch |

### Cross-Sprint Context (`_context.md`)

Some knowledge outlives a single sprint. When you notice a Running Context entry that's project-level (not sprint-specific), promote it to `backlog/sprints/_context.md`:

```markdown
# Project Context

## Architecture Decisions
- argon2 for all password hashing (2026-03-22, Sprint W13)
- API versioning via URL prefix /v1/ (2026-03-15, Sprint W12)

## Conventions
- All new endpoints need rate limiting middleware
- Test DB via docker-compose.test.yml, never local postgres
- Commit format: Fixes #N or Refs #N

## Known Gotchas
- token refresh must use sliding window (fixed expiry caused logout storms)
- Safari doesn't send cookies on first redirect — workaround in auth middleware
```

At sprint start, read `_context.md` alongside the new sprint file. At sprint end, review Running Context and promote anything that future sprints need to know.

---

## Task Files (thin GitHub mirror)

Files in `backlog/tasks/` are synced copies of GitHub Issues — kept thin on purpose. Their job is to let AI read issue details without an API call.

```yaml
---
id: BACK-42
title: Implement OAuth2 flow
status: In Progress
labels: [auth, backend]
priority: high
milestone: Sprint W13
created_date: '2026-03-22'
---

## Description
[Synced from GitHub issue body]

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] Valid credentials return JWT token
- [x] Expired tokens get 401 response
- [ ] Test coverage > 90%
<!-- AC:END -->
```

Task files get AC checkboxes updated during work. Everything else (notes, decisions, context) goes in the **sprint file**, not here.

---

## Process

### Orient — Starting a Session

1. Read `backlog/sprints/_context.md` if it exists — project-level knowledge.
2. Find the active sprint: the file in `backlog/sprints/` with `status: active` in frontmatter.
3. Read it — plan, progress, running context. You now know where you are.
4. Find where you left off: last Progress entry + first unchecked item in Plan.
5. If no sprint file exists, check GitHub: `gh issue list --state open --json number,title,labels,milestone`

Two files at most (`_context.md` + active sprint), full picture.

### Create — New Issues

1. Create on GitHub: `gh issue create -t "Title" -l "labels" -m "milestone"`
2. Pull to local task file: `gh issue view <N> --json` → write `backlog/tasks/`
3. Add to current sprint's Plan if it belongs in this sprint

### Plan — Sprint

When starting a new sprint:

1. Create GitHub milestone: `gh api repos/{owner}/{repo}/milestones -f title="Sprint W13" -f due_on="2026-03-28"`
2. Assign issues: `gh issue edit <N> --milestone "Sprint W13"`
3. Pull issues to `backlog/tasks/`
4. **Create sprint file** in `backlog/sprints/`:
   - Set Goal (one sentence)
   - Order issues into Batches — group small tasks that can run in one session
   - Estimate time per task to help decide batching
   - Note any dependencies between tasks

### Work — Execute a Batch

**Option A: Do it yourself (Claude Code)**
1. Read sprint file → find current batch
2. For each issue in the batch:
   - Update GitHub label: `gh issue edit <N> --add-label "status:in-progress"`
   - Read task file for AC and description
   - Do the work. Check off AC in the task file as you go.
   - Add to sprint file's **Running Context** when you discover something that affects later tasks
3. When batch is done:
   - Update sprint file Plan checkboxes
   - Add Progress entry with date and summary
   - Push meaningful updates to GitHub: `gh issue comment <N> --body "summary"`

**Option B: Delegate to Codex (via dev-relay)**
1. Read sprint file → find current batch
2. For each issue: extract AC from task file → construct dispatch prompt (AC = Done Criteria)
3. Dispatch via `dev-relay/scripts/dispatch.js` (background for parallel tasks)
4. Review PR when Codex finishes (independent review in fresh context)
5. Merge + update sprint file Progress/Running Context

See the dev-relay skill for the full dispatch → review → merge process.

Small tasks in a batch flow naturally — finish one, check it off, start the next. The sprint file's batch grouping makes this explicit.

### Complete — Close Issues

1. All AC checked in task file
2. Commit/PR with `Fixes #<N>`
3. Move task file: `backlog/tasks/` → `backlog/completed/`
4. Check off in sprint Plan
5. If the sprint is done: set `status: completed`, write a final Progress entry

When the whole sprint closes:
- The sprint file becomes a permanent record of decisions, context, and progression.
- Review Running Context — promote project-level entries to `_context.md` so future sprints inherit them.

### Sync — GitHub ↔ Local

**Pull** (GitHub → Local): `gh issue list` → update task files. Do this at sprint start and when issues change.
**Push** (Local → GitHub): status label updates, progress comments, closing issues. Do this at meaningful milestones.

See `references/github-sync.md` for detailed commands.

### Quick Fix — Single Issue, No Sprint

Not everything needs a sprint. For a one-off bug fix or quick task:

1. `gh issue view <N>` — read the issue directly
2. Do the work, commit with `Fixes #<N>`
3. Done. No sprint file, no local task file needed.

If you discover it's bigger than expected, that's when you create a sprint file.

### Next — What to Work On

1. Read sprint file → find first unchecked batch
2. If current sprint is done, check GitHub for unplanned work or start next sprint
3. Present: "Next up: Batch 3 (#43 Rate limiting + #44 Input validation, ~50min total)"

---

## Principles

1. **GitHub defines, sprint file executes.** Issues say what to do. Sprint file says how, in what order, and tracks what you learned along the way.

2. **One file per session.** Read the sprint file. You know where you are, what's next, and what context matters.

3. **Running Context is gold.** Decisions and discoveries in one task affect later tasks. Capture them in the sprint file so they're never lost between sessions.

4. **Batch small tasks.** Don't start a session for a 15-minute task. Group 2-4 small tasks into one batch and knock them out together.

5. **Sync is explicit.** Pull at sprint start. Push at meaningful milestones. Let GitHub handle what it's good at (comments, PR links, timeline).

6. **Files are readable.** Both sprint files and task files make sense opened in any editor. No CLI required to understand them.

---

## References (load on demand)

- `references/file-format.md` — Backlog.md file format, config.yml, task file fields, naming conventions
- `references/github-sync.md` — `gh` CLI patterns: label setup, milestone management, sync commands
- `references/workflow-patterns.md` — Sprint planning, bug triage, feature breakdown, retrospective

## Scripts (deterministic, no LLM needed)

All scripts are executable directly (`./scripts/sync-pull.js`) or via `node`.

- `scripts/status.sh` — Quick project status from local files + GitHub
- `scripts/sync-pull.js [PREFIX]` — Pull open GitHub issues to local backlog/tasks/
- `scripts/sprint-init.js "auth-system" [--milestone "Name"]` — Generate sprint file skeleton
