Answering all 13 from the skill text only, no commands run.

**1. Active sprint, `_context.md`, partial Plan**
- ACTIONS: Read `_context.md`, then the active sprint file; run `scripts/status.sh --json` and `scripts/next.sh --json` from project root; name the current state and the next batch whose items are `[ ]` with deps `[x]`.
- MUTATIONS: none.
- STOP/ASK: no.

**2. Plan overlapping an active track**
- ACTIONS: Read `_context.md` and the active sprint; run `sprint-init.js "topic" --component/--scope`, which refuses the overlap. Report the conflict and propose either adding the Issues to the existing active Plan (with a Progress note) or closing that track first.
- MUTATIONS: none by default; if the user chooses to extend the existing sprint, edit its Plan and Progress.
- STOP/ASK: yes. Two readings (extend vs. close-and-replan) lead to materially different work, so ask.

**3. Two disjoint active tracks**
- ACTIONS: Read `_context.md` and both sprint files; run `status.sh --json` (portfolio view), then `next.sh --track auth` and `next.sh --track billing`; name each track's state and next batch.
- MUTATIONS: none.
- STOP/ASK: no; disjoint tracks coexist by contract.

**4. No spec axis, three ordered issues**
- ACTIONS: Confirm authority is GitHub (no `.tracker`), read the three issues via `gh issue view N --json body,comments`. Ordered multi-Issue batch satisfies Sprint Admission. Run `setup-dev-backlog.js`, then `sprint-init.js "topic" --scope "<glob>"`; write Goal, three sequential batches (one Issue each, ordered), estimates. Spec absence is handled per `references/spec-fallback.md`, no charter required.
- MUTATIONS: creates `.dev-backlog/` and one `status: active` sprint file; no Issue changes.
- STOP/ASK: no.

**5. No spec axis, one self-contained issue**
- ACTIONS: Read the Issue with `gh issue view N --json body,comments`. Sprint Admission says default path is sprint-free Issue → implementation → PR → close; a single Issue does not qualify. Implement, verify each AC, open PR, close with `gh issue close N`.
- MUTATIONS: Issue AC ticks and closure, PR; no `.dev-backlog/` created.
- STOP/ASK: no.

**6. Work #42, no local task files, three AC checkboxes**
- ACTIONS: `gh issue view 42 --json body,comments`; apply newest `## Agent Brief` comment and any `spec_ref:` precedence. Implement, verify each AC before ticking it, open PR.
- MUTATIONS: Issue AC checkboxes ticked only after verification; no sprint file (not admitted).
- STOP/ASK: no, unless the authority read fails, in which case diagnose and stop.

**7. Fresh online session, no local task files**
- ACTIONS: Check for `_context.md` and active sprint (absent); confirm authority from `.tracker` (default GitHub); `gh issue list` to find live Issues; run `next.sh` which reports no active sprint and the next live Issue.
- MUTATIONS: none.
- STOP/ASK: no; report the next Issue and whether a sprint is warranted.

**8. Only repo files, GitHub unavailable**
- ACTIONS: Read `_context.md` and any active sprint for the readable picture; attempt `gh issue view`; it fails. Diagnose the failure (auth, network, missing `gh`) and report.
- MUTATIONS: none.
- STOP/ASK: yes. Failed authority read is fail-closed; I never execute tasks or change AC/lifecycle from sprint text or local copies.

**9. Close a sprint with reusable Running Context**
- ACTIONS: For each Plan task, re-read the live Issue, verify AC, close with the Close verb. Strike or carry any non-`[x]` items with a Progress entry. Run `sprint-close.sh` (runs `backlog-doctor.js`, flips status, appends Progress). Then promote the project-level Running Context into `_context.md`.
- MUTATIONS: Issues closed; sprint file `status: completed`; `_context.md` updated; completed sprint file may be deleted.
- STOP/ASK: no, unless an AC does not verify against the current Issue text.

**10. Issue changed during work**
- ACTIONS: Re-read the live Issue (`gh issue view N --json body,comments`); the newest Agent Brief or `spec_ref:` wins. Re-verify existing work against the new AC; adjust implementation; note the change in sprint Running Context/Progress if admitted.
- MUTATIONS: Issue AC ticks reflect the new spec; sprint Progress note if admitted. Never edit the Issue back.
- STOP/ASK: ask only if the change makes completed work contradictory or out of scope; otherwise continue.

**11. Legacy `backlog/` layout**
- ACTIONS: Orient needs `.dev-backlog/`; run `scripts/setup-dev-backlog.js`, which migrates `backlog/sprints/` and `backlog/config.yml` into `.dev-backlog/` and leaves `backlog/tasks/`, `docs/`, `completed/` in place. Then read `_context.md` and the migrated active sprint, run `status.sh`/`next.sh`.
- MUTATIONS: local layout migration to `.dev-backlog/` (files created, config moved); no tracker changes.
- STOP/ASK: no; migration is the specified rail for Plan/orient bootstrap and is reversible via git.

**12. Work #7, `.tracker` says `backlog`, no remote**
- ACTIONS: Authority is Backlog.md, GitHub irrelevant. Read spec with `backlog task 7 --plain`; honor `spec_ref:` if present. Implement, verify AC, commit locally; close with `backlog task edit 7 -s Done` (or repo's configured terminal status).
- MUTATIONS: Backlog task status and AC; local commit; sprint Progress if admitted.
- STOP/ASK: no; a missing GitHub remote is not a failure for the `backlog` authority.

**13. `.tracker` says `backlog`, CLI missing**
- ACTIONS: Attempt `backlog task N --plain`; it fails. Diagnose: report that the declared authority's CLI is absent and how to install it. Do not infer authority from `gh` being present.
- MUTATIONS: none.
- STOP/ASK: yes. Failed authority read stops execution; no fallback to sprint text, and switching `.tracker` is the user's decision.
