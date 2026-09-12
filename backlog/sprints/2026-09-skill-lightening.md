---
milestone: 2026-09 skill lightening
status: active
started: 2026-09-12
due: TBD
scope: ["skills/**", "tests/**", "docs/conformance/**"]
objectives: [O10, O1]
component: ""
---

# skill-lightening

## Goal
Both SKILL.md files read as goal + done-condition + deterministic rail for Fable 5 / GPT-6 Astra, with legacy scaffolding and repeated rules gone and a before/after conformance run proving no behavior loss.

## Plan

### Batch 1 — Enablers (disjoint files)
- [x] #396 Move Eval Prompts out of SKILL.md into tests/evals (~1h) -> PR #402 merged
- [x] #400 Replace contract-prose regex pins on wording with behavior tests (~1h) -> PR #403 merged

### Batch 2 — Subtraction: legacy hot path
- [x] #397 Demote sync/legacy-tracker material from the dev-backlog SKILL.md hot path (~1h) -> PR #404 merged

### Batch 3 — Subtraction: state each rule once
- [x] #398 Dedupe spec-field omission, track overlap, and sprint admission (~2h) -> PR #405 merged

### Batch 4 — Freedom by design
- [x] #399 Reframe Execution Path as goal + Done when + rail; positive defaults (~3h) -> PR #406 merged

### Batch 5 — Measurement
- [~] #401 Before/after conformance run on Fable 5.1 and Codex (~3h) -> in progress this session (plan-level harness, no PR yet)

## Running Context
- Source: 2026-09-12 review of the official Fable 5 / Opus 5 / GPT-6 Astra prompting and skill-authoring guides. Both vendors: prior-model skills are too prescriptive; conflicting skill guidance makes Astra block early; keep explicit "done" definitions; hard constraints only for irreversible/shared mutations.
- Baseline for #401 is git tag `pre-skill-lightening` (d6f5650). Do not retag.
- Charter freeze holds: `sync-pull.js` / `legacy-tracker.js` stay; this wave only stops advertising them.
- #400 also dropped two SKILL.md wording pins from `authority-contract.test.js` (found while landing #397); prose tests now pin `## Sprint Admission` and `effective-task-spec.js` presence only.
- Cross-family review (Codex) runs once on the cumulative SKILL.md diff at the end of Batch 3 and again after Batch 4, not per PR.
- Rules re-added after the wave must cite a repeated mistake from the #401 run, not an anticipated risk.
- GPT-6 Astra review on #398 (read-only `codex exec`, cumulative diff) found three real conflicts that pre-dated the wave and were fixed in PR #405: sprint-free work vs "Plan checked, Progress updated"; prose precedence omitting the `## Agent Brief` comment the resolver honors; the pre-completion re-resolve check that had left with the Sync section. Lesson: subtraction exposes contradictions that repetition was hiding; keep the cross-family review at batch boundaries.
- Astra review #2 on #399 found the `gh` vs adapter create-route conflict and the missing `## Agent Brief` precedence in three references (fixed in #406). Astra "next cuts" for #399 (applied): Orient step 1 (`_context.md`) and step 4 duplicate the Core Contracts bullet and the Done line; Work step 2 duplicates the read-active-sprint bullet; Orient step 3 collapses to "use `status.sh`/`next.sh`, `--track` for one"; Complete is already script-owned.

## Progress
- 2026-09-12: Sprint opened (#396–#401 banked). Next: Batch 1 (#396 + #400 in parallel worktrees).
- 2026-09-12: Batches 1–2 done (#402, #403 by Sonnet worktree subagents; #404 by this session). SKILL.md 225 → 188 lines. Next: Batch 3 (#398).
- 2026-09-12: Batch 3 done (#405 merged after Astra review fixes). SKILL.md 184 lines; never/only/must 1/7/1. Next: Batch 4 (#399).
- 2026-09-12: Batch 4 done (#406 merged after Astra review #2). SKILL.md 162 lines; never/only/must 3/6/0. Next: Batch 5 (#401) — plan-level conformance on Fable 5.1 + GPT-6 Astra, before vs after.
