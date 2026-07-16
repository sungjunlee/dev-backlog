# dev-backlog

[![CI](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml/badge.svg)](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Choose one canonical task tracker per repository: GitHub Issues or an offline
local Markdown store. Sprint files remain the execution hub that both you and
your AI agent read during a coding session.

dev-backlog adds a local sprint file that carries the plan, decisions, and progress across tasks and sessions. Claude Code, Codex, and humans all read the same file.

No new server. No hidden state. Existing GitHub repositories keep their current
behavior without migration.

README.md is the product overview and human quick start. The agent execution contract, sprint-file rules, and full script reference live in [skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md).

```text
backlog/config.yml: tracker: github | local
        |
        +-- github -> GitHub Issues (canonical) -> tasks/ mirrors
        |
        `-- local  -> tasks/ + completed/ (canonical, no gh)

backlog/sprints/     execution hub: plan, context, progress
        ^
        |
  Claude Code / Codex / Human
  reads sprint -> knows what to do next
  updates progress -> team sees what happened
```

## What You Get

| Capability | What changes |
|------------|--------------|
| One canonical tracker | Explicit `github` or fully offline `local`; runtime never switches it |
| One active sprint file | The human and the agent read the same execution plan |
| Mode-aware task files | GitHub mirrors in `github`; canonical tasks in `local` |
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
- [`gh` CLI](https://cli.github.com/) authenticated with `gh auth login` (GitHub mode only)
- Git
- Node.js 18+
- Bash. On Windows, use Git for Windows Bash; Node-based acceptance tests resolve
  it from `git.exe` instead of selecting an ambient WSL `bash.exe`.

### Want to inspect or run the helper scripts directly?

```bash
git clone https://github.com/sungjunlee/dev-backlog.git
```

## Quick Start

Run these commands from the project you want to manage, not from the `dev-backlog` repo itself.
The examples below assume you have this repo available at `/path/to/dev-backlog`. If you installed the skill with `npx skills add`, use the installed skill path instead.

```bash
# 1. Choose the canonical tracker and bootstrap backlog/
node /path/to/dev-backlog/skills/dev-backlog/scripts/setup-dev-backlog.js \
  --tracker github --non-interactive

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

# 5. Close the sprint when the work is done
bash /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-close.sh backlog
```

For a fully offline repository, choose `--tracker local` instead. Create and
update canonical tasks through the configured tracker lifecycle, use normalized
refs such as `BACK-1` in the Plan, and run the same `status`, `next`, and
`sprint-close` commands. Local mode deliberately does not invent milestones,
PR relationships, sprint/progress mirrors, comments, or closing-keyword links.
Those requests fail before side effects with actionable remediation; JSON-capable
commands return the same structured error contract.

For task `list`, `read`, `create`, `update`, and `close`, the stable invocation
boundary is the configured adapter exported by `scripts/tracker.js`. Operators
and agents resolve it with the target `backlogDir` and call those methods in
either mode; the exact procedure and signatures are documented in
[the process guide](skills/dev-backlog/references/process.md#required-core-lifecycle-invocation-boundary).

### Upgrade behavior

There is zero automatic migration. A repository whose existing
`backlog/config.yml` has no `tracker:` key continues in GitHub mode with its
existing `#N`, numeric `issue_number`, task-mirror, milestone, mirror, progress,
comment, and closing behavior. Run `setup-dev-backlog.js` to pin that legacy
GitHub authority before making any later explicit switch. Setup never migrates
task files and runtime never chooses a tracker from availability or failure.
The implementation-level contract and proof map live in
[docs/tracker-adapter-design.md](docs/tracker-adapter-design.md).

Then use the skill during your coding session:

```text
/dev-backlog orient
/dev-backlog next
/dev-backlog work 42
/dev-backlog sync
```

For the detailed sprint contract, section semantics, and full script inventory, see [skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md).

## Maintainer Verification

Run the same cross-platform checks used by CI:

```bash
node --test skills/*/scripts/*.test.js
bash skills/dev-backlog/scripts/smoke-test.sh
```

Windows uses Git for Windows Bash. If Git comes from a nonstandard installation,
set `DEV_BACKLOG_BASH` to its `bash.exe` before running the Node tests. POSIX mode
symlink-privilege, and open-file replacement race tests are skipped when the
Windows filesystem cannot represent those semantics; the behavior remains
covered by the Ubuntu job.

After editing this repository's skill bundle, run the discovery smoke check from the repository root:

```bash
npx --yes skills add . -l
```

Expected: the CLI discovers `backlog-triage` and `dev-backlog`. This verifies bundle packaging and frontmatter discovery.

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

1. Read the configured tracker; in GitHub mode, explicitly pull issues into `backlog/tasks/`.
2. Create or read canonical tasks and generate the active sprint file.
3. Read the sprint before you code.
4. Work batch by batch, not issue by issue across ten tabs.
5. Update `Running Context` and `Progress` as you learn things.
6. Close the sprint explicitly when the work is really done.

The configured tracker handles task truth. The sprint file handles execution.

## Multi-Track Sprints

Most repos run one active sprint at a time, and nothing changes for them. But two workstreams that touch **disjoint code** don't have to serialize: since the 2026-07 multi-track change, sprints partition by *scope*, and multiple disjoint-scope tracks may be `status: active` at once.

**When to open a second track:** the new work touches a different component or directory subtree than every current active track, and waiting for that sprint to close would just serialize unrelated work.

**Declaring scope** (explicit, never inferred — one axis per track):

```yaml
component: "auth-system"   # primary scope key when a capability axis exists
scope: ["src/auth/**"]     # explicit path globs otherwise (sprint-init.js --scope)
```

**The invariant:** no two active tracks may overlap — same `component:`, or colliding `scope:` globs (nested paths overlap). Overlap fails loud everywhere: `sprint-init.js` refuses to create the track, `backlog-doctor` fails with `Active tracks overlap on scope`, and JSON reads exit with `OVERLAPPING_TRACKS`. Two scopeless active tracks can't be *proven* disjoint, so the doctor warns (informationally) instead.

**Working a portfolio:**

```bash
bash skills/dev-backlog/scripts/next.sh                      # portfolio: one stanza per track
bash skills/dev-backlog/scripts/next.sh --track 2026-07-auth # one track, deterministic
bash skills/dev-backlog/scripts/sprint-close.sh --track 2026-07-auth  # close just that track
node skills/dev-backlog/scripts/sprint-mirror.js --track 2026-07-auth # mirror one track
```

`status.sh --json` / `next.sh --json` emit `schema_version: 2` with `active_sprints[]`; the single-track fields are retained and byte-compatible, so existing consumers keep working.

## Optional extensions

The core loop above needs none of these. Add one only when you want its capability — each row prices what it adds and what it requires.

| Extension | Adds | Requires |
|-----------|------|----------|
| Spec axis (charter / system map / capabilities) | Objective/capability alignment for sprints and triage, plus the reassess signal | craftkit skills installed; degrades gracefully when absent |
| dev-relay | delegated-work tracking: `[~]` in-flight state and PR handoff in the sprint file | the dev-relay skill |
| backlog-triage | open-issue grooming into an advisory report (classification, stale flags, Alignment, Decision Review) | nothing — ships in this bundle |

### Spec axis (charter, system map, capabilities)

The `spec-charter`, `spec-system-map`, and `spec-grill` authoring skills moved to [craftkit](https://github.com/sungjunlee/craftkit) — that repo is their canonical home as of 2026-07.

```bash
npx skills add sungjunlee/craftkit -g -y
```

`dev-backlog` and `backlog-triage` consume `spec/charter.md`, `spec/system-map.md`, and `spec/capabilities.md` as read-only yardsticks (Objective IDs, capability handles, Alignment/Decision Review evidence) and degrade gracefully when those files are absent. Sprint planning and triage keep working against the installed craftkit skills; the spec index lives at [spec/README.md](spec/README.md).

### Solo or with dev-relay

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

### Backlog triage (sibling skill)

`dev-backlog` runs the sprint. [`backlog-triage`](skills/backlog-triage/SKILL.md) grooms the open-issue pile that feeds into it — classification, relationships, stale / obsolete flags, priority proposals, Alignment, and spec-aware Decision Review. It produces one markdown report under `backlog/triage/YYYY-MM-DD-report.md` that you review, check accepted proposals on, and apply behind an explicit `--apply`.

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

Use `dev-backlog` when you know what to work on; use `backlog-triage` when the open-issue list has grown faster than your attention. When `spec/charter.md`, `spec/capabilities.md`, or `spec/system-map.md` exist, Decision Review uses them as optional evidence for `Do Now`, `Shape First`, `Defer`, and `Drop / Close`; missing spec files are skipped.
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
| Exactly one tracker owns task truth | GitHub collaboration and offline local work share one core lifecycle without becoming co-authoritative |
| Sprint files are the execution hub | One file carries plan, context, and progress across sessions |
| Task-file authority is mode-specific | Thin mirrors in GitHub mode; canonical active/completed files in local mode |
| `_context.md` holds cross-sprint knowledge | Sprint files stay local to the sprint, project memory stays shared |
| Sync is always explicit | No background process mutates your local state behind your back |
| Task-file format is Backlog.md-compatible | `tasks/` follows the [Backlog.md](https://github.com/MrLesk/Backlog.md) task format; `sprints/` and `gh` sync are dev-backlog additions |

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
