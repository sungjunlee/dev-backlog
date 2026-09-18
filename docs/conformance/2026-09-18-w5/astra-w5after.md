All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the repo root.

1. **ACTIONS:** Read `_context.md`, the active sprint, and `.tracker`; run `status.sh --json` and `next.sh --json`; read the next task from the declared authority. Report unfinished/in-flight work and the next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless the live authority read fails; then diagnose and stop execution.

2. **ACTIONS:** Read context and the active track; assess sprint admission and scope. `sprint-init.js` refuses overlapping scope; use the existing track for compatible admitted work or propose a later sprint.
   **MUTATIONS:** No overlapping sprint; update the existing Plan/Progress only when the requested work clearly belongs there.
   **STOP/ASK:** Ask if choosing between extending the current track and deferring work requires a scope decision; never bypass the overlap guard.

3. **ACTIONS:** Read `_context.md` and both sprint files; run `status.sh --json` and `next.sh --json` for the portfolio, then `next.sh --track auth` and `--track billing` as needed; read actionable live Issues.
   **MUTATIONS:** None.
   **STOP/ASK:** No; disjoint active tracks are valid. Report each track’s state and next batch.

4. **ACTIONS:** Read the three live Issues with `gh issue view N --json body,comments`, applying specification precedence; run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write a Goal and three sequential batches with estimates.
   **MUTATIONS:** Create `.dev-backlog/` and an active sprint with ordered `[ ]` task refs; no tracker changes or invented spec files.
   **STOP/ASK:** No if AC and dependencies are clear. Ordered multi-Issue work admits a sprint; absent spec skills do not block it. The unprovided fallback reference adds no inferable requirements.

5. **ACTIONS:** Read the live Issue using `gh issue view N --json body,comments`; implement, verify every AC, open a PR, then re-read and complete through `gh issue close N` after merge/commit.
   **MUTATIONS:** Implementation files, PR, and explicit verified Issue AC/lifecycle updates; no sprint or `.dev-backlog/` bootstrap needed.
   **STOP/ASK:** No; one self-contained Issue follows the sprint-free cycle, and Relay is optional.

6. **ACTIONS:** Read available sprint context and `.tracker`; for default GitHub, run `gh issue view 42 --json body,comments`; apply Agent Brief/`spec_ref:` precedence; implement and verify all three current AC.
   **MUTATIONS:** Implementation and explicit verified AC updates; if admitted, set Plan `[~]` with a branch/PR pointer and update Progress. Close only after completion checks.
   **STOP/ASK:** No; local task files are unnecessary. Stop execution if the authority read fails.

7. **ACTIONS:** Read `.tracker`, `_context.md`, and active sprint files when present; run `status.sh --json` and `next.sh --json`; read the selected live task using its authority’s Read command.
   **MUTATIONS:** None during orientation.
   **STOP/ASK:** No solely because local task files are missing; ask for selection only if available evidence cannot identify the intended work.

8. **ACTIONS:** Read repo context, active Plans, and `.tracker`; use `status.sh`/`next.sh` where possible, explicitly labeling local findings as unverified. Attempt the declared authority’s Read command.
   **MUTATIONS:** None.
   **STOP/ASK:** If authority is GitHub and access fails, stop task execution and request restored access; local text cannot replace it. If a usable local Backlog authority is declared, proceed through that authority.

9. **ACTIONS:** Re-read planned live tasks and verify current AC/completion; finish any outstanding task closure first. Run `sprint-close.sh` (`--track` if needed); after success, promote project-level Running Context into `_context.md`.
   **MUTATIONS:** Explicit remaining task closures if warranted; completed sprint status/final Progress via the script; durable context in `_context.md`. Preserve the completed sprint.
   **STOP/ASK:** No if all checks pass; stop closure on unresolved work or failed authority reads. Local task files are unnecessary.

10. **ACTIONS:** Re-read the Issue with its authority command; resolve the newest Agent Brief and any `spec_ref:`; compare implementation against the current specification, adjust work, and reverify every AC before completion.
    **MUTATIONS:** Necessary implementation changes and explicit AC updates; admitted sprint decisions/Progress and Plan state as appropriate.
    **STOP/ASK:** Ask if the changed specification is contradictory or materially ambiguous; otherwise proceed. Never close against the stale specification.

11. **ACTIONS:** Inspect the legacy context, active sprint, and config; recognize existing work. Run `setup-dev-backlog.js` to migrate the skill layout, then `status.sh --json`, `next.sh --json`, and the live task read.
    **MUTATIONS:** Migrate legacy sprints/config/triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker lifecycle changes or duplicate sprint.
    **STOP/ASK:** No for routine migration; stop if conflicting destination state makes migration unsafe.

12. **ACTIONS:** Read available sprint context and `.tracker`; run `backlog task 7 --plain`, resolving any `spec_ref:`; implement and verify all AC; complete with `backlog task edit 7 -s Done`, using the configured terminal status.
    **MUTATIONS:** Implementation and explicit Backlog AC/status changes; sprint Plan/Progress only if admitted.
    **STOP/ASK:** No; a GitHub remote is unnecessary. Stop if the Backlog authority read fails.

13. **ACTIONS:** Honor `.tracker`; attempt `backlog task N --plain` for the selected task and diagnose the missing CLI. Identify installation/restoration as the prerequisite, then retry the live read once available.
    **MUTATIONS:** None to tracker or task files while the authority is unreadable; do not switch `.tracker` or use local copies as fallback.
    **STOP/ASK:** Stop execution and request CLI availability if it cannot be restored within authorization; resume only after a successful authority read.