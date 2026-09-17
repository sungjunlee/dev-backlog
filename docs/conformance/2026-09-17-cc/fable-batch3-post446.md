# Batch 3c answers (Fable)

1. **Orient, one active sprint, partial Plan**
ACTIONS: Read `.dev-backlog/sprints/_context.md`, then the active sprint file (Goal, Plan markers, Running Context, Progress). Run `scripts/status.sh --json` and `scripts/next.sh --json` from the project root to get the next actionable batch. Confirm each `[~]`/next-batch Issue is still open via `gh issue view N --json state,body` (fail-closed if `gh` fails). Report: sprint state, next batch, next live Issue.
MUTATIONS: none.
STOP/ASK: no; orient is read-only. Only stop if `gh` fails (then diagnose, do not proceed to work).

2. **Plan a sprint overlapping an active track**
ACTIONS: Read `_context.md` and the active sprint file to learn its `component:`/`scope:`. Run `scripts/sprint-init.js "topic" --component|--scope ...`; it refuses because `scopesOverlap` detects the collision. Do not hand-write a second file to bypass it. Options to present: add the work as a later batch of the existing track, narrow the new scope to a disjoint one, or wait for the existing track to close.
MUTATIONS: none (init refused; no sprint file written).
STOP/ASK: yes; ask the user which option they want, since concurrent overlapping tracks are forbidden and re-scoping is a judgment call.

3. **Orient with two disjoint active tracks**
ACTIONS: Read `_context.md` and both sprint files (`auth` with `scope: ["src/auth/**"]`, `billing` with `scope: ["src/billing/**"]`). Run `scripts/status.sh --json` for the portfolio view, then `scripts/next.sh --track auth` and `scripts/next.sh --track billing` for per-track next batches. Verify the next Issues live via `gh issue view`. Report per-track state and next batch; note both scopes are disjoint so they coexist.
MUTATIONS: none.
STOP/ASK: no; if the user did not say which track they will work, ask before entering `work`.

4. **No spec axis, three ordered Issues, reach first active sprint**
ACTIONS: `gh issue view` each of the three Issues (body, AC) to confirm they are live and ordered; ordered multi-Issue batches satisfy Sprint Admission. Run `scripts/setup-dev-backlog.js` to create `.dev-backlog/` (no legacy layout to migrate). Run `scripts/sprint-init.js "topic"` (optionally `--milestone`, `--component`/`--scope` only if the user names one). Write Goal and a Plan with three batches, one Issue per batch (dependent order), plus estimates; per `references/spec-fallback.md`, `objectives:` stays empty and no charter is invented. Run `scripts/status.sh` to confirm the track is active.
MUTATIONS: local: new `.dev-backlog/` tree, `_context.md`, sprint file `status: active`. GitHub: none.
STOP/ASK: no for setup/init; ask only if batch order or scope axis is ambiguous. I would not run `spec-charter` (not installed) or amend `spec/*`.

5. **No spec axis, one self-contained Issue, no Relay**
ACTIONS: `gh issue view N --json body,comments` (Agent Brief / `spec_ref:` override rules). Sprint Admission says default path is sprint-free Issue → implementation → PR → close; a single Issue does not admit a sprint. Implement directly, verify each AC, open a PR, then `gh issue close N` after merge.
MUTATIONS: GitHub: AC checkboxes ticked and Issue closed after verification, PR created. Local: no `.dev-backlog/`, no sprint file created.
STOP/ASK: no, unless the AC are unreadable or `gh` fails.

6. **Work #42, no local task files, three live AC**
ACTIONS: `gh issue view 42 --json body,comments`; apply override order (newest `## Agent Brief` comment > body; `spec_ref:` > both). If a sprint is active and #42 is on the Plan, mark it `[~]` with branch/PR pointer. Implement, verify AC items one by one, tick each checkbox on the Issue via `gh issue edit` only after verification, open PR, add Progress entry if admitted.
MUTATIONS: GitHub: AC checkboxes, PR; sprint file `[~]` + Progress if admitted. No local task files are created (none are required).
STOP/ASK: no; stop if the `gh` read fails (diagnose, no execution).

7. **Fresh online session, no local task files**
ACTIONS: Read `_context.md` and any active sprint file if `.dev-backlog/` exists; run `scripts/status.sh --json` / `next.sh --json`. If no sprint, `gh issue list --state open` (plus milestone/labels) to name the next live Issue. Treat GitHub as sole truth; local task files are not needed.
MUTATIONS: none.
STOP/ASK: no; ask what to work on only if no sprint and no obvious next Issue.

8. **Fresh session, repo files only, no GitHub access**
ACTIONS: Read `_context.md` and active sprint file for the picture; run `scripts/status.sh` (local view). Attempt `gh issue view` for the next item; it fails, so diagnose (`gh auth status`, network) and report.
MUTATIONS: none. Never fall back to sprint text or local copies as task authority.
STOP/ASK: yes; stop before any implementation or AC/lifecycle change until a live `gh` read succeeds (Hard Constraint).

9. **Close sprint with reusable Running Context, no local task files**
ACTIONS: For each Plan item, re-read the live Issue with `gh issue view`, verify AC, confirm merged/closed (`gh issue close` if verified but still open); set `[x]`. Run `scripts/sprint-close.sh` (or `--track <slug>` if multiple tracks); it runs `backlog-doctor.js`, flips `status: completed`, appends final Progress. Then promote project-level Running Context into `_context.md`; leave the sprint file as immutable record.
MUTATIONS: GitHub: any remaining Issue closures. Local: sprint `status: completed`, Progress entry, `_context.md` updated.
STOP/ASK: ask if any Plan item is not verifiably done (the sprint stays open until Plan is done); otherwise no.

10. **GitHub Issue changed during work**
ACTIONS: Re-read `gh issue view N --json body,comments`; apply override rules (newest `## Agent Brief`, `spec_ref:`). Diff against what I implemented; adjust work to the current AC; verify each current AC before ticking. Note the change in sprint Running Context/Progress if admitted.
MUTATIONS: Local sprint Progress note; GitHub AC only after verification against the new spec. No edits to the Issue body itself.
STOP/ASK: ask if the change contradicts work already merged or alters scope materially; otherwise continue under the live spec.

11. **Legacy `backlog/` layout, orient**
ACTIONS: Orient is read-only, so read `backlog/sprints/` active sprint and `backlog/config.yml` for context and run `gh` for live Issues, but report that the layout is legacy. Migration is via `scripts/setup-dev-backlog.js` (moves sprints/config/triage into `.dev-backlog/`, leaves `backlog/tasks/`, `docs/`, `completed/`); it belongs to `plan`, not orient.
MUTATIONS: none during orient.
STOP/ASK: yes; propose running `setup-dev-backlog.js` and wait for the user before migrating, since it moves files.
