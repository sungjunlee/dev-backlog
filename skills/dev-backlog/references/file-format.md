# File Format Reference

Sprint files and `.dev-backlog/` layout.

## Sprint file

Each active sprint lives at `.dev-backlog/sprints/YYYY-MM-<topic>.md`. Required
headings: `## Goal`, `## Plan`, `## Running Context`, `## Progress`. Plan item
grammar: `- [ ] #N …` — task N in the declared authority and nothing else; `[~]`
in-flight and `[x]` done may append `→ PR #N (state)` (end of line) and/or `[branch:name]`. Section semantics live in
[SKILL.md](../SKILL.md).

```markdown
---
milestone: Sprint W13
status: active
started: 2026-03-22
due: 2026-03-28
objectives: [O10]
component: "auth-system"
---

# Auth + API Foundation

## Goal
Users can log in and access protected API endpoints.

## Plan
### Batch 1 - DB + seed
- [x] #38 DB schema setup

### Batch 2 - Core auth
- [~] #42 OAuth2 flow → PR #87 (reviewing)

### Batch 3 - Hardening
- [ ] #43 Rate limiting

## Running Context
- argon2 for hashing

## Progress
- 2026-03-22 AM: Batch 1 done.
```

Frontmatter field and section semantics live in the [SKILL.md Sprint File
Contract](../SKILL.md#sprint-file-contract). `sprint-init.js` reads no `spec/`
file: it emits `component:` or `scope:` only from the matching flag and never
emits `objectives:`. Older `objectives: []` / `component: ""` values stay
valid.

Order Plan items into parallel-safe batches. An empty `## Plan` is valid until
issues are selected; every nonblank, non-heading Plan line must parse as a
task item.

## .dev-backlog/.tracker

The first line names a row in the [SKILL.md Task Authority
table](../SKILL.md#task-authority), trimmed and case-insensitive. Setup never
writes it; a maintainer creates it by hand to opt out of GitHub
(`printf 'backlog\n' > .dev-backlog/.tracker`). Among shipped scripts only
`triage-apply --apply` reads it, solely to require GitHub before a write;
`sprint-state.js` is authority-neutral and its schema-3 JSON has no `tracker`
field. The bounded legacy migration neither reads nor displays the authority.
An empty, unknown, unreadable, or directory `.tracker` fails loud — only an
absent file means `github`.

## .dev-backlog/config.yml

`config.yml` is not parsed by this skill. Routine commands never create,
rewrite, or remove fields from it; an existing file (Backlog.md's, or a
leftover of an earlier release) is preserved byte-for-byte. The explicitly
authorized legacy migration may relocate the whole file as described below.
`backlog-triage` reads its own `.dev-backlog/triage-config.yml`.

## Migration from `backlog/` (one-way)

Existing repos that still keep skill files under `backlog/` must move them
once. The skill execution root is `.dev-backlog/` only. Never delete
`backlog/tasks/`, `backlog/docs/`, or `backlog/completed/` — those leftover
operator files are not skill execution.

### Manual migrate

1. Back up the repo (`git status` clean, or copy the tree).
2. `git mv` only skill-owned names after that backup:

```bash
mkdir -p .dev-backlog
git mv backlog/sprints .dev-backlog/sprints           # if present
git mv backlog/config.yml .dev-backlog/config.yml     # skill config only; see below
git mv backlog/triage .dev-backlog/triage             # if present
git mv backlog/triage-config.yml .dev-backlog/triage-config.yml  # if present
```

3. Leave `backlog/tasks/`, `backlog/docs/`, and `backlog/completed/` in place
   if they exist — those leftover operator paths are not skill execution.
4. Verify the destination against the backup before removing any leftover
   skill-owned sources. The move is not atomic: a failed `git mv` can leave
   names on both sides. Do not treat leftover `tasks/`, `docs/`, or
   `completed/` as skill names to delete.
5. Remove an empty leftover `backlog/` only when nothing else needs it
   (typically when `tasks/`, `docs/`, and `completed/` are also absent).

`config.yml`: move it only when it is this skill's leftover file. If it is a
Backlog.md config or the ownership is ambiguous, leave it under `backlog/`.

### Explicit compatibility command

Routine commands never inspect or move `backlog/`. `sprint-init.js`
creates `.dev-backlog/sprints/` directly on a fresh repository. After a backup
and review of the declared names above, authorize the retained one-time path
explicitly:

```bash
node /path/to/dev-backlog/skills/dev-backlog/scripts/setup-dev-backlog.js \
  --migrate-legacy
```

The command runs only when `.dev-backlog/` is absent and at least one
skill-owned marker still sits under `backlog/`. It copies every declared name
to a staging directory before publishing the complete `.dev-backlog/` recovery
copy, then removes only those sources. A copy or publish failure leaves every
original in place; a later removal failure leaves the complete destination copy
from which any removed original can be recovered. It never reads `.tracker`.
The removed `--tracker` and
`--non-interactive` flags are errors.

If `.dev-backlog/` already exists, migration skips (`destination-exists`) and
does not retry: leftover skill names stay byte-identical under `backlog/`. They
are not a second active root. Routine commands likewise leave existing sprint
files, `_context.md`, and leftover `backlog/` content byte-identical.

A lone `backlog/config.yml` with no `sprints/`, `triage/`, or
`triage-config.yml` is left in place (Backlog.md or ambiguous). `config.yml`
is migrated only when one of those skill markers is present; a leftover
`backlog/.tracker` is parked and stays where it is.

This is one-way: do not copy execution files back into `backlog/`.

### Compatibility window

An anonymized 2026-11-12 check covered 26 maintained-consumer default
branches under aliases consumer-F through consumer-AE (zero unknown).
Historical aliases consumer-A through consumer-E were not part of this check.

| Legacy layout | Present aliases | Present | Absent | Unknown |
| --- | --- | ---: | ---: | ---: |
| `backlog/sprints/` | consumer-F, consumer-G, consumer-H, consumer-I, consumer-J, consumer-K, consumer-L, consumer-M, consumer-N, consumer-O, consumer-P, consumer-Q, consumer-R | 13 | 13 | 0 |
| `backlog/triage/` | consumer-G, consumer-N | 2 | 24 | 0 |

For each row, every unlisted alias in consumer-F through consumer-AE is
absent; none of the 26 is unknown.
Because both layouts still exist, the explicit compatibility command remains.
Delete the migration implementation and command only after a later anonymized
check finds **0 present and 0 unknown for both layouts**.
