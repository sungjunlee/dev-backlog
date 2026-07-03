---
milestone: 2026-07 execution substrate
status: active
started: 2026-07-03
due: TBD
objectives: [O4]
component: "sprint-execution"
---

# Execution Substrate

## Goal
Any actor can read execution state through `--json` surfaces and one `backlog-doctor` verdict instead of parsing markdown, the consumption contract covers non-relay actors, review hygiene debt is cleared, and the fresh-session recovery eval passes as the acceptance gate.

## Plan
### Batch 1 - E1 review hygiene (#218)
- [x] #208 fix(dev-backlog): add issue-creation route to Mode Router and complete to argument-hint (~20min) → PR #221 (merged) [run:issue-208-20260703090524030-d4bec2a2]
- [x] #209 chore(dev-backlog): remove dead Backlog.md config fields and reword compat docs (~30min) → PR #222 (merged) [run:issue-209-20260703090706456-f1713a3a]
- [x] #210 docs(spec): single-source legacy CHARTER.md fallback rule in spec-axis.md (~20min) → PR #223 (merged) [run:issue-210-20260703125556716-d72d883c]

### Batch 2 - E2 contract and read surfaces
- [x] #212 docs(dev-backlog): generalize integration contract into actor-agnostic consumption contract (~45min) → PR #224 (merged) [run:issue-212-20260703125820308-36828a54]
- [x] #211 feat(dev-backlog): add --json read surfaces to status.sh and next.sh (~1hr) → PR #225 (merged) [run:issue-211-20260703130640416-2ac13ba4]

### Batch 3 - E2 backlog-doctor
- [ ] #213 feat(dev-backlog): backlog-doctor aggregated health check (~2hr)

### Batch 4 - E2 recovery gate (after #211 and #212)
- [ ] #214 test(dev-backlog): fresh-session recovery eval and smoke test (~45min)

## Running Context
- Source PRD: `docs/prd-2026-07-autonomous-execution.md` (sections 4, 7). Issue AC is authoritative; PRD gives rationale.
- Epics #218 (E1) and #219 (E2) are tracking issues, not plan items; check their task lists and close them when all children merge.
- #209's charter Non-Goal line goes through human-gated `spec-charter amend`, not direct edit.
- Trace-grammar or JSON-shape changes (#211, #212) must stay compatible with dev-relay regexes; run cross-project smoke checks (PRD S7).
- #212 open question resolved at dispatch time: the consumption contract stays in integration-contract.md re-scoped in place (dev-relay already points there; minimal churn); no new reference file.
- Batch overlap rule this sprint: #211 waits for #212 (both edit integration-contract.md); #212 ran parallel to #210 (no shared files).
- Sprint files must be committed to main when opened, not left untracked: the #211 executor worktree lacked the untracked active sprint and seeded its own (removed before merge). Direct SSOT evidence for the #215 spike.
- Execution model for this sprint: implementation is delegated (relay/delegate to an external executor); this session plans, reviews, and merges.
- Reviewer routing: `opencode` + `opencode-go/glm-5.2` failed primary review twice (prose instead of JSON verdict); use `codex` reviewer for this repo until the opencode adapter or model prompt-compliance improves.

## Progress
- 2026-07-03: Sprint created from milestone #10 (2026-07 execution substrate). Issues #208-#214 batched; epics #218/#219 tracked outside the Plan. Delegated execution starting with Batch 1.
- 2026-07-03: #208 and #209 dispatched in parallel via relay (executor codex per route policy; opencode-go/* is review-phase-only). #210 held until #208 merges — both touch skills/dev-backlog/SKILL.md. #209's charter Non-Goal AC item excluded from executor scope; needs human-gated spec-charter amend.
- 2026-07-03: #208 → PR #221 → reviewed (LGTM, round 1) → merged; capability Learning appended. #209 → PR #222 → round-1 changes_requested (missing charter Non-Goal — the intentionally held-back human-gated item); user approved wording, charter amend (revision 3 + Decision row) committed to issue-209 branch, evidence rebranded, round-2 review running. #210 dispatched after #208 merge removed the SKILL.md overlap.
- 2026-07-03: #209 → PR #222 round-2 LGTM → merged. #210 → PR #223 → reviewed (LGTM, round 1) → merged. Batch 1 (E1) complete — epic #218 ready to close. #212 dispatched (parallel, no file overlap with #210); #211 queued behind #212 (both edit integration-contract.md).
- 2026-07-03: Epic #218 closed with S6 evidence. #212 → PR #224 → reviewed (LGTM, round 1) → merged; consumption contract now actor-agnostic, JSON schema section lands with #211. #211 dispatched (age heuristic fixed at dispatch: earliest Progress mention of #N, else sprint started date, else null; JSON emission single-sourced in node).
- 2026-07-03: #211 → PR #225: executor seeded a duplicate active sprint (worktree lacked the then-untracked real one) — removed before merge, real sprint committed to main; gate-check stale false-positives from rebase timestamp ties (filed dev-relay#753, workaround: amend head timestamp) → merged after round-3 LGTM. Batch 2 (E2 contract + JSON surfaces) complete.
