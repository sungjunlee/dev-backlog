1. ACTIONS: Read `.dev-backlog/sprints/_context.md`, then the active sprint file; run `status.sh --json` and `next.sh --json`; name the sprint state, the `[~]`/`[ ]` items, and the next actionable batch plus its live Issue.
MUTATIONS: none.
STOP/ASK: no (orient is read-only; Done when I can name the next batch and its Issue).

2. ACTIONS: Read `_context.md` and the active sprint file; run `sprint-init.js "topic" --component|--scope ...` — it refuses because `scopesOverlap` detects the active track; report the conflict and the options (narrow scope to a disjoint axis, fold the issues into the existing track's Plan, or wait for `sprint-close.sh`).
MUTATIONS: none (init fails loud; no sprint file created).
STOP/ASK: yes — ask the user which option they want; I never bypass the overlap refusal or edit the existing active track's scope silently.

3. ACTIONS: Read `_context.md`, then both active files; run `status.sh --json` (portfolio) and `next.sh --track auth` / `next.sh --track billing`; report each track's state and next batch separately.
MUTATIONS: none.
STOP/ASK: no (disjoint tracks coexist as a portfolio; if the user wants work, ask which track).

4. ACTIONS: Ordered multi-Issue batches admit a sprint. Run `setup-dev-backlog.js --tracker github --non-interactive` to create `.dev-backlog/`; run `effective-task-spec.js` on each issue to confirm live resolution; `sprint-init.js "topic" [--component|--scope]`; write Goal, three one-item ordered batches (#A → #B → #C), estimates. Spec axis absent → degrade per `references/spec-fallback.md` (no `objectives:`, no charter checks).
MUTATIONS: local `.dev-backlog/` config and one `status: active` sprint file; tracker: none.
STOP/ASK: only to confirm track scope/component if unclear; otherwise no.

5. ACTIONS: Default sprint-free path. `effective-task-spec.js #N` (fail-closed if `gh` unavailable); implement directly on a branch; verify each AC; open PR; close the Issue via adapter `close` after merge.
MUTATIONS: tracker: AC checkboxes and Issue closure (explicit); local: code/branch only — no `.dev-backlog/` created (a single self-contained issue does not admit a sprint; Relay absence is irrelevant).
STOP/ASK: no, unless tracker resolution fails (then diagnose and stop).

6. ACTIONS: `effective-task-spec.js #42` for the effective spec (spec_ref > Agent Brief > body), AC, lifecycle, digest; implement; verify each of the three AC items; check them off in the live Issue; if a sprint is active and #42 is admitted, mark `[~]` with the PR pointer, `[x]` after merge.
MUTATIONS: tracker: three AC checkboxes ticked only after verification, Issue closed after merge; local: sprint Plan/Progress only if admitted.
STOP/ASK: no; stop if resolution fails (no AC/lifecycle changes until it succeeds).

7. ACTIONS: Read `_context.md` and any active sprint file; `status.sh --json`, `next.sh --json`; resolve the named next Issue with `effective-task-spec.js`; proceed in the routed mode.
MUTATIONS: none at orientation.
STOP/ASK: no — no local task files is the normal state; tracker is the sole authority.

8. ACTIONS: Read `_context.md`, active sprint file (Plan, Running Context, Progress) for the picture; attempt `status.sh`/`effective-task-spec.js` — adapter unavailable → fail-closed.
MUTATIONS: none — no fallback to local files, no legacy export, no AC/lifecycle edits.
STOP/ASK: yes — report that the configured tracker is unreachable and must be repaired (`references/adapter-ports.md`) before any task execution; I can only summarize the sprint file.

9. ACTIONS: Per remaining Plan task: re-resolve with `effective-task-spec.js`, verify AC, close via adapter; `[x]` + Progress. Then `sprint-close.sh` (runs `backlog-doctor.js`, flips `status: completed`, final Progress entry, prints reassess recommendation); then promote the future-applicable Running Context into `_context.md`.
MUTATIONS: tracker: Issue closures for verified tasks; local: sprint `status: completed` (immutable afterward), `_context.md` appended.
STOP/ASK: only if a Plan item is unverified/unmerged — sprint stays open; or if the doctor flags a reassess signal, surface it (no `spec/*` amend unattended).

10. ACTIONS: Re-run `effective-task-spec.js` and compare digest; adopt the current effective spec as truth; re-verify AC against the new spec; note the change in Running Context/Progress if the sprint is admitted.
MUTATIONS: local sprint notes only; tracker: none (the Issue is authority, not something to revert).
STOP/ASK: yes if the change invalidates completed work or shifts scope — report the diff and ask before continuing; otherwise no.

11. ACTIONS: `effective-task-spec.js BACK-7` via the `backlog` adapter (grammar per `references/adapter-ports.md`); sprint-free path; implement; verify both AC; check them off through the Backlog.md CLI; close via the adapter's close verb.
MUTATIONS: tracker (files/Backlog.md): two AC checkboxes and task closure; local: code only, no sprint file.
STOP/ASK: no; runtime never switches adapters — if `backlog` CLI fails, stop and repair.

12. ACTIONS: Recognize legacy `backlog/` layout; run `setup-dev-backlog.js --tracker github --non-interactive`, which migrates sprints, `.tracker`, config, triage into `.dev-backlog/` and leaves `backlog/tasks/`, `docs/`, `completed/` in place; then read `_context.md`/active sprint and run `status.sh --json`, `next.sh --json`.
MUTATIONS: local: new `.dev-backlog/` (migrated sprint file, `.tracker`, config); tracker: none.
STOP/ASK: yes — briefly confirm the migration before running it, since it restructures the consumer repo's files; orientation itself is read-only.
