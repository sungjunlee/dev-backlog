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

Grading: `2026-09-17-triage/rubric.md`. Report scenarios are graded on three of the four equivalence criteria from the issue (sections, active-sprint protection, anchor validity); edge direction is ungraded because no scenario in `tests/evals/backlog-triage.md` exercises it. Apply scenarios are graded on the shared `triage-apply.js` semantics. Graded by the maintainer session; a GPT-5.6 Sol read-only review of this PR pushed the edge-direction criterion out of the graded set and the stale-signal correction below.

## Results

| Channel × variant | PASS | PARTIAL | FAIL | Notes |
| --- | ---: | ---: | ---: | --- |
| fable × A | 7/7 | 0 | 0 | scripts named per step; valid anchor pairs in 1–3 |
| fable × B | 7/7 | 0 | 0 | derives stale/relationship signals from `gh` JSON; `revisit` not `close` for the in-flight issue in 3; the only answer that demonstrates edge direction (`#12 blocks #15`) |
| astra × A | 7/7 | 0 | 0 | valid anchor pairs; explicit active-sprint exclusion in 3 |
| astra × B | 7/7 | 0 | 0 | example anchors given without the paired checkbox line (the OUTPUT prose states the pairing); `revisit` for the in-flight issue in 3 |

Astra total tokens per run (codex-cli stderr, not committed): A 25.6k, B 11.3k.

Grading notes. No run proposed a GitHub mutation in report mode; every apply answer skipped the unchecked anchor (4), deduped once (5), stayed dry-run without `--apply` (6), and logged `already-applied` on re-run (7). Edge direction was demonstrated only by fable × B; the other three answers mention relationship evidence without stating direction, and since no scenario asks for it the criterion is ungraded here (a gap in the eval set, carried into #433). The prompt asked for one example anchor line; Astra × B gave the anchor without the checkbox line and states the pairing in prose, so it is graded PASS with the omission noted.

## Findings

1. **Plan-level equivalence holds.** On both models, variant B reaches the same outcome as variant A on all seven scenarios: same eight sections in the same order, no close against an issue named in the active sprint, valid anchors, identical apply semantics. Nothing in B's answers depended on a script that B does not have.
2. **B derives most of the deterministic signals A computes, not all.** Both models on B stated stale as "inactive past the configured threshold with no milestone" and relationships from `#N` mentions, dependency phrases, comments, and merged closing PRs — the signal set `triage-relate.js` implements. Neither B answer mentioned the `wontfix` / `invalid` label signals that `triage-stale.js` emits and that `skill-B.md` lists; both A answers named labels. This is the one signal the scripts-less contract lost at plan level and is a named check for the real-execution A/B. Fable × B additionally said it would name any signal it could not derive rather than invent it.
3. **B is cheaper on the hot path.** Astra spent 56% fewer tokens on B (codex-cli stderr, not committed) for answers that reach the same graded outcome; the B prompt is 56 lines against A's 139.
4. **Limits of this evidence.** This is plan-level: it shows the contract is understood without the scripts, not that a real B report on a real repo matches a real A render. Things the scripts get right mechanically and this run cannot see: mention parsing outside code fences and URL fragments, comment hydration and pagination, label / date / duplicate obsolescence, dependency direction, absent charter tiers, snapshot reproducibility, quoted-anchor parsing and arg normalization. Scenario 2 is also script-shaped ("snapshot", `--relate`, `--stale`); both B answers reinterpreted it as "derive from the issue JSON", which is the intended B behavior but not a literal match. The deletion issue therefore starts with a fixture-backed A/B, not one ordinary run.
5. **Not repeated, not acted on:** both Astra answers hedge scenario 5 on "existing authorization"; Fable × A would "flag" inconsistent checkbox pairs. Neither changes the outcome.

## Decision

B reaches the same graded outcome as A at plan level on both models, with one lost signal (label-based obsolescence) and one ungraded criterion (edge direction). Per the issue: the deletion is filed as a follow-up under the epic — [#433](https://github.com/sungjunlee/dev-backlog/issues/433) — gated on a fixture-backed real-execution A/B covering the items in finding 4 before the scripts go. `triage-apply.js` stays. This closes the remaining #367 item (backlog-triage scenarios cross-model).

## Raw artifacts

`2026-09-17-triage/` holds the two prompts, `skill-B.md`, the rubric, and each channel's answers (`fable-*.md`, `astra-*.md`). Retention follows `docs/conformance/README.md`.
