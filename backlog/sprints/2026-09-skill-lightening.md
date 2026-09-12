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
- [ ] #398 Dedupe spec-field omission, track overlap, and sprint admission (~2h)

### Batch 4 — Freedom by design
- [ ] #399 Reframe Execution Path as goal + Done when + rail; positive defaults (~3h)

### Batch 5 — Measurement
- [ ] #401 Before/after conformance run on Fable 5.1 and Codex (~3h)

## Running Context
- Source: 2026-09-12 review of the official Fable 5 / Opus 5 / GPT-6 Astra prompting and skill-authoring guides. Both vendors: prior-model skills are too prescriptive; conflicting skill guidance makes Astra block early; keep explicit "done" definitions; hard constraints only for irreversible/shared mutations.
- Baseline for #401 is git tag `pre-skill-lightening` (d6f5650). Do not retag.
- Charter freeze holds: `sync-pull.js` / `legacy-tracker.js` stay; this wave only stops advertising them.
- #400 also dropped two SKILL.md wording pins from `authority-contract.test.js` (found while landing #397); prose tests now pin `## Sprint Admission` and `effective-task-spec.js` presence only.
- Cross-family review (Codex) runs once on the cumulative SKILL.md diff at the end of Batch 3 and again after Batch 4, not per PR.
- Rules re-added after the wave must cite a repeated mistake from the #401 run, not an anticipated risk.

## Progress
- 2026-09-12: Sprint opened (#396–#401 banked). Next: Batch 1 (#396 + #400 in parallel worktrees).
- 2026-09-12: Batches 1–2 done (#402, #403 by Sonnet worktree subagents; #404 by this session). SKILL.md 225 → 188 lines. Next: Batch 3 (#398).
