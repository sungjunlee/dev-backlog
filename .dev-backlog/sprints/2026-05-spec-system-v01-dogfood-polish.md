---
milestone: spec-system v0.1 dogfood polish
status: completed
started: 2026-05-23
due: TBD
objectives: [O3, O4]
component: ""
---

# spec-system-v01-dogfood-polish

## Goal
Remaining spec-grill dogfood polish issues (#112–#114) land against the current `spec-grill` split, while already-resolved relay-learnings findings stay closed as upstream dev-relay work.

## Plan
[Order into batches. Group small tasks (~30min or less) for one session.]

- [x] #115 docs(backlog-charter): capability-count heuristic in references/capabilities.md (~20min) → closed
- [x] #114 docs(spec-grill): clarify capability-level Decisions seeding (~20min) → PR #175 (merged)
- [x] #113 docs(spec-grill): make Goal observability check explicit outside the 3-axis test (~15min) → PR #175 (merged)
- [x] #112 docs(spec-grill): add Behavior vs. Hard Constraint tiebreaker rule (~20min) → PR #175 (merged)
- [x] #111 docs(backlog-charter): note that extract-signals clusters by code, not by capability (~20min) → PR #117 (merged)

## Running Context
- Live append-learnings verified: PR #117 → first finalize-run wrote `- 2026-05-23 (run #<id>): ... [PR #117]` under `## Capability: charter-management` between LEARN markers. Direct `append-learnings.js` rerun returned `status: skipped`, `reason: idempotent_match`, byte-identical file. Idempotency holds at the script boundary.
- Found and filed: finalize-run.js refuses to re-run end-to-end after cleanup removes the worktree (worktree-path guard); see #118. Doesn't affect append-learnings's own idempotency — discovered while exercising it.
- **Higher-priority gap, filed as #119**: append-learnings writes to the local working tree but does not commit or push the entry. In normal use the entry sits as `git status` modified content and is one `git stash` away from loss. Design doc doesn't address durability. Recommendation in #119 body: option-2 commit+push from finalize-run with dirty-tree and wrong-branch guards.
- Tier-2 brownfield grill done as strawman: dev-relay PR [#517](https://github.com/sungjunlee/dev-relay/pull/517) opened — 6 functional capabilities (`readiness-shaping`, `planning`, `dispatch-execution`, `review-cycle`, `merge-finalize`, `manifest-lifecycle`). PR body flags 4 specific Behaviors/Constraints needing real grill before merge. Counts as the independent-project event for CHARTER O3/O4 advance once the maintainer (you) walks grill against it.
- 2026-05-31 triage: #118 and #119 are resolved upstream by dev-relay PR #525 / issue #519; keep this sprint focused on #112–#114 spec-grill docs. `component:` migrated from retired `charter-management` to `spec-grill`.
- 2026-07-05: `component:` cleared from retired `spec-grill` — the spec-* capabilities moved to craftkit with the skills (0.7.0, charter Decision 2026-07-04), same migration pattern as the `charter-management` retirement above.

## Progress
- 2026-05-23 13:15: #111 dispatched (codex executor) → PR #117 → reviewed (LGTM, round 1) → merged. Live `append-learnings.js` first-run + idempotency confirmed end-to-end. Filed #118 (finalize-run rerun guard).
- 2026-05-23 13:18: Filed #119 (append-learnings durability gap — higher-priority than #118).
- 2026-05-23 13:20: Tier-2 brownfield grill on sibling dev-relay → strawman PR dev-relay#517 (6 capabilities, 211 lines).
- 2026-05-31: Backlog triage closed #76, #118, and #119; retitled/rescoped #112–#114 to `spec-grill`; tightened #73's snapshot-v2 contract in an issue comment. Active sprint plan now has #112–#114 remaining.
- 2026-05-31: Implemented #113 → #112 → #114 locally in `skills/spec-grill/SKILL.md` and `skills/spec-grill/references/capabilities.md`. Validation passed: `node --test skills/spec-grill/scripts/*.test.js`, `objectives-check.js`, and `component-lint.js`. Issues remain open until the changes are committed/landed.
- 2026-05-31: PR #175 merged to `main`, closing #112, #113, and #114. Sprint complete; #73 remains outside this sprint as the next `triage-grooming` batch candidate.
