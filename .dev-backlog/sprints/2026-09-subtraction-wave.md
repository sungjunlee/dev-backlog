---
milestone: 2026-09 subtraction wave
status: active
started: 2026-09-17
due: TBD
scope: ["skills/**", "spec/**", "tests/**", "docs/**", ".dev-backlog/triage/**"]
objectives: []
component: ""
---

# subtraction-wave

## Goal
dev-backlog spec, code, and hot path agree after the #411 tracker wave, and every reference, linter, or adapter that fails the keep test (shared-state guard, cheap deterministic check, or a consumed wire contract) is deleted with a before/after conformance run, ending in v0.11.0.

## Plan
### Batch 1 - Reconcile and re-lighten (parallel-safe: #421 touches spec/ and triage/, #422 touches SKILL.md + adapter-ports.md)
- [ ] #421 Reassess under the status-free charter; amend charter to match the #411 tracker wave (human-gated) (~2h)
- [ ] #422 Re-lighten dev-backlog SKILL.md after the #411 tracker wave: tracker branching off the hot path (~2h)

### Batch 2 - Measure the tracker wave (needs #422)
- [ ] #423 Conformance run for the #411 tracker wave and the re-lightened SKILL.md (Fable 5.1 + GPT-6 Astra) (~3h)

### Batch 3 - Delete (parallel-safe: #424 scripts/tests for gitlab, #425 references; #424 and #426 wait for the #421 amendment)
- [ ] #424 Park the GitLab adapter until a measured consumer exists (~2h)
- [ ] #425 Delete low-ROE dev-backlog references (integration-contract, github-sync, process, scripts, boundaries, checkbox-repair) (~3h)
- [ ] #426 Remove spec-axis linters (objectives-check, component-lint, capabilities-doctor); component: is a free scope string (~3h)

### Batch 4 - Triage experiment (independent; can run alongside Batch 3)
- [ ] #427 backlog-triage scripts-less experiment: run the seven evals on both models, then decide deletion (~3h)

### Batch 5 - Release
- [ ] #428 Cut v0.11.0 with the measured state (~1h)


## Running Context
- Keep test for any surface: (1) guards shared/irreversible state, (2) deterministic check the model cannot cheaply redo, (3) wire contract another tool consumes. Fails all three → delete, do not rewrite.
- `spec/*` amendments (#421, and the capability text for #426) are human-gated: propose in the reassess report, apply only after explicit approval, record the gate date.
- Cross-family review: read-only `codex exec -m gpt-6-astra` on the cumulative diff at each batch boundary (recipe in `docs/conformance/2026-09-12-skill-lightening.md`).
- Rules are re-added only when a conformance run shows a repeated mistake; file it as its own issue.
- Epic #420 is not a Plan item; close it when Batch 5 lands.
- `.tracker=files` has a measured consumer (Backlog.md CLI installed); `gitlab` does not. #424 depends on the #421 charter rule for new adapters.

## Progress
- 2026-09-17: Sprint opened. Epic #420, milestone 23, issues #421–#428 filed; starting point recorded in the epic body (SKILL.md 181 lines / 12 never-only-must, references 1,308, scripts 13,286, tests 11,422).
  