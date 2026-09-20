1. **Orient, one active sprint + `_context.md` + partial Plan**
ACTIONS: Read `.dev-backlog/.tracker` (absent = github); read `_context.md`, then the active sprint file; run `status.sh --json` and `next.sh --json`; `gh issue view N --json body,comments` for the next `[ ]`/`[~]` item to confirm it is live and open. Name current batch state, in-flight `[~]` pointers, and the next actionable batch.
MUTATIONS: none.
STOP/ASK: no; only if the `gh` read fails (fail-closed) or Plan refs are malformed.

2. **Plan a sprint overlapping an active track**
ACTIONS: Read `_context.md` and every `status: active` file; run `status.sh`; run `sprint-init.js "topic" --component/--scope …` — it refuses on `scopesOverlap` and I do not work around it. Report the collision to the user.
MUTATIONS: none (no sprint file is created).
STOP/ASK: yes — ask whether to add the issues to the existing track's Plan (later batch + Progress note), narrow the new scope to a disjoint one, or close the active track first. No hand-edit of the active track's scope or status.

3. **Orient, two disjoint active tracks**
ACTIONS: Read `_context.md`, both sprint files; `status.sh --json` for the portfolio view, then `status.sh --track auth` / `--track billing` and `next.sh --track <slug>`; `gh issue view` the next Issue per track. Report per-track state and next batch, noting scopes are disjoint (`src/auth/**` vs `src/billing/**`).
MUTATIONS: none.
STOP/ASK: no; if the user says "work" without naming a track, ask which one.

4. **No spec axis, three ordered issues, reach first active sprint**
ACTIONS: `gh issue view` each of the three issues (body + comments, Agent Brief/`spec_ref:` precedence). Admission: ordered multi-Issue batches qualify. Run `setup-dev-backlog.js` (creates `.dev-backlog/`), then `sprint-init.js "topic" [--scope …]`; write Goal, three sequential batches (`[ ] #A` → `[ ] #B` → `[ ] #C`), estimates. Spec degradation per `references/spec-fallback.md`: no charter → no `objectives:`, no spec resolution, no amendment attempted.
MUTATIONS: local only — new `.dev-backlog/` (sprints dir, `_context.md`), one `status: active` sprint file. No Issue writes.
STOP/ASK: no; I note that `spec-charter` is optional and available via craftkit, but do not block on it.

5. **No spec axis, one self-contained issue, no `.dev-backlog/`**
ACTIONS: `gh issue view N --json body,comments`; take the sprint-free path: implement on a branch → PR → verify AC → `gh issue close N` after merge. No `setup-dev-backlog.js`, no sprint.
MUTATIONS: tracker only at the end (AC checkboxes/close after verification); no local `.dev-backlog/`.
STOP/ASK: no; ask only if AC are missing or ambiguous.

6. **Work #42, no local task files, three live AC checkboxes**
ACTIONS: Read `.tracker`; `gh issue view 42 --json body,comments` — newest `## Agent Brief` overrides body, `spec_ref:` overrides both. Implement on a branch, verify each AC by test/evidence, open PR. If a sprint is admitted and #42 is on it, mark `[~] #42 (PR #…)`; otherwise no sprint edit.
MUTATIONS: tick each AC checkbox only after verification; close via `gh issue close 42` post-merge; Plan `[~]`→`[x]` + Progress only if admitted.
STOP/ASK: no, unless the `gh` read fails (stop, diagnose, no execution).

7. **Fresh online session, no local task files**
ACTIONS: Read `.tracker`; read `_context.md` and any active sprint file if present; `status.sh` / `next.sh`; `gh issue view` the next Issue to get live spec. Proceed per Orient → Work with the Issue as the only task truth (no task-file directory is required).
MUTATIONS: none until work starts.
STOP/ASK: no.

8. **Fresh session, repo files only, no GitHub access**
ACTIONS: Read `_context.md` and the active sprint file for the picture; attempt `gh issue view N`; it fails → fail-closed. Diagnose (`gh auth status`, network) and report what the sprint file suggests as context only.
MUTATIONS: none — no code execution against a task, no AC/lifecycle/Plan changes.
STOP/ASK: yes — stop; the authority read failed and I may not fall back to sprint text or any local copy. Ask the user to restore `gh` access or confirm the authority.

9. **Close sprint with reusable Running Context, no local task files**
ACTIONS: For each Plan item, re-read the live Issue, verify AC, confirm closed (`gh issue close N` if verified and still open). Run `sprint-close.sh` (with `--track` if multiple active) → runs `backlog-doctor.js`, flips `status: completed`, appends final Progress. Then promote project-level Running Context into `_context.md`; leave the sprint file untouched as permanent record.
MUTATIONS: sprint `status: completed`, Progress entry, `_context.md` additions; Issues closed only where verified; `--close-milestone` only if the user asks.
STOP/ASK: yes if any Plan item is not `[x]` or an AC is unverified — the sprint stays open; also stop on a doctor failure.

10. **GitHub Issue changed during work**
ACTIONS: Re-read `gh issue view N --json body,comments` (newest Agent Brief/`spec_ref:` win); diff against what I implemented; re-verify every AC against the current spec before ticking anything. Note the change in Progress / Running Context if the sprint is admitted.
MUTATIONS: none to the Issue text; AC checkboxes only after re-verification; Progress note locally.
STOP/ASK: ask if the change contradicts work already done or expands scope — a scope change becomes a new Issue or a batch adjustment, not a silent sprint rewrite.

11. **Legacy `backlog/` layout, no `.dev-backlog/`**
ACTIONS: Orient first reads the legacy files read-only and reports. Plan/Work rail: `setup-dev-backlog.js` migrates `backlog/sprints/` and `config.yml` (and triage) into `.dev-backlog/`, leaving `backlog/tasks/`, `docs/`, `completed/` in place (`references/file-format.md`). Then `status.sh` / `next.sh`.
MUTATIONS: local migration creating `.dev-backlog/`; no tracker writes.
STOP/ASK: yes — confirm the migration with the user before running setup, since it moves the active sprint file; orient itself makes no change.

12. **Work #7, `.tracker` = `backlog`, no GitHub remote**
ACTIONS: Read spec with `backlog task 7 --plain` (`spec_ref:` overrides body; no Agent Brief concept here). Implement, verify AC, commit; close with `backlog task edit 7 -s Done` (or the repo's configured terminal status). Never use `gh`; no PR expected without a remote.
MUTATIONS: Backlog.md task status → Done, AC ticked after verification; Plan `[~]`→`[x]` + Progress if admitted.
STOP/ASK: no; note `backlog-triage` and `--close-milestone` are unavailable (GitHub-only).

13. **`.tracker` = `backlog` but CLI missing**
ACTIONS: `backlog task N --plain` fails → fail-closed. Diagnose (CLI not installed), report. Do not infer the authority from `gh` being present.
MUTATIONS: none.
STOP/ASK: yes — stop; ask the user to install Backlog.md CLI or explicitly change `.tracker`. I never switch the authority or fall back to sprint text myself.
