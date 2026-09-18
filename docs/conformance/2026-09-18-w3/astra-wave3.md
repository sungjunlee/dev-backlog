All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the repository root; no commands or file operations are performed here.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the selected Issue with `gh issue view N --json body,comments`.
   **MUTATIONS:** None during orientation.
   **STOP/ASK:** No; report current progress and the next actionable batch/Issue. A failed live Issue read blocks task execution.

2. **ACTIONS:** Read existing context and active scope; identify the overlap. `sprint-init.js` must refuse an overlapping new track; consider placing the work in the existing sprint or sequencing a later sprint.
   **MUTATIONS:** No overlapping sprint; update the existing Plan only once its intended scope is established.
   **STOP/ASK:** Ask if the intended resolution is unclear. Do not bypass the overlap guard or mark unfinished work completed.

3. **ACTIONS:** Read `_context.md` and both Plans; run `status.sh --json` and `next.sh --json` for the portfolio, then `next.sh --track auth` and `next.sh --track billing`; verify candidate Issues live.
   **MUTATIONS:** None.
   **STOP/ASK:** No for orientation; report each track’s state and next batch. Disjoint active tracks are valid.

4. **ACTIONS:** Read all three Issues live and resolve their specifications; their required ordering admits a sprint. Run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write a Goal and three ordered batches with estimates and complete `#N` references.
   **MUTATIONS:** Create `.dev-backlog/` and the first active sprint; tracker unchanged unless an explicit Issue correction is needed. Do not invent spec files or Objective IDs.
   **STOP/ASK:** No solely because the spec axis is absent; stop for failed live reads or unresolved task requirements. Referenced fallback details are not supplied here.

5. **ACTIONS:** Read the Issue with `gh issue view N --json body,comments`, resolve overrides, implement, verify every AC, and create its PR; close with `gh issue close N` after completion requirements are satisfied.
   **MUTATIONS:** Implementation files, PR, and deliberately updated Issue AC/lifecycle; no sprint or `.dev-backlog/` bootstrap.
   **STOP/ASK:** No; a self-contained Issue follows the sprint-free default, and Relay is optional.

6. **ACTIONS:** Read any existing sprint context, then `gh issue view 42 --json body,comments`; apply specification precedence, implement, and verify all three AC items before checking them off.
   **MUTATIONS:** Implementation files and verified Issue AC; if already admitted, mark its Plan item `[~]` with a branch/PR pointer and record Progress.
   **STOP/ASK:** No merely because task files are missing; stop on failed live reads or material specification ambiguity.

7. **ACTIONS:** Read available `_context.md` and active sprints; run `status.sh --json` and `next.sh --json`; read the next candidate Issue live and resolve its authoritative specification.
   **MUTATIONS:** None during initial orientation; no local task copies or automatic sprint creation.
   **STOP/ASK:** No for orientation. Report the next Issue/batch or planning need; ask only if competing priorities prevent choosing authorized work.

8. **ACTIONS:** Read available repository context and sprint files; use local status information to describe recorded progress. Diagnose unavailable GitHub access; do not treat local records as current task specifications.
   **MUTATIONS:** None.
   **STOP/ASK:** Stop task execution and AC/lifecycle changes until a live GitHub read succeeds; report the access blocker. Local orientation remains possible.

9. **ACTIONS:** Re-read planned Issues live and verify current AC/completion; finish any remaining task closure and Plan updates. Once the Plan is done, run `sprint-close.sh`, then promote reusable project context into `_context.md`.
   **MUTATIONS:** Any necessary verified Issue closures; Plan completion and Progress; script sets `status: completed` and final Progress; update `_context.md`, retaining the sprint as permanent history.
   **STOP/ASK:** No because task files are absent; stop if live verification fails, work remains unfinished, or sprint closure checks fail.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; resolve the body’s `spec_ref:` first, otherwise the newest `## Agent Brief`, otherwise the body. Reconcile implementation and reverify every AC against that current specification.
    **MUTATIONS:** Adjust implementation and deliberately correct AC status as warranted; record changed decisions/progress in an admitted sprint.
    **STOP/ASK:** Pause affected work if the change creates conflicting requirements or exceeds authorized scope; otherwise continue. Never close against a stale specification.

11. **ACTIONS:** Inspect legacy `backlog/sprints/` context and active Plan; verify candidate Issues live. Report the legacy-layout condition without assuming “no active sprint”; the supplied contract explicitly places `setup-dev-backlog.js` migration on the Plan rail.
    **MUTATIONS:** None for orientation. When migration is needed for planning, use `setup-dev-backlog.js` to migrate sprints/config/triage while leaving legacy tasks/docs/completed in place.
    **STOP/ASK:** No for read-only orientation; do not invent automatic legacy support in `status.sh`/`next.sh` or create a competing sprint.