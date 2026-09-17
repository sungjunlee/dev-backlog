# File Format Reference

Sprint files, tracker selection, and config. Optional diagnostic exports are a
short note at the end — never a runtime format. Adapter ports:
[adapter-ports.md](adapter-ports.md).

## Sprint file

Each active sprint lives at `.dev-backlog/sprints/YYYY-MM-<topic>.md`. Required
headings: `## Goal`, `## Plan`, `## Running Context`, `## Progress`. Plan item
grammar: `- [ ] #N …` (or the configured tracker ref); `[~]` in-flight and `[x]`
done may append `→ PR #N (state)` (end of line), `[branch:name]`, and/or `[run:…]` (end of line). Section semantics live in
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
- [x] #38 DB schema setup (~15min)

### Batch 2 - Core auth
- [~] #42 OAuth2 flow (~2hr) -> PR #87 (reviewing)

### Batch 3 - Hardening
- [ ] #43 Rate limiting (~30min)

## Running Context
- argon2 for hashing

## Progress
- 2026-03-22 AM: Batch 1 done.
```

`objectives:` and `component:` are **optional and unchecked** (charter rev 18):

| Field | Optional? | Semantics |
| --- | --- | --- |
| `objectives:` | yes | Human-authored charter Objective IDs. Never generated, never resolved against `spec/charter.md`. |
| `component:` | yes | Free track-scope string, compared only by `scopesOverlap`. By convention a `## Capability:` heading so relay Learnings route, but nothing checks that. |

`sprint-init.js` reads no `spec/` file. It emits `component:` only when
`--component` was given and `scope:` only when `--scope` was given; it never
emits `objectives:`. An older sprint that still carries `objectives: []` /
`component: ""` stays valid. Full semantics:
[`spec-fallback.md`](spec-fallback.md).

Order Plan items into parallel-safe batches. An empty `## Plan` is valid until
issues are selected; every nonblank, non-heading Plan line must parse as a
task item.

## Tracker selection

`.dev-backlog/.tracker` contains exactly one newline-terminated selection:

```text
github
```

The supported values are `github` and `files`. When `.tracker` is
missing, runtime accepts only a leftover top-level `tracker: github` or
`tracker: files` value from `config.yml`; with neither,
it deterministically defaults to `github`. Any other value fails. Availability
never changes selection; adapter failure is fail-closed. Setup writes
`.tracker` atomically and never edits `config.yml`. `files` is a chosen
Backlog.md CLI authority (plan refs `BACK-N`), not a fallback from GitHub.

## .dev-backlog/config.yml

```yaml
project_name: "my-project"
task_prefix: "BACK"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
```

`config.yml` remains the read-only source for diagnostic-export filename
settings such as `task_prefix`; setup never creates, rewrites, or removes
fields from it. dev-backlog reads `task_prefix`, `default_status`, and
`statuses`; `project_name` is retained as metadata.

## Effective task specification

Work and completion resolve task input through `effective-task-spec.js`. It
selects, in order: an explicit `spec_ref`, a posted Issue comment starting with
`## Agent Brief`, then the Issue body. To select a repository document
explicitly, put exactly one marker in the Issue body:

```markdown
<!-- dev-backlog:spec_ref docs/oauth-rollout.md -->
```

`spec_ref` is repository-relative. The resolver fails closed when it is
missing, unreadable, outside the repository, or duplicated with a conflicting
value; it does not fall back to another document. Optional AC markers:

```markdown
## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Condition 1
- [x] Condition 2
<!-- AC:END -->
```

Without the markers, acceptance criteria still work as plain checkboxes.

## Optional diagnostic export

`sync-pull.js --legacy-export` may write `exports/github-issues/` as a
diagnostic/rollback snapshot. Those files are never read as task truth, are
not under the skill execution root, and are not a Backlog.md compatibility
layer. Import is human-reviewed Markdown into a GitHub Issue. Exported
filenames look like `{PREFIX}-{N} - {Title-Slug}.md`; decimal IDs are
historical parse-only, not runtime identities. This flag is not on orient,
plan, work, or complete.

## Migration from `backlog/` (one-way)

Existing repos that still keep skill files under `backlog/` must move them
once. The skill execution root is `.dev-backlog/` only. Never delete
`backlog/tasks/`, `backlog/docs/`, or `backlog/completed/` — those leftover
operator files are not the diagnostic export and not skill execution.

### Manual migrate

1. Back up the repo (`git status` clean, or copy the tree).
2. `git mv` only skill-owned names after that backup:

```bash
mkdir -p .dev-backlog
git mv backlog/sprints .dev-backlog/sprints           # if present
git mv backlog/.tracker .dev-backlog/.tracker         # if present
git mv backlog/config.yml .dev-backlog/config.yml     # skill config only; see below
git mv backlog/triage .dev-backlog/triage             # if present
git mv backlog/triage-config.yml .dev-backlog/triage-config.yml  # if present
```

3. Leave `backlog/tasks/`, `backlog/docs/`, and `backlog/completed/` in place
   if they exist — those leftover operator paths are not skill execution and
   are not `exports/github-issues/`.
4. Verify the destination against the backup before removing any leftover
   skill-owned sources. The move is not atomic: a failed `git mv` can leave
   names on both sides. Do not treat leftover `tasks/`, `docs/`, or
   `completed/` as skill names to delete.
5. Remove an empty leftover `backlog/` only when nothing else needs it
   (typically when `tasks/`, `docs/`, and `completed/` are also absent).

`config.yml`: move it only when it is this skill's `tracker:` / `task_prefix`
file. If it is a Backlog.md config or the ownership is ambiguous, leave it
under `backlog/` and create `.dev-backlog/.tracker` via setup.

### Setup auto-migrate

`setup-dev-backlog.js` copies then removes those same skill-owned names when
`.dev-backlog/` is absent and at least one skill-owned name still sits under
`backlog/`. That path is not `git mv`, takes no backup, and is not atomic.
It validates the leftover tracker pin first, so a refused layout is left
untouched. If `.dev-backlog/` already exists, auto-migrate skips
(`destination-exists`) and does not retry: leftover skill names stay under
`backlog/` and `backlog-doctor.js` warns. They are not a second active root.

A lone `backlog/config.yml` with no `sprints/`, `.tracker`, `triage/`, or
`triage-config.yml` is left in place (Backlog.md or ambiguous); setup still
creates `.dev-backlog/.tracker`. `config.yml` is migrated only when one of
those skill markers is present.

This is one-way: do not copy execution files back into `backlog/`.
