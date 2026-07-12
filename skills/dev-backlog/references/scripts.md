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
- `scripts/init.sh [project-name]` — bootstrap `backlog/` with config and directories.
- `scripts/tracker.js` — official programmatic core lifecycle boundary: resolve the configured adapter with `{ backlogDir }`, then call `list`, `read`, `create`, `update`, or `close` as documented in `process.md`.
- `scripts/next.sh [--json] [--track slug] [backlog-dir]` — show the next actionable batch; N disjoint active tracks render a portfolio, `--track` selects one.
- `scripts/status.sh [--json] [--track slug] [backlog-dir]` — summarize sprint-file state plus task state from the configured tracker; portfolio/`--track` semantics match `next.sh`.
- `scripts/sprint-state.js [--mode status|next] [--track slug | --component slug] [backlog-dir]` — the single sprint-markdown parser behind the `--json` surfaces; emits `schema_version: 2` with `active_sprints[]` plus retained single-track fields.
- `scripts/sync-pull.js [PREFIX] [--update] [--dry-run] [--json] [--limit N]` — pull open GitHub issues into `backlog/tasks/`.
- `scripts/sprint-init.js "topic" [--milestone "Name"] [--scope "glob[,glob]"] [--dry-run] [--json]` — create an active sprint skeleton; refuses only a track whose scope overlaps an existing active track (scopeless next to scopeless warns and allows). `--scope` emits explicit `scope:` globs; `objectives:`/`component:` are emitted only when the backing spec file exists (see `spec-fallback.md`).
- `scripts/progress-sync.js [--month YYYY-MM] [--dry-run] [--json] [--relay-manifest PATH] [--finalize]` — sync monthly progress issue.
- `scripts/sprint-close.sh [backlog-dir] [--track slug] [--dry-run] [--close-milestone]` — close an active sprint and print the doctor/reassess signal summary; `--track` picks the track when several are active, otherwise an unambiguous single active needs no flag.
- `scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]` — verify sprint Objective IDs.
- `scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]` — verify sprint `component:` handles.
- `scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]` — check `spec/capabilities.md` compactness and Learnings markers.
- `scripts/backlog-doctor.js [--json] [--stale-days N] [backlog-dir]` — aggregate backlog health checks; hard violations fail, soft execution signals warn. JSON includes top-level `reassess_signal`.
- `scripts/sprint-mirror.js [backlog-dir] [--track slug] [--dry-run] [--json]` — publish one active sprint track to a read-only GitHub issue mirror; a portfolio requires `--track`, and sync stays explicit only.
- `scripts/context-hook.sh [backlog-dir]` — one-line active-sprint summary for a Claude Code PreToolUse hook (portfolio line for N tracks); silent when no active sprint.

## Tracker routing

`backlog/config.yml` is the only runtime selection authority. Missing `tracker:`
retains legacy GitHub behavior without rewriting the config. GitHub mode uses
`gh` and treats task files as mirrors; local mode treats task files as canonical
and makes zero provider calls. `sprint-init`, `sprint-mirror`, and
`progress-sync` are representative JSON-capable optional-feature boundaries:
when unsupported, `--json` exits non-zero with the shared `{ "error": ... }`
contract from `tracker.js`, while human mode prints the same remediation.

Detailed adapter mechanics and compatibility evidence are single-sourced in
[`docs/tracker-adapter-design.md`](../../../docs/tracker-adapter-design.md).
