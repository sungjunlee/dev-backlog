Simulation only; no commands run or files accessed. Commands below would run from the repository root, using scripts from the installed skill’s `scripts/` directory. Referenced documents not included in the prompt are not assumed.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; resolve the next task with `effective-task-spec.js TASK_REF`; report current state and next actionable batch.
   **MUTATIONS:** None; orientation does not advance Plan checkboxes.
   **STOP/ASK:** No, unless live tracker resolution fails.

2. **ACTIONS:** Read existing context and active Plan; compare proposed scope; retain `sprint-init.js`’s overlap guard. Incorporate related work into the existing track if consistent with the requested scope.
   **MUTATIONS:** Deliberately update the existing Goal/Plan if appropriate; do not create an overlapping active sprint or change tracker lifecycle merely for planning.
   **STOP/ASK:** Ask if proceeding requires choosing between changing existing commitments and deferring the new sprint; never bypass the overlap refusal.

3. **ACTIONS:** Read `_context.md` and both active sprint files; run portfolio `status.sh --json` and `next.sh --json`; use `--track auth` and `--track billing` for detail; report each track’s next batch.
   **MUTATIONS:** None; preserve both disjoint active tracks.
   **STOP/ASK:** No; portfolio orientation does not require selecting only one track.

4. **ACTIONS:** Inspect live GitHub issues with `gh`; establish work meeting Sprint Admission; run `setup-dev-backlog.js --tracker github --non-interactive`, then `sprint-init.js "topic"`; write Goal, ordered batches, normalized issue refs, and estimates.
   **MUTATIONS:** Create `.dev-backlog/` configuration and the active sprint; omit unsupported objectives/component fields. Add `--scope` only for an explicitly declared scope; create no substitute spec documents.
   **STOP/ASK:** No for admitted work; if complexity does not justify a sprint, explain that and clarify the intended continuity need. Missing spec skills alone is no blocker.

5. **ACTIONS:** Resolve the issue using `effective-task-spec.js "#N"`; implement directly, verify every AC, re-resolve before completion, then merge or commit and close through `adapter.close`.
   **MUTATIONS:** Implementation files and explicit GitHub AC/lifecycle updates; no sprint, local task mirror, or Relay installation.
   **STOP/ASK:** No; one self-contained issue follows the sprint-free path. Stop if live resolution fails.

6. **ACTIONS:** Run `effective-task-spec.js "#42"`; follow its effective specification and source precedence; implement and verify all three effective AC items; re-resolve before merge/commit and closure.
   **MUTATIONS:** Implementation files and verified tracker AC/lifecycle; update `[~]`, pointer, and Progress only if #42 belongs to an admitted sprint.
   **STOP/ASK:** No; missing local task files is expected. Stop if resolution fails or effective requirements contain a blocking ambiguity.

7. **ACTIONS:** Read `_context.md` and active sprint files if present; identify the chosen tracker; run `status.sh --json` and `next.sh --json`; resolve the next live task and report the next action.
   **MUTATIONS:** None during orientation; do not create task mirrors or a sprint simply because the session is fresh.
   **STOP/ASK:** No for orientation; stop and diagnose if the configured tracker is unavailable.

8. **ACTIONS:** Read available repository context and sprint records; report provisional execution context and the live-state verification gap. For a GitHub-backed repository, diagnose unavailable access before resolving or executing tasks.
   **MUTATIONS:** None; do not infer current AC/lifecycle from repository snapshots or exports.
   **STOP/ASK:** Stop GitHub-backed execution and request restored access. If the repository instead explicitly chooses `files` and its CLI works, GitHub access is irrelevant; use that authority.

9. **ACTIONS:** Check that the Plan is complete and task completion was verified against current effective specifications; resolve outstanding discrepancies first. Run `sprint-close.sh`; after success, promote reusable project context to `_context.md`.
   **MUTATIONS:** The script marks the sprint completed and appends final Progress; update `_context.md`, preserving the completed sprint as permanent history. No local task files are needed.
   **STOP/ASK:** No if completion checks pass; stop closure for unresolved tasks or failed checks.

10. **ACTIONS:** Re-run `effective-task-spec.js "#N"`; compare effective source, digest, AC, and lifecycle with the prior result; adjust implementation and verification to the current specification before completion.
   **MUTATIONS:** Update implementation and verified tracker AC deliberately; revise admitted Plan/context/progress where affected. Do not overwrite changed requirements with a stale copy.
   **STOP/ASK:** Ask only for contradictory or materially ambiguous changes; stop if live resolution fails. A resolvable change alone needs no permission.

11. **ACTIONS:** Honor `.tracker=files`; run `effective-task-spec.js BACK-7`; implement and verify both effective AC items; re-resolve, merge or commit, then use the adapter’s `backlog task edit` operation to mark Done.
   **MUTATIONS:** Implementation files and AC/status through Backlog.md CLI; no sprint and no direct parsing or editing of `backlog/tasks/*.md`.
   **STOP/ASK:** No; the installed chosen CLI supports the sprint-free task cycle. Stop if its resolver fails.

12. **ACTIONS:** Inspect legacy context, active sprint, `.tracker`, and configuration; verify live GitHub tasks using `gh`. Check documented compatibility before relying on `status.sh` / `next.sh`: the supplied contract does not specify legacy discovery or migration.
   **MUTATIONS:** None; do not bootstrap a competing `.dev-backlog/` hub, move files, or assume the scripts discover legacy state.
   **STOP/ASK:** Report provisional orientation; ask for the migration/compatibility contract before any layout conversion. Read-only inspection and live GitHub verification can proceed.