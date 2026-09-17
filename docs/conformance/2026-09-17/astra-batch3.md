All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the repository root. Referenced adapter details were not supplied, so adapter commands are identified by operation.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; resolve the next task with `effective-task-spec.js TASK_REF`. Report current state and next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless live resolution fails; report the blocker without executing work.

2. **ACTIONS:** Read existing context and the active track; compare requested scope. `sprint-init.js` must refuse the overlapping new track; determine whether the work belongs in the existing Plan or should follow it.
   **MUTATIONS:** No overlapping sprint; update the existing Plan and Progress only if the requested planning authorizes that inclusion.
   **STOP/ASK:** Stop new-track creation; ask if choosing between existing-track inclusion and deferred work requires a user decision.

3. **ACTIONS:** Read `_context.md` and both active sprints; run portfolio `status.sh --json` and `next.sh --json`, then use `--track auth` and `--track billing` as needed. Report each track’s state and next batch.
   **MUTATIONS:** None; disjoint active tracks may coexist.
   **STOP/ASK:** No for orientation; ask only if subsequent execution requires a priority the evidence cannot establish.

4. **ACTIONS:** Run `setup-dev-backlog.js --tracker github --non-interactive`; resolve all three issues; run `sprint-init.js "topic"`; write a Goal, estimates, and three sequential batches in the required order.
   **MUTATIONS:** Create `.dev-backlog/` configuration and the active sprint; add complete issue refs with `[ ]` checkboxes. No tracker changes or invented spec files.
   **STOP/ASK:** No; ordered multi-Issue execution admits a sprint, and optional spec skills are not prerequisites. Stop if task resolution fails.

5. **ACTIONS:** Resolve the issue using `effective-task-spec.js TASK_REF` with default GitHub authority; implement directly, verify AC, create a PR, re-resolve before completion, merge and close through the adapter.
   **MUTATIONS:** Implementation files and explicit tracker AC/lifecycle updates; no sprint or local task mirror.
   **STOP/ASK:** No; neither Relay nor a spec axis is required. Stop if live resolution fails.

6. **ACTIONS:** Run `effective-task-spec.js 42`; use its effective source and AC, which may supersede the body. Implement, verify every effective AC, re-resolve before completion, then merge or commit and close through the adapter.
   **MUTATIONS:** Implementation files and verified tracker AC/lifecycle; update Plan `[~]` with a pointer, then `[x]` and Progress if already admitted.
   **STOP/ASK:** No solely because local task files are absent; stop on failed live resolution or unresolved specification ambiguity.

7. **ACTIONS:** Inspect configured tracker and any `_context.md`/active sprints; run `status.sh --json` and `next.sh --json`; resolve the next live task. Establish current state from repository context and tracker evidence.
   **MUTATIONS:** None during orientation; no automatic export, task-file creation, or sprint initialization.
   **STOP/ASK:** No for orientation; absent an execution request, report the next action without starting implementation.

8. **ACTIONS:** Read available configuration, `_context.md`, and active sprint files; attempt the configured adapter’s resolution if available. For GitHub authority, report repository-derived state as unverified when access fails.
   **MUTATIONS:** None; do not substitute local copies for unavailable GitHub truth or switch adapters.
   **STOP/ASK:** Stop task execution and AC/lifecycle changes until live resolution succeeds; request restored access. A configured, available files adapter can still operate locally.

9. **ACTIONS:** Re-resolve planned tasks and verify completion against current AC; finish any authorized outstanding work. Run `sprint-close.sh` (with `--track` if needed); after success, promote reusable project-level Running Context into `_context.md`.
   **MUTATIONS:** Any necessary verified tracker completion; sprint becomes completed with final Progress; `_context.md` gains future-relevant context. Preserve the completed sprint.
   **STOP/ASK:** No because task files are absent; stop closure if tasks remain unresolved or required checks fail.

10. **ACTIONS:** Re-run `effective-task-spec.js TASK_REF`; compare its source, digest, AC, and lifecycle with the earlier resolution. Reconcile implementation and verification with the current effective specification before completion.
    **MUTATIONS:** Adjust implementation and explicit tracker updates only as warranted; record consequential decisions in admitted sprint context/progress.
    **STOP/ASK:** Pause stale-spec completion; ask if changes introduce conflicting intent or unclear scope. A digest change alone does not require asking.

11. **ACTIONS:** Run `effective-task-spec.js BACK-7` through the configured files adapter; implement, verify both effective AC, re-resolve, then commit or merge and close using the adapter’s Backlog.md CLI operation.
    **MUTATIONS:** Implementation files and canonical Backlog.md task AC/lifecycle; no GitHub issue and no sprint for this self-contained task.
    **STOP/ASK:** No; stop if the files adapter cannot resolve the task. Never fall back to GitHub.

12. **ACTIONS:** Recognize the legacy layout; run `setup-dev-backlog.js --tracker github --non-interactive` to migrate it. Read migrated context and active sprint; run `status.sh --json` and `next.sh --json`.
    **MUTATIONS:** Migrate skill-owned sprints, `.tracker`, config, and any triage data into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker mutation or new sprint.
    **STOP/ASK:** No for the specified migration; stop if conflicting destination state or adapter failure prevents safe orientation.