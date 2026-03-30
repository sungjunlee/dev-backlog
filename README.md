# dev-backlog

**Manage development work through GitHub Issues + local sprint files.**

dev-backlog bridges GitHub's issue tracker with local sprint execution files for [Claude Code](https://claude.ai/code) and [Codex](https://chatgpt.com/codex). GitHub Issues define _what_ to do. Sprint files organize _how_ — batching, ordering, shared context, and progress tracking.

```
GitHub Issues                 Local Sprint File              Your Session
 │                             │                              │
 ├── #38 DB schema             │                              │
 ├── #39 Seed data       ──►  Batch 1 — DB + seed       ──► Read sprint file
 ├── #42 OAuth2 flow      ──►  Batch 2 — Core auth       ──► Work batch by batch
 ├── #43 Rate limiting    ──►  Batch 3 — Hardening       ──► Update progress
 └── #44 Input validation      │                              │
                               Running Context:               │
                               - argon2 for hashing           │
                               - rate limit middleware path   │
```

## Why

- **One file per session** — read the sprint file and you know where you are, what's next, and what context matters
- **Batching** — group small tasks (~15-30min) into one session for flow
- **Running Context** — decisions and discoveries carry across tasks, not lost between sessions
- **Explicit sync** — pull at sprint start, push at milestones; no silent background sync
- **Backlog.md compatible** — `npm i -g backlog.md` adds board/TUI/MCP on top

## Install

```bash
npx skills add sungjunlee/dev-backlog
```

Installs as a [Claude Code custom slash command](https://docs.anthropic.com/en/docs/claude-code/skills). Add `-g -y` for global install without prompts:

```bash
npx skills add sungjunlee/dev-backlog -g -y
```

<details>
<summary>Install from a local clone</summary>

```bash
git clone https://github.com/sungjunlee/dev-backlog.git
cd dev-backlog
npx skills add . -g -y
```
</details>

### Prerequisites

- [Claude Code](https://claude.ai/code) or [Codex](https://chatgpt.com/codex)
- [`gh` CLI](https://cli.github.com/) — authenticated (`gh auth login`)
- Git
- Node.js 18+

## Quick Start

```
/dev-backlog orient          # Read sprint file, see where you are
/dev-backlog next             # Show next actionable batch
/dev-backlog status           # Project status from sprint + GitHub
```

### Sprint lifecycle

1. **Create issues** on GitHub with labels and milestones
2. **Pull to local**: `sync-pull.js` fetches issues to `backlog/tasks/`
3. **Plan sprint**: `sprint-init.js` generates a sprint file skeleton
4. **Work batches**: implement, verify AC, commit with `Fixes #N`
5. **Close sprint**: set `status: completed`, move tasks, promote context

## Sprint File Example

Filename: `2026-03-auth-system.md`

```markdown
---
milestone: Sprint W13
status: active
started: 2026-03-22
due: 2026-03-28
---

# Auth + API Foundation

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

## Scripts

All scripts live in the skill's `scripts/` directory. Run from your project root.

| Script | Description |
|--------|-------------|
| `init.sh [project-name]` | Bootstrap `backlog/` directory with config.yml |
| `next.sh` | Show next actionable batch from active sprint |
| `status.sh` | Project status from sprint file + GitHub |
| `sync-pull.js [PREFIX] [--update] [--dry-run]` | Pull open GitHub issues to local task files |
| `sprint-init.js "topic" [--milestone "Name"] [--dry-run]` | Generate sprint file skeleton |

## Structure

```
skills/dev-backlog/
├── SKILL.md                     ← Core prompt (always loaded, ~194 lines)
├── references/
│   ├── file-format.md           ← Backlog.md field spec + config.yml
│   ├── github-sync.md           ← gh CLI patterns, labels, milestones
│   ├── process.md               ← Detailed workflow steps
│   └── workflow-patterns.md     ← Sprint planning, triage, retro
└── scripts/
    ├── init.sh                  ← Bootstrap backlog/ directory (bash)
    ├── next.sh                  ← Next actionable batch (bash)
    ├── status.sh                ← Project status overview (bash)
    ├── sync-pull.js             ← Pull GitHub issues to local (node)
    └── sprint-init.js           ← Generate sprint skeleton (node)
```

## Works With dev-relay

dev-backlog works standalone. For delegating implementation to AI agents, pair it with [dev-relay](https://github.com/sungjunlee/dev-relay):

- **dev-backlog** defines the work (issues, sprint plan, context)
- **dev-relay** executes it (worktree → Codex → PR → review → merge)
- Sprint files are updated at each relay phase

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| GitHub Issues = source of truth | Visible to collaborators, persists across tools, standard workflow |
| Sprint file = execution hub | One file carries plan, context, and progress across sessions |
| Task files = thin mirror | Sync cache only; context lives in sprint file, not duplicated |
| Explicit sync | No silent background sync; pull/push at meaningful milestones |
| Backlog.md compatible | `sprints/` is a custom addition; `tasks/` follows the standard format |
| Stateless scripts | No database, no daemon — state lives in GitHub and local markdown |

## Contributing

Issues and PRs welcome. Please open an issue first for non-trivial changes.

## License

MIT
