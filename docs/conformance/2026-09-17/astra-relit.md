1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; identify the next live Issue and actionable batch. All scripts here resolve from the installed skill’s `scripts/` directory and run from the repo root.
   **MUTATIONS:** None.
   **STOP/ASK:** No, unless live tracker access fails; partial Plan completion is normal.

2. **ACTIONS:** Inspect the active track and proposed scope; use `sprint-init.js` for creation, respecting its overlap refusal. Consider incorporating the work into the existing sprint or defining a genuinely disjoint track.
   **MUTATIONS:** No overlapping sprint; update the existing Plan or create a disjoint sprint only once the intended scope is settled.
   **STOP/ASK:** Ask if choosing between those alternatives changes the requested scope. Never bypass the overlap guard or prematurely complete the existing sprint.

3. **ACTIONS:** Read `_context.md` and both active sprint files; run `status.sh --json` and `next.sh --json` for the portfolio, then use `--track auth` and `--track billing` as needed.
   **MUTATIONS:** None.
   **STOP/ASK:** No. Report each track’s state and next actionable batch; disjoint active tracks are supported.

4. **ACTIONS:** Inspect live Issues and dependencies; establish sprint admission through an ordered multi-Issue batch or another stated continuity need. Run `setup-dev-backlog.js --tracker github --non-interactive`, then `sprint-init.js "topic"`; write Goal, ordered Plan, and estimates.
   **MUTATIONS:** Create `.dev-backlog/` configuration and the first active sprint. Omit unsupported `objectives` and `component`; declare `--scope` only if explicitly established. No mandatory spec files or skill installation.
   **STOP/ASK:** No if admission and scope are clear; otherwise ask for the missing execution scope. Open Issues alone do not justify a sprint.

5. **ACTIONS:** Use GitHub as the default tracker; run `effective-task-spec.js ISSUE_REF`, implement directly, verify every AC, open a PR, re-resolve before completion, then merge and close through the adapter.
   **MUTATIONS:** Implementation files and explicit GitHub AC/lifecycle updates; no sprint or local task mirror. If configuration is required for resolution, bootstrap with `setup-dev-backlog.js --tracker github --non-interactive`.
   **STOP/ASK:** No. Relay and a spec axis are optional; stop execution if live resolution fails.

6. **ACTIONS:** Run `effective-task-spec.js` with #42’s supported task reference; honor its selected source and digest; implement and verify all effective AC, including the three Issue checkboxes if they remain authoritative.
   **MUTATIONS:** Implementation files and verified tracker AC/lifecycle updates; if already admitted, mark the Plan `[~]` with a branch/PR pointer and update Progress.
   **STOP/ASK:** No merely because local task files are absent. Stop if resolution fails or requirements require clarification.

7. **ACTIONS:** Read `_context.md` and active sprint files when present; run `status.sh --json` and `next.sh --json`; consult the live tracker to identify the next Issue or batch.
   **MUTATIONS:** None during orientation; do not create local task files or a sprint merely to reconstruct session state.
   **STOP/ASK:** No if the configured tracker resolves successfully. A fresh session does not require conversation history.

8. **ACTIONS:** Read available repo context and sprint records; inspect tracker configuration and diagnose unavailable GitHub access. Report only provisional local state, without claiming a verified next live Issue.
   **MUTATIONS:** None; no task implementation, AC changes, lifecycle changes, or adapter switching.
   **STOP/ASK:** Stop tracker-dependent execution and request restored access. Local files cannot substitute for successful live task resolution.

9. **ACTIONS:** Re-resolve planned tasks and verify current AC and completion; finish any authorized outstanding task closure. Once the Plan is done, run `sprint-close.sh`, then promote project-level Running Context into `_context.md`.
   **MUTATIONS:** Explicit outstanding tracker closures if needed; completed Plan entries, final Progress, `status: completed`, and retained future context in `_context.md`. Preserve the closed sprint as immutable history.
   **STOP/ASK:** No if completion checks pass; stop closure on unresolved tasks or failed checks. Local task files are unnecessary.

10. **ACTIONS:** Re-run `effective-task-spec.js TASK_REF`; compare source, digest, AC, and lifecycle with the working snapshot. Adjust implementation and verification to the current effective specification; re-resolve again before closure.
    **MUTATIONS:** Necessary implementation changes and deliberate tracker updates reflecting verified current AC; update admitted sprint context/progress when relevant.
    **STOP/ASK:** Ask only if the change introduces ambiguity or materially changes authorized scope; stop if resolution fails. Never close against a stale specification.

11. **ACTIONS:** Keep the `files` adapter; run `effective-task-spec.js BACK-7`, implement directly, verify both effective AC, re-resolve, commit or merge, and use the configured adapter’s AC-update and close commands.
    **MUTATIONS:** Implementation files and canonical Backlog.md task AC/lifecycle through its CLI; no sprint and no GitHub mutations.
    **STOP/ASK:** No if resolution succeeds. Exact Backlog.md update/close syntax is not supplied here; consult `references/adapter-ports.md` before execution rather than inventing it.

12. **ACTIONS:** Inspect the legacy active sprint, tracker marker, and config as provisional evidence. Consult the installed migration/compatibility documentation and supported `status.sh`/`next.sh` behavior before relying on legacy-path discovery.
    **MUTATIONS:** None during orientation; do not bootstrap a competing `.dev-backlog/`, silently migrate, or treat `sync-pull.js --legacy-export` as an import command.
    **STOP/ASK:** The supplied contract does not define legacy discovery or migration. Stop any unsupported transition; ask for direction if documented compatibility cannot establish authoritative routing.