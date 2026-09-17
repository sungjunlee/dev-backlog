1. ACTIONS: `gh issue list --state open --limit 500 --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url` (raise limit until count stops growing); read `spec/charter.md` (else `CHARTER.md`), optional capabilities/system-map, `.dev-backlog/triage-config.yml` (stale_days, default 60), any `status: active` sprint; `gh issue view N --json comments,closedByPullRequestsReferences` where a merged closing PR or comment history matters; write `.dev-backlog/triage/2026-09-18-report.md`.
OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. Stale = no update past stale_days and no milestone; relationships from `#N` mentions outside code fences/URLs and merged closing PRs. Example: `<!-- triage:close #42 reason="merged PR #87 already exists" -->` / `- [ ] close #42 - merged PR #87 already exists`.
MUTATIONS: one new report file locally; GitHub none. Unchecked boxes are expected — apply is a separate mode.
STOP/ASK: no; report is advisory. Ask only if no `gh` auth or repo.

2. ACTIONS: same rail — the report mode has no helper script; `gh issue list` / `gh issue view` plus reading charter/config/sprints; write the report by hand with all eight sections in order.
OUTPUT: same sections; stale from `updatedAt` vs `stale_days` and absence of milestone; edges written one per fact with direction as the evidence phrase states (`A blocks B` = B waits for A). Example: `<!-- triage:set-priority #17 value=high -->` / `- [ ] set-priority #17 - value=high, blocks #20 and #23`.
MUTATIONS: report file only; GitHub none.
STOP/ASK: no; note in the report if no charter ("skipped because no charter" in Alignment).

3. ACTIONS: read the active sprint's Plan and Running Context first; collect the issue numbers named there; render the report as usual.
OUTPUT: the stale issue appears in Classification and Alignment/Decision Review, but no `close`/`close-duplicate` anchor targets it; at most a `revisit` or a note "in-flight in sprint <name>, close not proposed". Example: `<!-- triage:revisit #58 reason="inactive 75d but named in active sprint Plan" -->` / `- [ ] revisit #58 - inactive 75d but named in active sprint Plan`.
MUTATIONS: report file only; GitHub none.
STOP/ASK: no; the boundary is applied silently and recorded in the report.

4. ACTIONS: `node <skill dir>/scripts/triage-apply.js <report.md>` to see the plan, then `--apply --yes`.
OUTPUT: the unchecked anchor is skipped and listed as not accepted; only `[x]` anchors execute (close/revisit/set-priority/etc. via `gh`).
MUTATIONS: GitHub only for accepted actions; audit log written beside the report; unchecked issue untouched.
STOP/ASK: no for the skipped item — `[ ]` is the human's decision; if zero anchors are accepted I would report "nothing to apply" rather than run `--apply`.

5. ACTIONS: dry-run, then `--apply --yes`.
OUTPUT: the action appears twice (source section + Apply Checklist) but is deduped by `(verb, issueNumber, normalizedArgs)`; executed once; the duplicate logged as deduped/skipped.
MUTATIONS: one GitHub mutation for that issue; one audit-log entry (plus dedupe note).
STOP/ASK: no; if the two copies disagree in args (e.g. different reason) they would not dedupe, so I would ask which is intended before applying.

6. ACTIONS: run `node <skill dir>/scripts/triage-apply.js <report.md>` from the project root.
OUTPUT: dry-run plan only — lists accepted actions, skipped unchecked/unknown verbs, and dedupe results; nothing executed.
MUTATIONS: none (no GitHub writes, no audit log).
STOP/ASK: yes — I stop after showing the plan and wait for the human to request `--apply --yes`.

7. ACTIONS: `triage-apply.js <report.md>` dry-run, then `--apply --yes` again.
OUTPUT: actions already in the audit log are logged `already-applied` and skipped; the remaining accepted actions execute; unaccepted ones untouched.
MUTATIONS: GitHub only for the not-yet-applied accepted actions; audit log appended.
STOP/ASK: no, re-run is idempotent by design; if the audit log is missing or the earlier failure reason is unclear (e.g. auth), I would check that first rather than blindly retry.
