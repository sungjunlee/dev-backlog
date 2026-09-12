1. ACTIONS: Read `backlog/sprints/_context.md`, then the active sprint file (Goal, Plan, Running Context, Progress). Run `status.sh --json` and `next.sh --json`. Name the next actionable batch: the first batch with `[ ]` items whose prior batches are `[x]`; note any `[~]` items with their PR/branch pointers as in flight. For the next live item, `effective-task-spec.js #N` to confirm it is still open.
MUTATIONS: none.
STOP/ASK: no; report state and next batch. Ask only if `[~]` items have no pointer (unmoored) or doctor warns.

2. ACTIONS: Read `_context.md` and the active sprint file to see its `component:`/`scope:`. Run `sprint-init.js "topic" --component|--scope ...`; it refuses the overlapping track. Do not work around the refusal.
MUTATIONS: none (no file created, no GitHub change).
STOP/ASK: yes. Report the overlap and offer options: add the issues to the existing active track's Plan, choose a provably disjoint scope, or wait until the active track closes via `sprint-close.sh`. The user decides.

3. ACTIONS: Read `_context.md`, then both sprint files (`YYYY-MM-auth.md`, `YYYY-MM-billing.md`). Run `status.sh --json` for the portfolio view, then `next.sh --track auth` and `next.sh --track billing`. Name each track's current batch state and next actionable batch; confirm scopes are disjoint (`src/auth/**` vs `src/billing/**`).
MUTATIONS: none.
STOP/ASK: no; ask only which track to work if the user's request does not name one.

4. ACTIONS: `scripts/setup-dev-backlog.js --tracker github --non-interactive` to bootstrap `backlog/`. `gh issue list` to see open issues. Apply Sprint Admission: only if execution needs ordered multi-Issue batches, handoff, or cross-Issue context does a sprint exist; otherwise the default is sprint-free Issue → PR. If admitted, `sprint-init.js "topic"` with no `--component`/`--objectives` (spec absent; `references/spec-fallback.md` degradation), optionally `--scope`, then write Goal, ordered Plan batches with `#N` refs, estimates.
MUTATIONS: local only: `backlog/` config and one sprint file; no GitHub changes; do not create `spec/` or run `spec-*`.
STOP/ASK: ask which issues form the sprint and confirm sprint admission is warranted; also mention the optional craftkit install but do not install it.

5. ACTIONS: Do not create a sprint (one self-contained issue fails Sprint Admission; no Relay presence is irrelevant). `effective-task-spec.js #N` to get AC, lifecycle, digest. Implement directly on a branch, verify each AC, open a PR, close the Issue on merge. `backlog/` may be bootstrapped only if needed, not required.
MUTATIONS: GitHub: branch, PR, Issue AC checkboxes checked and Issue closed after verification. Local: code changes only.
STOP/ASK: no for the sprint-free route; confirm before merge/close if the user hasn't asked for a full cycle.

6. ACTIONS: Read `_context.md` and any active sprint. `effective-task-spec.js #42` for spec, three AC items, lifecycle, `source_ref`, digest. If admitted to a sprint, mark the Plan item `[~]` with branch/PR pointer. Implement each AC, verify each, then check each box in the Issue only after verification (explicit `gh issue edit` per `references/github-sync.md`); open PR.
MUTATIONS: GitHub: AC checkboxes on #42, PR; local: code, sprint Plan `[~]` and Progress entry if admitted.
STOP/ASK: stop if `effective-task-spec.js` fails to resolve; diagnose but do not execute or change AC/lifecycle.

7. ACTIONS: Read `backlog/sprints/_context.md` and active sprint file if `backlog/` exists; otherwise run `setup-dev-backlog.js --tracker github --non-interactive` only if a mode needs it. Run `status.sh --json` / `next.sh --json`; if no sprint, `gh issue list` for the next live Issue. Local task files are not required; the Issue is truth via `effective-task-spec.js`.
MUTATIONS: none (setup bootstrap only if a workflow requires it).
STOP/ASK: no; report orientation and ask what mode the user wants.

8. ACTIONS: Read `_context.md`, active sprint files, Progress and Running Context to reconstruct state. `status.sh --json` (tracker-neutral) may run; `next.sh` and `effective-task-spec.js` need GitHub and will fail. Report what the sprint file says, with an explicit caveat that Issue truth cannot be verified offline.
MUTATIONS: none. No AC/lifecycle changes, no Plan checkbox changes, no implementation of tasks whose spec cannot be live-resolved (Work boundary).
STOP/ASK: yes; stop before executing any task and tell the user GitHub access is required to resolve specifications.

9. ACTIONS: Per task: `effective-task-spec.js #N` re-resolve, verify every AC, confirm each Issue closed and Plan `[x]`. Run `sprint-close.sh` (with `--track` if multiple tracks); it runs `backlog-doctor.js`, flips `status: completed`, appends final Progress, prints reassess. After success, promote the reusable Running Context entries to `_context.md`; leave the sprint file untouched thereafter.
MUTATIONS: GitHub: close any Issues still open after AC verification. Local: sprint `status: completed`, Progress entry, `_context.md` additions.
STOP/ASK: stop if doctor warns or Plan items remain unchecked; ask before closing Issues that aren't verifiably done. Never flip completed back.

10. ACTIONS: Re-run `effective-task-spec.js #N`; compare digest and `source_ref` against the earlier one. Re-read the new AC and lifecycle; re-verify existing work against the changed spec; if the Issue was closed or re-scoped, stop implementing. If a sprint is admitted, record the change in Running Context/Progress and adjust the Plan item.
MUTATIONS: local sprint notes only until re-verification; GitHub AC only after re-verification against the current spec.
STOP/ASK: yes, if the change invalidates completed work or conflicts with the sprint Goal; report the diff and ask how to proceed. Never edit the Issue to match the old spec.
