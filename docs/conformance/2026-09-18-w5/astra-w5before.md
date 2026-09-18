All actions below are hypothetical; no commands or file operations are performed. Scripts resolve from the installed skill’s `scripts/` directory and run from the target repository root.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the next Issue with `gh issue view N --json body,comments`. Report Plan state and the next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless the live GitHub read fails; then diagnose and stop execution.

2. **ACTIONS:** Read existing context and the active track; evaluate admission and scope. `sprint-init.js "topic" --scope "..."` must refuse overlapping scope. Consider adding admitted work to the existing Plan or deferring it.
   **MUTATIONS:** No overlapping sprint; update the existing Plan only when that placement is authorized and clear.
   **STOP/ASK:** Stop overlapping creation; ask about placement if intent does not resolve it. Never bypass the overlap guard.

3. **ACTIONS:** Read `_context.md` and both sprint files; run `status.sh --json` and `next.sh --json` for the portfolio, then use `--track auth` and `--track billing` as needed. Verify next Issues live.
   **MUTATIONS:** None; retain both disjoint active tracks.
   **STOP/ASK:** No for orientation; report each track’s state and next batch without inventing a combined priority.

4. **ACTIONS:** Read the three live Issues and resolve their specifications. Ordered multi-Issue work qualifies for admission: run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write Goal, estimates, and three dependency-ordered batches.
   **MUTATIONS:** Create `.dev-backlog/` and the active sprint with checkbox refs `#N`; no tracker changes needed.
   **STOP/ASK:** No. Missing spec files or craftkit skills do not block the core cycle; do not invent a spec axis. Failed GitHub reads do block execution.

5. **ACTIONS:** Read the Issue via `gh issue view N --json body,comments`; implement directly, verify AC, create a PR, then re-read the live specification before completion and closure.
   **MUTATIONS:** Implementation files, explicit Issue AC updates, PR, and eventual Issue closure; no sprint or `.dev-backlog/` required.
   **STOP/ASK:** No. A self-contained Issue needs neither a sprint nor Relay; stop if its live read fails.

6. **ACTIONS:** Read any existing sprint context, then `gh issue view 42 --json body,comments`; apply specification precedence, implement, and verify all three current AC items.
   **MUTATIONS:** Implementation files and explicitly verified Issue checkboxes; if admitted, set Plan `[~]` with a branch/PR pointer and update Progress. No local task files.
   **STOP/ASK:** No, unless the live read fails or a material specification ambiguity prevents correct work.

7. **ACTIONS:** Read `_context.md` and active sprint files if present; run `status.sh --json` and `next.sh --json`; read the selected live Issue and report the next action.
   **MUTATIONS:** None during orientation; absence of local task files requires no reconstruction.
   **STOP/ASK:** No for orientation. Do not infer authorization to implement solely from being online; ask for direction if no actionable intent is established.

8. **ACTIONS:** Read available context and sprint files; attempt the required live Issue read and diagnose unavailable GitHub access. Report only provisional local execution context.
   **MUTATIONS:** None; do not implement from local copies or change AC/lifecycle.
   **STOP/ASK:** Stop task execution until a live read succeeds; request restored access if user intervention is necessary.

9. **ACTIONS:** Re-read every relevant live Issue, verify current AC, and complete remaining merge/commit and closure steps. Once the Plan is done, run `sprint-close.sh`; after success, promote future-facing project context to `_context.md`.
   **MUTATIONS:** Explicit Issue completion updates; Plan `[x]` and Progress; completed sprint status/final log; `_context.md`. Preserve the closed sprint as immutable history.
   **STOP/ASK:** No if verification and close checks succeed; otherwise resolve blockers before closure. Local task files are unnecessary.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; resolve `spec_ref:` first, otherwise newest `## Agent Brief`, otherwise body. Compare changes, adjust implementation, and reverify every current AC before completion.
    **MUTATIONS:** Necessary implementation corrections, explicit AC updates, and admitted sprint context/progress.
    **STOP/ASK:** Stop completion until current requirements are verified; ask only for unresolved conflicts or material ambiguity.

11. **ACTIONS:** Recognize the legacy layout; run `setup-dev-backlog.js` to migrate it, then read migrated context/sprint and run `status.sh --json` and `next.sh --json`; verify the next Issue live.
    **MUTATIONS:** Migrate legacy sprints, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker mutation.
    **STOP/ASK:** No for routine migration; stop on migration conflicts or failed live Issue reads.

12. **ACTIONS:** Ignore `.tracker` as an authority selector; attempt `gh issue view 7 --json body,comments` and diagnose repository resolution. Use `--repo OWNER/REPO` only if the intended GitHub repository is established.
    **MUTATIONS:** None until live Issue access succeeds; no local-backlog execution.
    **STOP/ASK:** Ask for the GitHub repository if unknown. No remote does not authorize replacing GitHub task authority.

13. **ACTIONS:** Use `status.sh` / `next.sh` as appropriate and read the live Issue with `gh issue view N --json body,comments`. The supplied contract does not route through `.tracker` or require the `backlog` CLI.
    **MUTATIONS:** None solely because that CLI is absent; do not install it or rewrite `.tracker`.
    **STOP/ASK:** No due to missing `backlog`; stop only if required GitHub access fails or another actual blocker arises.