Answering all 13 scenarios from the skill text only, no commands run.

**1. Orient, one active sprint, `_context.md`, partial Plan**
ACTIONS: Read `.dev-backlog/.tracker` (absent = github), `_context.md`, the active sprint file. Run `status.sh --json` / `next.sh --json` for `latest_progress`, `next_batch`, `in_flight`. Confirm the next `[ ]` item's Issue is live via `gh issue view N --json body,comments`. Report latest Progress, in-flight pointers (or `unmoored`), next batch.
MUTATIONS: none.
STOP/ASK: no; orient is read-only. `[ ]` selection is not `[~]` work, so I do not start anything.

**2. Plan a sprint overlapping an active track**
ACTIONS: Run `status.sh --json` to see the active track's `component`/`scope`. Run `sprint-init.js "topic" --component|--scope ...`; it refuses the overlap. Report the conflict and the options: add the work to the existing active Plan as a later batch (with a Progress note), or close/rescope the existing track.
MUTATIONS: none until the user chooses; I never force a second overlapping `status: active` file.
STOP/ASK: yes; which track owns the work is a user decision.

**3. Orient, two disjoint active tracks (`auth`, `billing`)**
ACTIONS: Read `_context.md` and both sprint files. Run `status.sh --json` (portfolio view) and `next.sh --track auth` / `next.sh --track billing`. Verify each track's next `[ ]` Issue live with `gh issue view`. Report per-track latest Progress, in-flight pointers, next batch.
MUTATIONS: none.
STOP/ASK: no; disjoint scopes coexist as a portfolio.

**4. No spec axis, three ordered GitHub issues, reach first active sprint**
ACTIONS: Read each issue with `gh issue view N --json body,comments`. Admission is met (ordered multi-Issue batch). Run `setup-dev-backlog.js` (creates `.dev-backlog/`), then `sprint-init.js "topic" --scope "<globs>"` (explicit scope; no component axis exists). Write Goal, three sequential batches (one issue each, dependents later), estimates. Per `references/spec-fallback.md`, proceed without charter/capabilities.
MUTATIONS: local only: new `.dev-backlog/` and the sprint file. No Issue changes.
STOP/ASK: no; the user named the order. I state the scope globs I chose.

**5. No spec axis, one self-contained issue, no `.dev-backlog/`**
ACTIONS: Read the issue via `gh issue view`. Sprint Admission is not met (single Issue, no continuity need), so the default sprint-free path applies: Issue → implementation → PR → `gh issue close N`. I do not run `setup-dev-backlog.js`.
MUTATIONS: code branch/PR; Issue AC/closure only after verification. No `.dev-backlog/` created.
STOP/ASK: no.

**6. Work #42, no local task files, three live AC checkboxes**
ACTIONS: Read `.tracker` (github). `gh issue view 42 --json body,comments`; newest `## Agent Brief` comment overrides body, `spec_ref:` overrides both. Implement, verify each AC, then tick the checkbox explicitly on the Issue and open a PR. No sprint exists, so sprint-free path; no `[~]` marking.
MUTATIONS: Issue AC checkboxes (per verified item), PR. No local sprint files.
STOP/ASK: no, unless an AC is ambiguous or the authority read fails.

**7. Fresh online session, no local task files**
ACTIONS: Read `.tracker`; `_context.md`/sprint absent so nothing to orient from locally. Read the authority live (`gh issue list`, `gh issue view`) to name the next live Issue. Route by user intent from the Mode Router; with no active sprint, admitted work triggers `plan`, otherwise sprint-free `work`.
MUTATIONS: none until the user picks a mode/Issue.
STOP/ASK: ask which Issue/mode if the request is only "start", since nothing local names the next step.

**8. Fresh session, repo files only, GitHub unavailable**
ACTIONS: Read `.tracker`, `_context.md`, active sprint; run `status.sh --json`/`next.sh --json`. Attempt `gh issue view`; it fails, so I diagnose (auth, network) and report local orientation as last-recorded/provisional with in-flight pointers or `unmoored`; next live Issue is unknown.
MUTATIONS: none.
STOP/ASK: stop. Failed authority read is fail-closed: no dispatch, Plan mutation, execution, or AC/lifecycle claims from sprint text.

**9. Close sprint with reusable Running Context, no local task files**
ACTIONS: Per Plan item, `gh issue view N`, verify AC, confirm closed via `gh issue close N`; mark `[x]`. Strike or carry unfinished items with a Progress entry. Run `sprint-close.sh` (runs `backlog-doctor.js`, flips `status: completed`, appends final Progress). Then promote project-level Running Context into `_context.md`.
MUTATIONS: Issues closed only when verified; sprint file `completed` (disposable afterward); `_context.md` gains promoted context.
STOP/ASK: ask before closing Issues whose AC I cannot verify; otherwise no.

**10. GitHub Issue changed during work**
ACTIONS: Re-read live: `gh issue view N --json body,comments`, honoring newest Agent Brief and `spec_ref:`. Diff against what I implemented; adjust work to the current spec, re-verify every AC against the new text before checking any box. Log the change in sprint Progress/Running Context if a sprint is admitted.
MUTATIONS: AC ticks only against the current spec; Progress note if admitted.
STOP/ASK: ask if the change materially widens/contradicts scope; a live re-read before completion is mandatory regardless.

**11. Legacy layout `backlog/sprints/` + `backlog/config.yml`, no `.dev-backlog/`; orient**
ACTIONS: Run `setup-dev-backlog.js`, which migrates sprints/config/triage into `.dev-backlog/` and leaves `backlog/tasks/`, `docs/`, `completed/`. Then read `.tracker`, `_context.md`, migrated active sprint; run `status.sh --json`/`next.sh --json`; verify next Issue live.
MUTATIONS: local migration to `.dev-backlog/` (new files). No tracker changes.
STOP/ASK: brief confirmation before migrating since it rewrites layout; if the user said "orient" plainly I state that migration is required and proceed, as the scripts only run against `.dev-backlog/`.

**12. Work #7, `.tracker` says `backlog`, no GitHub remote**
ACTIONS: Authority is Backlog.md; GitHub absence is irrelevant. `backlog task 7 --plain` is the spec (`spec_ref:` overrides). Implement, verify AC, commit; close with `backlog task edit 7 -s Done` (or the repo's configured terminal status). No `gh` calls, no milestone/triage (GitHub-only).
MUTATIONS: task 7 AC/status in Backlog.md; sprint `[~]`/`[x]` + Progress if admitted.
STOP/ASK: no.

**13. `.tracker` says `backlog`, CLI not installed**
ACTIONS: Attempt `backlog task N --plain`, it fails. Diagnose (report missing CLI, install hint). Do not infer `github` from `gh` being installed, and do not read `backlog/tasks/*.md` directly as a substitute.
MUTATIONS: none.
STOP/ASK: stop. Failed authority read is fail-closed until a live read succeeds; the user must install the CLI or change `.tracker`.
