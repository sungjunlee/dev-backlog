1. ACTIONS: Read `_context.md` and the active sprint file; run `status.sh --json` and `next.sh --json`; read the Plan to find the next actionable batch (unchecked/`[~]` items after completed batches); report sprint state, current batch, and next live Issue.
MUTATIONS: none.
STOP/ASK: no; orient is read-only.

2. ACTIONS: Read `_context.md` and the active sprint file to see its `component:`/`scope:`; run `sprint-init.js "topic" --component/--scope ...`, which refuses because `scopesOverlap` detects the overlap; report the conflict and the options (join the existing active track's Plan, narrow the scope to a disjoint axis, or close the existing sprint first).
MUTATIONS: none until the user chooses; if they say to fold the work into the existing track, I add Plan items and a Progress note to that sprint file.
STOP/ASK: yes; the overlap is a hard refusal, and choosing how to resolve it changes a shared active track.

3. ACTIONS: Read `_context.md` and both sprint files; run `status.sh --json` (portfolio view) and `next.sh --track auth` / `next.sh --track billing`; report each track's state and next batch, confirming disjoint scopes.
MUTATIONS: none.
STOP/ASK: no.

4. ACTIONS: Sprint Admission passes (ordered multi-Issue batches). Run `setup-dev-backlog.js --tracker github --non-interactive` to create `.dev-backlog/`; `gh issue view N --json body,comments` for each of the three issues; `sprint-init.js "topic"` (optionally `--milestone`/`--component`); write Goal, three ordered batches (one issue each, no `[~]`), estimates, per `references/file-format.md`; treat the spec axis as absent per `references/spec-fallback.md` and skip charter checks.
MUTATIONS: local only, new `.dev-backlog/` config and one `status: active` sprint file; no tracker changes.
STOP/ASK: no beyond the user's stated ordering; I would confirm tracker key is `github` if `.tracker` intent is ambiguous.

5. ACTIONS: Sprint-free path. `gh issue view N --json body,comments` (apply Agent Brief / `spec_ref:` precedence); implement directly; verify each AC; open PR; close the Issue through the adapter close verb after merge.
MUTATIONS: tracker only: AC checkboxes and Issue closure after verification; no `.dev-backlog/` created, no sprint file.
STOP/ASK: no; the missing spec axis and Relay change nothing on this path.

6. ACTIONS: `gh issue view 42 --json body,comments`; take the newest `## Agent Brief` comment over the body, and a `spec_ref:` line over both; implement; verify each of the three AC items; check off only verified ones via `gh issue edit`/comment; if a sprint is admitted, mark the Plan item `[~]` with the PR pointer, then `[x]` after merge.
MUTATIONS: Issue AC checkboxes, PR, eventual closure; sprint Plan/Progress only if #42 is on an active Plan.
STOP/ASK: if the `gh` read fails, stop and diagnose before touching AC or lifecycle; otherwise no.

7. ACTIONS: Read `_context.md` and the active sprint file if present; `status.sh --json` / `next.sh --json`; for the named next Issue run `gh issue view N --json body,comments` as the live specification; proceed to `work`.
MUTATIONS: none for orientation; work mutations follow scenario 6.
STOP/ASK: no; task files are not required, the tracker is the authority.

8. ACTIONS: Read `_context.md` and the active sprint file for the readable picture; run `status.sh`/`next.sh` to name the next batch; attempt `gh issue view` and note the failure.
MUTATIONS: none.
STOP/ASK: yes; the adapter is fail-closed, so I report the sprint state but do not execute tasks, check AC, or change lifecycle until a live `gh` read succeeds; I do not fall back to local files as task truth.

9. ACTIONS: Per task, re-read each live Issue (`gh issue view`), verify every AC, ensure merged and closed via `gh issue close`, set Plan `[x]`; then `sprint-close.sh` (`--track` if multiple), which runs `backlog-doctor.js`, flips `status: completed`, appends final Progress, prints any reassess signal; then promote project-level Running Context into `_context.md`.
MUTATIONS: Issue closures if any remain open; sprint file status/Progress; `_context.md` additions; the completed sprint stays immutable afterward.
STOP/ASK: only if an Issue's AC cannot be verified or the doctor reports blockers; the close itself needs no ask.

10. ACTIONS: Re-run `gh issue view N --json body,comments`; treat the latest body/Agent Brief/`spec_ref:` as the spec; diff against work done; re-verify AC under the new spec; add a Progress note (and Running Context if the change affects later tasks) when a sprint is admitted; if the change spawns new scope, file a new Issue rather than silently rewriting the Plan.
MUTATIONS: sprint Progress/Running Context; possibly a new Issue; no AC ticks that are no longer verified.
STOP/ASK: yes if the change invalidates completed work or contradicts the sprint Goal; I'd surface it before continuing.

11. ACTIONS: Sprint-free path with the `files` adapter; use the Backlog.md CLI per `references/adapter-ports.md` to view `BACK-7` (its ref grammar); implement; verify both AC; check them off and close with the adapter's close verb; never touch `gh`.
MUTATIONS: `BACK-7` AC and status via the Backlog.md CLI only; no sprint file.
STOP/ASK: if the `backlog` CLI is unavailable or the read fails, stop (fail-closed); otherwise no.

12. ACTIONS: Recognize the legacy layout; `.dev-backlog/` is missing, so run `setup-dev-backlog.js --tracker github --non-interactive`, which migrates `backlog/sprints/`, `.tracker`, config, and triage into `.dev-backlog/` while leaving `backlog/tasks/`, `docs/`, `completed/` in place; then read `_context.md` and the migrated active sprint; `status.sh --json` / `next.sh --json`.
MUTATIONS: local only: new `.dev-backlog/` with migrated sprints and config; no tracker changes.
STOP/ASK: yes, briefly; migration rewrites the local layout, so I'd confirm before running setup in a repo the user only asked to orient in, and orient read-only from `backlog/` until they agree.
