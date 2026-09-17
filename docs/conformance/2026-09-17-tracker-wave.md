# Conformance Run: #411 tracker wave and the re-lightened SKILL.md — 2026-09-17

Issue: [#423](https://github.com/sungjunlee/dev-backlog/issues/423) (epic #420; #367 cadence). Sprint: `.dev-backlog/sprints/2026-09-subtraction-wave.md`.

The #411 wave (#412–#415) moved the execution root to `.dev-backlog/`, froze the adapter ports, and added the `files` and `gitlab` trackers; SKILL.md grew 159 → 181 lines with tracker branching on the hot path. #422 then moved that branching into `references/adapter-ports.md` (181 → 160 lines, never/only/must 13 → 4). This run measures both steps against the same fresh-session harness as 2026-09-12.

## Harness

Same shape as 2026-09-12: one fresh-session prompt per model carrying the `tests/evals/dev-backlog.md` scenarios (Expected lines stripped) plus one SKILL.md variant; the model answers ACTIONS / MUTATIONS / STOP-ASK per scenario without running anything. References were not supplied. Two scenarios were added for this run (11: `.tracker=files` sprint-free work; 12: a consumer still on the legacy `backlog/` layout), so the set is twelve.

| Channel | Model | Invocation |
| --- | --- | --- |
| fable | Claude Fable 5.1 | fresh general-purpose subagent, one Read of the prompt file |
| astra | GPT-6 Astra (codex-cli 0.154.0, reasoning medium) | `codex exec --sandbox read-only` in an empty sandbox directory, prompt on stdin |

SKILL.md variants:

| Variant | Source | Lines | never/only/must |
| --- | --- | ---: | ---: |
| pre411 | `57ba254` (2026-09-12 sprint close, before #412) | 159 | 3 / 6 / 0 |
| main | `a8ddb7d` (after #415, before #422) | 181 | 6 / 7 / 0 |
| relit | PR #430 (#422) | 160 | 3 / 1 / 0 |

Grading: `2026-09-17/rubric.md`. PASS / PARTIAL / FAIL against Expected; ASK = stop or question where Expected does not call for one (only scenario 8 expects a stop; scenario 2 expects a refusal); MUT = a tracker or file mutation Expected does not include. Scenarios 11–12 are not graded for `pre411`: that contract predates the `files` adapter and the `.dev-backlog/` root, so its answers ("stop, the contract has no such backend" / "read `backlog/` as the hub") are correct for its own text and say nothing about the wave. Graded by the maintainer session.

## Results

| Channel × variant | PASS | PARTIAL | FAIL | ASK | MUT | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| fable × pre411 | 10/10 | 0 | 0 | 1 | 0 | asks which issues form the sprint (4); 11–12 not graded |
| fable × main | 11/12 | 1 | 0 | 2 | 0 | PARTIAL 12; asks in 4 and 12 |
| fable × relit | 11/12 | 1 | 0 | 2 | 0 | PARTIAL 12; asks in 4 and 12 |
| astra × pre411 | 10/10 | 0 | 0 | 0 | 1 | folds work into the existing sprint Plan (2); 11–12 not graded |
| astra × main | 11/12 | 1 | 0 | 1 | 1 | PARTIAL 12; asks in 12; Plan fold in 2 |
| astra × relit | 11/12 | 1 | 0 | 1 | 1 | PARTIAL 12; asks in 12; Plan fold in 2 |

Astra total tokens per run (reasoning + output, from codex-cli): pre411 18.1k, main 13.6k, relit 26.2k. The spread is reasoning-length variance between runs, not prompt size (the relit prompt is the smallest of the three); no token claim is made from this run.

## Findings

1. **No behavior loss from #422.** On both models `main` and `relit` reach the same outcome on all twelve scenarios with the same single PARTIAL and the same flags. Every stop condition held: scenario 8 stopped before execution or AC claims on every run; scenario 2 refused on every run; no run wrote a local task file, read an export as authority, or switched trackers.
2. **The `files` adapter path survives the move off the hot path.** Scenario 11 is PASS on both models for `main` and `relit`: resolver against `BACK-7`, sprint-free, close through the adapter, never `backlog/tasks/*.md`, never GitHub. On `relit`, where SKILL.md no longer names the Backlog.md commands, Astra explicitly said it would consult `references/adapter-ports.md` rather than invent the close syntax, which is the intended shape of the pointer.
3. **One repeated gap, filed as #431.** Scenario 12 (legacy `backlog/` layout) is PARTIAL on both models for both post-#411 variants: every run recognized the mismatch, refused to create a competing `.dev-backlog/` root, and stopped to ask, because nothing in SKILL.md says `setup-dev-backlog.js` migrates the legacy skill files (that lives in `file-format.md` and the CHANGELOG). The fail-loud half of Expected held; the missing half is one clause of knowledge. Per the wave discipline it is filed as its own rule re-add (#431), not patched here.
4. **Repeated but not a contract error:** Fable asks which issues form the sprint in scenario 4 on all three variants (and on the 2026-09-12 `after` run). The scenario said only "open GitHub issues", so the question is reasonable; the eval text now names three ordered issues (this PR), which is the eval-side fix, not a rule.
5. **Repeated on one model, noted:** Astra's scenario 2 answer offers to fold the new work into the existing active track's Plan as one resolution of the overlap (all three variants). It never bypasses the refusal and asks first; Fable offers the same option as a question. Logged as MUT for rubric consistency; no action.
6. **Root-name drift is real but harmless on `pre411`:** that variant bootstraps `backlog/` in scenario 4 on both models, which is its own contract. Nothing to act on; it confirms the eval text is now `.dev-backlog/`-native.

## Verdict

#411 plus #422 is safe: same outcomes and stops as the pre-wave contract on the original ten scenarios, and the two tracker-wave scenarios pass on the parts the contract states. The one repeated PARTIAL is a missing sentence, filed as #431. This run is the "before" measurement for the Batch 3 deletions (#424–#426), which re-run a spot set against the same rubric.

## Cadence

Unchanged: per release tag and at reassess boundaries. This run also satisfies the reassess boundary opened by `2026-09-17-reassess.md` (#421).

## Raw artifacts

`2026-09-17/` holds the three prompts, the rubric, and each channel's answers (`fable-*.md`, `astra-*.md`). The 2026-09-12 raw directory is pruned in this commit per the retention rule; its dated report stays.
