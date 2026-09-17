1. Triage on a repo with open issues, no accepted checkboxes
- ACTIONS: `gh issue list --state open --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url`; read `spec/charter.md` (else `CHARTER.md`), optional `spec/capabilities.md`/`system-map.md`, `.dev-backlog/triage-config.yml` (stale threshold, default 60d), any `status: active` sprint; `gh issue view N --comments` / `gh pr list --search "closes #N" --state merged` where a judgment needs it; write `.dev-backlog/triage/2026-09-17-report.md`.
- OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. Stale = `updatedAt` older than threshold and no milestone; relationships from `#N` mentions/"blocks"/"depends-on" phrases in bodies/comments and merged closing PRs. Example: `<!-- triage:close #42 reason="merged PR #87 already exists" -->` / `- [ ] close #42 - merged PR #87 already exists`.
- MUTATIONS: one new local report file; GitHub none.
- STOP/ASK: no; the report is advisory and all boxes stay `[ ]` for the human.

2. Render a report from a snapshot with no `--relate` / `--stale` files
- ACTIONS: the skill text names no snapshot/`--relate`/`--stale` inputs, so I treat the snapshot as the `gh issue list` JSON and derive the signals myself: stale from `updatedAt` vs the config threshold + missing milestone; relationships from `#N` mentions, blocks/depends-on phrases, and `gh pr list --search "closes #N" --state merged`.
- OUTPUT: all eight sections in order; Relationships holds one edge per evidence fact (`#12 blocks #15`); Obsolete Candidates lists only issues with concrete evidence; if a signal cannot be computed from the snapshot alone, say so in that section rather than inventing it. Example: `<!-- triage:revisit #31 reason="no activity for 92 days, no milestone" -->` / `- [ ] revisit #31 - no activity for 92 days, no milestone`.
- MUTATIONS: local report file only; GitHub none.
- STOP/ASK: no, but I would note in the reply that no relate/stale side-files were supplied and the signals were derived from issue data.

3. Report while an active sprint Plan names a stale issue
- ACTIONS: read the `status: active` sprint; collect issues named in its Plan / Running Context as the in-flight set before writing Obsolete Candidates.
- OUTPUT: the stale issue appears in Classification (age) and Decision Review, but gets no `close`/`close-duplicate` anchor; at most a `revisit` note stating it is in-flight in sprint X. Example: `<!-- triage:revisit #58 reason="stale by age but named in active sprint Plan; not proposing close" -->` / `- [ ] revisit #58 - stale by age but named in active sprint Plan`.
- MUTATIONS: local report only; GitHub none.
- STOP/ASK: no; the boundary rule decides it, and "Done when" requires no close targets an in-flight issue.

4. Apply where an anchor is present but its checkbox is unchecked
- ACTIONS: `triage-apply.js <report.md>` (dry-run) to show the plan, then `triage-apply.js <report.md> --apply --yes` if the human confirms.
- OUTPUT: the unchecked anchor is listed as skipped/not accepted; only `[x]` actions execute.
- MUTATIONS: GitHub only for accepted actions; audit log written beside the report; the unchecked issue untouched.
- STOP/ASK: no for the unchecked line (unchecked means not accepted, I never flip it myself); I would not run `--apply --yes` without the human asking for apply.

5. Apply where the same accepted action appears in its source section and Apply Checklist
- ACTIONS: dry-run, then `--apply --yes`.
- OUTPUT: the script dedupes by `(verb, issue, args)`, so the action executes once and the duplicate is logged as a dedupe, not a second mutation. If the two copies differ in args, they are different keys; I would flag that in the reply since the checklist should repeat each action exactly once.
- MUTATIONS: one GitHub mutation for that action; audit log records it once.
- STOP/ASK: no unless the duplicate copies disagree, in which case I ask which one is intended before applying.

6. `triage-apply.js <report.md>` without `--apply`
- ACTIONS: run it as given; that is the dry-run rail.
- OUTPUT: printed plan of accepted actions (`[x]` next to valid anchors), skipped unknown verbs, and unaccepted lines; nothing executed.
- MUTATIONS: none in GitHub; no audit log written (plan only).
- STOP/ASK: no; I report the plan and wait for the human to request `--apply --yes`.

7. Re-run apply after a partial successful apply
- ACTIONS: dry-run first to see what remains, then `triage-apply.js <report.md> --apply --yes`.
- OUTPUT: previously applied actions are logged `already-applied` and skipped; the actions that failed or were not reached are executed; unaccepted lines still skipped.
- MUTATIONS: GitHub changes only for the remaining accepted actions; audit log appended beside the report.
- STOP/ASK: only if the earlier failure cause is unknown (auth, rate limit, a target issue already closed by someone else); otherwise no, since re-run is idempotent by design.
