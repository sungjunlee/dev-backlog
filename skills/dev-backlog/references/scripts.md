# Script reference

Full flag inventory for the `dev-backlog` deterministic helpers. `SKILL.md` carries the resolution rule and the core-path scripts; this file is the complete table for when you need a flag that is not on the core path.

## Resolution

Resolve scripts from the installed `dev-backlog` skill directory, not the target project. In a source checkout that is the local `scripts/` directory beside `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root.

```bash
skill_dir="skills/dev-backlog" # source checkout; replace with the resolved installed skill dir
bash "$skill_dir/scripts/next.sh"
node "$skill_dir/scripts/sprint-init.js" "next-sprint" --dry-run
```

## Operator inventory

Entry-point scripts an operator or agent invokes directly. Internal modules
(`tracker-capability.js`, `tracker-status-list.js`, `github-milestones.js`,
`legacy-tracker.js`, and similar) are implementation details consumed by these
entry points and are intentionally not listed.

- `scripts/setup-dev-backlog.js [project-name] [--tracker github|files] [--non-interactive] [--json]` — persist the chosen task authority (`github` or `files`) and create only `sprints/`.
- `scripts/init.sh [project-name]` — bootstrap `.dev-backlog/` with `.tracker` and directories.
- `scripts/tracker.js` — official programmatic core lifecycle boundary: resolve the configured adapter with `{ backlogDir }`, then call `list`, `read`, `create`, `update`, or `close` as documented in `adapter-ports.md` and `process.md`. Adapter failure is fail-closed.
- `scripts/effective-task-spec.js TASK_REF [--repo OWNER/REPO] [--spec-ref PATH] [--backlog-dir PATH] [--root PATH]` — resolve the configured live task into effective spec, normalized AC/lifecycle, selected source, and stable SHA-256 revision/digest. Source precedence: explicit `spec_ref` (body marker `<!-- dev-backlog:spec_ref PATH -->` or `--spec-ref`), then a posted `## Agent Brief` comment, then the Issue body. Any authority/spec load failure stops without a task-mirror fallback.
- `scripts/next.sh [--json] [--track slug] [backlog-dir]` — show the next actionable batch; N disjoint active tracks render a portfolio, `--track` selects one.
- `scripts/status.sh [--json] [--track slug] [backlog-dir]` — summarize sprint-file state plus task state from the configured tracker; portfolio/`--track` semantics match `next.sh`.
- `scripts/sprint-state.js [--mode status|next] [--track slug | --component slug] [backlog-dir]` — the single sprint-markdown parser behind the `--json` surfaces; emits `schema_version: 2` with `active_sprints[]` plus retained single-track fields.
- `scripts/sync-pull.js --legacy-export [PREFIX] [--update] [--dry-run] [--json] [--limit N]` — opt-in diagnostic/rollback export of open Issues to `exports/github-issues/`; not a core lifecycle step and not a Backlog.md compatibility layer.
- `scripts/sprint-init.js "topic" [--milestone "Name"] [--component "slug" | --scope "glob[,glob]"] [--dry-run] [--json]` — create an active sprint skeleton; refuses only a track whose scope overlaps an existing active track (with 2+ active tracks, any undeclared axis warns and allows). `--component` validates and emits one `spec/capabilities.md` slug; `--scope` emits explicit globs when no component axis fits. The flags are mutually exclusive, and spec-backed fields otherwise follow `spec-fallback.md`.
- `scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]` — close an active sprint and print the doctor/reassess signal summary; `--track` picks the track when several are active, otherwise an unambiguous single active needs no flag. Checked legacy mirrors are archived only when present; a mirrorless close is the normal supported path.
- `scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]` — verify sprint Objective IDs.
- `scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]` — verify sprint `component:` handles.
- `scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]` — check `spec/capabilities.md` compactness and Learnings markers.
- `scripts/backlog-doctor.js [--json] [--stale-days N] [backlog-dir]` — aggregate backlog health checks; hard violations fail, soft execution signals warn. JSON includes top-level `reassess_signal`.
- `scripts/context-hook.sh [backlog-dir]` — one-line active-sprint summary for a Claude Code PreToolUse hook (portfolio line for N tracks); silent when no active sprint.
- `scripts/doc-drift-check.js [--root PATH] [--json]` — source-repo maintenance net (#367): verify every `.js`/`.sh` script name mentioned in `skills/*/SKILL.md`, `skills/*/references/*.md`, and `.dev-backlog/sprints/_context.md` resolves to a file under a skill's `scripts/`; dangling mentions fail. Filename-level only; its test runs the live-repo check in CI.

## Tracker routing

`.dev-backlog/.tracker` selection rules live in `file-format.md`; adapter ports in `adapter-ports.md`; routing and optional-export boundaries in `authority-contract.md`.
