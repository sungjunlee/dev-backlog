# File Format Reference

Sprint files, tracker selection, and config. Optional Backlog.md-shaped
exports are a short legacy note at the end — never a runtime format.

## Sprint file

Each active sprint lives at `backlog/sprints/YYYY-MM-<topic>.md`. Section
semantics and checkbox states are in [SKILL.md](../SKILL.md).

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

`objectives:` and `component:` are **optional**:

| Field | Optional? | Omission semantics |
| --- | --- | --- |
| `objectives:` | yes | Omitted entirely when neither `spec/charter.md` nor legacy root `CHARTER.md` exists. A present-but-unknown Objective ID is a hard failure (`objectives-check.js`) — except in `status: completed` sprints, which are immutable history and may reference retired IDs. |
| `component:` | yes | Omitted entirely when `spec/capabilities.md` does not exist. A present value must resolve to exactly one `## Capability:` slug (`component-lint.js`) — except in `status: completed` sprints, which may reference retired slugs. |

`sprint-init.js` emits each field only when its backing spec file is present.
An older sprint that still carries `objectives: []` / `component: ""` stays
valid. `backlog-doctor.js` warns (soft) only when the **active** sprint omits a
field while its spec file exists. Full semantics: [`spec-fallback.md`](spec-fallback.md).

Order Plan items into parallel-safe batches. An empty `## Plan` is valid until
issues are selected; every nonblank, non-heading Plan line must parse as a
task item.

## Tracker selection

`backlog/.tracker` contains exactly one newline-terminated selection:

```text
github
```

The only supported value is `github`. When `.tracker` is missing, runtime
accepts only a legacy top-level `tracker: github` value from `config.yml`; with
neither, it deterministically defaults to `github`. Any other value fails.
Availability never changes selection. Setup writes `.tracker` atomically and
never edits `config.yml`.

## config.yml

```yaml
project_name: "my-project"
task_prefix: "BACK"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
```

`config.yml` remains the read-only source for Backlog.md settings such as
`task_prefix`; setup never creates, rewrites, or removes fields from it.
dev-backlog reads `task_prefix`, `default_status`, and `statuses`;
`project_name` is retained as metadata.

## Effective task specification

Work and completion resolve task input through `effective-task-spec.js`. The
canonical task body is the default selected specification. To select a
repository document explicitly, put exactly one marker in the Issue body:

```markdown
<!-- dev-backlog:spec_ref docs/tasks/oauth-rollout.md -->
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

## Optional legacy export

`sync-pull.js --legacy-export` may write `backlog/tasks/` in a
Backlog.md-compatible shape for diagnosis or rollback. Those files are never
read as task truth. Import is human-reviewed Markdown into a GitHub Issue.
Exported filenames look like `{PREFIX}-{N} - {Title-Slug}.md`; decimal IDs are
historical parse-only, not runtime identities.
