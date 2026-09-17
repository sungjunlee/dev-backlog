1. **Run triage on a repo with open issues, no accepted checkboxes.**
ACTIONS: `node "$skill_dir/scripts/triage-collect.js" --json` from project root → snapshot in `.dev-backlog/triage/.cache/<ISO>.json`; read snapshot + `spec/charter.md` (else `CHARTER.md`), optional capabilities/system-map, any `status: active` sprint; write `--model-actions` JSON (priority/milestone/obsolete/relationship entries); run `triage-report.js --snapshot PATH --model-actions PATH [--active-sprint PATH]`; insert `## Alignment` and `## Decision Review` before Apply Checklist. Stop.
OUTPUT: Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist. Stale/relationship signals come from the in-process relate/stale scripts (issue refs, merged-PR links, dates, labels); semantic edges/priorities from my model-actions. Example: `<!-- triage:close #42 reason="merged PR #87 already exists" -->` / `- [ ] close #42 - merged PR #87 already exists`.
MUTATIONS: GitHub none; local: snapshot cache, model-actions file, report under `.dev-backlog/triage/`.
STOP/ASK: Stop after report; no apply since no `[x]` (and apply is a separate invocation anyway).

2. **Render from snapshot with no `--relate`/`--stale` files.**
ACTIONS: Skip collect; write model-actions; resolve active sprint; run `triage-report.js --snapshot PATH --model-actions PATH [--active-sprint PATH]` with no override flags.
OUTPUT: Full report sections as in #1; relate/stale run in-process from the snapshot by default (the flags are overrides only, so nothing is missing). Example anchor: `<!-- triage:set-priority #42 value="high" reason="customer-reported outage blocks the auth theme" -->` / `- [ ] set-priority #42 - high`.
MUTATIONS: GitHub none; local report (+ `.bak` if overwriting).
STOP/ASK: no.

3. **Render while an active sprint Plan names a stale issue.**
ACTIONS: Resolve the `status: active` sprint file under `.dev-backlog/sprints/`; run `triage-report.js --snapshot PATH --model-actions PATH --active-sprint <sprint path>`; also omit any `obsolete` close for that issue from my model-actions.
OUTPUT: Same sections; the stale signal still surfaces from snapshot dates/refs but no Obsolete close targets an issue in the active Plan/Running Context — I note it in Obsolete Candidates as excluded (in-flight) rather than proposing `close`. Verify the rendered report has no close anchor for it. Example: `<!-- triage:close #17 reason="superseded by merged PR #90" -->` / `- [ ] close #17 - superseded by merged PR #90` (for a non-sprint issue only).
MUTATIONS: GitHub none; local report only.
STOP/ASK: no, but I would not omit `--active-sprint`; if the renderer still emitted a close for the sprint issue, I would fix inputs before finishing.

4. **Apply where an anchor is present but checkbox unchecked.**
ACTIONS: `triage-apply.js <report.md>` dry-run first, confirm that action is not in the plan; then `triage-apply.js <report.md> --apply --yes` if the human asked for apply.
OUTPUT: The unchecked action is skipped (accepted = anchor exists AND paired checkbox `[x]`); only other checked anchors execute via `gh` (label/milestone/close edits). Audit log written beside the report.
MUTATIONS: GitHub: only checked actions; the unchecked one untouched. Local: apply log.
STOP/ASK: No stop for the skipped item; I do not check the box myself — a human flips checkboxes.

5. **Same accepted action in source section and Apply Checklist.**
ACTIONS: Dry-run, then `--apply --yes`.
OUTPUT: Duplicate surfaces dedupe by `(verb, issueNumber, normalizedArgs)`, so the action executes exactly once; the second occurrence is skipped/merged. If only one of the two is `[x]`, I treat it as accepted once the dedupe merges surfaces, but I would flag the mismatch in my summary.
MUTATIONS: One GitHub mutation; one audit-log entry.
STOP/ASK: no (ask only if the two surfaces are checked inconsistently and the human's intent is unclear).

6. **`triage-apply.js <report.md>` without `--apply`.**
ACTIONS: Run it; it parses accepted anchors and prints intended `gh` mutations.
OUTPUT: A dry-run plan listing each checked anchor's verb/issue/args; unknown verbs parsed and skipped; unchecked anchors omitted.
MUTATIONS: none (GitHub and local).
STOP/ASK: Stop here; mutation requires an explicit later `--apply --yes` invocation.

7. **Re-run apply after a partial successful apply.**
ACTIONS: Dry-run to see remaining plan, then `triage-apply.js <report.md> --apply --yes`.
OUTPUT: Already-completed actions are detected (e.g., label/milestone/closed state already present) and logged `already-applied`; only the remaining accepted actions execute. Audit log appended beside the report.
MUTATIONS: GitHub: only the not-yet-applied accepted actions; local: audit log updated.
STOP/ASK: If the earlier partial run failed with errors (not just interruption), I would surface the failure cause before re-running; otherwise no.
