# dev-backlog

[![CI](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml/badge.svg)](https://github.com/sungjunlee/dev-backlog/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

GitHub Issues are the canonical task authority. Simple work stays Issue → PR.
Open a local sprint file only when execution needs shared batching, context,
progress, or handoff across issues, actors, or sessions.

No new server. No hidden state. No automatic memory writes. No required task mirror.
This repo is a personal toolkit.

Human quick start is this file. The agent execution contract is
[skills/dev-backlog/SKILL.md](skills/dev-backlog/SKILL.md); routing is
[skills/dev-backlog/references/authority-contract.md](skills/dev-backlog/references/authority-contract.md).

## Install

```bash
npx skills add sungjunlee/dev-backlog -g -y
```

Needs [Claude Code](https://claude.ai/code) or [Codex](https://chatgpt.com/codex),
an authenticated [`gh` CLI](https://cli.github.com/), Git, and Node.js 18+.

To inspect scripts from a clone:

```bash
git clone https://github.com/sungjunlee/dev-backlog.git
```

## Default loop: Issue → PR

Work from the live Issue. No sprint, no pull step, and no task-file directory required.

1. Create or pick a GitHub Issue with acceptance criteria.
2. Implement and open a PR.
3. Verify every AC item, then close the Issue.

```text
/dev-backlog orient
/dev-backlog work 42
```

Resolve intent and AC from the live Issue when you need the machine-readable
spec:

```bash
node /path/to/dev-backlog/skills/dev-backlog/scripts/effective-task-spec.js \
  "#42" --repo OWNER/REPO
```

Sibling skill [`backlog-triage`](skills/backlog-triage/SKILL.md) grooms the
open-issue pile. It is not part of the default loop.

## When to open a sprint

Open a sprint only for ordered multi-Issue work, delegated or parallel handoff,
cross-Issue or cross-session context, or concurrent-track coordination.
Duration, estimate, milestone membership, and Relay presence alone do not
require one.

```bash
# from the project you manage, not from this repo
node /path/to/dev-backlog/skills/dev-backlog/scripts/setup-dev-backlog.js \
  --tracker github --non-interactive
node /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-init.js "auth-system"
bash /path/to/dev-backlog/skills/dev-backlog/scripts/next.sh
bash /path/to/dev-backlog/skills/dev-backlog/scripts/sprint-close.sh backlog
```

Close the sprint explicitly only when a sprint was admitted.

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
- [~] #42 OAuth2 flow -> PR #87
- [ ] #43 Rate limiting

## Running Context
- argon2 for hashing

## Progress
- 2026-03-22: #42 in review.
```

Backlog.md compatibility is a one-way legacy boundary. Optional surfaces
(spec axis via [craftkit](https://github.com/sungjunlee/craftkit),
[dev-relay](https://github.com/sungjunlee/dev-relay), GitHub Projects) are
priced in the [authority contract](skills/dev-backlog/references/authority-contract.md).

## Docs

- [Agent execution contract](skills/dev-backlog/SKILL.md)
- [Authority and routing](skills/dev-backlog/references/authority-contract.md)
- [Project specs](spec/README.md)
- [Decision records](docs/README.md) — not live contracts

## Maintainer checks

```bash
node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js
bash skills/dev-backlog/scripts/smoke-test.sh
npx --yes skills add . -l
```

Expected: the CLI discovers `backlog-triage` and `dev-backlog`.

## License

MIT
