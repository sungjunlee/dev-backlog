# Project Context

## Architecture Decisions

- GitHub Issues are the source of truth; `.dev-backlog/` is the execution layer
- Script interfaces should stay stable unless an issue explicitly changes the CLI contract
- Exactly one persisted tracker owns canonical task truth. Runtime selection is configuration-only and fail-closed; an absent key is the documented GitHub compatibility default, never an auth/CLI fallback.
- Core task identity is `{ tracker, id, ref, url? }`. GitHub `#N` is parsed by the single exact parser; legacy GitHub `issue_number`, filenames, Markdown, and JSON remain compatibility aliases.
- Direct GitHub task lifecycle transport belongs to the GitHub adapter. Milestones, PR relationships, comments, and closing semantics remain explicit capabilities or narrowly named provider transports. (Mirrors and progress issues were removed by #340/#347.)
- The tracker layer is config-only (`TRACKER_KEYS = ["github", "files", "gitlab"]`, #415); unsupported provider capabilities fail before effects instead of changing tracker authority. This repository pins `github`. Forgejo/Gitea are follow-up forge adapters.
- Setup recommendations never override a persisted tracker selection, and setup re-runs preserve user-authored configuration and task bytes.
- Active sprints partition by track scope (2026-07, epic #289): `component:` equality or explicit `scope:` globs decide overlap through the ONE `scopesOverlap()` in `scripts/lib.js` — never re-implement it. Disjoint tracks coexist as a portfolio; overlap fails loud; single-track behavior is the G4 text-byte-identity compatibility surface (anchored in the smoke test; never snapshot `--json`, which is schema-versioned instead).

## Conventions

- Prefer minimal-diff refactors over repo-wide rewrites
- Keep `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js` green at each step of script cleanup work
- Treat sprint/task markdown shape as a compatibility surface for bash scripts and agent tooling
- Commit the active sprint file to main when opening it; an untracked sprint is invisible to dispatch worktrees, and a relay executor may seed a duplicate active sprint to satisfy live checks (2026-07, Sprint execution-substrate — direct SSOT evidence for the #215 spike)
- JSON read surfaces (`status.sh --json`, `next.sh --json` via `sprint-state.js`) and `backlog-doctor.js` are the machine path for orientation and health; extend them instead of adding new markdown parsers
- No `skills/` file may carry an unconditional required-read of a cross-repo `../spec-charter/references/` path — it dangles for adopters without craftkit. Consumption-side spec degradation lives in the in-bundle `references/spec-fallback.md`; craftkit's `spec-charter` is the when-installed authoring home. The smoke test GATE_A2A3 enforces this (2026-07 adoption-hardening, #254/#255)
- Sprint spec fields are optional: `sprint-init.js` omits `objectives:`/`component:` when the backing spec file is absent; `backlog-doctor` soft-warns only when the ACTIVE sprint drops a field while its spec exists. Existing `objectives: []`/`component: ""` stay valid (no migration) (#258)

- SKILL.md is goal / rail / Done-when per mode (2026-09 skill-lightening, #396–#399): state a rule once, name the script that enforces it, keep hard constraints only for shared or irreversible state. Re-add prose only when a conformance run shows a repeated mistake (`docs/conformance/`), never for an anticipated risk.
- Eval prompts live in `tests/evals/`, never in SKILL.md — the 2026-09-12 run showed an in-file Eval Prompts section is a self-contaminating answer key.
- Cross-family review at batch boundaries (read-only `codex exec -m gpt-6-astra` on the cumulative diff) found three contradictions repetition had hidden; cheaper than per-PR review and worth keeping for prose waves.
- Keep test for any surface (2026-09 subtraction wave, epic #420): (1) guards shared/irreversible state, (2) deterministic check the model cannot cheaply redo, (3) wire contract another tool consumes. Fails all three → delete, do not rewrite. A reviewer defending a deleted doc as a "consumed contract" must show the consumer reading the doc; dev-relay consumes the sprint-state JSON, never a reference file.
- A new tracker adapter needs a measured consumer (charter rev 18): its CLI installed and in use on a maintainer machine, or a maintainer repo pinning the key. `files` qualifies; `gitlab` was parked at `a8ddb7d`.
- Conformance harness recipe: `docs/conformance/2026-09-17-tracker-wave.md` (12 scenarios, prompt builder strips Expected). `codex exec` outside a git repo needs `--skip-git-repo-check`; prompt on stdin with `-`, final answer via `-o`; Astra token counts are on stderr. Fresh-session Fable runs are general-purpose subagents with one Read of the prompt file. A repeated PARTIAL earns either one clause in SKILL.md (#431) or an eval-side Expected relaxation, never both.

## Known Gotchas

- Live GitHub work re-reads the Issue with `gh issue view --json body,comments` when it changes. There is no local fallback copy of Issue state.
- Backlog triage reads issues via `gh`; comment history and merged closing PRs are fetched when a judgment needs them, not as a snapshot-enrichment pass.
- Relationship edges in the triage report are advisory context. A `merged-pr-link` mention is evidence, not a close by itself — close still needs an Obsolete Candidate plus an accepted apply checkbox.
- Backlog triage reports must protect issues referenced in the active sprint Plan or Running Context from close / close-duplicate proposals.
- `gh issue create` does not support `--json`; a `create --json ... || create -b "fallback"` chain fails the first call at flag parsing and posts the fallback placeholder as the real issue body (BACK-243 incident, 2026-07-05). Capture the URL from stdout instead.
- Reassess signal counting is date-granular: sprints closed on the same day as (or after) the latest `.dev-backlog/triage/YYYY-MM-DD-reassess.md` all count, so several small same-day closes can re-trigger the recommendation right after a reassess (observed 2026-07-04). Judgment call at close time; tune the threshold/rule if it keeps nagging (PRD listed thresholds as dogfood-tunable).
- `references/spec-fallback.md` is consumption-side only, ~1 page hard cap: it says how dev-backlog/backlog-triage BEHAVE when the spec axis is thin/absent, never authors spec semantics (that lives in craftkit). Guard against it drifting into a second spec-axis authority — that was the 2026-06/07 silent-fork failure mode (#253)
- Smoke flake (not a regression): the live-repo `status: shows sprint name` assertion in the smoke test depends on `gh issue list` and can fail intermittently on network; re-run before assuming a change broke it. The offline cold-adopter section is deterministic (2026-07)
- v1.0.0 is reserved and is not a cleanup cut: do not delete completed sprint files.
- Never chain `gh pr merge` after a grep-filtered test run — capture `$?` from `node --test` and the smoke test first. A backtick inside a JS template literal in `backlog-doctor.js` reached main for one commit this way (2026-09-17, #435).
- In-flight Plan pointer grammar (parsed by `sprint-state.js`): `→ PR #N (state)` at end of line, `[branch:name]`, `[run:id]`. Any other shape reads as unmoored and fails the live smoke assertion.
- `sprint-init.js --component` is a free track-scope string since #426 (no `spec/capabilities.md` lookup); `objectives:` is never emitted and never checked. Nothing lints `spec/` any more; O4 drift detection is the `backlog-triage` Alignment section.
- #366 (GitHub resilience) closed 2026-08-22 without a matrix. #367 (fresh-session conformance cadence) runs per release tag and at reassess boundaries; latest run `docs/conformance/2026-09-12-skill-lightening.md`.
