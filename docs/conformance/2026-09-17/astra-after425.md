All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repository root. Referenced documents were not supplied, so adapter-specific syntax and legacy migration behavior remain unspecified.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; resolve the next task with `effective-task-spec.js TASK_REF`. Report sprint state and the next actionable batch, accounting for unfinished and in-flight items.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless live resolution fails or dependencies leave the next action ambiguous.

2. **ACTIONS:** Read existing context and active tracks; establish the proposed scope. `sprint-init.js` refuses an overlapping active track; use the existing sprint if the work fits, or establish a genuinely disjoint scope before initializing another.
   **MUTATIONS:** No overlapping sprint; update the existing Plan only when the intended placement is established.
   **STOP/ASK:** Ask if choosing between extending the existing track and changing scope requires a user decision; never bypass the overlap guard.

3. **ACTIONS:** Read `_context.md` and both sprints; run `status.sh --json` and `next.sh --json` for the portfolio, then use `--track auth` and `--track billing` for track detail. Identify each track’s next actionable batch.
   **MUTATIONS:** None; preserve both active tracks.
   **STOP/ASK:** No for orientation; disjoint active tracks are valid.

4. **ACTIONS:** Resolve the three named GitHub Issues with `effective-task-spec.js`; the ordered multi-Issue dependency admits a sprint. Run `setup-dev-backlog.js --tracker github --non-interactive`, then `sprint-init.js "topic"`; write a Goal and three sequential batches with complete refs and estimates.
   **MUTATIONS:** Create `.dev-backlog/`, its GitHub tracker configuration, and the first active sprint. Omit unavailable objective/component axes; create no speculative spec files.
   **STOP/ASK:** No if issue definitions and order are clear; stop if live resolution fails.

5. **ACTIONS:** Resolve the issue using `effective-task-spec.js TASK_REF`; implement directly, verify AC, create a PR, then re-resolve before completion and close through the GitHub adapter.
   **MUTATIONS:** Implementation files and deliberate tracker AC/lifecycle updates; no sprint or bootstrap required solely for this task.
   **STOP/ASK:** No; neither missing spec files nor missing Relay blocks sprint-free execution.

6. **ACTIONS:** Run `effective-task-spec.js 42`; follow its selected source and all three effective AC items. Implement, verify each item, and explicitly update GitHub; re-resolve before completing and closing.
   **MUTATIONS:** Implementation files and verified tracker AC/lifecycle; update sprint Plan/Progress only if #42 belongs to an admitted sprint. Create no local task mirror.
   **STOP/ASK:** No if resolution succeeds; otherwise stop task execution and AC/lifecycle changes while diagnosing.

7. **ACTIONS:** Read tracker configuration and any `_context.md` or active sprint; run `status.sh --json` and `next.sh --json`, then resolve the selected live task. Report the next task or batch and any sprint-planning need.
   **MUTATIONS:** None during orientation; do not manufacture local task files or automatically admit a sprint.
   **STOP/ASK:** No for orientation; ask for task selection only if available evidence cannot establish it.

8. **ACTIONS:** Read available tracker configuration, `_context.md`, and sprint records for provisional orientation. Attempt the configured resolver only when its authority is accessible; repo files cannot substitute for unavailable GitHub task truth.
   **MUTATIONS:** None; no cached-task execution, tracker switching, or AC/lifecycle changes.
   **STOP/ASK:** If GitHub is configured, stop execution and report that access must be restored. If another configured adapter is available, use that adapter.

9. **ACTIONS:** Read sprint/context and re-resolve planned tasks; verify current AC and finish outstanding task completion first. Run `sprint-close.sh` with `--track` if needed; after successful doctor checks and closure, promote reusable project context to `_context.md`.
   **MUTATIONS:** Necessary verified tracker completion updates; completed Plan, final Progress, `status: completed`, and promoted `_context.md` content. Preserve the completed sprint as permanent history.
   **STOP/ASK:** No if completion checks pass; stop closure for unresolved tasks or failed checks. Local task files are unnecessary.

10. **ACTIONS:** Re-run `effective-task-spec.js TASK_REF`; compare the effective source, digest, AC, and lifecycle with the working specification. Adjust implementation and verification to the current effective specification, then re-resolve before completion.
    **MUTATIONS:** Only changes justified by the current specification: implementation, verified tracker AC/lifecycle, and admitted sprint context/progress.
    **STOP/ASK:** Ask if changes create conflicting or unclear requirements; stop if resolution fails. An Issue edit does not automatically override a higher-precedence effective source.

11. **ACTIONS:** Honor `.dev-backlog/.tracker = files`; run `effective-task-spec.js BACK-7`, implement, and verify both AC items. Re-resolve before completion; use the files adapter’s documented Backlog.md commands for explicit AC updates and closure.
    **MUTATIONS:** Implementation files and canonical Backlog.md tracker files; no GitHub mutations and no sprint for this self-contained task.
    **STOP/ASK:** No if resolution succeeds; stop if the configured adapter fails. Do not invent CLI syntax absent from the supplied contract.

12. **ACTIONS:** Inspect the legacy context, active sprint, tracker marker, and config for provisional orientation. Consult installed usage/reference documentation for supported legacy handling before relying on `status.sh --json` or `next.sh --json`; verify live GitHub task truth.
    **MUTATIONS:** None; do not silently bootstrap a second execution hub, move legacy files, or invoke `sync-pull.js --legacy-export` as a migration.
    **STOP/ASK:** The supplied contract defines no legacy discovery or migration guarantee. If documented compatibility cannot resolve the layout, stop authoritative orientation and request migration direction.