# File Format Reference

Task files are compatible with the [Backlog.md](https://github.com/MrLesk/Backlog.md) task format.

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
falls back to the other adapter.

## Local Canonical Storage (`tracker: local`)

In local mode the `backlog/tasks/` and `backlog/completed/` files are the
**canonical** task store, not GitHub mirrors. `local-tracker.js` owns every
filesystem rule behind the seven required operations; callers only ever see the
normalized identity `{ tracker: "local", id, ref: "{PREFIX}-{N}[.M]" }` — there
is no fabricated `url`.

- **Allocation.** `create` allocates the next positive **parent** integer by
  scanning the exact configured-prefix IDs across both `tasks/` and
  `completed/` (so a closed `BACK-7` still reserves `7`). `BACK-1` and `BACK-11`
  are kept distinct by exact-match parsing. An explicit decimal `id` (e.g.
  `1.2`) creates a subtask only when that exact ID is free; decimals never
  shift parent allocation and are not auto-created.
- **Atomic publication.** Allocation runs inside an exclusive lock
  (`backlog/.local-tracker.lock`); the new file is written to a same-directory
  temp and hard-linked into place, so a colliding destination fails instead of
  overwriting. The lock and temp are always released, including on error.
- **Body preservation.** A metadata/state-only `update` rewrites only the
  requested frontmatter keys and leaves the human-authored description,
  headings, and `AC:BEGIN/END` checkbox bytes untouched. Filenames stay stable
  even when the frontmatter `title` changes. The body is replaced only when the
  caller supplies one explicitly.
- **Archive on close.** `close` moves exactly one active task into
  `backlog/completed/`, writes `status: Done`, and refuses an existing
  destination rather than overwriting; a task that is already archived returns a
  clear already-closed result without data loss.
- **No provider features.** Local reports **no** optional capabilities. Any
  milestone, PR relationship, mirror, progress-issue, comment, or
  closing-semantics attempt fails with the existing tracker+capability error
  before any filesystem mutation, and the runtime never invokes `gh` or falls
  back to GitHub for explicit local.

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
