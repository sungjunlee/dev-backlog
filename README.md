# dev-backlog

[![CI](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml/badge.svg)](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Keep GitHub Issues as source of truth. Add a local sprint file as the execution layer for Claude Code, Codex, and humans.

GitHub is good at shared visibility. It is bad at answering four questions that matter during a work session: what should I do next, what context matters, what is already in flight, and what should my AI agent read before touching code. dev-backlog fills that gap with plain Markdown files that live next to your repo and stay easy to inspect in git.

No new server. No hidden state. No need to abandon GitHub Issues.

```text
GitHub
  issues, milestones, labels, PR links
        |
        | explicit sync via gh
        v
backlog/
  sprints/     one active working file: plan, context, progress
  tasks/       thin issue mirror for local and AI reads
  completed/   archived done tasks
  config.yml   project config
```

## Why This Exists

Issue trackers answer "what exists."

Sessions need "what is next."

If you work with Claude Code or Codex, this gets sharper. The agent can move fast, but only if it can read the same execution surface you do. A good sprint file gives both of you the same working memory: batches, decisions, gotchas, progress, and open loops.

That is the whole point of this project.

## What You Get

| Capability | What changes |
|------------|--------------|
| GitHub stays the source of truth | Collaborators keep using issues, milestones, labels, and PR links |
| One active sprint file | The human and the agent read the same execution plan |
| Thin local task mirror | AI can read issue details without another API round trip |
| Explicit sync | Pull and refresh when you choose, not behind your back |
| `[ ]`, `[~]`, `[x]` plan states | In-flight delegated work stays visible instead of disappearing into PR tabs |
| `context-hook.sh` | Claude Code can get a one-line sprint summary before edits |
| `sprint-close.sh` | Close the loop: mark sprint complete, archive tasks, optionally close the milestone |
| Plain Markdown + Bash + Node built-ins | No database, no daemon, no mystery |

## Install

### Use as a skill

```bash
npx skills add sungjunlee/dev-backlog -g -y
```

### Prerequisites

- [Claude Code](https://claude.ai/code) or [Codex](https://chatgpt.com/codex)
- [`gh` CLI](https://cli.github.com/) authenticated with `gh auth login`
- Git
- Node.js 18+

### Want to inspect or run the helper scripts directly?

```bash
git clone https://github.com/sungjunlee/dev-backlog.git
```

## Quick Start

Run these commands from the project you want to manage, not from the `dev-backlog` repo itself.
The examples below assume you have this repo available at `/path/to/dev-backlog`. If you installed the skill with `npx skills add`, use the installed skill path instead.

```bash
# 1. Bootstrap backlog/
bash /path/to/dev-backlog/skills/dev-backlog/scripts/init.sh

# 2. Pull open GitHub issues into backlog/tasks/
node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js --dry-run
node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js
node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js --json

# 3. Create an active sprint from a milestone
node /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
node /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-init.js "auth-system" --milestone "Sprint W13" --dry-run --json

# 4. See what to do next
bash /path/to/dev-backlog/skills/dev-backlog/scripts/next.sh
bash /path/to/dev-backlog/skills/dev-backlog/scripts/status.sh
```

Then use the skill during your coding session:

```text
/dev-backlog orient
/dev-backlog next
/dev-backlog work 42
/dev-backlog sync
```

## A Sprint File Looks Like This

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
### Batch 1 - DB + seed
- [x] #38 DB schema setup (~15min)
- [x] #39 Seed data script (~10min)

### Batch 2 - Core auth
- [~] #42 OAuth2 flow (~2hr) -> PR #87 (reviewing)

### Batch 3 - Hardening
- [ ] #43 Rate limiting (~30min)
- [ ] #44 Input validation (~20min)

## Running Context
- argon2 for hashing
- test DB: docker-compose.test.yml

## Progress
- 2026-03-22 AM: Batch 1 done.
- 2026-03-22 PM: #42 in review.
```

`[ ]` means not started. `[~]` means in flight, usually a delegated task or open PR. `[x]` means merged or done.

## Daily Workflow

1. Pull GitHub issues into `backlog/tasks/`.
2. Generate or update the active sprint file.
3. Read the sprint before you code.
4. Work batch by batch, not issue by issue across ten tabs.
5. Update `Running Context` and `Progress` as you learn things.
6. Close the sprint explicitly when the work is really done.

This is simple on purpose. The issue tracker handles collaboration. The sprint file handles execution.

## Solo Or With dev-relay

dev-backlog works fine on its own.

If you also use [dev-relay](https://github.com/sungjunlee/dev-relay), the sprint file becomes the handoff contract between planning and delegated implementation.

```text
[ ] #42 OAuth2 flow
   |
   +-> do it yourself ------------------> [x] #42
   |
   +-> dispatch with dev-relay ---------> [~] #42 -> PR #87 (reviewing)
                                          |
                                          +----------------------------> [x] #42 -> PR #87 (merged)
```

The contract for that integration lives in [references/integration-contract.md](skills/dev-backlog/references/integration-contract.md).

## Deterministic Scripts

All scripts live under `skills/dev-backlog/scripts/`.

| Script | What it does |
|--------|--------------|
| `init.sh [project-name]` | Create `backlog/`, `sprints/`, `tasks/`, `completed/`, and `config.yml` |
| `sync-pull.js [PREFIX] [--update] [--dry-run] [--json]` | Pull open issues into `backlog/tasks/`; `--update` refreshes frontmatter while preserving local acceptance-criteria checkboxes; `--json` emits a machine-readable summary |
| `sprint-init.js "topic" [--milestone "Name"] [--dry-run] [--json]` | Create a sprint file from a GitHub milestone; `--json` emits the sprint path and metadata |
| `next.sh [backlog-dir]` | Show the next actionable batch with zero LLM cost |
| `status.sh [backlog-dir]` | Show sprint progress, GitHub issues, local task counts, and in-flight work |
| `context-hook.sh [backlog-dir]` | Print a one-line sprint summary for Claude Code `PreToolUse` hooks |
| `sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]` | Mark the sprint complete, move finished tasks, and optionally close the GitHub milestone |

<details>
<summary>Claude Code hook example</summary>

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "command": "bash /path/to/dev-backlog/skills/dev-backlog/scripts/context-hook.sh /path/to/repo/backlog"
      }
    ]
  }
}
```

</details>

## Quality Bar

This repo is meant to be used, not admired from a distance.

- GitHub Actions CI runs on push and pull request to `main`
- 130+ tests cover Node logic and Bash smoke flows
- `--dry-run` exists for risky file-writing operations
- Shared Bash and Node libraries keep behavior consistent across scripts
- MIT licensed

## Design Choices

| Decision | Why |
|----------|-----|
| GitHub Issues are the source of truth | Collaborators already live there |
| Sprint files are the execution hub | One file carries plan, context, and progress across sessions |
| Task files stay thin | Sync cache only; decisions belong in the sprint file |
| `_context.md` holds cross-sprint knowledge | Sprint files stay local to the sprint, project memory stays shared |
| Sync is always explicit | No background process mutates your local state behind your back |
| Backlog.md compatibility matters | `tasks/` stays compatible with the standard format; `sprints/` is the only custom layer |

## Docs

- [Core skill prompt](skills/dev-backlog/SKILL.md)
- [Process guide](skills/dev-backlog/references/process.md)
- [File format and config](skills/dev-backlog/references/file-format.md)
- [GitHub sync patterns](skills/dev-backlog/references/github-sync.md)
- [Workflow patterns](skills/dev-backlog/references/workflow-patterns.md)
- [dev-relay integration contract](skills/dev-backlog/references/integration-contract.md)

## Contributing

Issues and pull requests are welcome.

If you want to change sprint file structure, checkbox patterns, or task file naming, read the integration contract first. Those details are load-bearing for `dev-relay` interop.

For non-trivial changes, open an issue first so the format and workflow stay coherent.

## License

MIT
