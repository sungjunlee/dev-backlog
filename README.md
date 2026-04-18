# dev-backlog

[![CI](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml/badge.svg)](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

GitHub Issues stay the source of truth. Sprint files become the execution hub that both you and your AI agent read during a coding session.

dev-backlog adds a local sprint file that carries the plan, decisions, and progress across tasks and sessions. Claude Code, Codex, and humans all read the same file.

No new server. No hidden state. No need to abandon GitHub Issues.

README.md is the product overview and human quick start. The agent execution contract, sprint-file rules, and full script reference live in [skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md).

```text
GitHub Issues (source of truth)
        |
        | gh CLI (explicit sync)
        v
backlog/
  tasks/       thin issue mirror (AI reads without API)
  sprints/     execution hub: plan, context, progress
  completed/   archived done tasks
        ^
        |
  Claude Code / Codex / Human
  reads sprint -> knows what to do next
  updates progress -> team sees what happened
```

## What You Get

| Capability | What changes |
|------------|--------------|
| GitHub stays the source of truth | Collaborators keep using issues, milestones, labels, and PR links |
| One active sprint file | The human and the agent read the same execution plan |
| Thin local task mirror | AI can read issue details without another API round trip |
| Explicit sync | Pull and refresh when you choose, not behind your back |
| `[ ]` / `[~]` / `[x]` plan states | Delegated work stays visible in the sprint file, not buried in PR tabs |
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
node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js --limit 50

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

For the detailed sprint contract, section semantics, and full script inventory, see [skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md).

Important if you use `dev-relay`: sprint files are not fully freeform markdown.
These details are load-bearing for automation:

- section headings such as `## Plan`, `## Running Context`, `## Progress`
- checkbox states `- [ ]`, `- [~]`, `- [x]`

If you change those shapes casually, relay automation can stop reading or updating the sprint correctly. Full contract: [references/integration-contract.md](skills/dev-backlog/references/integration-contract.md).

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

If you also use [dev-relay](https://github.com/sungjunlee/dev-relay), the sprint file tracks delegated implementation too.

```text
[ ] #42 OAuth2 flow
   |
   +-> do it yourself ------------------> [x] #42
   |
   +-> dispatch with dev-relay ---------> [~] #42 -> PR #87 (reviewing)
                                          |
                                          +----------------------------> [x] #42 -> PR #87 (merged)
```

The `[~]` state makes in-flight work visible to everyone, and `Running Context` carries decisions across handoffs without re-explaining.

The contract for that integration lives in [references/integration-contract.md](skills/dev-backlog/references/integration-contract.md).

## Backlog Triage (sibling skill)

`dev-backlog` runs the sprint. [`backlog-triage`](skills/backlog-triage/SKILL.md) grooms the open-issue pile that feeds into it — classification, relationships, stale / obsolete flags, priority proposals. It produces one markdown report under `backlog/triage/YYYY-MM-DD-report.md` that you review, check accepted proposals on, and apply behind an explicit `--apply`.

```bash
SKILL=/path/to/dev-backlog/skills/backlog-triage/scripts
SNAP=backlog/triage/.cache/<ts>.json

# Review phase (read-only, default): collect → analyze → render
node $SKILL/triage-collect.js
node $SKILL/triage-relate.js --snapshot $SNAP --json > /tmp/relate.json
node $SKILL/triage-stale.js  --snapshot $SNAP --json > /tmp/stale.json
node $SKILL/triage-report.js --snapshot $SNAP --relate /tmp/relate.json --stale /tmp/stale.json

# Apply phase (opt-in): review the report, check accepted proposals, then
node $SKILL/triage-apply.js backlog/triage/<date>-report.md --apply

# Live apply integration coverage (opt-in only; mutates the disposable sandbox repo)
GH_TOKEN="$(gh auth token)" TRIAGE_APPLY_INTEGRATION=1 \
  node --test $SKILL/triage-apply.integration.test.js
```

Use `dev-backlog` when you know what to work on; use `backlog-triage` when the open-issue list has grown faster than your attention.
The integration test is excluded from the default `node --test` path unless you explicitly set `TRIAGE_APPLY_INTEGRATION=1`. It targets the dedicated sandbox repo `sungjunlee/triage-apply-sandbox` and requires a `GH_TOKEN` that can mutate that repo.

## Script Entry Points

All deterministic helpers live under `skills/dev-backlog/scripts/`.
Use the commands in Quick Start for the common path, and use [skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md) as the canonical script/flag reference when you need the full execution contract.

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

<details>
<summary>Codex workflow example</summary>

`dev-backlog` works well with Codex when the sprint file stays the shared execution state instead of extra chat context.

Start with the cheap deterministic commands:

```bash
bash /path/to/dev-backlog/skills/dev-backlog/scripts/status.sh
bash /path/to/dev-backlog/skills/dev-backlog/scripts/next.sh
```

Then hand Codex the active sprint as the source of truth:

```text
Read backlog/sprints/_context.md and the active sprint file first.
Tell me the next batch, implement #42, and keep the sprint file updated.
Update Running Context and Progress before you stop.
```

When GitHub issue metadata changed during the session, refresh the local mirror:

```bash
node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js --update
```

This keeps Codex focused on one execution file, not ten browser tabs and stale issue context.

</details>

## Quality Bar

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
| Builds on Backlog.md | `tasks/` follows the [Backlog.md](https://github.com/MrLesk/Backlog.md) format; `sprints/` and `gh` sync are the additions |

## Docs

- [Agent execution contract](skills/dev-backlog/SKILL.md)
- [Process guide](skills/dev-backlog/references/process.md)
- [File format and config](skills/dev-backlog/references/file-format.md)
- [GitHub sync patterns](skills/dev-backlog/references/github-sync.md)
- [Workflow patterns](skills/dev-backlog/references/workflow-patterns.md)
- [dev-relay integration contract](skills/dev-backlog/references/integration-contract.md)
- [Backlog triage (sibling skill)](skills/backlog-triage/SKILL.md)

## Contributing

Issues and pull requests are welcome.

If you want to change sprint file structure, checkbox patterns, or task file naming, read the integration contract first. Those details are load-bearing for `dev-relay` interop.

For non-trivial changes, open an issue first so the format and workflow stay coherent.

## License

MIT
