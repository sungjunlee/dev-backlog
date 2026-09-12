# Conformance Run: skill-lightening wave, before vs after — 2026-09-12

Issue: [#401](https://github.com/sungjunlee/dev-backlog/issues/401) (part of #367). Sprint: `backlog/sprints/2026-09-skill-lightening.md`.

The wave (#396–#399) changed prose only: SKILL.md 225 → 159 lines, `never` / `only` / `must` 11 / 21 / 6 → 3 / 6 / 0. This run measures whether the lighter contract changes what a fresh session does.

## Harness

Plan-level conformance, same shape as the 2026-08-16 run: each model receives one fresh-session prompt containing the ten `tests/evals/dev-backlog.md` scenarios (Expected lines stripped) plus one SKILL.md variant, and answers ACTIONS / MUTATIONS / STOP-ASK per scenario without running anything. No fixture repo; this measures the hot-path contract, not execution. References were not supplied.

| Channel | Model | Invocation |
| --- | --- | --- |
| fable | Claude Fable 5.1 | fresh general-purpose subagent, one Read of the prompt file |
| astra | GPT-6 Astra (codex-cli 0.153.0, reasoning medium) | `codex exec` in an empty sandbox directory |

SKILL.md variants:

| Variant | Source | Lines | Prompt size (est. tokens) |
| --- | --- | ---: | ---: |
| before | git tag `pre-skill-lightening` (d6f5650) | 225 | ~4.6k |
| before-noeval | same, with the `## Eval Prompts` section removed | 209 | ~3.9k |
| after | main after #406 (this PR adds the #408 one-liner) | 159–162 | ~2.9k |

`before-noeval` exists because the pre-wave SKILL.md carried the eval answer key inside itself: its `## Eval Prompts` section contained every Expected line verbatim. A `before` score is therefore contaminated and only `before-noeval` vs `after` is a fair comparison.

Grading: `2026-09-12/rubric.md`. PASS / PARTIAL / FAIL against Expected; ASK = unconditional stop or question where Expected does not call for one (only scenario 8 expects a stop); MUT = a GitHub or file mutation Expected does not include. Graded by the maintainer session.

## Results

| Channel × variant | PASS | PARTIAL | FAIL | ASK | MUT | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| fable × before | 10 | 0 | 0 | 0 | 0 | contaminated (answer key in prompt) |
| fable × before-noeval | 8 | 2 | 0 | 0 | 0 | PARTIAL on 3, 7 |
| fable × after | 8 | 2 | 0 | 1 | 0 | PARTIAL on 3, 7; asks which issues form the sprint in 4 |
| astra × before | 10 | 0 | 0 | 0 | 1 | contaminated; bootstraps `backlog/` in 5 |
| astra × before-noeval | 8 | 2 | 0 | 0 | 1 | PARTIAL on 3, 7; bootstraps `backlog/` in 5 |
| astra × after | 8 | 2 | 0 | 0 | 1 | PARTIAL on 3, 7; bootstraps `backlog/` in 5 |

Astra total tokens per run (reasoning + output, from codex-cli): before 29.5k, before-noeval 28.9k, after 27.9k.

## Findings

1. **No behavior loss.** On both models, `before-noeval` and `after` reach the same outcome on all ten scenarios, with the same two PARTIALs. Every stop condition held: scenario 8 (no GitHub access) stopped before execution or AC claims on every run; scenario 2 (overlapping track) refused on every run; nobody wrote a local task file or read a legacy export.
2. **The "before" advantage was the answer key.** The only runs scoring 10/10 are the ones whose SKILL.md contained the Expected lines. Moving Eval Prompts out (#396) removed a cheat sheet from the hot path, not a contract.
3. **Two PARTIALs are over-specified expectations, not model mistakes** (all four uncontaminated runs, both models): scenario 3 expects `backlog-doctor` to run during orient; scenario 7 expects the model to state that `spec_ref` wins. Every model instead runs the scripts that own those behaviors. Filed as #407 (eval-side fix), no rule re-added.
4. **One repeated over-eager instruction, fixed:** Astra bootstrapped `backlog/` for a single self-contained Issue in all three variants because SKILL.md opened with an unconditional "If `backlog/` does not exist, run setup". Moved into the Plan rail (#408, this PR). This is the wave's rule-change discipline working in the other direction: a repeated observation earned a prose change.
5. **Not repeated, not acted on:** Fable × after asked which issues form the sprint in scenario 4 (one run, one model). Astra answered in Korean on every run despite an English prompt; the content was in scope, so this is a harness note (a global Codex instruction, not the skill).

## Verdict

The lightened SKILL.md is safe to keep: same outcomes, same stops, ~37% smaller hot-path prompt on both models. Cross-family review during the wave (GPT-6 Astra, read-only `codex exec`, on PRs #405 and #406) found three pre-existing contradictions that repetition had hidden — sprint-free work vs "Plan checked", the omitted `## Agent Brief` precedence, and the `gh` vs adapter create route — which is the concrete cost of over-specification this run was meant to surface.

## Cadence

Unchanged from 2026-08-16: per release tag and at reassess boundaries. Next run should use the #407-revised expectations and may add the seven `tests/evals/backlog-triage.md` scenarios.

## Raw artifacts

`2026-09-12/` holds the three prompts, the rubric, and each channel's answers (`fable-*.md`, `astra-*.md`). The 2026-08-16 raw directory is pruned in this commit per the retention rule; its dated report stays.
