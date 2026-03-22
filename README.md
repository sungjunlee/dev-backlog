# dev-backlog

A Claude Code skill for managing development work through GitHub Issues + local sprint execution files.

## How It Works

Two layers, each with a clear job:

```
GitHub (source of truth — what to do)
  Issues, Milestones, Labels, Comments, PR links
       ↕  gh CLI (explicit sync)
Local (execution hub — how to do it)
  backlog/sprints/   ← Plan, batch, context, notes, progress
  backlog/tasks/     ← Thin mirror of GitHub issues
```

**Sprint file is the core.** One file per sprint. Read it at session start — you know where you are, what's next, and what context matters across tasks.

## Key Concepts

- **GitHub Issues** define tasks. **Sprint files** organize execution.
- **Batching**: group small tasks (~15-30min each) into one session.
- **Running Context**: decisions/discoveries captured in the sprint file carry across tasks and sessions.
- **Quick Fix**: not everything needs a sprint — one-off bug fixes work directly from GitHub.

## Sprint File Example

```markdown
---
milestone: Sprint W13
status: active
started: 2026-03-22
due: 2026-03-28
---

# Sprint W13: Auth + API Foundation

## Goal
Users can log in and access protected API endpoints.

## Plan
### Batch 1 — DB + seed (one session)
- [x] #38 DB schema setup (~15min)
- [x] #39 Seed data script (~10min)

### Batch 2 — Core auth
- [ ] #42 OAuth2 flow (~2hr)

## Running Context
- argon2 for hashing (decided in #42)
- rate limit middleware: middleware/rateLimit.ts

## Progress
- 2026-03-22 AM: Batch 1 done.
- 2026-03-22 PM: #42 started. 3/5 AC done.
```

## Installation

```bash
# Via npx skills
npx skills add <repo-url> --global --yes

# Manual
cp -r skills/dev-backlog ~/.claude/skills/dev-backlog
```

## Structure

```
skills/dev-backlog/
├── SKILL.md                     ← Core (always loaded, ~250 lines)
├── references/
│   ├── file-format.md           ← Backlog.md field spec + config.yml
│   ├── github-sync.md           ← gh CLI patterns, labels, milestones
│   └── workflow-patterns.md     ← Sprint planning, triage, retro
└── scripts/
    ├── status.sh                ← Quick project status (bash)
    ├── sync-pull.py             ← Pull GitHub issues to local (uv/python)
    └── sprint-init.py           ← Generate sprint skeleton (uv/python)
```

## Design Philosophy

- **GitHub defines, sprint file executes** — issues say what; sprint file says how + tracks what you learned
- **One file per session** — read the sprint file and you're oriented
- **Sync is explicit** — pull at sprint start, push at milestones
- **Files are readable** — any .md file makes sense in a plain editor
- **Backlog.md compatible** — `npm i -g backlog.md` adds board/TUI/MCP

## Version

v0.3.0 — March 2026
