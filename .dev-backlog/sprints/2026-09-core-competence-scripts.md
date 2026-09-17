---
milestone: 2026-09 core-competence scripts
status: active
started: 2026-09-17
due: TBD
scope: ["skills/**", "spec/**", "tests/**", "docs/**", ".github/**", "README.md", "CLAUDE.md"]
---

# core-competence-scripts

## Goal
dev-backlog and backlog-triage scripts shrink to the four surfaces that beat `gh` plus file reads (sprint-file contract, fail-loud shared-state guards, `sprint-state` JSON for dev-relay, `triage-apply` human gate); GitHub-only, no adapters, no export; every deletion measured before/after; v0.12.0.

## Plan
### Batch 1 - Test infra out, spec rev 19 (parallel-safe: #441 scripts/tests/CI, #442 spec/)
- [x] #441 Move test infrastructure out of the skill bundle; delete context-hook.sh and init.sh (~1h) → PR #449 (merged)
- [x] #442 Charter rev 19: GitHub-only (files parked), diagnostic export deleted, reassess-signal bookkeeping retired (~1h) → PR #448 (merged)

### Batch 2 - Delete the gh wrappers (parallel-safe: #443 effective-task-spec + Work rail, #444 sync-pull/legacy)
- [x] #443 Delete effective-task-spec.js; the Work rail reads the Issue with gh (~2h) → PR #451 (merged)
- [x] #444 Delete sync-pull.js and legacy-tracker.js (diagnostic export) — G2 (~1h) → PR #450 (merged)

### Batch 3 - Tracker abstraction out (sequential: #446 needs #445)
- [~] #445 Park the files adapter and delete the tracker abstraction; GitHub-only rails — G1 (~4h) [run:opus-445]
- [ ] #446 Shrink backlog-doctor.js and setup-dev-backlog.js to the surviving checks (~2h)

### Batch 4 - Triage pipeline decision
- [x] #433 backlog-triage: fixture-backed real A/B, then delete collect/relate/stale/report; keep triage-apply.js (~3h) → PR #452 (merged)

### Batch 5 - Release
- [ ] #447 Cut v0.12.0 with the measured state (~1h)

## Running Context
- Keep test unchanged from the 2026-09 subtraction wave: shared/irreversible-state guard, deterministic check the model cannot cheaply redo, or a consumed wire contract. Only `sprint-state` JSON has a consumer (dev-relay, 19 references); verify a reviewer's "consumed contract" claim by grepping the consumer.
- G1 (park `files`, GitHub-only) and G2 (delete the export) were approved 2026-09-17 ("권장대로 진행"); #442 records the gate date. Retrieval point for everything parked: tag `v0.11.0`.
- Before/after conformance per deletion batch on Fable 5.1 (fresh subagent) and GPT-6 Astra (`codex exec --skip-git-repo-check --sandbox read-only`, prompt on stdin, `-o` for the answer). Baseline = the 2026-09-17 tracker-wave § After Batch 3 run. Eval Expected lines that name deleted scripts are revised in the same PR that deletes them.
- Cross-family review at each batch boundary: Astra via codex for Opus/Grok-implemented PRs, Sol via codex for session-implemented ones; cursor-agent only for Grok.
- Check `$?` of `node --test` and `smoke-test.sh` before any `gh pr merge`; CI is required, so use `--auto`.
- dev-relay consumer check for #445: run dev-relay's tests against this checkout's `sprint-state.js` before merge.

## Progress
- 2026-09-17: Sprint opened. Epic #440, milestone 24, issues #441–#447 plus #433 (moved in). Starting point v0.11.0 `31ef26b`: dev-backlog scripts 8,234 (1,890 test infra), backlog-triage 3,359, tests 9,738.
- 2026-09-17: Batch 1 done (#442 PR #448 charter rev 19; #441 PR #449, scripts 8,234 → 6,243, no hot-path change so no run). Batch 2 runs sequentially (#444 then #443) because both edit SKILL.md/file-format/README/evals.
- 2026-09-17: Batch 2 done (#444 PR #450 −2,004; #443 PR #451 −1,280). After-run 12/12 both models (`docs/conformance/2026-09-17-core-competence.md`). #445 dispatched to Opus.
- 2026-09-17: #433 real A/B done on a 15-issue fixture: variant B equivalent to the script pipeline on both models (Astra chose `revisit` over `close` for one merely-inactive issue). Deletion dispatched to Grok in parallel with #445 (disjoint files).
- 2026-09-17: Batch 4 done: #433 merged (PR #452, −5,384; backlog-triage scripts 3,359 → ~1,000, SKILL.md 116 → 44). After-run 7/7 both models. Waiting on #445 (Opus) for Batch 3.
