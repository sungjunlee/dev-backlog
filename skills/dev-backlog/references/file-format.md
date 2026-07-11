# File Format Reference

Task files are compatible with the [Backlog.md](https://github.com/MrLesk/Backlog.md) task format.

## Frontmatter Fields

### Core

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Storage ref `{PREFIX}-{N[.M]}`; a GitHub mirror derives `N` from the issue number, while local owns the ref directly |
| `title` | string | Yes | Brief, action-oriented description |
| `status` | string | Yes | Current state (see Status Values below) |

### Classification

| Field | Type | Description |
|-------|------|-------------|
| `labels` | string[] | Categorization labels (maps to GitHub labels only in GitHub mode) |
| `priority` | string | `low`, `medium`, `high`, `critical` |
| `assignee` | string[] | Assigned people (`@username`) |

### Relationships

| Field | Type | Description |
|-------|------|-------------|
| `dependencies` | string[] | Task IDs that must complete first (e.g., `[BACK-38]`) |

### Dates

| Field | Type | Description |
|-------|------|-------------|
| `created_date` | string | Creation date (`YYYY-MM-DD`) |
| `updated_date` | string | Last update (`YYYY-MM-DD HH:MM`) |

## Status Values

Default set (configurable in `config.yml`):

| Status | GitHub mapping | Meaning |
|--------|-------------|---------|
| `To Do` | `status:todo` | Not started |
| `In Progress` | `status:in-progress` | Active work |
| `Done` | — | Completed (issue closed) |

Extended set (if using more granular tracking):

| Status | GitHub mapping | Meaning |
|--------|-------------|---------|
| `Blocked` | `status:blocked` | Waiting on external dependency |
| `In Review` | `status:in-review` | PR under review |

## Filename Convention

```
{PREFIX}-{N} - {Title-Slug}.md
```

Examples:
- `BACK-42 - Implement-OAuth2-flow.md`
- `PROJ-7 - Fix-login-timeout.md`
- `BACK-100.2 - Create-HTTP-server-module.md` (sub-task)

The prefix comes from `config.yml` (`task_prefix`). In GitHub mode, the numeric
part is the issue number and the file is a mirror. In local mode, the configured
adapter allocates the canonical local ID.

## Body Structure

Task files are thin GitHub mirrors when `tracker: github` and canonical task
records when `tracker: local`. Notes, decisions, and cross-task context still go
in the **sprint file** (`backlog/sprints/`), not here.

```markdown
## Description
[Synced from GitHub issue body — includes any checkboxes from the issue]
```

`sync-pull.js` wraps a GitHub issue body in `## Description`. Local create stores
the supplied body directly. Acceptance criteria checkboxes remain human-authored
bytes in either mode; metadata-only refresh/update preserves them.

For manual task files or Backlog.md CLI compatibility, you can optionally add structured AC markers:

```markdown
## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Condition 1
- [x] Condition 2 (checked off during work)
<!-- AC:END -->
```

The `<!-- AC:BEGIN/END -->` markers enable machine parsing by the Backlog.md CLI. Without them, acceptance criteria still work as plain checkboxes — the file reads fine either way.

Only AC checkboxes get updated in task files during work. Everything else (notes, technical decisions, running context) lives in the sprint file.

## Sprint Frontmatter (spec-axis fields)

Sprint files (`backlog/sprints/*.md`) carry `objectives:` and `component:` alongside `milestone:` / `status:` / `started:` / `due:`. Both spec-axis fields are **optional**:

| Field | Optional? | Omission semantics |
| --- | --- | --- |
| `objectives:` | yes | Omitted entirely when neither `spec/charter.md` nor legacy root `CHARTER.md` exists. A present-but-unknown Objective ID is a hard failure (`objectives-check.js`). |
| `component:` | yes | Omitted entirely when `spec/capabilities.md` does not exist. A present value must resolve to exactly one `## Capability:` slug (`component-lint.js`). |

`sprint-init.js` emits each field only when its backing spec file is present, so a cold adopter with no `spec/` gets a clean sprint with neither key. An older sprint that still carries an empty `objectives: []` / `component: ""` stays valid — this is omission-on-generate, not a migration. `backlog-doctor.js` warns (soft, non-blocking) only when the **active** sprint omits a field while its spec file exists. Full semantics live in [`spec-fallback.md`](spec-fallback.md); the authoritative contract table is in [SKILL.md](../SKILL.md).

## config.yml

```yaml
project_name: "my-project"
tracker: github
task_prefix: "BACK"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
```

`tracker` accepts only `github` or `local`. A missing key deterministically
defaults to `github`; runtime availability never changes that selection or
falls back to the other adapter. This is a zero-migration upgrade rule: existing
tracker-less repositories keep GitHub authority and all legacy files unchanged.
`setup-dev-backlog.js` pins that authority or creates an explicit fresh choice;
it never migrates task files.

## Local Canonical Storage (`tracker: local`)

In local mode `backlog/tasks/` and `backlog/completed/` are the **canonical**
task store. Required list/read/create/update/close operations return normalized
identity `{ tracker: "local", id, ref: "{PREFIX}-{N[.M]}" }` without fabricating
a URL. Metadata-only updates preserve body/AC bytes; close writes `status: Done`
and archives the same file. Local reports no optional provider capabilities, so
milestones, PR relationships, mirrors, progress issues, comments, and closing
semantics fail before filesystem or provider effects and never invoke `gh`.

Filesystem allocation, publication, collision, and recovery details have one
implementation owner: [Tracker Adapter Design Contract](../../../docs/tracker-adapter-design.md).

dev-backlog also reads `task_prefix`, `default_status`, and `statuses`;
`project_name` is retained as metadata. Other Backlog.md config fields are not
consumed by dev-backlog.

## Sub-tasks

Hierarchical IDs use decimal notation:
- `BACK-42` — parent task
- `BACK-42.1` — first sub-task
- `BACK-42.2` — second sub-task

Sub-tasks get their own files: `BACK-42.1 - Subtask-title.md`

## Backlog.md CLI Compatibility

The `backlog/tasks/` and `backlog/completed/` directories use a Backlog.md-compatible task-file format, so the CLI will recognize them.

The `backlog/sprints/` directory is a custom addition for sprint execution tracking. Backlog.md CLI ignores it (only scans `tasks/`, `completed/`, `drafts/`, `decisions/`, `docs/`). This is safe — sprints/ won't interfere with CLI operations.
