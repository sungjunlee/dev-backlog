1. ACTIONS: Resolve scripts from the installed skill directory; from the project root, run `triage-collect.js`, judge the saved snapshot against available specs and active sprint, write model-actions JSON, then run `triage-report.js --snapshot PATH --model-actions PATH` with `--active-sprint PATH` if applicable.  
OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. In-process scripts derive references, merged-PR links, dates, labels, and stale signals from the snapshot; model judgment supplies semantic relationships and proposals. Example, only if supported by evidence:  
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists  
MUTATIONS: GitHub: none. Locally: snapshot, model-actions JSON, report; `.bak` on report overwrite. Alignment maps every issue to an Objective or orphan, names evidence tiers, and is skipped if both charters are absent; Decision Review categorizes every issue and names missing tiers.  
STOP/ASK: Stop after the report; no permission question needed. No accepted checkboxes means no apply.

2. ACTIONS: Use the existing snapshot without re-fetching; judge and write model-actions JSON; resolve any active sprint; run `triage-report.js --snapshot PATH --model-actions PATH`, adding `--active-sprint PATH` when applicable.  
OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. Missing override files are normal: relate/stale run in-process using snapshot references, merged-PR links, dates, and labels; semantic relationships come from model judgment. Evidence-supported example:  
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists  
MUTATIONS: GitHub: none. Locally: model-actions JSON and completed report, plus `.bak` on overwrite. Include Objective/orphan mapping and evidence tiers, or skipped Alignment without a charter; categorize every issue in Decision Review and name missing spec tiers.  
STOP/ASK: No ask for `--relate` or `--stale` files; they are optional overrides. Stop after reporting.

3. ACTIONS: Resolve the `status: active` sprint; judge the snapshot and write model-actions JSON; run `triage-report.js --snapshot PATH --model-actions PATH --active-sprint PATH`; verify that no Obsolete close targets any issue in its Plan or Running Context.  
OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. Snapshot-derived stale/reference signals run in-process; model judgment supplies semantic relationships. Exclude the protected issue from close proposals; this example is only for a different, eligible issue:  
<!-- triage:close #43 reason="merged PR #87 already exists" -->
- [ ] close #43 - merged PR #87 already exists  
MUTATIONS: GitHub and sprint files: none. Locally: model-actions JSON and report, with `.bak` on overwrite. Complete Objective/orphan mapping, evidence-tier disclosure, and every-issue Decision Review; skip Alignment if both charters are absent.  
STOP/ASK: No; active-sprint protection is mandatory, not an approval question. Stop after the report.

4. ACTIONS: Run `triage-apply.js <report.md>`; verify the printed plan excludes the unchecked proposal. If other accepted actions exist, execute `triage-apply.js <report.md> --apply --yes` for those.  
OUTPUT: Skip the unchecked anchor: acceptance requires both the anchor and its paired `[x]`. If it is the only proposal, execute no GitHub mutation.  
MUTATIONS: GitHub changes only for other accepted actions, if any. Dry-run writes nothing; mutation execution creates or updates the audit log beside the report. Do not change checkboxes.  
STOP/ASK: No; never infer acceptance from an anchor alone.

5. ACTIONS: Run `triage-apply.js <report.md>`, verify one planned action for the duplicate surfaces, then run `triage-apply.js <report.md> --apply --yes`.  
OUTPUT: Deduplicate by `(verb, issueNumber, normalizedArgs)`; execute the accepted action once and skip its duplicate occurrence. Unknown verbs are skipped.  
MUTATIONS: GitHub receives the single accepted action’s mutation; a local audit log exists beside the report. No report checkbox edits.  
STOP/ASK: No; existing human acceptance authorizes this apply invocation.

6. ACTIONS: Run only `triage-apply.js <report.md>`.  
OUTPUT: Print intended `gh` mutations for checked, anchored actions; deduplicate equivalent actions and skip unchecked proposals and unknown verbs. Execute no mutations.  
MUTATIONS: GitHub: none. Local files: none, including no audit-log write.  
STOP/ASK: Stop after the dry-run; do not automatically add `--apply --yes`.

7. ACTIONS: Run `triage-apply.js <report.md>` to inspect the remaining plan; then run `triage-apply.js <report.md> --apply --yes`.  
OUTPUT: Previously successful accepted actions are skipped and logged `already-applied`; execute remaining accepted actions. Continue skipping unchecked proposals, duplicate surfaces, and unknown verbs.  
MUTATIONS: GitHub changes only for remaining accepted actions; the local audit log records outcomes beside the report. Do not reset acceptance or erase prior success records.  
STOP/ASK: No renewed approval for unchanged accepted actions; stop and report any unresolved execution failure.