# Project Context

## Architecture Decisions

- GitHub Issues are the source of truth; `.dev-backlog/` is the execution layer
- Script interfaces should stay stable unless an issue explicitly changes the CLI contract
- GitHub-only since v0.12.0 (#445): the `files` adapter, the frozen adapter ports, and `.dev-backlog/.tracker` are parked at tag `v0.11.0`. No tracker abstraction, no adapter layer, no selection step; a leftover `.tracker` is ignored, never deleted. Re-admitting any of it needs a measured consumer, not an installed CLI.
- Plan refs are `#N` and nothing else. The one parser is `parseIssueRef` / `parsePlanCheckbox` in `scripts/lib.js`; `lib.sh` mirrors it as `RE_ISSUE_REF` for the shell rails. The wire identity dev-relay reads stays `{ tracker: "github", id, ref, issue_number }`.
- Milestones, PR relationships, comments, and closing semantics are plain `gh` calls the session (or one small bash guard in `sprint-close.sh`) makes. (Mirrors and progress issues were removed by #340/#347.)
- Setup re-runs preserve user-authored configuration and task bytes; `config.yml` is neither read nor written by this skill.
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
- Tracker generality is a charter Non-Goal (rev 19): do not re-add an adapter, a port contract, or a selection file. `gitlab` was parked at `a8ddb7d`; `files` and the ports at `v0.11.0`.
- Conformance harness recipe: `docs/conformance/2026-09-17-tracker-wave.md` (12 scenarios, prompt builder strips Expected). `codex exec` outside a git repo needs `--skip-git-repo-check`; prompt on stdin with `-`, final answer via `-o`; Astra token counts are on stderr. Fresh-session Fable runs are general-purpose subagents with one Read of the prompt file. A repeated PARTIAL earns either one clause in SKILL.md (#431) or an eval-side Expected relaxation, never both.
- The four surfaces scripts still own (charter rev 19 Non-Goal "Wrapping gh", epic #440): the sprint-file contract, fail-loud shared-state guards (overlap, unmoored `[~]`, `status: completed`), the `sprint-state` JSON dev-relay consumes, and the `triage-apply` human gate. Anything else that wraps `gh` is deleted, not rewritten. Verify the wire contract with `RELAY_DEV_BACKLOG_ROOT=<checkout> node --test --test-concurrency=1 tests/*/scripts/*.test.js` in `../dev-relay` (two `relay-dispatch` timing flakes are pre-existing).
- The Work rail is `gh issue view N --json body,comments` (#443): newest `## Agent Brief` comment over body, `spec_ref:` line in the body over both, fail-closed on a failed read. The former task-spec resolver script is parked at `v0.11.0`.
- The backlog-triage report is written by the session (44-line SKILL.md, #433). The scripts-less variant was proven on a 15-issue fixture A/B before deletion (`docs/conformance/2026-09-17-cc/433/`); repeat that shape — fixture, A render, B session report, checker on close set / protection / exclusions / anchors — before deleting any other judgment script.

## Known Gotchas

- Live GitHub work re-reads the Issue with `gh issue view --json body,comments` when it changes. There is no local fallback copy of Issue state.
- Backlog triage reads issues via `gh`; comment history and merged closing PRs are fetched when a judgment needs them, not as a snapshot-enrichment pass.
- Relationship edges in the triage report are advisory context. A `merged-pr-link` mention is evidence, not a close by itself — close still needs an Obsolete Candidate plus an accepted apply checkbox.
- Backlog triage reports must protect issues referenced in the active sprint Plan or Running Context from close / close-duplicate proposals.
- `gh issue create` does not support `--json`; a `create --json ... || create -b "fallback"` chain fails the first call at flag parsing and posts the fallback placeholder as the real issue body (BACK-243 incident, 2026-07-05). Capture the URL from stdout instead.
- `references/spec-fallback.md` is consumption-side only, ~1 page hard cap: it says how dev-backlog/backlog-triage BEHAVE when the spec axis is thin/absent, never authors spec semantics (that lives in craftkit). Guard against it drifting into a second spec-axis authority — that was the 2026-06/07 silent-fork failure mode (#253)
- The smoke test is fully offline since #445: `status.sh` no longer lists Issues and `sprint-init.js` no longer reads milestones, so a smoke failure is a real regression, not a network flake.
- v1.0.0 is reserved and is not a cleanup cut: do not delete completed sprint files.
- Never chain `gh pr merge` after a grep-filtered test run — capture `$?` from `node --test` and the smoke test first. A backtick inside a JS template literal in `backlog-doctor.js` reached main for one commit this way (2026-09-17, #435).
- In-flight Plan pointer grammar (parsed by `sprint-state.js`): `→ PR #N (state)` at end of line, `[branch:name]`, `[run:id]`. Any other shape reads as unmoored and fails the live smoke assertion.
- `sprint-init.js --component` is a free track-scope string since #426 (no `spec/capabilities.md` lookup); `objectives:` is never emitted and never checked. Nothing lints `spec/` any more; O4 drift detection is the `backlog-triage` Alignment section.
- #366 (GitHub resilience) closed 2026-08-22 without a matrix. #367 (fresh-session conformance cadence) runs per release tag and at reassess boundaries; latest run `docs/conformance/2026-09-12-skill-lightening.md`.
- Wave 3 (v0.13.0, epic #456) re-ran the keep test with a consumer grep per surface; the shipped `skills/dev-backlog/scripts/` inventory is 2,255 lines / 11 files, and the repo-only helpers (the doc-drift lint and the bash locator) live in `tests/tools/`, not in the bundle — naming them by filename in this file trips the drift check. Count files with `ls | wc -l` before quoting a number: the v0.12.0 close-out miscounted 13 as 14.
- When a flag is deleted, reject it explicitly rather than ignore it: Astra caught `sprint-init.js` silently turning a former `--dry-run` call into a real write (#457). The rejection test is a guard on irreversible state, not a rewrite of the retired surface.
- Cross-family reviewers grade against the issue's literal acceptance numbers; when an estimate (≤ 100 lines) is beaten by the "cut, don't refactor" rule, amend the acceptance on the issue and record the override on the PR instead of trimming to hit the number.
