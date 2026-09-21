All actions below are hypothetical; no commands or files are accessed. Script names refer to the installed skill’s `scripts/` directory, run from the repository root.

1. **ACTIONS:** Read `_context.md` and the active sprint; run `status.sh --json` and `next.sh --json`; read the candidate Issue through the declared authority. Report latest Progress, Plan state, next `[ ]` batch, and every in-flight PR/branch pointer or `unmoored`, plus recorded ownership or `unknown`.
   **MUTATIONS:** None.
   **STOP/ASK:** No for orientation; `[ ]` selection alone does not authorize dependencies or taking over `[~]` work.

2. **ACTIONS:** Read context and the existing active track; inspect scope and live Issues. Use `sprint-init.js "topic" --scope "…"` or `--component "…"` only with a valid scope; overlapping creation must be refused. Identify whether the work belongs in the existing track or should wait.
   **MUTATIONS:** No conflicting sprint; update the existing Plan only when that placement is established and authorized.
   **STOP/ASK:** Stop overlapping creation; ask about placement if the user’s intent does not resolve it. Never falsify scope to bypass the guard.

3. **ACTIONS:** Read `_context.md` and both Plans; run portfolio `status.sh --json` and `next.sh --json`, then use `--track auth` and `--track billing` as needed. Live-read candidate Issues; report each track’s Progress, next batch, in-flight pointers, and ownership.
   **MUTATIONS:** None; both disjoint active tracks remain valid.
   **STOP/ASK:** No for orientation; do not arbitrarily collapse the portfolio or select an execution owner.

4. **ACTIONS:** Read the three Issues with `gh issue view N --json body,comments`, applying specification precedence. Their required ordering admits a sprint. Run `setup-dev-backlog.js`, then `sprint-init.js "topic"`; write a Goal and three sequential batches with complete `#N` refs and estimates.
   **MUTATIONS:** Create `.dev-backlog/` and the first active sprint; tracker unchanged. Do not invent charter IDs or require optional spec skills.
   **STOP/ASK:** No, provided live specifications establish the work; missing spec infrastructure is not a blocker.

5. **ACTIONS:** Read the Issue with `gh issue view N --json body,comments`; follow any overriding specification. For requested implementation, implement, verify AC, create a PR, then complete and close through the prescribed lifecycle.
   **MUTATIONS:** Implementation files and deliberate Issue/PR updates as work proceeds; no sprint or `.dev-backlog/` bootstrap is needed.
   **STOP/ASK:** No; a self-contained Issue follows the sprint-free default.

6. **ACTIONS:** Resolve authority; for GitHub run `gh issue view 42 --json body,comments`. Apply newest Agent Brief and `spec_ref:` precedence; implement and verify all three live AC individually. Re-read before completion and use `gh issue close 42` after completion requirements hold.
   **MUTATIONS:** Implementation files; explicitly check only verified Issue AC and update lifecycle. No local task mirror or unnecessary sprint.
   **STOP/ASK:** No unless the live read fails or a material specification ambiguity blocks implementation.

7. **ACTIONS:** Check `.tracker` and any existing context/sprints; use `status.sh --json` and `next.sh --json`. With default GitHub and no sprint, use `gh issue list` and `gh issue view N --json body,comments` to identify live work and assess sprint admission.
   **MUTATIONS:** None during orientation; absence of local task files does not require creating them.
   **STOP/ASK:** No for discovery; ask for priority only if available evidence cannot identify the intended next work.

8. **ACTIONS:** Read available context and sprint files; use local `status.sh --json` / `next.sh --json` output where available. Diagnose the failed authority read; report only last-recorded state, including in-flight pointers or `unmoored` and ownership or `unknown`.
   **MUTATIONS:** None.
   **STOP/ASK:** Stop before dispatch, Plan mutation, execution, or AC/lifecycle claims. The next live Issue remains unknown until authority access succeeds.

9. **ACTIONS:** Read context and sprint; re-read planned Issues and verify current AC for task completion. Finish outstanding items or explicitly strike/carry them with Progress. Run `sprint-close.sh`; after success, promote reusable project context into `_context.md`.
   **MUTATIONS:** Any justified task closures and Plan updates; sprint becomes completed with final Progress; `_context.md` gains future-relevant context. Completed sprint deletion is optional.
   **STOP/ASK:** No if completion conditions hold; stop for failed authority reads or unresolved disposition of unfinished work. Local task files are unnecessary.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`; resolve newest Agent Brief and overriding `spec_ref:`. Compare current requirements with implemented work, adjust implementation, and reverify every current AC before completion.
   **MUTATIONS:** Necessary implementation changes, explicit verified AC updates, and admitted sprint context/Progress; correct stale completion claims.
   **STOP/ASK:** No for clear changes within authorized scope; ask when changes introduce material ambiguity or require a new scope decision.

11. **ACTIONS:** Recognize the legacy skill layout; run `setup-dev-backlog.js` to migrate it. Read migrated context and active sprint; run `status.sh --json` and `next.sh --json`, then live-read the candidate Issue.
   **MUTATIONS:** Migrate legacy sprints, config, and triage into `.dev-backlog/`; leave `backlog/tasks/`, `docs/`, and `completed/` in place. Tracker task content remains unchanged.
   **STOP/ASK:** No for routine migration; do not create a duplicate active sprint or infer task authority from the legacy directory name.

12. **ACTIONS:** Honor `.tracker: backlog`; run `backlog task 7 --plain`, follow any `spec_ref:`, implement, and verify AC. Re-read before completion; use `backlog task edit 7 -s Done`, substituting the configured terminal status if different.
   **MUTATIONS:** Implementation files and deliberate Backlog task AC/status updates; sprint updates only if admitted.
   **STOP/ASK:** No; Backlog.md requires no GitHub remote.

13. **ACTIONS:** Honor `.tracker: backlog`; diagnose the missing CLI, for example with `command -v backlog`. Report that the declared authority cannot be read; retain only provisional local orientation.
   **MUTATIONS:** None; do not change `.tracker`, use GitHub, or substitute raw local task files.
   **STOP/ASK:** Stop task execution and AC/lifecycle mutations until the Backlog CLI is available and a live read succeeds. Request the missing prerequisite if it cannot be restored within existing authorization.
