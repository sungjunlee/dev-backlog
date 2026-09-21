All actions below are hypothetical; no commands or files are accessed. Script names refer to the installed skill’s `scripts/` directory, run from the repo root.

1. **ACTIONS:** Read `_context.md`, the active sprint, and declared authority; run `status.sh --json` and `next.sh --json`. Read the next live Issue through that authority; report sprint state and next actionable batch, accounting for `[~]` work.
   **MUTATIONS:** None for orientation.
   **STOP/ASK:** No, unless the authority read fails; then diagnose and stop task execution.

2. **ACTIONS:** Read existing context, active scope, and live Issues; confirm sprint admission. Use `sprint-init.js "topic"` with the proposed explicit component or scope; its overlap guard must refuse the conflicting track.
   **MUTATIONS:** No overlapping active sprint; preserve the existing track.
   **STOP/ASK:** Ask whether to incorporate work into the existing track, defer it, or choose a genuinely disjoint scope. Do not bypass the guard.

3. **ACTIONS:** Read `_context.md` and both active Plans; run `status.sh --json` and `next.sh --json` for the portfolio, then `next.sh --track auth` and `next.sh --track billing` as needed. Read each next live Issue.
   **MUTATIONS:** None.
   **STOP/ASK:** No; disjoint active tracks are valid. Report each track’s state and next batch without forcing a single active sprint.

4. **ACTIONS:** Read the three Issues with `gh issue view N --json body,comments`, applying override precedence. Their required ordering admits a sprint: run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write a Goal, estimates, and three sequential batches in the named order.
   **MUTATIONS:** Create `.dev-backlog/` and the first active sprint; no tracker changes required.
   **STOP/ASK:** No, provided live specifications are adequate. Missing optional spec skills/files do not block the core cycle or require installing them.

5. **ACTIONS:** Read the Issue with `gh issue view N --json body,comments`, resolve overrides, implement, verify every AC, and create a PR; close the Issue after completion verification and merge or commit.
   **MUTATIONS:** Implementation files, PR, and deliberate Issue AC/lifecycle updates; no sprint or `.dev-backlog/` bootstrap needed.
   **STOP/ASK:** No; one self-contained Issue follows the sprint-free default, absent additional continuity needs.

6. **ACTIONS:** Resolve authority; for default GitHub, run `gh issue view 42 --json body,comments`. Resolve Agent Brief/`spec_ref:` precedence, implement, verify all three current AC items, and explicitly reflect verified results on the Issue; re-read before closure.
   **MUTATIONS:** Implementation files and verified Issue AC/lifecycle updates; sprint progress only if already admitted.
   **STOP/ASK:** No; local task files are unnecessary. Stop execution if the live authority read fails.

7. **ACTIONS:** Read any `.tracker`, `_context.md`, and active sprint; run `status.sh --json` and `next.sh --json`. Read the identified live task using the declared authority, defaulting to GitHub.
   **MUTATIONS:** None merely to establish orientation; do not generate local task mirrors.
   **STOP/ASK:** No if a next task is determinable. Ask for direction if no actionable task can be identified; stop execution on failed authority reads.

8. **ACTIONS:** Inspect available repo context and authority declaration; attempt the declared read, such as `gh issue view N --json body,comments`, and diagnose its unavailability. Report local sprint state only as an unverified execution picture.
   **MUTATIONS:** None; no implementation, AC, or lifecycle changes.
   **STOP/ASK:** Stop task execution until live authority access succeeds. Request restored access; repo files cannot substitute for canonical task specifications.

9. **ACTIONS:** Read context and Plan; re-read live Issues and verify current AC before task closure. Ensure every Plan item is `[x]` or explicitly struck/carried with a Progress entry; run `sprint-close.sh`, then promote reusable project context to `_context.md`.
   **MUTATIONS:** Verified tracker closures as needed; final Plan/Progress, `status: completed`, and `_context.md`. Completed sprint deletion is optional.
   **STOP/ASK:** No if completion conditions hold. Stop on authority failure or unresolved completion requirements; local task files are unnecessary.

10. **ACTIONS:** Re-read with `gh issue view N --json body,comments`; apply newest Agent Brief and overriding `spec_ref:`. Compare the current specification with implementation, adjust work, and reverify every current AC before closure.
   **MUTATIONS:** Required implementation changes, deliberate AC updates, and admitted sprint context/progress; undo stale completion claims where necessary.
   **STOP/ASK:** No for clear changes within authorized scope. Ask if the change creates material ambiguity or conflicts with user instructions; do not close against stale requirements.

11. **ACTIONS:** Run `setup-dev-backlog.js` to migrate the recognized legacy skill layout. Read migrated `_context.md` and active sprint; run `status.sh --json`, `next.sh --json`, and read the next live Issue.
   **MUTATIONS:** Migrate skill sprints/config/triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker mutation.
   **STOP/ASK:** No for this supported migration. Legacy `backlog/config.yml` alone does not declare Backlog.md authority.

12. **ACTIONS:** Honor `.tracker: backlog`; read context if present and run `backlog task 7 --plain`, resolving any `spec_ref:`. Implement and verify AC, explicitly update the task, then use `backlog task edit 7 -s Done` or the configured terminal status when complete.
   **MUTATIONS:** Implementation files, Backlog.md task AC/status, and admitted sprint progress if applicable.
   **STOP/ASK:** No; GitHub and a GitHub remote are unnecessary.

13. **ACTIONS:** Honor the declared Backlog.md authority; attempt `backlog task N --plain` and diagnose the missing CLI. Identify installation/restoration as the prerequisite; do not select another authority based on available tooling.
   **MUTATIONS:** None to tracker, authority declaration, or implementation files.
   **STOP/ASK:** Stop task execution and request that the CLI be made available, or clarification on installing it; resume only after a successful canonical read.
