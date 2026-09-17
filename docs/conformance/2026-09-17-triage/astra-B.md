1. **ACTIONS:** From the project root, use `gh issue list --state open --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url`; read the charter, optional specs, triage config, and active sprints; inspect comments and merged PRs where needed; write the report.
**OUTPUT:** Classification → Relationships → Obsolete Candidates → Priority Proposals → Milestone Suggestions → Alignment → Decision Review → Apply Checklist. Obtain stale signals from inactivity against the configured threshold (default 60 days), with no milestone; obtain relationships from issue references, explicit dependency language, comments, and merged closing PRs. Conditional example:
<!-- triage:close #42 reason="merged PR #87 already exists" -->
**MUTATIONS:** Create `.dev-backlog/triage/YYYY-MM-DD-report.md`, pairing each proposal anchor with an unchecked checkbox and repeating it once in Apply Checklist; no GitHub or `spec/*` changes.
**STOP/ASK:** No. Report generation needs no accepted checkboxes; exclude in-flight issues from closing proposals and active or wait-gated milestones from assignment proposals.

2. **ACTIONS:** Inspect the snapshot and available project context; derive classifications, stale candidates, and relationships directly. Use `gh issue view N --comments` and `gh pr list --search "closes #N" --state merged` when further evidence is needed. The contract names no renderer script and requires no `--relate` or `--stale` files.
**OUTPUT:** Classification → Relationships → Obsolete Candidates → Priority Proposals → Milestone Suggestions → Alignment → Decision Review → Apply Checklist. Derive stale signals from timestamps, milestone status, and the configured/default threshold; derive relationship edges from explicit phrases and issue mentions, supplemented by comments and merged PRs. Example if justified:
<!-- triage:revisit #42 reason="inactive beyond the stale threshold and has no milestone" -->
**MUTATIONS:** Write the report only, with anchored unchecked proposals and checklist repetitions; no GitHub or `spec/*` changes.
**STOP/ASK:** No merely because the auxiliary files are absent. Explicitly identify unavailable evidence; do not fabricate findings.

3. **ACTIONS:** Read the snapshot, triage config, charter/spec context, and active sprint Plan and Running Context before proposing actions; corroborate ambiguous evidence with `gh issue view N --comments` or merged-PR searches.
**OUTPUT:** Classification → Relationships → Obsolete Candidates → Priority Proposals → Milestone Suggestions → Alignment → Decision Review → Apply Checklist. Calculate staleness from inactivity and milestone status; derive relationships from references and explicit dependency evidence. Explain that active sprint membership prevents a closing proposal. Example:
<!-- triage:revisit #42 reason="stale but named in the active sprint Plan" -->
**MUTATIONS:** Write the report with an unchecked revisit proposal if warranted; no closing proposal for that issue, no GitHub changes, and no sprint or spec edits.
**STOP/ASK:** No. Staleness does not override the explicit in-flight protection.

4. **ACTIONS:** Run the installed skill’s `triage-apply.js <report.md>` to preview; for an authorized execution request, run `triage-apply.js <report.md> --apply --yes`.
**OUTPUT:** Skip the action whose adjacent checkbox is unchecked, assuming no equivalent checked occurrence exists elsewhere; execute only other accepted, supported actions.
**MUTATIONS:** No GitHub change for the unchecked action; other accepted actions may change GitHub. Execution writes an audit log beside the report.
**STOP/ASK:** No. An anchor alone is not acceptance; do not check its box on the human’s behalf.

5. **ACTIONS:** Run `triage-apply.js <report.md>`; then run `triage-apply.js <report.md> --apply --yes` for authorized execution.
**OUTPUT:** Deduplicate the accepted source-section and Apply Checklist occurrences by `(verb, issue, args)`; execute the action once, skipping the redundant occurrence.
**MUTATIONS:** One logical GitHub action and an audit log beside the report; no additional mutation from the repeated entry.
**STOP/ASK:** No. Repetition in Apply Checklist is required and the apply script explicitly handles deduplication.

6. **ACTIONS:** Run `triage-apply.js <report.md>` from the target project root, resolving the script from the installed skill directory.
**OUTPUT:** Print the dry-run plan for accepted actions; execute no GitHub actions. Do not silently append `--apply --yes`.
**MUTATIONS:** None; the contract does not specify a dry-run audit-file write.
**STOP/ASK:** No. Finish after presenting the plan; execution was not requested by this invocation.

7. **ACTIONS:** Run `triage-apply.js <report.md>` to review the remaining plan, then rerun `triage-apply.js <report.md> --apply --yes` under the existing execution authorization.
**OUTPUT:** Log successful prior actions as `already-applied`; execute remaining accepted, supported actions; deduplicate repetitions and skip unchecked actions and unknown verbs. Report any remaining failures.
**MUTATIONS:** Only remaining accepted actions change GitHub; write the rerun audit log beside the report.
**STOP/ASK:** No for an ordinary resumable partial apply. Stop on an unresolved blocker rather than broadening acceptance or claiming completion.