All actions below are hypothetical. Resolve scripts from the installed skill’s `scripts/` directory and run them from the repository root.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the selected live Issue through the declared authority. Report Plan state and the next actionable batch.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless the authority read fails; then stop before execution.

2. **ACTIONS:** Read existing context and the active track’s scope; inspect proposed Issues and dependencies. Use the existing track for compatible admitted work; `sprint-init.js` must refuse an overlapping new track.
   **MUTATIONS:** If incorporating the requested work, deliberately update the existing Goal/Plan and Progress; no overlapping active sprint or automatic tracker changes.
   **STOP/ASK:** Stop creation of the overlapping track. Ask only if choosing between existing-track integration and a genuinely disjoint scope requires user intent.

3. **ACTIONS:** Read `_context.md` and both sprint files; run `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for details. Read each selected live Issue.
   **MUTATIONS:** None; preserve both disjoint active tracks.
   **STOP/ASK:** No. Report the portfolio and each track’s next actionable batch; two active tracks are valid.

4. **ACTIONS:** Read the three live Issues and confirm their AC/dependencies; run `setup-dev-backlog.js`, then `sprint-init.js "topic"`. Write a Goal and three ordered batches with complete `#N` checkboxes and estimates.
   **MUTATIONS:** Create `.dev-backlog/` and the first active sprint; retain Issues as task authority. No invented spec documents or mandatory skill installation.
   **STOP/ASK:** No, provided the live Issues sufficiently define the work. Ordered multi-Issue execution admits a sprint; the missing spec axis does not itself block planning.

5. **ACTIONS:** Read the live Issue using `gh issue view N --json body,comments`, apply specification precedence, then implement, verify AC, and create a PR. Re-read before completion and use `gh issue close N` after verified completion.
   **MUTATIONS:** Implementation files and deliberate Issue AC/lifecycle updates; no `.dev-backlog/` or sprint required.
   **STOP/ASK:** No, unless the authority is unreadable or a material requirement is unclear.

6. **ACTIONS:** Read existing sprint context if present; run `gh issue view 42 --json body,comments`; honor the newest Agent Brief and any body `spec_ref:`. Implement and verify all three current AC items individually.
   **MUTATIONS:** Implementation files and verified Issue AC updates; if admitted, mark the Plan `[~]` with a branch/PR pointer and update Progress. No local task copies.
   **STOP/ASK:** No; missing local task files are irrelevant. Stop if the authoritative specification cannot be read.

7. **ACTIONS:** Inspect `.tracker` and existing context/sprints; run `status.sh --json` and `next.sh --json`. With default GitHub authority, use `gh issue list` and `gh issue view N --json body,comments` as needed to identify live work.
   **MUTATIONS:** None during orientation; do not bootstrap a sprint merely because this is a fresh session.
   **STOP/ASK:** No for orientation. Ask only if selecting among equally actionable Issues requires a user priority.

8. **ACTIONS:** Read available context, sprint files, and `.tracker`; report locally recorded state. Attempt the declared authority’s read only if accessible; a local Backlog.md authority may still work through `backlog task N --plain`.
   **MUTATIONS:** None when the required authority is inaccessible.
   **STOP/ASK:** If authority is GitHub, stop execution until live access succeeds; local files cannot establish current task truth. Missing conversation history is not itself a blocker.

9. **ACTIONS:** Read context and the sprint; re-read every planned live Issue and verify current AC/completion. Finish outstanding task closure, then run `sprint-close.sh`; after success, promote project-level Running Context to `_context.md`.
   **MUTATIONS:** Necessary verified Issue closures and Plan completion; sprint status/final Progress through the script; reusable context in `_context.md`. Preserve the completed sprint as history.
   **STOP/ASK:** Stop closure if any task remains unverified or the script fails. Otherwise no; local task files are unnecessary.

10. **ACTIONS:** Re-read the live Issue; resolve the newest Agent Brief and body `spec_ref:` precedence. Compare the effective specification with completed work, adjust implementation, and reverify current AC before completion.
    **MUTATIONS:** Necessary code changes and deliberate AC updates; admitted sprint decisions/progress as appropriate. No background synchronization or local specification overwrite.
    **STOP/ASK:** Ask if changed requirements create an unresolved scope or intent conflict; otherwise continue against the current specification. Failed reads stop execution.

11. **ACTIONS:** Inspect legacy context/sprint and authority configuration; run `setup-dev-backlog.js` to migrate the legacy skill layout, then read migrated context and run `status.sh --json` / `next.sh --json`; verify the selected live task.
    **MUTATIONS:** Migrate skill-owned sprints, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker lifecycle changes.
    **STOP/ASK:** No for the prescribed migration; stop on unresolved migration conflicts or failed authority reads. Legacy directory presence alone does not select Backlog.md authority.

12. **ACTIONS:** Read sprint context if present, then `backlog task 7 --plain`; follow any `spec_ref:`. Implement, verify AC, re-read before completion, and use `backlog task edit 7 -s Done` or the configured terminal status.
    **MUTATIONS:** Implementation files, deliberate Backlog.md AC/status updates, and admitted sprint progress if applicable.
    **STOP/ASK:** No; a GitHub remote is unnecessary. Stop only if the declared authority or effective specification cannot be read.

13. **ACTIONS:** Diagnose CLI availability, for example with `command -v backlog`; restore the required CLI before retrying `backlog task N --plain`.
    **MUTATIONS:** No task, AC, lifecycle, or sprint-execution changes while the authority read is unavailable.
    **STOP/ASK:** Stop execution until the CLI is available and a live read succeeds; ask for installation/access help if needed. Never switch authority or substitute raw local task files.
