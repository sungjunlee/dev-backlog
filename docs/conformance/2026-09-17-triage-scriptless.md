# Conformance Run: backlog-triage scripts-less experiment — 2026-09-17

Issue: [#427](https://github.com/sungjunlee/dev-backlog/issues/427) (epic #420; closes the last open item of #367). Sprint: `.dev-backlog/sprints/2026-09-subtraction-wave.md`.

Question: does a ≤ 40-line `backlog-triage` SKILL.md that says "read issues with `gh`, write the fixed report shape, emit anchors for apply" reach the same outcome as the current SKILL.md plus the collect / relate / stale / report scripts? The keep test says a script survives only as a guard on shared state, a deterministic check the model cannot cheaply redo, or a consumed wire contract. `triage-apply.js` is the human gate and passes; the other four recompute judgments the model can make from `gh issue list --json`. Do not delete on principle; measure.

## Harness

Same fresh-session, plan-level shape as the dev-backlog runs: one prompt per model carrying the seven `tests/evals/backlog-triage.md` scenarios (Expected stripped) plus one SKILL.md variant; the model answers ACTIONS / OUTPUT / MUTATIONS / STOP-ASK per scenario, including one example anchor line, without running anything. References were not supplied to either variant.

| Channel | Model | Invocation |
| --- | --- | --- |
| fable | Claude Fable 5.1 | fresh general-purpose subagent, one Read of the prompt file |
| astra | GPT-6 Astra (codex-cli 0.154.0, reasoning medium) | `codex exec --sandbox read-only` in an empty sandbox, prompt on stdin |

Variants:

| Variant | Source | Lines |
| --- | --- | ---: |
| A | `skills/backlog-triage/SKILL.md` at main (`6724a0f`) + its scripts | 116 |
| B | `2026-09-17-triage/skill-B.md`: `gh` reads, fixed eight-section shape, verb list, anchor grammar, active-sprint boundary, `triage-apply.js` kept | 33 |

Grading: `2026-09-17-triage/rubric.md`. Report scenarios are graded on the four equivalence criteria from the issue (sections, active-sprint protection, edge direction, anchor validity); apply scenarios on the shared `triage-apply.js` semantics. Graded by the maintainer session.

## Results

| Channel × variant | PASS | PARTIAL | FAIL | Notes |
| --- | ---: | ---: | ---: | --- |
| fable × A | 7/7 | 0 | 0 | scripts named per step; valid anchor pairs in 1–3 |
| fable × B | 7/7 | 0 | 0 | derives stale/relationship signals from `gh` JSON; `revisit` not `close` for the in-flight issue in 3; states edge direction (`#12 blocks #15`) |
| astra × A | 7/7 | 0 | 0 | valid anchor pairs; explicit active-sprint exclusion in 3 |
| astra × B | 7/7 | 0 | 0 | anchors given without the paired checkbox line in the example (the OUTPUT prose states the pairing); `revisit` for the in-flight issue in 3 |

Astra total tokens per run (codex-cli stderr, not committed): A 25.6k, B 11.3k.

Grading notes. No run proposed a GitHub mutation in report mode; every apply answer skipped the unchecked anchor (4), deduped once (5), stayed dry-run without `--apply` (6), and logged `already-applied` on re-run (7). Edge direction was demonstrated only by fable × B; the other three answers state the rule without an example, which the scenarios do not require — it is a gap in the eval set, not in either variant. Astra × B's example anchors omit the checkbox line the prompt asked for; the same answer states that every proposal pairs an anchor with an unchecked checkbox, so this is graded PASS with the omission noted.

## Findings

1. **Plan-level equivalence holds.** On both models, variant B reaches the same outcome as variant A on all seven scenarios: same eight sections in the same order, no close against an issue named in the active sprint, valid anchors, identical apply semantics. Nothing in B's answers depended on a script that B does not have.
2. **B derives the deterministic signals A computes.** Both models on B stated stale as "inactive past the configured threshold with no milestone" plus `wontfix`/`invalid`/merged-closing-PR, and relationships from `#N` mentions, dependency phrases, comments, and merged PRs — the same signal set `triage-relate.js` and `triage-stale.js` implement. Fable × B additionally said it would name any signal it could not derive rather than invent it.
3. **B is cheaper on the hot path.** Astra spent 56% fewer tokens on B for the same answers; the B prompt is 56 lines against A's 139.
4. **Limits of this evidence.** This is plan-level. It shows the contract is understood without the scripts, not that a real B report on a real repo matches a real A render (mention parsing outside code fences, URL-fragment noise, comment hydration, snapshot reproducibility are things the scripts get right mechanically). The deletion issue therefore starts with one real-execution A/B on this repo.
5. **Not repeated, not acted on:** both Astra answers hedge scenario 5 on "existing authorization"; Fable × A would "flag" inconsistent checkbox pairs. Neither changes the outcome.

## Decision

B is equivalent at plan level on both models. Per the issue: the deletion is filed as a follow-up under the epic — [#433](https://github.com/sungjunlee/dev-backlog/issues/433) — gated on one real-execution A/B before the scripts go. `triage-apply.js` stays. This closes the remaining #367 item (backlog-triage scenarios cross-model).

## Raw artifacts

`2026-09-17-triage/` holds the two prompts, `skill-B.md`, the rubric, and each channel's answers (`fable-*.md`, `astra-*.md`). Retention follows `docs/conformance/README.md`.
