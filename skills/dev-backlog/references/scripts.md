# Script reference

Full flag inventory for the `dev-backlog` deterministic helpers. `SKILL.md` carries the resolution rule and the core-path scripts; this file is the complete table for when you need a flag that is not on the core path.

## Resolution

Resolve scripts from the installed `dev-backlog` skill directory, not the target project. In a source checkout that is the local `scripts/` directory beside `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root.

```bash
skill_dir="skills/dev-backlog" # source checkout; replace with the resolved installed skill dir
bash "$skill_dir/scripts/next.sh"
node "$skill_dir/scripts/sprint-init.js" "next-sprint" --dry-run
```

## Full inventory

- `scripts/setup-dev-backlog.js [project-name] [--tracker github|local] [--non-interactive] [--json]` — persist one canonical tracker and minimum directories without migrating task files; fresh non-interactive setup requires an explicit tracker.
- `scripts/init.sh [project-name]` — bootstrap `backlog/` with `.tracker` and directories.
- `scripts/tracker.js` — official programmatic core lifecycle boundary: resolve the configured adapter with `{ backlogDir }`, then call `list`, `read`, `create`, `update`, or `close` as documented in `process.md`.
- `scripts/next.sh [--json] [--track slug] [backlog-dir]` — show the next actionable batch; N disjoint active tracks render a portfolio, `--track` selects one.
- `scripts/status.sh [--json] [--track slug] [backlog-dir]` — summarize sprint-file state plus task state from the configured tracker; portfolio/`--track` semantics match `next.sh`.
- `scripts/sprint-state.js [--mode status|next] [--track slug | --component slug] [backlog-dir]` — the single sprint-markdown parser behind the `--json` surfaces; emits `schema_version: 2` with `active_sprints[]` plus retained single-track fields.
- `scripts/sync-pull.js [PREFIX] [--update] [--dry-run] [--json] [--limit N]` — pull open GitHub issues into `backlog/tasks/`.
- `scripts/sprint-init.js "topic" [--milestone "Name"] [--component "slug" | --scope "glob[,glob]"] [--dry-run] [--json]` — create an active sprint skeleton; refuses only a track whose scope overlaps an existing active track (with 2+ active tracks, any undeclared axis warns and allows). `--component` validates and emits one `spec/capabilities.md` slug; `--scope` emits explicit globs when no component axis fits. The flags are mutually exclusive, and spec-backed fields otherwise follow `spec-fallback.md`.
- `scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]` — close an active sprint and print the doctor/reassess signal summary; `--track` picks the track when several are active, otherwise an unambiguous single active needs no flag.
- `scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]` — verify sprint Objective IDs.
- `scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]` — verify sprint `component:` handles.
- `scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]` — check `spec/capabilities.md` compactness and Learnings markers.
- `scripts/backlog-doctor.js [--json] [--stale-days N] [backlog-dir]` — aggregate backlog health checks; hard violations fail, soft execution signals warn. JSON includes top-level `reassess_signal`.
- `scripts/context-hook.sh [backlog-dir]` — one-line active-sprint summary for a Claude Code PreToolUse hook (portfolio line for N tracks); silent when no active sprint.

## Tracker routing

`backlog/.tracker` is the runtime selection authority. When it is absent, a
legacy `tracker:` key read from `config.yml` is the compatibility fallback;
with neither, GitHub remains the deterministic default. Setup migrates a legacy
selection to `.tracker` without editing `config.yml`. GitHub mode uses `gh` and
treats task files as mirrors; local mode uses `local-tracker.json` as canonical
and derives the same task-file mirrors with zero provider calls.

Detailed adapter mechanics and compatibility evidence are single-sourced in
[`docs/tracker-adapter-design.md`](../../../docs/tracker-adapter-design.md).
