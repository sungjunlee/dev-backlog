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
- [~] #421 Reassess under the status-free charter; amend charter to match the #411 tracker wave (human-gated) (~2h) → PR #429 (merged)
- [x] #422 Re-lighten dev-backlog SKILL.md after the #411 tracker wave: tracker branching off the hot path (~2h) → PR #430 (merged)

### Batch 2 - Measure the tracker wave (needs #422)
- [x] #423 Conformance run for the #411 tracker wave and the re-lightened SKILL.md (Fable 5.1 + GPT-6 Astra) (~3h) → PR #432 (merged)

### Batch 3 - Delete (parallel-safe: #424 scripts/tests for gitlab, #425 references; #424 and #426 wait for the #421 amendment)
- [~] #424 Park the GitLab adapter until a measured consumer exists (~2h) → PR #437 (merged)
- [~] #425 Delete low-ROE dev-backlog references (integration-contract, github-sync, process, scripts, boundaries, checkbox-repair) (~3h) → PR #435 (merged)
- [~] #426 Remove spec-axis linters (objectives-check, component-lint, capabilities-doctor); component: is a free scope string (~3h) → PR #438 (merged)
- [~] #431 Plan rail: setup migrates a legacy backlog/ skill layout (rule re-add from the #423 evidence; unplanned, admitted 2026-09-17) (~30min) → PR #436 (merged)

### Batch 4 - Triage experiment (independent; can run alongside Batch 3)
- [~] #427 backlog-triage scripts-less experiment: run the seven evals on both models, then decide deletion (~3h) → PR #434 (merged)

### Batch 5 - Release
- [~] #428 Cut v0.11.0 with the measured state (~1h) → PR #439 (open)


## Running Context
- Keep test for any surface: (1) guards shared/irreversible state, (2) deterministic check the model cannot cheaply redo, (3) wire contract another tool consumes. Fails all three → delete, do not rewrite.
- `spec/*` amendments (#421, and the capability text for #426) are human-gated: propose in the reassess report, apply only after explicit approval, record the gate date.
- Cross-family review: read-only `codex exec -m gpt-6-astra` on the cumulative diff at each batch boundary (recipe in `docs/conformance/2026-09-12-skill-lightening.md`).
- Rules are re-added only when a conformance run shows a repeated mistake; file it as its own issue.
- Epic #420 is not a Plan item; close it when Batch 5 lands.
- `.tracker=files` has a measured consumer (Backlog.md CLI installed); `gitlab` does not. #424 depends on the #421 charter rule for new adapters.

## Progress
- 2026-09-17: Sprint opened. Epic #420, milestone 23, issues #421–#428 filed; starting point recorded in the epic body (SKILL.md 181 lines / 12 never-only-must, references 1,308, scripts 13,286, tests 11,422).
  
- 2026-09-17: Batch 1 in flight. #421 report on PR #429 (spec amendments proposed, human gate pending); #422 on PR #430 (Astra review: merge with edits, applied). In-flight pointer grammar is `→ PR #N (state)` at end of line (status.sh `PR_RE`).
- 2026-09-17: #422 merged (PR #430, SKILL.md 160 lines / never-only-must 4). #423 run done: no behavior loss, scenario 12 gap filed as #431; PR #432 under review.
- 2026-09-17: Batch 2 closed (#423 merged, PR #432). Batch 4 #427 measured: variant B plan-level equivalent on both models; deletion filed as #433, PR #434 under Sol review. Batch 3 #425 dispatched to Grok 4.6 (cursor-agent, own worktree); #424/#426 wait on the #421 spec gate.
- 2026-09-17: #425 merged (PR #435; references 10 → 4 files, −892 lines). Astra review DO NOT MERGE overridden on evidence (dev-relay consumes sprint-state JSON, not the doc). Post-merge hotfix: a backtick inside the doctor remediation template literal broke `backlog-doctor.js` on main for one commit; caught by re-running smoke, fixed in the next commit. Lesson: never chain `gh pr merge` after a grep-filtered test run — check exit codes explicitly.
- 2026-09-17: #431 merged (PR #436). Remaining: #421 spec gate (PR #429 open, human decision), then #424 and #426, then #428. Batch 1/2/4 done; Batch 3 has #425 and #431 done.
- 2026-09-17: Spec gate approved; #421 merged (PR #429, charter rev 18). #424 dispatched to Grok 4.6, #426 to Opus 5, both in own worktrees.
- 2026-09-17: Batch 3 closed: #424 (PR #437, −1,162), #426 (PR #438, −2,432 incl. orphaned sprint-status.js). After-run on both models 12/12. #428 dispatched to Grok (CHANGELOG release section + release notes); tag and release published from this session.
