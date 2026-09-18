All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repository root.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the next Issue with `gh issue view N --json body,comments`, applying specification precedence. Report sprint state and next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless a failed live GitHub read prevents identifying the next live Issue; report that limitation without executing work.

2. **ACTIONS:** Read existing context and the active track; establish sprint admission and compare proposed scope. `sprint-init.js` refuses overlapping active tracks; use the existing sprint if the work belongs there, or resolve scope/sequencing before creating another.
   **MUTATIONS:** No overlapping sprint; add authorized work to the existing Goal/Plan and Progress only when appropriate. No automatic tracker changes.
   **STOP/ASK:** Stop overlapping creation; ask if choosing between integrating, deferring, or changing scope requires an unresolved user decision.

3. **ACTIONS:** Read `_context.md` and both active sprint files; run portfolio `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for details. Verify the next Issues live and report each track’s state and batch.
   **MUTATIONS:** None; preserve both disjoint active tracks.
   **STOP/ASK:** No; multiple disjoint active tracks are valid.

4. **ACTIONS:** Read the three live Issues and resolve their specifications; ordered multi-Issue execution admits a sprint. Run `setup-dev-backlog.js`, then `sprint-init.js "topic"` with an explicitly justified scope axis if needed; write Goal, estimates, and three sequential batches in the required order.
   **MUTATIONS:** Create `.dev-backlog/` and its first active sprint with complete `#N` checkbox references. No required tracker changes or invented spec files.
   **STOP/ASK:** No, if Issue specifications are sufficient; missing optional spec skills do not block. Ask only for material missing requirements.

5. **ACTIONS:** Read the live Issue with `gh issue view N --json body,comments`; implement, verify its AC, and create a PR. Re-read before completion, then merge/commit and close through the authorized completion flow.
   **MUTATIONS:** Implementation files, verified Issue AC, PR, and eventual Issue closure; no sprint or `.dev-backlog/` bootstrap required.
   **STOP/ASK:** No; a self-contained Issue follows the default sprint-free path, and Relay is optional.

6. **ACTIONS:** Read any existing sprint context, then `gh issue view 42 --json body,comments`; resolve `spec_ref:` over newest `## Agent Brief` over body. Implement and verify all three live AC individually before checking them off.
   **MUTATIONS:** Implementation and verified Issue AC; if admitted, mark Plan `[~]` with branch/PR pointer and update Progress. No local task-definition files.
   **STOP/ASK:** No unless the live read fails or requirements are materially unclear; neither missing local tasks nor unchecked AC alone requires clarification.

7. **ACTIONS:** Read `_context.md` and active sprint files when present; run `status.sh --json` and `next.sh --json`; retrieve the next live Issue and resolve its specification. Identify the next action and whether execution complexity warrants sprint planning.
   **MUTATIONS:** None during orientation; do not create local task files or bootstrap a sprint merely because the session is fresh.
   **STOP/ASK:** No for orientation; ask for task selection only if available context cannot establish it.

8. **ACTIONS:** Inspect available repo context and sprint records; explain the locally recorded state. Diagnose unavailable GitHub access, but do not treat local records as current task authority.
   **MUTATIONS:** None to task implementation, AC, lifecycle, or sprint completion.
   **STOP/ASK:** Stop task execution until a live GitHub read succeeds; request restored access if necessary. Local files cannot authorize offline execution.

9. **ACTIONS:** Read context and sprint; re-read live planned Issues and verify all current AC and completion states. Finish any authorized outstanding closure steps, then run `sprint-close.sh` (with `--track` if needed); after success, promote project-level Running Context to `_context.md`.
   **MUTATIONS:** Any verified outstanding Issue closures and Plan/Progress updates; script sets `status: completed` and final Progress. Update `_context.md`; retain the closed sprint unchanged afterward.
   **STOP/ASK:** No if the Plan is done and checks succeed; stop closure on unresolved work, failed live reads, or failing closure checks.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; reapply specification precedence and compare the current requirements with implementation and prior verification. Adjust work and reverify every current AC before completion.
   **MUTATIONS:** Necessary implementation changes and deliberate AC updates; admitted sprint context/progress reflects the change without becoming a duplicate specification.
   **STOP/ASK:** Pause stale-spec completion; ask only if the change creates ambiguous or conflicting requirements. A failed read stops execution.

11. **ACTIONS:** Recognize the legacy layout; run `setup-dev-backlog.js` to migrate sprints, config, and triage into `.dev-backlog/`. Read migrated context and active sprint, then run `status.sh --json`, `next.sh --json`, and verify the next Issue live.
   **MUTATIONS:** Local layout migration; leave `backlog/tasks/`, `docs/`, and `completed/` in place. Preserve the existing active sprint; no new sprint or tracker mutation.
   **STOP/ASK:** No for the documented migration; stop if migration exposes conflicts requiring a decision or GitHub reads fail.