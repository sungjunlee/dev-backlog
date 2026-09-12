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
- [ ] #396 Move Eval Prompts out of SKILL.md into tests/evals (~1h)
- [ ] #400 Replace contract-prose regex pins on wording with behavior tests (~1h)

### Batch 2 — Subtraction: legacy hot path
- [ ] #397 Demote sync/legacy-tracker material from the dev-backlog SKILL.md hot path (~1h)

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
- `contract-prose.test.js` requires one "no task-file directory required" / "optional legacy export" sentence per surface until #400 lands; keep exactly one while subtracting.
- Rules re-added after the wave must cite a repeated mistake from the #401 run, not an anticipated risk.

## Progress
- 2026-09-12: Sprint opened (#396–#401 banked). Next: Batch 1 (#396 + #400 in parallel worktrees).
