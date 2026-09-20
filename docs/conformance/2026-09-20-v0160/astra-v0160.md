All actions below are hypothetical; nothing is executed. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repo root. Authority reads honor `spec_ref:` and, on GitHub, the newest `## Agent Brief`.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the selected live Issue using the declared authority.
   **MUTATIONS:** None; report sprint state, incomplete work, and the next actionable batch.
   **STOP/ASK:** No, unless the authority read fails.

2. **ACTIONS:** Read existing context and the active track’s scope; check sprint admission. `sprint-init.js` must refuse overlapping scope; identify whether to extend the existing Plan or propose a genuinely disjoint track.
   **MUTATIONS:** No conflicting sprint; update the existing Plan only when that planning choice is authorized.
   **STOP/ASK:** Ask which scope or existing-track change the user intends if the request leaves that unresolved; never bypass overlap protection.

3. **ACTIONS:** Read `_context.md` and both active sprints; run portfolio `status.sh --json` and `next.sh --json`, then use `--track auth` and `--track billing` as needed; read the next live Issues.
   **MUTATIONS:** None; report each track’s state and next actionable batch.
   **STOP/ASK:** No; disjoint active tracks are valid.

4. **ACTIONS:** Read the three live Issues with `gh issue view N --json body,comments`; run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write a Goal and three ordered dependent batches with complete refs, checkboxes, and estimates.
   **MUTATIONS:** Create `.dev-backlog/` and an active sprint recording the required order; no tracker changes merely for planning.
   **STOP/ASK:** No if the Issues provide sufficient task definitions. Ordered multi-Issue execution admits a sprint; absent optional spec skills do not block it or require installation.

5. **ACTIONS:** Read the live Issue using `gh issue view N --json body,comments`; implement, verify its AC, create a PR, and complete the Issue lifecycle when verified.
   **MUTATIONS:** Implementation files and deliberate Issue AC/lifecycle updates; no `.dev-backlog/` or sprint required.
   **STOP/ASK:** No; a self-contained Issue follows the default sprint-free cycle.

6. **ACTIONS:** Read available sprint context, then `gh issue view 42 --json body,comments`; implement and verify all three current AC items; update verified AC. Re-read before final completion and closure.
   **MUTATIONS:** Implementation files and Issue #42 AC/lifecycle; if admitted, mark its Plan item `[~]` with a branch/PR pointer, then `[x]` after completion, and update Progress.
   **STOP/ASK:** No; local task files are unnecessary. Stop execution if the live authority read fails.

7. **ACTIONS:** Determine the declared authority, defaulting to GitHub; read any `_context.md` and active sprint; run `status.sh --json` and `next.sh --json`; read the selected live task.
   **MUTATIONS:** None during orientation; do not manufacture local task copies or a sprint.
   **STOP/ASK:** No if a next task is identifiable; ask for direction if no actionable task or selection basis exists.

8. **ACTIONS:** Read available repo context and `.tracker`; attempt the declared authority’s read. If it is GitHub, diagnose unavailable access and report only provisional local context.
   **MUTATIONS:** None while the required authority read is unavailable.
   **STOP/ASK:** Stop task execution and request restored access if GitHub is authoritative. If `.tracker` declares a working local Backlog.md authority, use it; lack of GitHub access alone does not block that route.

9. **ACTIONS:** Read context and the sprint; re-read live planned tasks and verify completion, resolving remaining Plan items by completion, striking, or carrying with a Progress entry. Run `sprint-close.sh`; after success, promote reusable Running Context into `_context.md`.
   **MUTATIONS:** Any necessary verified task closures and Plan updates; the script completes the sprint and appends final Progress; update `_context.md`, preserving the completed sprint thereafter.
   **STOP/ASK:** No merely because local task files are absent; stop if required authority reads fail or unresolved work requires a user decision.

10. **ACTIONS:** Re-read the live Issue and applicable overrides; compare the current specification with implementation and evidence; adapt work and reverify every current AC before completion.
   **MUTATIONS:** Necessary implementation changes, verified Issue AC updates, and admitted sprint context/progress; preserve the user’s specification changes.
   **STOP/ASK:** Ask only for conflicting or ambiguous requirements; stop if the authority cannot be read.

11. **ACTIONS:** Identify the legacy active sprint and context; run `setup-dev-backlog.js` to migrate the skill layout; read migrated context, run `status.sh --json` and `next.sh --json`, and read the next live task.
   **MUTATIONS:** Migrate legacy sprints, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker mutation.
   **STOP/ASK:** No for the defined migration; preserve the active sprint rather than creating a replacement.

12. **ACTIONS:** Read available sprint context and `backlog task 7 --plain`; follow any `spec_ref:`, implement, verify AC, and explicitly update the task. Complete with `backlog task edit 7 -s Done`, using the configured terminal status if different.
   **MUTATIONS:** Implementation files and Backlog.md task AC/status; admitted sprint Plan and Progress as applicable.
   **STOP/ASK:** No; `.tracker` declares Backlog.md, which needs no GitHub remote.

13. **ACTIONS:** Honor `.tracker: backlog`; diagnose the missing `backlog` executable and the installation/PATH prerequisite.
   **MUTATIONS:** None; do not switch `.tracker`, use GitHub, or execute from cached task text.
   **STOP/ASK:** Stop task execution until the declared CLI is available and `backlog task N --plain` succeeds; request environment repair if needed.