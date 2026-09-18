1.
- ACTIONS: Read `.dev-backlog/sprints/_context.md` and the active sprint file; run `status.sh --json` then `next.sh --json` from the project root (scripts resolved from the installed skill dir); for the `[~]`/next-batch items, `gh issue view N --json body,comments` to confirm live state; name the current batch, in-flight items, and next actionable batch.
- MUTATIONS: none (orient is read-only).
- STOP/ASK: no, unless a `gh` read fails (then stop and diagnose; never fall back to sprint text).

2.
- ACTIONS: Read `_context.md` and the existing active sprint to learn its `component:`/`scope:`; run `sprint-init.js "topic" --component|--scope ...`, which refuses an overlapping track; report the refusal and the overlap.
- MUTATIONS: none unless the user re-scopes to a disjoint axis or folds the work into the existing active Plan (then sprint-init creates a file, or the existing Plan gains a batch plus Progress note).
- STOP/ASK: yes — ask whether to narrow the scope, join the existing track, or wait for it to close; overlap must fail loud, not be worked around.

3.
- ACTIONS: Read `_context.md` and both sprint files; run `status.sh --json` for the portfolio view, then `next.sh --track auth` and `next.sh --track billing`; verify the two scopes are disjoint; for each track name state and next batch; check live Issues with `gh issue view`.
- MUTATIONS: none.
- STOP/ASK: no; ask which track to work only if the user then says "next" without naming one.

4.
- ACTIONS: `gh issue view` each of the three issues (fail-closed); note no spec axis per `references/spec-fallback.md` — proceed without charter, no `objectives:`; ordered multi-Issue batches admit a sprint, so run `setup-dev-backlog.js` to bootstrap `.dev-backlog/`, then `sprint-init.js "topic"` (optionally `--component`/`--scope`); write Goal and a Plan with three sequential batches (`[ ] #A`, `[ ] #B`, `[ ] #C`) plus estimates; run `status.sh` to confirm it is active.
- MUTATIONS: local only — new `.dev-backlog/` (with `_context.md`) and the sprint file; no GitHub writes.
- STOP/ASK: no; I would mention that no spec axis exists and craftkit `spec-charter` is optional, not required.

5.
- ACTIONS: `gh issue view N --json body,comments` (Agent Brief / `spec_ref:` precedence); this is sprint-free work, so implement directly on a branch, verify each AC, open a PR, then on merge close the Issue with `gh issue close`.
- MUTATIONS: code/branch/PR; Issue AC checkboxes and closure after verification; no `.dev-backlog/` created, no sprint.
- STOP/ASK: no (Relay absence is irrelevant — implement directly).

6.
- ACTIONS: `gh issue view 42 --json body,comments`; take the newest `## Agent Brief` or `spec_ref:` as spec; implement (directly or via dev-relay if installed) and verify each of the three AC items; if a sprint admits #42, mark its Plan item `[~]` with the branch/PR pointer; after verification check the AC boxes on the Issue and close via `gh issue close` once merged.
- MUTATIONS: branch/PR; Issue AC checkboxes and closure (explicit `gh` edits only); Plan `[~]`→`[x]` and Progress entry if admitted.
- STOP/ASK: no, unless an AC cannot be verified or the `gh` read fails.

7.
- ACTIONS: Read `_context.md` and any active sprint file if `.dev-backlog/` exists; `status.sh --json` / `next.sh --json`; otherwise `gh issue list` to name the next live Issue; sprint-free is the default path.
- MUTATIONS: none.
- STOP/ASK: no; ask what to work on only if no sprint and no obvious next Issue.

8.
- ACTIONS: Read `_context.md` and the active sprint file for the readable picture; run `status.sh`/`next.sh` (local); attempt `gh issue view` on the next planned Issue — it fails, so diagnose (auth/network) and report.
- MUTATIONS: none.
- STOP/ASK: yes — GitHub read is fail-closed; I can describe local state but do not execute tasks or change AC/lifecycle from sprint text until a live `gh` read succeeds.

9.
- ACTIONS: For each Plan task re-read the live Issue and verify AC, close with `gh issue close`, mark `[x]`; run `sprint-close.sh` (runs `backlog-doctor.js`, flips `status: completed`, appends final Progress, prints verdicts); after success, promote the reusable Running Context into `_context.md`.
- MUTATIONS: Issues closed (explicit); sprint file `status: completed` (immutable afterwards); `_context.md` gains promoted context.
- STOP/ASK: only if the doctor reports open Plan items or an AC fails verification; otherwise no.

10.
- ACTIONS: Re-read `gh issue view N --json body,comments`; treat the changed body/Agent Brief/`spec_ref:` as the new spec; diff against work done, re-verify all AC against the current spec, adjust implementation; add a Progress / Running Context note in the sprint if admitted.
- MUTATIONS: code changes; sprint Progress note; no silent AC edits — the Issue is the authority.
- STOP/ASK: ask only if the change contradicts completed work or invalidates the sprint Goal/batch order; otherwise proceed with the live spec.

11.
- ACTIONS: Since `.dev-backlog/` is missing, run `setup-dev-backlog.js`, which migrates the legacy `backlog/` layout (sprints, config, triage) into `.dev-backlog/` and leaves `backlog/tasks/`, `docs/`, `completed/`; then read `_context.md` and the migrated active sprint; `status.sh --json` / `next.sh --json`; `gh issue view` on next items.
- MUTATIONS: local only — new `.dev-backlog/` with migrated sprint/config; no GitHub writes.
- STOP/ASK: brief confirmation that migration is wanted, since orient is normally read-only and this creates/moves files.

12.
- ACTIONS: `.tracker` is a parked/ignored leftover — GitHub Issues are the sole authority; attempt `gh issue view 7 --json body,comments`; with no GitHub remote it fails, so diagnose (missing remote / `gh repo` resolution) and report.
- MUTATIONS: none.
- STOP/ASK: yes — fail-closed: I cannot execute #7 without a live GitHub read; ask the user to add a remote or point to the correct repo (`-R owner/repo`), and note `.tracker` has no effect.

13.
- ACTIONS: Ignore `.tracker` (no tracker abstraction exists); verify `gh` is available and proceed through the normal `gh` path; note the stale file to the user.
- MUTATIONS: none (would suggest deleting `.dev-backlog/.tracker`, only on request).
- STOP/ASK: no, unless the `gh` read itself fails.
