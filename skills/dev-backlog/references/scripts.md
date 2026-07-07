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

- `scripts/init.sh [project-name]` — bootstrap `backlog/` with config and directories.
- `scripts/next.sh` — show the next actionable batch.
- `scripts/status.sh` — summarize sprint file + GitHub state.
- `scripts/sync-pull.js [PREFIX] [--update] [--dry-run] [--json] [--limit N]` — pull open GitHub issues into `backlog/tasks/`.
- `scripts/sprint-init.js "topic" [--milestone "Name"] [--dry-run] [--json]` — create one active sprint skeleton; refuses a second active sprint. Emits `objectives:`/`component:` only when the backing spec file exists (see `spec-fallback.md`).
- `scripts/progress-sync.js [--month YYYY-MM] [--dry-run] [--json] [--relay-manifest PATH] [--finalize]` — sync monthly progress issue.
- `scripts/sprint-close.sh [backlog-dir] [--dry-run] [--close-milestone]` — close the single active sprint and print the doctor/reassess signal summary.
- `scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]` — verify sprint Objective IDs.
- `scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]` — verify sprint `component:` handles.
- `scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]` — check `spec/capabilities.md` compactness and Learnings markers.
- `scripts/backlog-doctor.js [--json] [--stale-days N] [backlog-dir]` — aggregate backlog health checks; hard violations fail, soft execution signals warn. JSON includes top-level `reassess_signal`.
- `scripts/sprint-mirror.js [backlog-dir] [--dry-run] [--json]` — publish the active sprint to a read-only GitHub issue mirror; explicit sync only.
- `scripts/context-hook.sh [backlog-dir]` — one-line active-sprint summary for a Claude Code PreToolUse hook; silent when no active sprint.
