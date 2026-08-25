# Project Context

## Architecture Decisions

- GitHub Issues are the source of truth; `backlog/` is the execution layer
- Script interfaces should stay stable unless an issue explicitly changes the CLI contract
- Exactly one persisted tracker owns canonical task truth. Runtime selection is configuration-only and fail-closed; an absent key is the documented GitHub compatibility default, never an auth/CLI fallback.
- Core task identity is `{ tracker, id, ref, url? }`. GitHub `#N` is parsed by the single exact parser; legacy GitHub `issue_number`, filenames, Markdown, and JSON remain compatibility aliases.
- Direct GitHub task lifecycle transport belongs to the GitHub adapter. Milestones, PR relationships, comments, and closing semantics remain explicit capabilities or narrowly named provider transports. (Mirrors and progress issues were removed by #340/#347; only the legacy-marker filter in `sync-pull`/`triage-collect` remains.)
- The tracker layer is GitHub-only (`TRACKER_KEYS = ["github"]`, #348); unsupported provider capabilities fail before effects instead of changing tracker authority.
- Setup recommendations never override a persisted tracker selection, and setup re-runs preserve user-authored configuration and task bytes.
- Active sprints partition by track scope (2026-07, epic #289): `component:` equality or explicit `scope:` globs decide overlap through the ONE `scopesOverlap()` in `scripts/lib.js` — never re-implement it. Disjoint tracks coexist as a portfolio; overlap fails loud; single-track behavior is the G4 text-byte-identity compatibility surface (anchored in smoke-test.sh; never snapshot `--json`, which is schema-versioned instead).

## Conventions

- Prefer minimal-diff refactors over repo-wide rewrites
- Keep `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js` green at each step of script cleanup work
- Treat sprint/task markdown shape as a compatibility surface for bash scripts and agent tooling
- Commit the active sprint file to main when opening it; an untracked sprint is invisible to dispatch worktrees, and a relay executor may seed a duplicate active sprint to satisfy live checks (2026-07, Sprint execution-substrate — direct SSOT evidence for the #215 spike)
- JSON read surfaces (`status.sh --json`, `next.sh --json` via `sprint-state.js`) and `backlog-doctor.js` are the machine path for orientation and health; extend them instead of adding new markdown parsers
- No `skills/` file may carry an unconditional required-read of a cross-repo `../spec-charter/references/` path — it dangles for adopters without craftkit. Consumption-side spec degradation lives in the in-bundle `references/spec-fallback.md`; craftkit's `spec-charter` is the when-installed authoring home. `smoke-test.sh` GATE_A2A3 enforces this (2026-07 adoption-hardening, #254/#255)
- Sprint spec fields are optional: `sprint-init.js` omits `objectives:`/`component:` when the backing spec file is absent; `backlog-doctor` soft-warns only when the ACTIVE sprint drops a field while its spec exists. Existing `objectives: []`/`component: ""` stay valid (no migration) (#258)

## Known Gotchas

- Live GitHub work re-runs `effective-task-spec.js` and reviews a changed source revision. Rollback/diagnostic export is explicit via `sync-pull.js --legacy-export --update`.
- Backlog triage snapshot enrichments stay explicit and bounded: `--with-comments` and `--with-closed-issues` are opt-in, while downstream scanners must gracefully gate on optional fields instead of assuming they exist.
- `triage-relate` relationship edges are advisory context. Even a `merged-pr-link` edge must not become a close recommendation unless `triage-stale` implements a separate conservative obsolete signal.
- Backlog triage reports must protect issues referenced in the active sprint Plan or Running Context from close / close-duplicate proposals.
- `gh issue create` does not support `--json`; a `create --json ... || create -b "fallback"` chain fails the first call at flag parsing and posts the fallback placeholder as the real issue body (BACK-243 incident, 2026-07-05). Capture the URL from stdout instead.
- Reassess signal counting is date-granular: sprints closed on the same day as (or after) the latest `backlog/triage/YYYY-MM-DD-reassess.md` all count, so several small same-day closes can re-trigger the recommendation right after a reassess (observed 2026-07-04). Judgment call at close time; tune the threshold/rule if it keeps nagging (PRD listed thresholds as dogfood-tunable).
- `references/spec-fallback.md` is consumption-side only, ~1 page hard cap: it says how dev-backlog/backlog-triage BEHAVE when the spec axis is thin/absent, never authors spec semantics (that lives in craftkit). Guard against it drifting into a second spec-axis authority — that was the 2026-06/07 silent-fork failure mode (#253)
- Smoke flake (not a regression): the live-repo `status: shows sprint name` assertion in `smoke-test.sh` depends on `gh issue list` and can fail intermittently on network; re-run before assuming a change broke it. The offline cold-adopter section is deterministic (2026-07)
- v1.0.0 is reserved and is not a cleanup cut: do not delete completed sprint files, and do not delete `sync-pull.js` / `legacy-tracker.js` without a measured consumer (charter freeze 2026-08-17; 2026-08 second-start close).
- #366 (GitHub resilience) and #367 (Eval-Prompts cadence) stay parked until organic pain appears.
