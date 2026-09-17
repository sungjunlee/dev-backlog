1. ACTIONS: Read `.dev-backlog/sprints/_context.md` and the active sprint file; run `status.sh --json` and `next.sh --json`; name the next unchecked batch and any `[~]` items, then `gh issue view N` on those Issues to confirm they are still open/unchanged.
MUTATIONS: none.
STOP/ASK: no; if `gh` fails, stop and diagnose (fail-closed) instead of reporting from sprint text.

2. ACTIONS: Check `status.sh --json` for active tracks and their `component:`/`scope:`; run `sprint-init.js "topic" --component/--scope` — it refuses the overlap. Do not hand-write a second sprint file.
MUTATIONS: none (init refuses).
STOP/ASK: yes — report the overlap and ask whether to add the work to the existing active Plan (as a later batch, with a Progress note), narrow the scope to a disjoint slug/glob, or close the existing track first.

3. ACTIONS: Read `_context.md` and both sprint files; run `status.sh --json` (portfolio view) and `next.sh --track auth` / `next.sh --track billing`; confirm scopes are disjoint per frontmatter; name the next batch per track and its live Issues via `gh issue view`.
MUTATIONS: none.
STOP/ASK: no, unless the user gives work without naming a track — then ask which track (or route by the touched paths).

4. ACTIONS: `gh issue view` each of the three Issues (fail-closed). Admission: ordered multi-Issue batches qualify for a sprint. Run `setup-dev-backlog.js` to create `.dev-backlog/`, then `sprint-init.js "topic"` (with `--component`/`--scope` only if the user gives a track axis); write Goal, Plan as three sequential batches (one Issue each, `[ ]` with `#N` refs and estimates), empty Running Context. Skip charter/objectives (no spec axis; degrade per `spec-fallback.md`, leave `objectives:` off).
MUTATIONS: local only — new `.dev-backlog/sprints/_context.md` and `YYYY-MM-<topic>.md` with `status: active`; no tracker changes.
STOP/ASK: no; note the absent spec axis and offer craftkit later, without blocking.

5. ACTIONS: `gh issue view N --json body,comments` (check for `## Agent Brief` / `spec_ref:`); implement directly, verify each AC, open a PR, then close the Issue after merge. No sprint (self-contained Issue fails admission); no `setup-dev-backlog.js`.
MUTATIONS: tracker — PR, AC checkboxes ticked after verification, `gh issue close` on merge; local — code only, no `.dev-backlog/`.
STOP/ASK: no (unless AC are ambiguous or `gh` read fails).

6. ACTIONS: `gh issue view 42 --json body,comments`; take newest `## Agent Brief` over body, `spec_ref:` over both; implement; verify each of the three AC; check each box on the Issue only after verification; PR; if a sprint is active and #42 is on the Plan, mark `[~]` with the PR pointer and log Progress.
MUTATIONS: tracker — Issue AC checkboxes, PR, closure after merge; local — code, plus sprint `[~]`/Progress only if admitted.
STOP/ASK: no; stop if the `gh` read fails.

7. ACTIONS: Read `_context.md` and active sprint file if present; `status.sh --json` / `next.sh --json`; with no sprint, `gh issue list` to name the next live Issue; state whether anything needs planning (admission check).
MUTATIONS: none.
STOP/ASK: no; ask only if multiple candidate Issues and no priority signal.

8. ACTIONS: Read `_context.md` and the active sprint file for orientation only; attempt `status.sh`/`gh`; on failure, report the picture as "unverified local context" and diagnose the `gh` access problem.
MUTATIONS: none — no task execution, no AC/lifecycle changes, no sprint edits.
STOP/ASK: yes — GitHub read is fail-closed; I stop before working any task and tell the user auth/network must be restored.

9. ACTIONS: For each Plan task, re-read the live Issue via `gh`, verify every AC, ensure `[x]` and closed; run `sprint-close.sh` (runs `backlog-doctor.js`, flips `status: completed`, appends final Progress, prints reassess); then copy the future-applicable Running Context entries into `_context.md`.
MUTATIONS: tracker — `gh issue close` for any still-open verified tasks; local — sprint file `status: completed` (never flipped back), `_context.md` appended.
STOP/ASK: no if all Plan items are verified done; ask if items remain open or the doctor reports failures, and surface the reassess signal without acting on `spec/*`.

10. ACTIONS: Re-read `gh issue view N --json body,comments`; diff against what I built; treat the newest `## Agent Brief` / `spec_ref:` as authority; re-verify every AC against the new spec before checking anything; adjust implementation; if admitted, note the change in Running Context/Progress.
MUTATIONS: tracker — only after re-verification (AC, closure); local — sprint note if a sprint exists.
STOP/ASK: ask if the change contradicts work already merged or in a PR, or expands scope; otherwise continue.

11. ACTIONS: Orient reads `_context.md`/active sprint under `.dev-backlog/`, which is missing; `status.sh`/`next.sh` would find no layout. Read `backlog/sprints/` active file for the picture; migration is the Plan rail (`setup-dev-backlog.js` migrates sprints/config/triage), not Orient.
MUTATIONS: none during orient.
STOP/ASK: yes — report the legacy layout and ask before running `setup-dev-backlog.js`, since it moves the active sprint and config (leaves `backlog/tasks/`, `docs/`, `completed/`); the migration is a deliberate file mutation the user should approve.
