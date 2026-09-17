All actions below are hypothetical. Scripts resolve from the installed skill’s `scripts/` directory and run from the repository root.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the next Issue live with `gh issue view N --json body,comments`; report current state and next actionable batch.
   **MUTATIONS:** None; orientation does not advance Plan checkboxes.
   **STOP/ASK:** No, unless the live tracker read fails; then diagnose and stop before task execution.

2. **ACTIONS:** Read context and the active track; assess sprint admission and scope overlap. `sprint-init.js` must refuse an overlapping new track. Identify whether the requested work belongs in the existing Plan or should wait.
   **MUTATIONS:** No overlapping sprint; update the existing Plan and Progress only when that integration is within the authorized scope.
   **STOP/ASK:** Ask if integrating, deferring, or changing scope requires a user decision; do not bypass overlap protection or reopen completed history.

3. **ACTIONS:** Read `_context.md` and both sprint files; run portfolio `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for focused results; verify candidate Issues live.
   **MUTATIONS:** None; preserve both active tracks and their separate Plans.
   **STOP/ASK:** No; disjoint active tracks are supported. Report each track’s next actionable batch.

4. **ACTIONS:** Read the three Issues live and resolve specification precedence; run `setup-dev-backlog.js --tracker github --non-interactive`, then `sprint-init.js "topic"`; write a Goal, estimates, and three sequential batches in the required order.
   **MUTATIONS:** Create `.dev-backlog/`, its tracker configuration, and one active sprint with complete Issue refs and unchecked Plan items; no automatic Issue changes or spec files.
   **STOP/ASK:** No if the Issues sufficiently define the work. Ordered multi-Issue execution admits a sprint; missing optional spec skills do not block it.

5. **ACTIONS:** Read the Issue using `gh issue view N --json body,comments`; resolve its effective specification; implement, verify every AC, open a PR, then re-read and complete through the tracker.
   **MUTATIONS:** Implementation files and deliberate Issue AC/lifecycle updates; PR and closure after verification. No sprint or `.dev-backlog/` bootstrap is required.
   **STOP/ASK:** No; neither Relay nor a spec axis is required. Stop task execution if the live Issue read fails.

6. **ACTIONS:** Read available sprint context, then `gh issue view 42 --json body,comments`; apply `spec_ref:` over the newest `## Agent Brief` over the body; implement and verify all three effective AC items.
   **MUTATIONS:** Implementation files; check AC only after verification and close after final live revalidation and merge/commit. If admitted, set Plan `[~]` with a branch/PR pointer, then `[x]`, and update Progress.
   **STOP/ASK:** No merely because local task files are absent; stop if live specification access fails or material ambiguity prevents execution.

7. **ACTIONS:** Read `_context.md` and active sprint files when present; determine the configured tracker; run `status.sh --json` and `next.sh --json`; read the selected task live.
   **MUTATIONS:** None during orientation; do not recreate local task specifications or bootstrap a sprint solely for a fresh session.
   **STOP/ASK:** No if the next task is determinable; ask only for unresolved scope or priority, and stop execution on tracker-access failure.

8. **ACTIONS:** Read available repository context and sprint records; describe the recorded state as unverified; diagnose unavailable GitHub access. Resume execution only after a successful live task read.
   **MUTATIONS:** None to implementation, task AC/lifecycle, or execution state based solely on stale local records.
   **STOP/ASK:** Stop task execution and request restored access if necessary. Local files and missing conversation history cannot replace the configured tracker’s authority.

9. **ACTIONS:** Re-read planned tasks live and verify current AC and completion; finish outstanding task closure and Plan updates; run `sprint-close.sh`; after success, promote project-level Running Context into `_context.md`.
   **MUTATIONS:** Required task AC/lifecycle and Plan updates; the script marks the sprint completed and appends final Progress; update `_context.md`, retaining the completed sprint permanently.
   **STOP/ASK:** No if closure checks pass; stop on unresolved work or failed checks. Local task files are unnecessary, and completed sprint history must remain immutable afterward.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; resolve current specification precedence; compare changes with implementation and verification; adapt and reverify affected AC before completion.
    **MUTATIONS:** Necessary implementation changes and explicit tracker corrections; update admitted sprint context/progress. Do not overwrite the Issue with a stale local specification.
    **STOP/ASK:** No for clear changes within authorized scope; ask about conflicting or materially expanded requirements. Stop if the live read fails.

11. **ACTIONS:** Keep the `files` adapter; use its live read operation for `BACK-7`, implement, verify both AC, re-read, commit/merge, and use its AC-update and `close` operations. Exact CLI syntax comes from `adapter-ports.md`, which was not supplied.
    **MUTATIONS:** Implementation and canonical Backlog.md task files through deliberate adapter operations; no sprint for this self-contained task.
    **STOP/ASK:** No sprint approval needed; stop if the configured adapter cannot operate. Never substitute GitHub or invent unavailable adapter syntax.

12. **ACTIONS:** Recognize the legacy configuration and read its context/active sprint; run `setup-dev-backlog.js --tracker github --non-interactive` to migrate; then `status.sh --json`, `next.sh --json`, and a live Issue read.
    **MUTATIONS:** Migrate legacy sprints, `.tracker`, config, and any triage data into `.dev-backlog/`; preserve active state and leave `backlog/tasks/`, `docs/`, and `completed/` in place. No tracker mutations.
    **STOP/ASK:** No for the prescribed migration; stop on migration conflicts or live tracker failure. Do not treat the missing new directory as an empty project.