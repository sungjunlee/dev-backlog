# Project Context

## Architecture Decisions
- GitHub Issues are the source of truth; `backlog/` is the execution layer
- Script interfaces should stay stable unless an issue explicitly changes the CLI contract

## Conventions
- Prefer minimal-diff refactors over repo-wide rewrites
- Keep `node --test skills/dev-backlog/scripts/*.test.js` green at each step of script cleanup work
- Treat sprint/task markdown shape as a compatibility surface for bash scripts and agent tooling
- Commit the active sprint file to main when opening it; an untracked sprint is invisible to dispatch worktrees, and a relay executor may seed a duplicate active sprint to satisfy live checks (2026-07, Sprint execution-substrate — direct SSOT evidence for the #215 spike)
- JSON read surfaces (`status.sh --json`, `next.sh --json` via `sprint-state.js`) and `backlog-doctor.js` are the machine path for orientation and health; extend them instead of adding new markdown parsers

## Known Gotchas
- Resolve `progress-sync` metric semantics in `#49` before doing structural refactors in `#50`
- `progress-sync` and the bash helpers both parse sprint/task markdown, so contract drift needs explicit coverage
- `sync-pull.js --update` refreshes task frontmatter and, for machine-managed issues whose **incoming GitHub body** starts with the `<!-- dev-backlog:progress-issue month=` marker, also refreshes the markdown body; every other task mirror keeps its existing body so local AC checkbox state is preserved
- Backlog triage snapshot enrichments stay explicit and bounded: `--with-comments` and `--with-closed-issues` are opt-in, while downstream scanners must gracefully gate on optional fields instead of assuming they exist.
- `triage-relate` relationship edges are advisory context. Even a `merged-pr-link` edge must not become a close recommendation unless `triage-stale` implements a separate conservative obsolete signal.
- Backlog triage reports must protect issues referenced in the active sprint Plan or Running Context from close / close-duplicate proposals.
- Relay reviewer routing: `opencode` + `opencode-go/glm-5.2` fails primary review (prose instead of JSON verdict, reproduced twice 2026-07); use the `codex` reviewer until the adapter or model compliance improves.
- `gh issue create` does not support `--json`; a `create --json ... || create -b "fallback"` chain fails the first call at flag parsing and posts the fallback placeholder as the real issue body (BACK-243 incident, 2026-07-05). Capture the URL from stdout instead.
- `opencode run` blocks forever pre-session (zero stdout, ignores SIGTERM) when stdin is an open non-TTY pipe without EOF — the agent-harness background-execution default. Root-caused 2026-07-05: it reads stdin into the message before starting; not a model or permission issue. Always invoke with `< /dev/null` (and `timeout -k` for kills).
- relay-merge `gate-check` mis-picks the latest PR commit when multiple commits share a committedDate (post-rebase ties) — dev-relay#753; workaround: `git commit --amend --no-edit` on the head to re-stamp, then re-review.
- Reassess signal counting is date-granular: sprints closed on the same day as (or after) the latest `backlog/triage/YYYY-MM-DD-reassess.md` all count, so several small same-day closes can re-trigger the recommendation right after a reassess (observed 2026-07-04). Judgment call at close time; tune the threshold/rule if it keeps nagging (PRD listed thresholds as dogfood-tunable).
