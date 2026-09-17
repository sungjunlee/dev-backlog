All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the repository root. Referenced documents were not supplied, so their contents are not assumed.

1. **ACTIONS:** Read `backlog/sprints/_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; identify the next live Issue and actionable batch, accounting for `[~]` work.
   **MUTATIONS:** None; orientation does not automatically update Plan checkboxes.
   **STOP/ASK:** No, unless missing live information prevents identifying actionable work.

2. **ACTIONS:** Read existing context and the active track; assess sprint admission and scope. `sprint-init.js "topic" --scope "..."` refuses overlapping active tracks; incorporate compatible work into the existing track or establish genuinely disjoint scope.
   **MUTATIONS:** Update the existing sprint’s Goal/Plan if appropriate; create a separate sprint only with nonoverlapping scope. No automatic GitHub changes.
   **STOP/ASK:** Stop overlapping creation. Ask only if choosing between materially different scopes requires the user’s decision; never bypass the overlap guard.

3. **ACTIONS:** Read `_context.md` and both active sprint files; run portfolio `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for track-specific detail.
   **MUTATIONS:** None.
   **STOP/ASK:** No. Disjoint active tracks are valid; report each track’s state and next actionable batch.

4. **ACTIONS:** Inspect live Issues and establish a continuity need warranting a sprint. If `backlog/` is absent, run `setup-dev-backlog.js --tracker github --non-interactive`; resolve candidate Issues with `effective-task-spec.js`; run `sprint-init.js "topic"` and write Goal, ordered batches, and estimates.
   **MUTATIONS:** Create `backlog/` configuration and an active sprint with complete `#N` Plan references. Omit unsupported optional objective/component IDs; declare `--scope` explicitly if used. No spec scaffolding or GitHub mutation is inherently required.
   **STOP/ASK:** No dependency-installation gate. If no admission criterion exists, explain the sprint-free default and clarify the intended coordination need before creating a sprint.

5. **ACTIONS:** Run `effective-task-spec.js #N`; implement directly, verify every AC, re-resolve before completion, then follow implementation → PR → Issue closure.
   **MUTATIONS:** Change implementation files; deliberately update verified GitHub AC/lifecycle. No sprint, local task mirror, or Relay setup is needed.
   **STOP/ASK:** No, unless live resolution fails or the effective specification leaves a material ambiguity.

6. **ACTIONS:** Read any existing sprint context; run `effective-task-spec.js #42`; implement against its effective specification and all three AC items; verify and re-resolve before completion.
   **MUTATIONS:** Change implementation files and explicitly update verified Issue AC/lifecycle. If admitted to a sprint, mark `[~]` with a branch/PR pointer, then `[x]` after completion, and update Progress.
   **STOP/ASK:** No local-task-file requirement. Stop implementation and AC/lifecycle changes if live resolution fails.

7. **ACTIONS:** Read any `_context.md` and active sprint files; run `status.sh --json` and `next.sh --json`; identify the next live Issue or batch. Use `effective-task-spec.js TASK_REF` before implementation.
   **MUTATIONS:** None during orientation; do not bootstrap task mirrors or a sprint merely because local task files are absent.
   **STOP/ASK:** No for orientation. A fresh session alone does not authorize implementing an unspecified task.

8. **ACTIONS:** Read available `_context.md`, sprint files, and repository evidence; attempt `effective-task-spec.js TASK_REF` if a task is identifiable and diagnose unavailable live resolution. Report local execution state as provisional.
   **MUTATIONS:** None; do not execute the task or change AC/lifecycle after resolution failure.
   **STOP/ASK:** Stop dependent execution until live resolution succeeds; request restored access if needed. Local files cannot establish current Issue truth.

9. **ACTIONS:** Re-resolve and verify planned tasks’ current AC and completion; once the Plan is done, run `sprint-close.sh` (with `--track` if needed). After success, promote reusable project-level Running Context into `_context.md`.
   **MUTATIONS:** Explicitly finish any authorized, verified Issue lifecycle updates; closure sets `status: completed` and final Progress. Update `_context.md`; retain the completed sprint as immutable history.
   **STOP/ASK:** No local-task-file requirement. Stop closure if verification or doctor checks prevent success; do not force completion.

10. **ACTIONS:** Re-run `effective-task-spec.js TASK_REF`; compare the effective specification, `source_ref`, and digest with the version used. Adapt implementation and verification to changed requirements; re-resolve again before completion.
    **MUTATIONS:** Update implementation and verified AC/lifecycle against current truth; record consequential decisions and progress in an admitted sprint.
    **STOP/ASK:** Stop if resolution fails. Ask if the change introduces conflicting or materially ambiguous requirements; an Issue edit alone does not require asking.

11. **ACTIONS:** Diagnose tracker routing first: the supplied contract documents `backlog/` and GitHub truth, but does not establish `.dev-backlog/.tracker = files` or `BACK-7` support. Consult the referenced authority/script contracts before attempting `effective-task-spec.js BACK-7`.
    **MUTATIONS:** None until supported routing and live resolution are established; do not invent Backlog.md commands, migrate trackers, or create a sprint.
    **STOP/ASK:** Stop dependent execution because the supplied text lacks the required backend contract. Request that contract or clarification; CLI installation alone does not establish authority.

12. **ACTIONS:** Read `backlog/sprints/_context.md` if present and the active sprint; inspect existing tracker/config; run `status.sh --json` and `next.sh --json`; identify the next live Issue and batch.
    **MUTATIONS:** None. The supplied skill explicitly uses `backlog/`; neither migration nor `.dev-backlog/` creation is prescribed.
    **STOP/ASK:** No. The scenario’s “legacy” label does not override the operating contract’s documented paths.