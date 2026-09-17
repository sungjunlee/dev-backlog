All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repo root. Referenced files not supplied here do not justify inventing adapter syntax.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; identify the next live Issue and actionable batch, distinguishing unfinished from in-flight work.  
   **MUTATIONS:** None.  
   **STOP/ASK:** No, unless tracker access fails; then stop and repair.

2. **ACTIONS:** Read existing context and the active Plan; assess sprint admission and scope. `sprint-init.js` refuses overlapping tracks; put compatible admitted work into the existing track or establish a genuinely disjoint scope.  
   **MUTATIONS:** Update the existing Goal/Plan/Progress if incorporating authorized work; create no overlapping active sprint.  
   **STOP/ASK:** Ask if choosing between competing scopes or priorities requires user intent; never bypass the overlap refusal.

3. **ACTIONS:** Read `_context.md` and both active Plans; run `status.sh --json` and `next.sh --json` for the portfolio, then use `--track auth` and `--track billing` as needed. Report each track’s state and next actionable batch.  
   **MUTATIONS:** None; preserve both disjoint active tracks.  
   **STOP/ASK:** No for orientation; ask only if subsequent execution requires an unresolved priority choice.

4. **ACTIONS:** Treat the ordered three-Issue batch as sprint-admitted; run `setup-dev-backlog.js --tracker github --non-interactive`; resolve all three through `effective-task-spec.js`; run `sprint-init.js "topic"` and write the Goal, estimates, and three sequential batches.  
   **MUTATIONS:** Create `.dev-backlog/` configuration and the active sprint with complete Issue refs and unchecked Plan items. Omit unsupported objective/component IDs; use `--scope` only with an explicitly chosen scope. Tracker unchanged.  
   **STOP/ASK:** No; missing spec files or craftkit skills do not block planning. Stop if live task resolution fails.

5. **ACTIONS:** Use the sprint-free path: resolve the Issue with `effective-task-spec.js`, implement directly, verify AC, open a PR, then re-resolve before merge and adapter closure. GitHub is the default tracker.  
   **MUTATIONS:** Implementation files, PR, and deliberate Issue AC/lifecycle updates; no sprint or local task mirror. No setup solely to create a sprint.  
   **STOP/ASK:** No; neither Relay nor a spec axis is required. Stop if live resolution fails.

6. **ACTIONS:** Run `effective-task-spec.js 42`; follow its selected effective specification and three AC items; implement and verify each. Re-resolve before completion, then merge or commit and close through the adapter.  
   **MUTATIONS:** Implementation files and verified tracker AC/lifecycle; if already admitted, mark Plan `[~]` with a pointer, then `[x]`, and update Progress. No local task files required.  
   **STOP/ASK:** No, unless resolution fails or material ambiguity prevents implementation.

7. **ACTIONS:** Read `_context.md` and active sprint files if present; run `status.sh --json` and `next.sh --json`; resolve the selected live task with `effective-task-spec.js` before any execution.  
   **MUTATIONS:** None during orientation; do not bootstrap a sprint or export task files merely because local task files are absent.  
   **STOP/ASK:** No for orientation; stop on unavailable configured tracker rather than switch adapters.

8. **ACTIONS:** Read available `_context.md`, sprint Plans, and repo files; distinguish recorded execution state from unverified live task truth. For a GitHub-configured repo, diagnose failed live resolution without executing the task.  
   **MUTATIONS:** None; do not substitute local records for unavailable GitHub authority or change AC/lifecycle.  
   **STOP/ASK:** Stop dependent work and request restored access. If another tracker is configured and available, use that tracker; lack of GitHub alone is not a blocker.

9. **ACTIONS:** Read the sprint and context; re-resolve and verify any tasks still needing completion, close them through the adapter, and ensure the Plan is done. Run `sprint-close.sh`, then promote project-level Running Context into `_context.md`.  
   **MUTATIONS:** Necessary verified tracker closure; Plan/Progress completion; script sets `status: completed` and final Progress; update `_context.md`. Preserve the completed sprint afterward.  
   **STOP/ASK:** No if checks pass; stop if tasks remain incomplete or closure checks fail. Local task files are unnecessary.

10. **ACTIONS:** Re-run `effective-task-spec.js` and compare source, digest, AC, and lifecycle with the earlier result. Reconcile implementation and verification with the current effective specification; re-resolve again before closure.  
    **MUTATIONS:** Adjust implementation and tracker AC only against verified current requirements; record consequential changes in admitted sprint Running Context/Progress.  
    **STOP/ASK:** Pause affected work for contradictory or unclear changes; otherwise proceed. Stop if live resolution fails.

11. **ACTIONS:** Honor `.dev-backlog/.tracker = files`; run `effective-task-spec.js BACK-7`; implement directly and verify both AC. Re-resolve, merge or commit, and use the Backlog.md adapter’s AC/lifecycle and close operations.  
    **MUTATIONS:** Implementation files and canonical file-tracker task AC/status through its CLI; no GitHub changes and no sprint. Exact adapter command syntax is not supplied.  
    **STOP/ASK:** No; a self-contained task needs no sprint. Stop if the configured adapter cannot resolve it.

12. **ACTIONS:** Recognize the legacy configuration; run `setup-dev-backlog.js --tracker github --non-interactive` to migrate it, then read migrated context/active sprint and run `status.sh --json` and `next.sh --json`.  
    **MUTATIONS:** Migrate legacy sprints, `.tracker`, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. Preserve sprint state; tracker unchanged.  
    **STOP/ASK:** No for the defined migration; stop for migration conflicts or unavailable GitHub resolution.