1. ACTIONS: Read `.dev-backlog/sprints/_context.md` and the active sprint file; run `status.sh --json` and `next.sh --json`; name the next actionable batch and its live Issue.
MUTATIONS: none.
STOP/ASK: no — Orient is read-only; I only report `[~]` items, unmoored checkboxes, or doctor warnings for the user to decide on.

2. ACTIONS: Read `_context.md` and the active sprint; run `status.sh --json` to see the active track's `component`/`scope`; attempt `sprint-init.js "topic" --scope|--component ...`, which refuses the overlapping track. Report the overlap.
MUTATIONS: none — no sprint file is created; tracker untouched.
STOP/ASK: yes — overlap fails loud by design. Ask whether to fold the work into the existing active track's Plan, narrow the scope to a disjoint one, or wait until the active track completes. I never edit the other track's `status:` or scope to force admission.

3. ACTIONS: Read `_context.md` and both active sprint files; run `status.sh --json` (portfolio view) then `status.sh --track auth` / `--track billing` and `next.sh --track <slug>` as needed; name each track's state and next batch, and confirm scopes are disjoint (`src/auth/**` vs `src/billing/**`).
MUTATIONS: none.
STOP/ASK: no; only if the user asks to "work" without naming a track would I ask which track (or run the batch from the one they name).

4. ACTIONS: Verify `gh` works; list open Issues (`gh issue list`); apply Sprint Admission — a sprint is only admitted if there are ordered multi-Issue batches / handoff / cross-Issue context. If admitted: `setup-dev-backlog.js --tracker github --non-interactive`, then `sprint-init.js "topic" [--milestone ...]` without `--component` (no `spec/capabilities.md`; `--scope` only if the user names a path axis), write Goal, ordered Plan batches with `#N` refs and estimates. `objectives:` left empty per `references/spec-fallback.md`.
MUTATIONS: creates `.dev-backlog/` and one `status: active` sprint file; no tracker writes (no Issue edits, no labels/milestones unless asked).
STOP/ASK: ask which Issues are in scope and confirm admission if the Issues do not clearly need a sprint; do not install craftkit or fabricate `spec/*`.

5. ACTIONS: Sprint-free path. `effective-task-spec.js #N` to get AC, lifecycle, source_ref, digest; implement on a branch; verify each AC; open a PR; on merge, close the Issue via `gh`.
MUTATIONS: tracker — AC checkboxes ticked and Issue closed only after verification; local — code/branch/PR only; no `.dev-backlog/` created (admission not met).
STOP/ASK: no, unless resolution fails (then diagnose and stop) or the Issue lacks verifiable AC (ask before inventing them).

6. ACTIONS: Read `_context.md`/active sprint if present; `effective-task-spec.js #42`; implement directly (or via dev-relay); verify AC 1–3 individually; open PR; tick each AC in the Issue as verified; close #42 after merge. If #42 is in an admitted sprint Plan, mark `[~]` with the PR pointer while in flight, then `[x]` plus a Progress entry.
MUTATIONS: tracker — three AC checkboxes and Issue closure, explicit `gh` edits only; local — Plan marker/Progress if a sprint exists.
STOP/ASK: no; stop only if `effective-task-spec.js` fails (no AC/lifecycle changes until live resolution succeeds).

7. ACTIONS: Read `_context.md` and any active sprint file; `status.sh --json` / `next.sh --json`; if no sprint, `gh issue list` to name the next live Issue; resolve it with `effective-task-spec.js` before working.
MUTATIONS: none for orientation.
STOP/ASK: no; local task files are not required — the live tracker is the authority.

8. ACTIONS: Read `_context.md`, active sprint file, and completed sprints for the recorded picture; run `status.sh`/`next.sh` for local sprint state only. Report that tracker resolution (`effective-task-spec.js`, `gh`) is unavailable.
MUTATIONS: none — no AC/lifecycle changes, no Plan marker changes, no fallback export.
STOP/ASK: yes — configured tracker failure is fail-closed; I can orient from local records but must not execute tasks or mutate anything until GitHub access is repaired. Ask the user to restore `gh` auth/network.

9. ACTIONS: Per task in the Plan: re-resolve with `effective-task-spec.js`, verify AC, ensure merged/closed via `gh`, mark `[x]`. Then `sprint-close.sh` (runs `backlog-doctor.js`, flips `status: completed`, appends final Progress, prints reassess signal). After it succeeds, promote project-level Running Context into `_context.md`.
MUTATIONS: tracker — any still-open verified Issues closed explicitly; local — sprint `status: completed`, Progress entry, `_context.md` gains the reusable context.
STOP/ASK: stop if the doctor fails or any Plan item is unverified/open (sprint stays open); ask only if a reassess recommendation implies a `spec/*` amendment (human-gated; never `amend` unattended).

10. ACTIONS: Re-run `effective-task-spec.js #N` and compare the digest to the one I started with; read the diff in AC/spec; re-verify implementation against the current AC; add a Running Context/Progress note if a sprint is admitted.
MUTATIONS: none to the tracker until re-verification; only AC ticks that still hold under the new spec.
STOP/ASK: ask if the change alters scope or invalidates completed work (which batch/PR to rework, whether to split into a new Issue); no if the change is cosmetic and every AC still verifies.

11. ACTIONS: Confirm `backlog` CLI is available (fail-closed otherwise); `effective-task-spec.js BACK-7`; implement on a branch; verify both AC; commit/PR; update AC and set Done via `backlog task edit` (adapter.close). No sprint — self-contained task does not meet admission.
MUTATIONS: tracker — BACK-7 AC and status Done through the CLI only; local — code only; never edit `backlog/tasks/*.md` directly and never touch GitHub.
STOP/ASK: no; stop if the `backlog` CLI is missing or resolution fails.

12. ACTIONS: Note the layout mismatch: the contract reads `.dev-backlog/.tracker`, `.dev-backlog/sprints/`; `backlog/` is the legacy layout. Read `backlog/sprints/<active>.md`, `_context.md`, and `backlog/.tracker` for the human picture; do not run `setup-dev-backlog.js` or `status.sh` against a non-existent `.dev-backlog/` as if it were current.
MUTATIONS: none — no migration, no new `.dev-backlog/`, no tracker writes.
STOP/ASK: yes — ask whether to migrate `backlog/` to `.dev-backlog/` (moving sprints, `.tracker`, config) before continuing, since it is a structural change to shared state and the `.tracker` value is setup-only. Until then, GitHub Issues remain the task authority and I orient from the legacy files read-only.
