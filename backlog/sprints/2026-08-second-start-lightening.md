---
milestone: 2026-08 second-start lightening
status: active
started: 2026-08-17
due: TBD
scope: ["spec/**", "docs/**", "README.md", "CLAUDE.md", "skills/**"]
objectives: [O10, O1, O4]
component: ""
---

# second-start-lightening

## Goal
The repo's hot path matches the product: GitHub Issues + complexity-triggered sprints, with spec/docs sized for a second start and no leftover measurement ceremony.

## Plan

### Batch 1 — Spec contracts
- [x] #379 Compact spec/* to living second-start contracts (~1d)

### Batch 2 — Public surface
- [x] #369 Right-size README for personal-toolkit posture (~2h)

### Batch 3 — Agent/human docs
- [x] #380 Write current-product docs; stop the subtraction narrative (~1d)

### Batch 4 — Proof-doc retirement
- [x] #381 Retire proof-only living docs after the #350 closeout (~2h)

## Running Context
- This track is the only active sprint. Sibling `2026-07-github-native-core-simplification` closed with the #350/#362 no-go.
- Human gate for charter edits: 2026-08-17 second-start / ruthless-lightening direction.
- Do not cut v1.0.0, do not delete completed sprint files, do not delete `sync-pull.js` / `legacy-tracker.js` this wave.
- README no longer points at `docs/compatibility-subtraction.md` (#369). Proof-only living docs retired by #381; `spec-history.md` and `conformance/` remain.
- #366 (GitHub resilience) and #367 (standing Eval-Prompts cadence) stay sprint-free / parked.

## Progress
- 2026-08-17: Sprint opened (milestone 21). `2026-08-review-follow-ups` closed so this track could take `docs/**` / `spec/**` / `skills/**`. Next: github-native #362 closeout, then Batch 1 (#379).
- 2026-08-17: Sibling track closed. #350/#362 no-go landed (shadow concluded, milestone 19 closed). This track is now the only active sprint. Next: Batch 1 #379.
- 2026-08-17: Batch 1 complete. Charter rev 16: O10/O1/O4 living; O3/O5 retired; personal-toolkit + #350 no-go + compat freeze recorded. `spec-system-design.md` Removed. Doctor: 3 objectives, pass. Next: Batch 2 #369 README.
- 2026-08-17: Batch 2 complete. README is install + Issue → PR + when to open a sprint (~125 lines). No living `compatibility-subtraction` pointer. Discovery still finds `dev-backlog` and `backlog-triage`. Next: Batch 3 #380.
- 2026-08-17: Batch 3 complete. SKILL/CLAUDE/process describe the current loop; `file-format.md` is sprint-first; `github-sync.md` no longer shows `create --json` or `draft.md`; `_context.md` drops other-repo harness gotchas; `workflow-patterns.md` removed. SKILL.md 224 lines. Node 495 pass / 1 skip; smoke 190/190; doc-drift OK. Next: Batch 4 #381.
- 2026-08-19: Batch 4 complete. o3-drill, mirrorless-github-pilot, compatibility-subtraction, and historical-retrieval-shadow Removed (pinned `9b2160c`). Living: spec-history + conformance. Stale triage cache dropped (kept latest). Next: close this sprint when the user wants.
