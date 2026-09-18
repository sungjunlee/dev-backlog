# dev-backlog wave-4 fresh-session simulation (Fable 5.1)

1. Orient: one active sprint, `_context.md`, partial Plan
- ACTIONS: Read `.dev-backlog/sprints/_context.md` and the active sprint file. Run `status.sh --json` and `next.sh --json`. `gh issue view N --json body,comments` for each `[~]`/next-batch item to confirm live lifecycle. Report sprint state, in-flight items, and the next actionable batch by Issue number.
- MUTATIONS: none.
- STOP/ASK: no. Only stop if a `gh` read fails (fail-closed); then report the diagnosis, not a sprint-text guess.

2. Plan a sprint overlapping an active track
- ACTIONS: Read `_context.md` and every active sprint file; `status.sh --json` to see track scopes. Run `sprint-init.js "topic" --component|--scope ...`; it refuses the overlapping track. Report the refusal and the conflicting scope.
- MUTATIONS: none (no sprint file created, no GitHub write, active track's scope untouched).
- STOP/ASK: yes. Ask whether to narrow to a provably disjoint scope, add the issues to the existing active track's Plan as a later batch, or close that track first.

3. Orient: two disjoint active tracks (`auth`, `billing`)
- ACTIONS: Read `_context.md` and both sprint files. `status.sh --json` for the portfolio view, then `next.sh --track auth` and `next.sh --track billing`. `gh issue view` the next-batch Issues of each. Report per-track state and next batch.
- MUTATIONS: none.
- STOP/ASK: no.

4. No spec axis, three ordered issues, reach first active sprint
- ACTIONS: `gh issue view` all three (fail-closed). Admission: ordered multi-Issue batches qualify. `setup-dev-backlog.js` to bootstrap `.dev-backlog/`. `sprint-init.js "topic"` (add `--component`/`--scope` only if the user names one). Write Goal, three sequential single-Issue batches with `#N` refs and estimates, initial Progress entry. Omit `objectives:`; no `spec/` or craftkit install (spec-fallback degradation).
- MUTATIONS: local: new `.dev-backlog/` layout, sprint file `status: active`, scaffolded `_context.md`. GitHub: none.
- STOP/ASK: no; order was given by the user. Show the Plan for review before starting work.

5. No spec axis, one self-contained issue, no `.dev-backlog/`, no Relay
- ACTIONS: `gh issue view N --json body,comments` (apply Agent Brief / `spec_ref` precedence). Implement directly on a branch, verify each AC, open a PR. After merge, `gh issue close N`.
- MUTATIONS: GitHub: PR, AC checkboxes after verification, close on merge. Local: code only; no `.dev-backlog/`, no sprint (sprint-free default path).
- STOP/ASK: no. Stop only if the `gh` read fails.

6. Work #42, no local task files, three live AC checkboxes
- ACTIONS: `gh issue view 42 --json body,comments`; newest `## Agent Brief` overrides body, `spec_ref:` overrides both. `status.sh` to see whether an active sprint lists #42. Implement, verify each of the three AC individually, open PR. If admitted, mark the Plan item `[~]` with the branch/PR pointer.
- MUTATIONS: GitHub: PR; check AC boxes only after verification; close on merge. Local: `[~]` + Progress note if a sprint holds #42, else none.
- STOP/ASK: no, unless an AC is ambiguous or the `gh` read fails.

7. Fresh online session, no local task files
- ACTIONS: Read `_context.md` and the active sprint file if present. `status.sh --json` / `next.sh --json`. `gh issue view` the named next Issues; if no sprint, `gh issue list` to name the next live Issue.
- MUTATIONS: none.
- STOP/ASK: no.

8. Fresh session, repo files only, no GitHub access
- ACTIONS: Read `_context.md` and the sprint file for a local, explicitly unverified picture. `status.sh` for structure. Attempt `gh issue view`; on failure diagnose (auth, network, `gh` missing).
- MUTATIONS: none.
- STOP/ASK: yes, stop. Fail-closed: do not execute tasks, check AC, or change lifecycle from sprint text. Ask the user to restore `gh` access.

9. Close sprint with promotable Running Context, no local task files
- ACTIONS: For each Plan task, re-read the live Issue, verify AC, confirm closed (`gh issue close` only for verified work). Run `sprint-close.sh` (`--track` if several active); it runs `backlog-doctor.js`, flips `status: completed`, appends final Progress. Then promote project-level Running Context into `_context.md`; leave the sprint file as immutable record. Commit.
- MUTATIONS: local: sprint `status: completed`, final Progress, `_context.md` edits. GitHub: issue closures for verified tasks only.
- STOP/ASK: ask if the doctor reports unchecked Plan items or open Issues; never close with stale items, never flip `completed` back.

10. GitHub Issue changed during work
- ACTIONS: Re-run `gh issue view N --json body,comments`; newest Agent Brief / `spec_ref` win. Diff the current spec against what was implemented, re-verify every AC against the current text, adjust the implementation. If admitted, note the change in Running Context/Progress.
- MUTATIONS: local: Progress/Running Context note. GitHub: none automatic; AC checks only after re-verification.
- STOP/ASK: ask if the change contradicts already-merged work or expands scope materially (propose a new Issue instead); otherwise continue.

11. Legacy layout (`backlog/sprints/`, `backlog/config.yml`, no `.dev-backlog/`). Orient
- ACTIONS: Read the legacy active sprint and `config.yml` as the readable picture; `status.sh` will report no `.dev-backlog/`. `gh issue view` the Issues it references. Explain that `setup-dev-backlog.js` migrates sprints/config/triage and leaves `backlog/tasks/`, `docs/`, `completed/` in place.
- MUTATIONS: none during orient; migration only on approval.
- STOP/ASK: yes. Ask before running the migration, since orient does not require moving files.
