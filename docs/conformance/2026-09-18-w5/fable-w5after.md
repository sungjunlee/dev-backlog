# fable-w5after

1. ACTIONS: Read `.dev-backlog/sprints/_context.md`, then the active sprint file (Goal, Plan, Running Context, Progress). Run `status.sh --json` and `next.sh --json` to get the next actionable batch. Verify the next batch's Issues with `gh issue view N --json body,comments`. Name the next live Issue and current sprint state.
   MUTATIONS: none.
   STOP/ASK: no; orient is read-only.

2. ACTIONS: Orient first (`_context.md`, active sprint, `status.sh`). Run `sprint-init.js "topic" --component/--scope ...`; it refuses because `scopesOverlap` detects the active track. Report the conflict and the options: add the Issues to the existing active Plan as a later batch, narrow the new scope to a disjoint one, or finish/close the existing track first.
   MUTATIONS: none until the user chooses (no forced sprint, no override).
   STOP/ASK: yes; the overlap refusal is a hard rail and resolving it changes another track's scope or plan.

3. ACTIONS: Read `_context.md` and both sprint files. Run `status.sh --json` for the portfolio view, then `next.sh --track auth` and `next.sh --track billing` for each track's next batch. Confirm scopes are disjoint (`src/auth/**` vs `src/billing/**`) and name each track's state and next live Issue.
   MUTATIONS: none.
   STOP/ASK: no.

4. ACTIONS: Read the three Issues via `gh issue view N --json body,comments` (fail-closed if any read fails). Admission: ordered multi-Issue batches qualify for a sprint. Run `setup-dev-backlog.js` to create `.dev-backlog/`, then `sprint-init.js "topic"` (optional `--scope` / `--component`). Write Goal, three sequential batches with `[ ]` `#N` refs and estimates, and a Running Context note. Per `references/spec-fallback.md`, proceed without charter/capabilities; note the missing spec axis without installing anything.
   MUTATIONS: local `.dev-backlog/` bootstrap plus one `status: active` sprint file; no Issue changes.
   STOP/ASK: no; ask only if an Issue read fails or the ordering is ambiguous.

5. ACTIONS: Sprint-free path. `gh issue view N --json body,comments` (honor Agent Brief / `spec_ref:`). Implement directly, verify every AC, open a PR, then close the Issue with `gh issue close N` once merged. Do not create `.dev-backlog/` or a sprint; Relay absence is irrelevant.
   MUTATIONS: code branch/PR; Issue AC checked and closed after verification; no local backlog files.
   STOP/ASK: no; note the missing spec axis only.

6. ACTIONS: `gh issue view 42 --json body,comments`, taking the newest `## Agent Brief` comment or `spec_ref:` as the specification. If a sprint is active and #42 is on the Plan, mark it `[~]` with the branch/PR pointer. Implement, verify each of the three AC checkboxes, check them on the Issue explicitly, open a PR, add a Progress entry if admitted.
   MUTATIONS: AC checkboxes on the Issue (deliberate `gh issue edit`), branch/PR, Plan `[~]` + Progress when a sprint exists.
   STOP/ASK: no unless the authority read fails or an AC is unverifiable.

7. ACTIONS: Read `_context.md` and any active sprint file if `.dev-backlog/` exists; run `status.sh` / `next.sh`. If no sprint, list live Issues (`gh issue list`) and name the next one. Local task files are not required, so their absence is normal.
   MUTATIONS: none.
   STOP/ASK: no.

8. ACTIONS: Read `_context.md` and the active sprint file for the readable picture; run `status.sh` (local-only). Attempt `gh issue view` for the next Plan ref; it fails, so the authority read is fail-closed. Report what the sprint says and what is unverified.
   MUTATIONS: none; no AC/lifecycle or Plan changes, no work executed from sprint text.
   STOP/ASK: yes; stop and tell the user GitHub is unreachable; never fall back to sprint text or a local copy as task truth.

9. ACTIONS: Verify each Plan Issue is closed with AC verified (re-read live via `gh issue view`). Run `sprint-close.sh` (with `--track` if several active); it runs `backlog-doctor.js`, flips `status: completed`, appends the final Progress entry. After success, promote the reusable Running Context to `_context.md`; leave the sprint file untouched as the permanent record.
   MUTATIONS: sprint `status: completed` + final Progress; `_context.md` updated; no Issue changes beyond already-verified closures.
   STOP/ASK: ask only if the doctor reports open Plan items or unclosed Issues.

10. ACTIONS: Re-read the live Issue (`gh issue view N --json body,comments`); the newest Agent Brief / `spec_ref:` wins. Diff the new AC against current work, re-verify or redo affected items. If a sprint is admitted, note the change in Running Context/Progress and adjust the batch estimate; do not rewrite the Issue to match old work.
    MUTATIONS: sprint Progress/Running Context note; code changes to satisfy the new AC; no silent Issue edits.
    STOP/ASK: ask if the change materially expands scope or contradicts the merged/in-review work.

11. ACTIONS: Recognize the legacy layout. Run `setup-dev-backlog.js`, which creates `.dev-backlog/` and migrates `backlog/` sprints, config, and triage while leaving `backlog/tasks/`, `docs/`, `completed/` in place (`references/file-format.md`). Then orient normally: `_context.md`, migrated active sprint, `status.sh` / `next.sh`.
    MUTATIONS: local `.dev-backlog/` created with migrated sprint files; nothing on GitHub.
    STOP/ASK: brief confirmation before migration since it rewrites the local layout; otherwise no.

12. ACTIONS: Authority is `backlog` (Backlog.md CLI), so no GitHub is needed. Read the spec with `backlog task 7 --plain` (honor `spec_ref:`). Mark `[~]` if admitted, implement, verify every AC, commit, then `backlog task edit 7 -s Done` (or the repo's configured terminal status). Do not use `gh` even if installed.
    MUTATIONS: Backlog.md task 7 AC/status; local commit; sprint Plan/Progress if admitted.
    STOP/ASK: no; the missing remote is irrelevant to this authority.

13. ACTIONS: Attempt `backlog task N --plain`; it fails (CLI missing). Treat this as a failed authority read: fail-closed. Diagnose (report that `.tracker` names `backlog` and the CLI is absent, suggest installing it). Do not switch to `gh` or infer the authority from installed CLIs, and do not read task files directly as truth.
    MUTATIONS: none.
    STOP/ASK: yes; stop and ask the user to install the Backlog.md CLI or explicitly change `.tracker`.
