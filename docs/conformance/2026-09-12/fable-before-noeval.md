1. ACTIONS: Read `backlog/sprints/_context.md`, then the active sprint file (Goal, Plan, Running Context, latest Progress); run `bash "$skill_dir/scripts/status.sh"` and `next.sh` to confirm state and the first unchecked/`[~]` batch; name the next actionable batch and its Issue refs.
MUTATIONS: none.
STOP/ASK: no — orient is read-only; I only report the next batch.

2. ACTIONS: Confirm the work meets a Sprint Admission trigger; read the existing active track's `component:`/`scope:`; run `node "$skill_dir/scripts/sprint-init.js" "<topic>" --scope/--component --dry-run`, which fails loud via `scopesOverlap`.
MUTATIONS: none while the overlap exists — no second sprint file, no GitHub changes.
STOP/ASK: yes — overlap is refused by contract; I ask whether to add the Issues to the existing active track's Plan, redeclare a genuinely disjoint scope, or close the existing track first.

3. ACTIONS: Read `_context.md`; run `bash "$skill_dir/scripts/status.sh"` and `next.sh` for the portfolio view (one stanza per track); read each track's Goal/Plan/Running Context/Progress; report the next unchecked item per track and note `--track auth|billing` for single-track work.
MUTATIONS: none.
STOP/ASK: no; if the user wants to work, ask which track unless intent is clear.

4. ACTIONS: Run `node "$skill_dir/scripts/setup-dev-backlog.js" --tracker github --non-interactive` (creates `backlog/` with `.tracker`=github); `gh issue list` to inspect open Issues; confirm Sprint Admission (ordered multi-Issue batches / handoff); run `sprint-init.js "<topic>" --dry-run` then real, with no `objectives:` and no `component:` (spec files absent, per `spec-fallback.md`), optionally `--scope` globs; write Goal and ordered parallel-safe Plan batches; verify with `backlog-doctor.js`.
MUTATIONS: local `backlog/.tracker`, `backlog/config.yml`, `backlog/sprints/<YYYY-MM-topic>.md`; GitHub milestone only if adapter reports `milestones`.
STOP/ASK: ask only if the selected work does not clearly meet an admission trigger (then stay sprint-free) or before creating a milestone; never run `sync-pull.js --legacy-export`, never `amend` spec.

5. ACTIONS: Do not create a sprint (one self-contained Issue fails admission). Run `setup-dev-backlog.js --tracker github --non-interactive` only if a `backlog/` root is needed for scripts; otherwise `node "$skill_dir/scripts/effective-task-spec.js" #N`, implement, verify AC, open a PR, close the Issue.
MUTATIONS: code + PR on GitHub; Issue AC/lifecycle updates; `Fixes #N` only if closing-semantics is intentionally used; no sprint file.
STOP/ASK: no, beyond normal implementation questions.

6. ACTIONS: `node "$skill_dir/scripts/effective-task-spec.js" 42` for effective spec, AC, lifecycle, digest; check for an admitted sprint containing #42 (read batch + Running Context if so); optionally mark GitHub status/`[~]`; implement; verify each of the three AC items before ticking it.
MUTATIONS: GitHub: Issue AC checkboxes (via `gh` edit after verification), status label/comment when gates succeed, PR; local: code, plus Plan `[~]`→`[x]`, Running Context, Progress only if #42 is admitted to a sprint.
STOP/ASK: stop if `effective-task-spec.js` fails to resolve (no legacy mirror may authorize execution); otherwise no.

7. ACTIONS: Read `_context.md` and any active sprint; run `status.sh`/`next.sh`; if no sprint, `gh issue list` and name the next live Issue; resolve chosen work with `effective-task-spec.js`. Absence of task files is normal for the GitHub tracker — no pull.
MUTATIONS: none for orientation; no `sync-pull.js --legacy-export`.
STOP/ASK: no — I report the next batch/Issue and wait for a work instruction.

8. ACTIONS: Read `_context.md`, the active sprint file(s), and `backlog/.tracker`; run `status.sh` if tracker-neutral output works offline; reconstruct state from Plan/Progress only, clearly labelled as local-only.
MUTATIONS: none — without GitHub, `effective-task-spec.js` cannot resolve live truth, so no lifecycle changes, no AC ticks; any checked legacy mirror is diagnostic only, never execution input.
STOP/ASK: yes — report reconstructed state, state that task truth is unverifiable offline, and ask before implementing anything or wait for GitHub access; never switch trackers.

9. ACTIONS: Run `bash "$skill_dir/scripts/sprint-close.sh"` (runs `backlog-doctor.js`, prints `reassess_signal`); verify all Plan items `[x]` and Issues closed; set `status: completed`, write final Progress entry; copy project-level Running Context entries into `backlog/sprints/_context.md`; leave sprint file in place.
MUTATIONS: local: sprint file status/Progress, `_context.md`; GitHub: none unless open Issues need closing (then ask). No task directories needed; nothing to archive.
STOP/ASK: ask if unchecked Plan items or open Issues remain, or if `reassess_signal` recommends spec reassessment (spec amend is human-gated; never `amend` unattended).

10. ACTIONS: Re-run `effective-task-spec.js TASK_REF` and diff the content digest/AC against what I was executing; re-read the new spec; do not pull or use legacy mirrors.
MUTATIONS: none automatically; after reconciliation, update Running Context/Progress (if admitted) noting the Issue change, and continue against the new AC.
STOP/ASK: yes if the change alters scope, AC, or invalidates in-progress work — surface the diff and ask before continuing; if trivial (typo/clarification), note it and proceed.
