# Conformance Run: triage model-actions — 2026-08-16

Issue: [#367](https://github.com/sungjunlee/dev-backlog/issues/367)

First cross-model conformance run for the prompt-judged triage step that #358
moved out of scripts. Each model received the identical fresh-session prompt
(`2026-08-16/eval-prompt.md`: the SKILL.md model-actions contract, repo context, and
the frozen 2026-08-16 open-issue snapshot, 14 issues) and produced a
`--model-actions` JSON array. Outputs were scored two ways: the deterministic
wire validator (`triage-report.js --model-actions`) and a judgment comparison
against the accepted 2026-08-16 triage report (`backlog/triage/2026-08-16-report.md`,
produced by Fable 5 and accepted by the user) as reference.

## Platforms

| Channel | Model | Invocation |
| --- | --- | --- |
| claude-opus | Opus (claude-opus-5) | fresh general-purpose subagent |
| claude-sonnet | Sonnet (claude-sonnet-5) | fresh general-purpose subagent |
| codex | gpt-5.6-sol (codex-cli 0.147.0, reasoning medium) | codex CLI, fresh thread |
| pi | nous-portal/deepseek/deepseek-v4-flash-0731 | `pi --print --no-session` |

## Wire conformance (deterministic validator)

| Channel | Entries | Parses as-is | Validator | Output-format compliance |
| --- | ---: | --- | --- | --- |
| claude-opus | 37 | yes | PASS | clean bare JSON |
| claude-sonnet | 23 | yes | PASS | clean bare JSON |
| codex | 26 | yes | PASS | clean bare JSON, wrote target file itself |
| pi | 26 | **no** | PASS after extraction | **violated "ONLY JSON"** — prose preamble + markdown fences; recoverable by fence-stripping |

No channel produced an invalid verb, a malformed edge kind, a dedupe-key
duplicate, or a missing required field. The #358 wire contract holds across
all four models.

## Judgment comparison

Shared core (all 4 channels agree, matching the accepted reference): the
gate edges (#361 and #364 block #350; #362/#365 depend on #350) and
priority-high on #361/#364. Nobody proposed close/close-duplicate on the
protected #350 — the active-sprint protection rule held everywhere.

Divergences, worst first:

1. **Mutual-exclusivity violation (opus, pi):** #362 and #365 are mutually
   exclusive decision branches, stated in both bodies. Opus assigned **both**
   to the same "decision bundle" milestone and simultaneously proposed
   `revisit` on each — scheduling and deferring the same issues at once. pi
   assigned both into the **existing active milestone**. Codex split them
   asymmetrically (#362 in, #365 out). Only sonnet kept both unscheduled.
2. **Active-milestone expansion (pi, codex):** pi put 8 and codex put 5 of
   the new issues into "2026-08 GitHub-native core simplification" — the
   milestone that is deliberately wait-gated on #350's decision. The
   reference treats that milestone as closed to new scope. The eval prompt
   stated the wait but did not spell out "do not add scope to it": a rubric
   gap worth closing in SKILL.md guidance rather than a pure model error.
3. **Over-clustering (all channels vs reference):** every channel
   milestone-assigned most or all 13 issues; the accepted reference assigned
   only the 3 sprint-track issues and deliberately left deferred work
   unassigned. Advisory blast radius, not a wire violation — but a consistent
   bias toward proposing more mutations than the evidence requires.
4. **Edge-direction variance:** for the reassess dependency, opus emitted
   `363 blocks 371` / `368 blocks 371` while sonnet/pi emitted
   `371 depends-on 363/368` — opposite conventions for the same fact, both
   wire-valid. The rubric does not fix a direction convention; downstream
   consumers treating `blocks` and `depends-on` as directional would read
   these inconsistently.
5. **Priority spread:** #363/#369 got `high` from opus/sonnet/codex vs
   `medium`/defer in the reference; pi rated #370 `high`. Reasonable
   disagreement territory; no channel inverted an urgency (nobody rated the
   calendar-gated #361/#364 below high).

## Verdict

- **Wire contract: robust.** 4/4 models validator-clean; the deterministic
  validation layer is doing its job as the safety net for prompt-judged
  actions.
- **Judgment quality: sonnet ≥ codex > opus > pi** on this run, dominated by
  the mutual-exclusivity and active-milestone findings. Claude-side outputs
  needed no post-processing; pi needs fence-stripping in any pipeline use.
- **Actionable rubric fixes** (follow-up candidates for SKILL.md's rubric,
  not this run): state that mutually-exclusive issues must not be
  co-scheduled; state that wait-gated/active milestones are closed to new
  scope; fix an edge-direction convention for `blocks`/`depends-on`.

## Cadence (accepted 2026-08-16, #367)

- Doc-drift check: continuous — lives in `node --test` CI since commit 31e2c7a.
- Model-actions conformance: per release tag (before cutting) and at
  reassess boundaries, results as dated files under `docs/conformance/`.
- The broader fresh-session recovery Eval Prompts in the two SKILL.md files
  remain covered by the deterministic smoke/regression suites; running them
  cross-model stays open scope under #367 for a future run.

## Raw artifacts

`2026-08-16/` holds the eval prompt and each channel's JSON (pi's after
fence-extraction; its raw stdout preserved as `pi-deepseek.raw`). The frozen
snapshot input is the committed `backlog/triage/.cache/2026-08-16T09-12-26Z.json`.
