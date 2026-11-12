# dev-backlog

[![CI](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml/badge.svg)](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

One task authority — GitHub Issues by default — is canonical. Simple work stays Issue → PR.
Open a local sprint file only when execution needs shared batching, context,
progress, or handoff across issues, actors, or sessions.

No new server. No hidden state. No automatic memory writes. No required local task files.
This repo is a personal toolkit.

Human quick start is this file. The agent execution contract is
[skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md); state ownership is
mapped in [authority-contract.md](skills/dev-backlog/references/authority-contract.md).

## Install

```bash
npx skills add sungjunlee/dev-backlog -g -y
```

The supported installation unit is this repository, which installs both
`dev-backlog` and `backlog-triage`; triage intentionally imports shared files
from its sibling. A copied `backlog-triage/` folder by itself is not a supported
installation unit.

Needs [Claude Code](https://claude.ai/code) or [Codex](https://chatgpt.com/codex),
Git, Node.js 18+, and the task authority's CLI: an authenticated
[`gh`](https://cli.github.com/) by default, or the [Backlog.md](https://backlog.md)
CLI / [`glab`](https://gitlab.com/gitlab-org/cli) when you opt out of GitHub
with one line:

```bash
mkdir -p .dev-backlog && printf 'backlog\n' > .dev-backlog/.tracker   # or: gitlab
```

GitLab is documented but not measured. Gitea is unverified and is not a Task
Authority option: no maintainer-authorized Gitea target has been exercised for
issue read, create, and close.

To inspect scripts from a clone:

```bash
git clone https://github.com/sungjunlee/dev-backlog.git
```

## Default loop: Issue → PR

Work from the live Issue. No sprint, no pull step, and no task-file directory required.

1. Create or pick an Issue (GitHub by default) with acceptance criteria.
2. Implement and open a PR.
3. Verify every AC item, then close the Issue.

```text
/dev-backlog orient
/dev-backlog work 42
```

Read intent and AC from the live Issue (`backlog task 42 --plain` / `glab issue view 42` under the other authorities):

```bash
gh issue view 42 --json body,comments
```

The [Task Authority contract](skills/dev-backlog/SKILL.md#task-authority)
defines source precedence and fail-closed reads.

Sibling skill [`backlog-triage`](skills/backlog-triage/SKILL.md) grooms the
open-issue pile (GitHub only). It is not part of the default loop.

## When to open a sprint

Open a sprint only for ordered multi-Issue work, delegated or parallel handoff,
cross-Issue or cross-session context, or concurrent-track coordination.
Duration and milestone membership alone do not require one.

```bash
# from the project you manage, not from this repo
node /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-init.js "auth-system"
node /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-state.js \
  --mode next --format text
```

`sprint-init.js` creates `.dev-backlog/sprints/` in a fresh repository. Only a
repository that still has the pre-`.dev-backlog/` skill layout needs the
bounded compatibility command: back up the tree, inspect the declared moves in
[file-format.md](skills/dev-backlog/references/file-format.md), then explicitly
run `setup-dev-backlog.js --migrate-legacy`. Routine commands never move
leftover `backlog/` content.

Close an admitted sprint with a deliberate edit: change its frontmatter
`status: active` to `status: completed` and append one Progress line. Verify the
result with `sprint-state.js --mode status --format text`; if the requested
scope also closes a GitHub milestone, make that native `gh api` PATCH first so
a remote failure leaves the local sprint active.

A sprint file is one Goal, an ordered Plan (`[ ]` / `[~]` / `[x]`), Running
Context, and Progress. Full section semantics live in
[SKILL.md](skills/dev-backlog/SKILL.md).

```markdown
---
status: active
---

# Auth + API Foundation

## Goal
Users can log in and access protected API endpoints.

## Plan
- [x] #38 DB schema setup
- [~] #42 OAuth2 flow → PR #87 (reviewing)
- [ ] #43 Rate limiting

## Running Context
- argon2 for hashing

## Progress
- 2026-03-22: #42 in review.
```

The [authority contract](skills/dev-backlog/references/authority-contract.md)
maps optional surfaces such as the spec axis and GitHub Projects without making
them part of the core loop.

## Docs

- [Agent execution contract](skills/dev-backlog/SKILL.md)
- [Authority and routing](skills/dev-backlog/references/authority-contract.md)
- [Project specs](spec/README.md)
- [Conformance runs](docs/conformance/README.md) — latest run only; history in git

## Maintainer checks

```bash
node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js
npx --yes skills add . -l
```

Expected: the CLI discovers `backlog-triage` and `dev-backlog`.

## License

MIT
