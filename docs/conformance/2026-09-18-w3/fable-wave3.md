1. ACTIONS: Read `_context.md`, then the active sprint file; run `status.sh --json` and `next.sh --json`; `gh issue view N --json body,comments` for the next unchecked/`[~]` Plan items to confirm live state. Name the current batch, in-flight items, and the next actionable batch.
MUTATIONS: none (orient is read-only).
STOP/ASK: no; stop only if a `gh` read fails (fail-closed).

2. ACTIONS: Read `_context.md` and active sprint files; run `status.sh`; attempt `sprint-init.js "topic" --component "slug"` (or `--scope`), which refuses the overlapping track. Report the overlap and offer options: add issues to the existing track's Plan, narrow the scope to a disjoint one, or wait for the track to close.
MUTATIONS: none until the user picks; no sprint file created.
STOP/ASK: yes; overlap fails loud and choosing a resolution is a user decision.

3. ACTIONS: Read `_context.md` and both active sprint files; run `status.sh --json` (portfolio view), then `next.sh --track auth` and `next.sh --track billing`; `gh issue view` on each track's next items. Name each track's state and next batch.
MUTATIONS: none.
STOP/ASK: no.

4. ACTIONS: Confirm no `.dev-backlog/`; run `setup-dev-backlog.js`; `gh issue view` on all three issues (fail-closed); `sprint-init.js "topic"` with `--component` or `--scope` if a track axis fits; write Goal, three sequential batches (one issue per batch given the ordering), estimates. Spec axis absent: proceed per `spec-fallback.md` degradation (no charter objectives, no `objectives:` field), and mention that craftkit `spec-*` is optional.
MUTATIONS: local: new `.dev-backlog/` and sprint file; tracker: none.
STOP/ASK: no; ordered multi-Issue batches meet Sprint Admission, and no `spec/*` is touched.

5. ACTIONS: `gh issue view N --json body,comments`; implement on a branch, verify each AC, open a PR, close the issue on merge. No `setup-dev-backlog.js`, no sprint.
MUTATIONS: tracker: AC checks and issue closure via `gh` after verification; local: code changes only, no `.dev-backlog/`.
STOP/ASK: no; sprint-free Issue → PR is the default path and Relay is optional.

6. ACTIONS: Read `_context.md`/active sprint if present; `gh issue view 42 --json body,comments`, honoring the newest `## Agent Brief` comment and any `spec_ref:` line; implement (directly or via dev-relay); verify each of the three AC items; open PR; if admitted, mark Plan item `[~]` with PR pointer.
MUTATIONS: tracker: check off AC only after verification, close #42 after merge; local: Plan `[~]`/Progress note if a sprint is admitted.
STOP/ASK: no, unless `gh` read fails or the AC is ambiguous.

7. ACTIONS: Read `_context.md` and active sprint file when present; run `status.sh --json` and `next.sh --json`; `gh issue view` on the next live Issue(s). Local task files are not required; the Issue is the spec.
MUTATIONS: none.
STOP/ASK: no.

8. ACTIONS: Read `_context.md` and the active sprint file for the readable picture; run `status.sh`/`next.sh` for local sprint state; attempt `gh issue view` on the next item; it fails, so diagnose (`gh auth status`, network).
MUTATIONS: none.
STOP/ASK: yes; a failed `gh` read is fail-closed. I report the local picture as orientation only and do not execute tasks or change AC/lifecycle until a live read succeeds; never treat sprint text as the spec.

9. ACTIONS: For each Plan task, re-read the live Issue, verify every AC, `gh issue close`; ensure Plan items are `[x]`; run `sprint-close.sh` (with `--track` if multiple active), review doctor verdicts; then promote the project-level Running Context entries to `_context.md`.
MUTATIONS: tracker: issue closures; local: sprint `status: completed`, final Progress entry, `_context.md` appended. Sprint file left as immutable record.
STOP/ASK: ask only if the doctor reports blocking findings or an AC cannot be verified; otherwise no.

10. ACTIONS: Re-read `gh issue view N --json body,comments`; diff the current spec (body / newest `## Agent Brief` / `spec_ref:`) against what I implemented; adjust work to the new AC; note the change in Running Context/Progress if admitted; verify all current AC before checking off.
MUTATIONS: tracker: none beyond verified AC checks; local: Progress note.
STOP/ASK: ask if the change invalidates completed work or conflicts with the sprint Goal; otherwise continue against the live spec.

11. ACTIONS: Recognize the legacy layout; do not read `backlog/sprints/` as the live hub. Run `setup-dev-backlog.js`, which creates `.dev-backlog/` and migrates sprints, config, and triage (leaving `backlog/tasks/`, `docs/`, `completed/`). Then read `_context.md`/migrated active sprint, run `status.sh --json` and `next.sh --json`, `gh issue view` on next items.
MUTATIONS: local: new `.dev-backlog/` with migrated sprint and config; tracker: none.
STOP/ASK: ask before migrating, since orient is expected to be read-only and migration rewrites the consumer repo's layout; proceed on confirmation.