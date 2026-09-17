All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repo root. Referenced documents were not supplied; I do not assume their contents.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the next Issue live with `gh issue view N --json body,comments`; report Plan state and next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No routine confirmation; if GitHub reads fail, report the limitation and stop task execution.

2. **ACTIONS:** Read context and the existing active sprint; compare scope. `sprint-init.js` must refuse the overlapping track; evaluate incorporating admitted work into the existing Plan or deferring it.
   **MUTATIONS:** No second overlapping sprint; update the existing Plan and Progress only if the requested scope clearly authorizes incorporation.
   **STOP/ASK:** Ask if incorporation versus deferral is ambiguous; never bypass the overlap guard.

3. **ACTIONS:** Read `_context.md` and both active sprints; run portfolio `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for detail; verify candidate Issues live.
   **MUTATIONS:** None; preserve both disjoint active tracks.
   **STOP/ASK:** No; report each track’s state and next actionable batch without arbitrarily combining them.

4. **ACTIONS:** Read the three Issues live and resolve specification precedence; ordered multi-Issue work qualifies for admission. Run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write Goal, estimates, and three sequential batches; verify with `status.sh --json` / `next.sh --json`.
   **MUTATIONS:** Create `.dev-backlog/` and the active sprint with complete `#N` checkbox references; no tracker changes or invented spec files.
   **STOP/ASK:** No, assuming Issues provide sufficient requirements; missing spec skills do not block the core cycle.

5. **ACTIONS:** Read the live Issue and effective specification; implement directly, verify every AC, create a PR, then complete the authorized merge/closure workflow.
   **MUTATIONS:** Implementation files, deliberate Issue AC/lifecycle updates, and PR; no sprint, local task files, or required `.dev-backlog/` bootstrap.
   **STOP/ASK:** No; neither missing Relay nor missing spec infrastructure requires a sprint.

6. **ACTIONS:** Read existing sprint/context if present; run `gh issue view 42 --json body,comments`; apply `spec_ref:` over newest `## Agent Brief` over body; implement and verify all three AC against the effective specification.
   **MUTATIONS:** Code and verified Issue AC; if already admitted, mark Plan `[~]` with branch/PR pointer and update Progress, then `[x]` after verified completion.
   **STOP/ASK:** No local task files needed; stop execution if the live read fails, and ask only for material specification ambiguity.

7. **ACTIONS:** Read `_context.md` and active sprints if present; run `status.sh --json` / `next.sh --json`; use live GitHub reads to identify and inspect the next Issue.
   **MUTATIONS:** None during orientation; absence of local task files does not trigger bootstrap or sprint creation.
   **STOP/ASK:** No routine question; report the next Issue/batch or a justified sprint-planning need. Fail closed if live GitHub reads fail.

8. **ACTIONS:** Read available repo context and sprint files; summarize only recorded local state. Diagnose unavailable GitHub access; do not treat local Plan entries as a current task specification.
   **MUTATIONS:** None; no implementation, AC, or lifecycle changes.
   **STOP/ASK:** Stop task execution until live GitHub reads succeed; request restored access if user intervention is needed.

9. **ACTIONS:** Read context and sprint; re-read planned Issues live and verify current AC/completion. Resolve unfinished tasks first; run `sprint-close.sh` (with `--track` if needed); after success, promote project-level Running Context into `_context.md`.
   **MUTATIONS:** Any justified task closure/Plan updates; script sets `status: completed` and final Progress; update `_context.md`, preserving the closed sprint as immutable history.
   **STOP/ASK:** No routine confirmation; stop closure for incomplete work, failed live reads, or script/doctor blockers. Local task files are unnecessary.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; resolve current specification precedence; compare changes with implementation and reverify every affected AC before completion.
    **MUTATIONS:** Adjust implementation and deliberate AC updates to current requirements; update admitted sprint context/progress and Plan when warranted. Never overwrite newer requirements with stale text.
    **STOP/ASK:** Ask if changes introduce conflicting or materially ambiguous scope; otherwise continue. A failed live read stops execution and lifecycle changes.

11. **ACTIONS:** Inspect legacy `_context.md` if present and the active sprint; run `setup-dev-backlog.js` to migrate the recognized layout; read migrated context/sprint, then run `status.sh --json` / `next.sh --json` and verify the next Issue live.
    **MUTATIONS:** Migrate legacy sprints, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place; no tracker changes or duplicate sprint.
    **STOP/ASK:** No routine confirmation for the prescribed migration; stop for migration conflicts or failed live Issue reads before execution.