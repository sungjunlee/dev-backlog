# Conformance Run: core-competence scripts wave — 2026-09-17

Epic [#440](https://github.com/sungjunlee/dev-backlog/issues/440). Sprint: `.dev-backlog/sprints/2026-09-core-competence-scripts.md`. Baseline: `2026-09-17-tracker-wave.md` § After Batch 3 (v0.11.0 SKILL.md, 12/12 on both models).

Same harness as the tracker-wave run: one fresh-session prompt per model with the twelve `tests/evals/dev-backlog.md` scenarios (Expected stripped) plus the SKILL.md under test; Fable 5.1 as a fresh general-purpose subagent, GPT-6 Astra via `codex exec --sandbox read-only` (reasoning medium). Rubric: `2026-09-17-cc/rubric.md` (the tracker-wave rubric with the #431 scenario-12 reading; eval Expected lines are revised in the PR that deletes the script they named). Graded by the maintainer session.

## Batch 1 (#441 test infra out, #442 charter rev 19)

No run: SKILL.md is byte-identical to the baseline.

## Batch 2 (#444 diagnostic export deleted, #443 effective-task-spec.js deleted)

SKILL.md from PR #451 (158 lines / never-only-must 5): the Work rail is `gh issue view N --json body,comments` with the one-clause precedence (newest `## Agent Brief` over body, `spec_ref:` over both) and a fail-closed boundary.

| Channel × variant | PASS | PARTIAL | FAIL | ASK | MUT | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| fable × batch2 | 12/12 | 0 | 0 | 0 | 0 | 6/7/10 read with `gh issue view`, apply the precedence, verify each AC, stop on a failed read; 12 migrates via setup and confirms first |
| astra × batch2 | 12/12 | 0 | 0 | 0 | 1 | same; Plan fold offered in 2 (every Astra run) |

No new PARTIAL or FAIL against the baseline; every stop held (8 fail-closed on both models, no local copy as authority); no run named the deleted resolver or the export. Scenario 11 still describes the `files` adapter and passes on the pre-#445 contract; it retires with #445. Raw: `2026-09-17-cc/fable-batch2.md`, `astra-batch2.md`, `prompt-batch2.md`. Astra tokens (stderr): 18.4k.

## Batch 4 (#433 backlog-triage pipeline deleted)

Real-execution A/B on a 15-issue fixture (`docs/conformance/2026-09-17-cc/433/`). Variant A is `triage-report.js` over a snapshot with `--active-sprint`; variant B is the 33-line scripts-less SKILL.md given the same data as the `gh` outputs it names, one fresh session per model.

Both Claude Fable 5.1 and GPT-6 Astra produced the eight sections in order, never closed protected sprint issues 603/612, ignored code-fence/URL/self-mention evidence, kept edge direction (601 blocks 602; 602 depends-on 601), and emitted anchors that parse in `triage-apply.js`. Close sets matched the deterministic signals (604/606/607/608); Astra conservatively proposed `revisit` for inactive #604, and Fable added a judgment `close-duplicate` A cannot make.

Decision: delete `triage-collect.js`, `triage-relate.js`, `triage-stale.js`, `triage-report.js`, and `triage-github.js`; keep `triage-apply.js`. Artifacts: `DECISION.md`, `report-A-scripts.md`, `report-B-fable.md`, `report-B-astra.md`.
