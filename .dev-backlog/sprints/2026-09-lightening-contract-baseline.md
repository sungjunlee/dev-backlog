---
milestone: Lightening 1: lean contract and baseline
status: active
started: 2026-09-27
due: TBD
component: "lightening"
---

# Lightening 1: lean contract and baseline

## Goal
The lean contract is ratified, observed guard defects are fixed, and surviving guarantees have repeatable outcome evidence.

## Plan

### Batch 1
- [x] #494 Ratify the lean contract and exact spec amendments (estimate: M) → PR #505 (merged)
- [x] #495 triage-apply: canonical milestone key, GitHub-only guard, validate every accepted action before any write (estimate: S) → PR #505 (merged)

### Batch 2
- [ ] #496 Sprint reader: frontmatter-only active detection, unambiguous selectors, conservative scope checks, honest next batch (estimate: M)

### Batch 3
- [ ] #497 Outcome-based test and conformance baseline (estimate: M)

## Running Context
- Task definition and acceptance criteria live on the linked GitHub issues; read them live before execution.
- Parent epic: #504. Milestone: https://github.com/sungjunlee/dev-backlog/milestone/28
- These sprints share code and documentation; only one is active at a time.
- Exit: Approved spec amendments and defect fixes are integrated; the outcome baseline is repeatable and required checks pass.
- First batch: the spec amendment draft and independent triage bug fix may proceed together. Publishing the plan did not approve a spec diff.
- The active sprint file is committed to main; delegates branch from main and must not create a duplicate sprint.
- S1 is the sole checkout writer. S2/S3 remain read-only until verified S1 integration and lifecycle completion; a local implementation or idle chat does not release that dependency.
- Spec rev 21 leads the runtime until #496–#502 land (see `_context.md`): execute from SKILL.md and the scripts; grade this sprint's work against `spec/*`.
- `triage-apply` preflight now rejects, before any write: non-positive or unsafe issue numbers, loose `key=value` grammar or repeated keys, NUL or >16,000-byte values, a second priority / milestone / closing action per issue; legacy `name=` is keyed as `milestone=`. #502 builds the checklist-only rule on this.
- #494 is approved and merged (`e449f78`); any further `spec/*` change needs a new exact-text approval.

## Progress
- 2026-09-27: Published issues and milestone; bound the first active sprint. No implementation has started.
- 2026-09-27: Live #494–#497 specifications read. Started Batch 1 on `codex/lightening-s1`: Opus 5.5 drafts #494 outside the repository; Sol xhigh implemented #495 within its declared scope. Full Node suite: 192 passed, 1 optional live integration skipped; smoke: 167 passed. Cross-family #495 review is pending. No public write or spec amendment has been made; Batch 2/3 remain blocked on their prerequisites.
- 2026-09-27: #494 revision 2 proposal is saved under `.dev-backlog/planning/2026-09-lightening/approval-494/`; spec patch SHA-256 `c200c64147bf3dba71805dba7b9618094d0a5bebcad07be281ace0c8b59f14ff`. Sol reviewed Opus's corrected proposal with no substantive blocker. An isolated copy including this proposed spec passes the full Node suite (192 pass, 1 skip) and smoke (167 pass). Human approval remains pending and repository `spec/*` is unchanged. #495 cross-family review is still running; no task is claimed complete.
- 2026-09-27: #495 cross-family review completed: Cursor Grok 4.7 high returned LGTM after targeted tests and independent fake-GitHub probes. Local implementation commit: `eeb0e7e` on `codex/lightening-s1`; no push, PR, issue update, or closure. Prepared the #494 approval proposal, exact patch, Batch 1 draft PR body, and #503 clarification under the local approval directory. Await human spec approval and the specific PUBLIC publication authorization; #494/#495 lifecycle and all S1 exit criteria are not complete. Do not hand off execution to S2.
- 2026-09-27: User approval was relayed by the gateway conversation, not received as a direct user message in this S1 conversation. Verified approved patch SHA-256 unchanged; posted the approval record at https://github.com/sungjunlee/dev-backlog/issues/494#issuecomment-5854919334. Applied the approved patch with only four approval-link/date substitutions and committed the three spec files separately as `47e8604bd70efaf44615167e31731e9f0114970c`, preserving #495 commit `eeb0e7eb4103e56a4881ea7fa21c4752c7288b24`. Full applied-tree Node suite: 192 pass, 1 optional integration skip; smoke: 167 pass. Published branch and Draft PR https://github.com/sungjunlee/dev-backlog/pull/505; remote head matches exactly, Linux `test` and `windows-test` CI both succeeded. Applied and read back exactly the three approved #503 wording edits. No merge, issue closure, Batch 2/3 execution, or S2 handoff is authorized by this publication approval. Next decision: authorize PR readiness/merge and issue lifecycle work before proceeding with dependent work.
- 2026-09-29: Batch 1 done. PR #505 rebase-merged (`33a6005`; spec commit `e449f78` separate); #495 closed by the PR, #494 closed after spec read-back against the approval record. Review cycle: Codex connector (7 findings fixed, checklist-only anchors deferred to #502), GPT-6 Astra (3 preflight fixes, LGTM), Cursor Grok 4.7 (spec-vs-runtime divergence resolved via `_context.md`, LGTM ×3), CodeRabbit (no actionable comments). Node 196 pass / 1 skip, smoke 167/167, CI green. Next: Batch 2 #496.
