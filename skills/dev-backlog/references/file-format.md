# File Format Reference

Task file specification following [Backlog.md](https://github.com/MrLesk/Backlog.md) format.

## Frontmatter Fields

### Core

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID matching GitHub issue: `{PREFIX}-{N}` (e.g., `BACK-42`) |
| `title` | string | Yes | Brief, action-oriented description |
| `status` | string | Yes | Current state (see Status Values below) |

### Classification

| Field | Type | Description |
|-------|------|-------------|
| `labels` | string[] | Categorization labels (maps to GitHub labels) |
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

| Status | GitHub Label | Meaning |
|--------|-------------|---------|
| `To Do` | `status:todo` | Not started |
| `In Progress` | `status:in-progress` | Active work |
| `Done` | — | Completed (issue closed) |

Extended set (if using more granular tracking):

| Status | GitHub Label | Meaning |
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

The prefix and number come from `config.yml` (`task_prefix`) and the GitHub issue number.

## Body Structure

Task files are thin GitHub mirrors. Notes, decisions, and context go in the **sprint file** (`backlog/sprints/`), not here.

```markdown
## Description
[Synced from GitHub issue body — includes any checkboxes from the issue]
```

`sync-pull.js` wraps the raw GitHub issue body in `## Description`. Acceptance criteria checkboxes from the issue body appear here as-is. dev-relay and other tools read AC from whatever structure the issue body provides.

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

## config.yml

```yaml
project_name: "my-project"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
task_prefix: "BACK"
labels: []
milestones: []
definition_of_done: []        # Default DoD items added to every new task
date_format: yyyy-mm-dd hh:mm
auto_commit: false
```

## Sub-tasks

Hierarchical IDs use decimal notation:
- `BACK-42` — parent task
- `BACK-42.1` — first sub-task
- `BACK-42.2` — second sub-task

Sub-tasks get their own files: `BACK-42.1 - Subtask-title.md`

## Backlog.md CLI Compatibility

The `backlog/tasks/` and `backlog/completed/` directories follow Backlog.md standard — the CLI will recognize them.

The `backlog/sprints/` directory is a custom addition for sprint execution tracking. Backlog.md CLI ignores it (only scans `tasks/`, `completed/`, `drafts/`, `decisions/`, `docs/`). This is safe — sprints/ won't interfere with CLI operations.
