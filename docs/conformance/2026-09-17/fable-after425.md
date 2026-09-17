1. ACTIONS: Read `_context.md` and the active sprint file; run `status.sh --json` and `next.sh --json`; name the next actionable batch (first batch with `[ ]`/`[~]` items) and the current sprint state. MUTATIONS: none. STOP/ASK: no.

2. ACTIONS: Read `_context.md` and the active sprint; run `status.sh --json` to see the active track's `component:`/`scope:`; attempt `sprint-init.js "topic" --component|--scope` only with a provably disjoint scope, otherwise expect refusal. MUTATIONS: none until the overlap is resolved; no sprint file created. STOP/ASK: yes — overlapping scope fails loud; ask whether to narrow the scope, add work to the existing active Plan as a later batch, or wait for the active track to close.

3. ACTIONS: Read `_context.md` and both sprint files; run `status.sh --json` (portfolio view), then `next.sh --track auth` and `next.sh --track billing`; report each track's state and next batch. MUTATIONS: none. STOP/ASK: no.

4. ACTIONS: Confirm admission (ordered multi-Issue batches qualifies); `setup-dev-backlog.js --tracker github --non-interactive`; `effective-task-spec.js` for each of the three issues; `sprint-init.js "topic" --scope "<globs>"` (no component axis without `spec/capabilities.md`); write Goal, three sequential batches (one issue each, in the stated order) with estimates, per `references/spec-fallback.md` omit `objectives:`/`component:`. MUTATIONS: local `.dev-backlog/` and a new `status: active` sprint file; no tracker writes. STOP/ASK: ask only if the three issues cannot be resolved live (fail-closed); otherwise no.

5. ACTIONS: Sprint-free default path: `effective-task-spec.js #N`, implement, open PR, verify AC, close via `gh issue close`. Do not run setup or create a sprint (single self-contained issue does not meet admission). MUTATIONS: tracker AC checkboxes/close after verification; no local files. STOP/ASK: no (report inability if resolution fails).

6. ACTIONS: Read `_context.md`/active sprint if present; `effective-task-spec.js 42` for AC, lifecycle, source_ref, digest; if admitted, mark Plan item `[~]` with branch/PR pointer; implement; verify each of the three AC; check them off on the Issue; PR. MUTATIONS: Issue #42 AC checkboxes (explicit `gh` edit) and later close; sprint Plan/Progress only if admitted. STOP/ASK: no, unless resolution fails.

7. ACTIONS: Read `_context.md` and active sprint if present; `status.sh --json` / `next.sh --json`; resolve the named next Issue via `effective-task-spec.js`; work it on the sprint-free path if nothing is admitted. MUTATIONS: none for orientation; tracker only after verified work. STOP/ASK: no.

8. ACTIONS: Read `_context.md`, active sprint file, Running Context and Progress for the local picture; attempt `status.sh`; note that live resolution is unavailable. MUTATIONS: none — adapter unavailable is fail-closed, no local fallback. STOP/ASK: yes — I can orient from local files but cannot execute tasks, change AC, or close anything until GitHub access is restored; tell the user and stop.

9. ACTIONS: Per task, re-resolve with `effective-task-spec.js`, verify AC, close via `gh issue close`, tick `[x]`; run `sprint-close.sh` (doctor, `status: completed`, final Progress); then promote the durable Running Context entries into `_context.md`. MUTATIONS: Issues closed; sprint file completed (immutable after); `_context.md` updated. STOP/ASK: no, unless the doctor reports an unfinished Plan or a reassess signal worth surfacing.

10. ACTIONS: Re-run `effective-task-spec.js` and compare the digest; re-verify the current AC against work done; if admitted, add a Running Context/Progress note. MUTATIONS: none to the Issue; sprint notes only. STOP/ASK: yes if the change alters scope or AC materially — ask whether to continue, split into a new Issue, or re-plan; otherwise continue on the new spec.

11. ACTIONS: Sprint-free path via the `backlog` adapter: `effective-task-spec.js BACK-7`, implement, verify both AC, commit, close with the adapter's close verb (`references/adapter-ports.md`). Never switch to `gh`. MUTATIONS: BACK-7 AC and status in Backlog.md; no sprint file. STOP/ASK: no; stop only if the `backlog` CLI fails (fail-closed).

12. ACTIONS: Read the legacy sprint to orient, but note `.dev-backlog/` is absent so `status.sh`/`next.sh` cannot find the hub; report the migration need (`setup-dev-backlog.js --tracker github --non-interactive`, then move `backlog/sprints/` and config under `.dev-backlog/`). MUTATIONS: none without approval. STOP/ASK: yes — ask before migrating the layout since it moves shared execution records.
