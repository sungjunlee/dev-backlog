1. **ACTIONS:** From the project root, use `gh issue list --state open --limit 500 --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url`; raise the limit until the count stops growing. Read charter, optional specs, config, and active sprints; use `gh issue view N --json comments,closedByPullRequestsReferences` where needed. Write the dated report.
   **OUTPUT:** Sections, in order: Classification; Relationships; Obsolete Candidates; Priority Proposals; Milestone Suggestions; Alignment; Decision Review; Apply Checklist. Staleness uses inactivity beyond configured `stale_days` (default 60), with no milestone. Relationships use directional evidence, eligible issue mentions, and merged closing PRs. Example anchor:
   `<!-- triage:revisit #42 reason="inactive beyond stale threshold; reassess scope" -->`
   **MUTATIONS:** Create `.dev-backlog/triage/YYYY-MM-DD-report.md`, with unchecked anchored proposals repeated once in Apply Checklist; no GitHub or `spec/*` changes.
   **STOP/ASK:** No approval needed to report. Do not apply anything without human-accepted checkboxes.

2. **ACTIONS:** Use the same `gh issue list` command and pagination-by-increasing-limit procedure; manually inspect charter/specs, config, and active sprints. Fetch needed comments/closing PR evidence with `gh issue view N --json comments,closedByPullRequestsReferences`. Manually compose the report; helper scripts are unnecessary.
   **OUTPUT:** Classification → Relationships → Obsolete Candidates → Priority Proposals → Milestone Suggestions → Alignment → Decision Review → Apply Checklist. Derive stale flags from inactivity/config and milestone absence; derive relationship edges from evidence phrases, plain `#N` mentions outside fences/URLs excluding self-mentions, and merged closing PRs. Example anchor:
   `<!-- triage:revisit #42 reason="scope needs clarification" -->`
   **MUTATIONS:** Write only the derived report, pairing each anchor with an unchecked checkbox and repeating each action once in Apply Checklist; no GitHub changes.
   **STOP/ASK:** No. Mark unavailable evidence explicitly; do not infer closure evidence from age alone.

3. **ACTIONS:** Gather issues with the report-mode `gh issue list` command, read the active sprint’s Plan and Running Context, and inspect charter/spec/config evidence; fetch additional history with `gh issue view N --json comments,closedByPullRequestsReferences` as needed.
   **OUTPUT:** Classification → Relationships → Obsolete Candidates → Priority Proposals → Milestone Suggestions → Alignment → Decision Review → Apply Checklist. Compute staleness from inactivity/config plus milestone absence; obtain relationships from eligible mentions, directional evidence, and merged closing PRs. Identify the stale issue as in flight and exclude it from closing proposals. Example anchor:
   `<!-- triage:revisit #42 reason="stale signal; protected by active sprint Plan" -->`
   **MUTATIONS:** Write the report only; leave GitHub, sprint files, and specs unchanged. Never suggest assignment into an active or wait-gated milestone.
   **STOP/ASK:** No. Active-sprint protection overrides any stale-based closing proposal.

4. **ACTIONS:** Run `node <installed skill dir>/scripts/triage-apply.js <report.md>` to preview accepted actions. If other accepted actions exist, execute them with the same command plus `--apply --yes`.
   **OUTPUT:** Skip the unchecked anchor; its presence alone grants no acceptance. If it is the only action, nothing executes.
   **MUTATIONS:** No GitHub change from the unchecked action. An actual apply of other accepted actions changes only their targets and writes the adjacent audit log.
   **STOP/ASK:** No additional confirmation for already accepted actions; do not check the unchecked box yourself.

5. **ACTIONS:** Preview with `node <installed skill dir>/scripts/triage-apply.js <report.md>`, then execute with `--apply --yes`.
   **OUTPUT:** Deduplicate the accepted source-section and Apply Checklist occurrences by `(verb, issueNumber, normalizedArgs)`; execute the action once. Skip unknown verbs and unaccepted actions.
   **MUTATIONS:** One logical GitHub action, with audit logging beside the report; no manual checkbox, sprint, or spec edits.
   **STOP/ASK:** No; the human acceptance already authorizes that action.

6. **ACTIONS:** Run exactly `node <installed skill dir>/scripts/triage-apply.js <report.md>`.
   **OUTPUT:** Print the dry-run plan of accepted actions. Execute no GitHub mutations; do not automatically append `--apply`.
   **MUTATIONS:** None required by the described dry-run contract; it specifies plan printing, not an audit-log write.
   **STOP/ASK:** Stop after the preview because execution was not requested.

7. **ACTIONS:** Preserve the existing audit log; preview with `node <installed skill dir>/scripts/triage-apply.js <report.md>`, then rerun with `--apply --yes`.
   **OUTPUT:** Log previously successful accepted actions as `already-applied`; execute remaining accepted actions, deduplicating repeated entries. Skip unchecked actions and unknown verbs.
   **MUTATIONS:** GitHub changes only for outstanding accepted actions; update the adjacent audit log.
   **STOP/ASK:** No renewed approval for unchanged accepted actions. If failures persist, report outstanding actions and their errors; do not claim completion.