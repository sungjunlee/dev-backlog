---
generated: 2026-09-17
repo: sungjunlee/fixture
snapshot: .dev-backlog/triage/.cache/snapshot.json
open_issues: 15
---

# Backlog Triage — 2026-09-17

## Classification
Grouped by theme / label / age from the collected snapshot.

### By Theme

| Group | Issues |
| --- | --- |
| auth | #601 Login page times out under load<br>#602 Add retry to auth client<br>#603 Old auth issue kept alive by the sprint<br>#611 Session refresh |
| billing | #610 Reconciliation drift on refunds<br>#612 Parked billing spike<br>#613 Refund reconciliation off by one cent |
| uncategorized | #604 Cold issue nobody owns<br>#605 Cold but milestoned<br>#606 Marked wontfix<br>#607 Marked invalid<br>#608 Already fixed by a merged PR<br>#609 Code-fence mention must not count<br>#614 Self mention should be ignored<br>#615 Orphan with no objective |

### By Label

| Group | Issues |
| --- | --- |
| bug | #601 Login page times out under load<br>#610 Reconciliation drift on refunds<br>#613 Refund reconciliation off by one cent |
| uncategorized | #602 Add retry to auth client<br>#603 Old auth issue kept alive by the sprint<br>#604 Cold issue nobody owns<br>#605 Cold but milestoned<br>#606 Marked wontfix<br>#607 Marked invalid<br>#608 Already fixed by a merged PR<br>#609 Code-fence mention must not count<br>#611 Session refresh<br>#612 Parked billing spike<br>#614 Self mention should be ignored<br>#615 Orphan with no objective |

### By Age

| Group | Issues |
| --- | --- |
| >90d | #601 Login page times out under load<br>#602 Add retry to auth client<br>#603 Old auth issue kept alive by the sprint<br>#604 Cold issue nobody owns<br>#605 Cold but milestoned<br>#606 Marked wontfix<br>#607 Marked invalid<br>#608 Already fixed by a merged PR<br>#609 Code-fence mention must not count<br>#610 Reconciliation drift on refunds<br>#611 Session refresh<br>#612 Parked billing spike<br>#613 Refund reconciliation off by one cent<br>#614 Self mention should be ignored<br>#615 Orphan with no objective |

## Relationships
- #601 Login page times out under load mentions #602 Add retry to auth client — Blocks #602.
- #602 Add retry to auth client mentions #601 Login page times out under load — Depends on #601 landing first.
- #604 Cold issue nobody owns mentions #605 Cold but milestoned — Mentions #605 in passing.
- #608 Already fixed by a merged PR merged-pr-link PR #88; mergedAt 2026-08-21T10:00:00.000Z
- #610 Reconciliation drift on refunds comment-mentions #608 Already fixed by a merged PR — Also related to #608 which was already merged.
- #610 Reconciliation drift on refunds mentions #613 Refund reconciliation off by one cent — Duplicate-looking of #613?
- #614 Self mention should be ignored mentions #611 Session refresh — Real mention: #611.

_(comment and closing-PR relationship signals run only when snapshot v2 fields are present)_

## Obsolete Candidates
<!-- triage:close #604 reason="inactive/stale: no activity for 245 days; exceeds stale_days threshold (60); no milestone assigned" -->
- [ ] Close #604 — inactive/stale: no activity for 245 days; exceeds stale_days threshold (60); no milestone assigned
  - _evidence: 245d since update (threshold 60d); no milestone_

<!-- triage:close #606 reason="labeled wontfix; explicit wontfix signal" -->
- [ ] Close #606 — labeled wontfix; explicit wontfix signal
  - _evidence: label=wontfix; updated 2026-08-01; no milestone_

<!-- triage:close #607 reason="labeled invalid; explicit invalid signal" -->
- [ ] Close #607 — labeled invalid; explicit invalid signal
  - _evidence: label=invalid; updated 2026-08-15; no milestone_

<!-- triage:close #608 reason="merged closing PR detected: PR #88 merged at 2026-08-21T10:00:00.000Z" -->
- [ ] Close #608 — merged closing PR detected: PR #88 merged at 2026-08-21T10:00:00.000Z
  - _evidence: updated 2026-08-20; PR #88 merged 2026-08-21; no milestone_

_(merged closing-PR signals run only when snapshot v2 fields are present)_

## Priority Proposals
Model judgment: non-high issues worth escalating, with rationale from theme activity, relationship edges, and sprint focus.

_(none)_

## Milestone Suggestions
_(none)_

## Apply Checklist
Consolidated list of every anchored action for scan-and-check review. Flip `[ ]` → `[x]` to accept. The apply step parses the whole report and dedupes — a checkbox in *any* location carrying the anchor accepts the action.

<!-- triage:close #604 reason="inactive/stale: no activity for 245 days; exceeds stale_days threshold (60); no milestone assigned" -->
- [ ] Close #604 — inactive/stale: no activity for 245 days; exceeds stale_days threshold (60); no milestone assigned _(from Obsolete Candidates)_

<!-- triage:close #606 reason="labeled wontfix; explicit wontfix signal" -->
- [ ] Close #606 — labeled wontfix; explicit wontfix signal _(from Obsolete Candidates)_

<!-- triage:close #607 reason="labeled invalid; explicit invalid signal" -->
- [ ] Close #607 — labeled invalid; explicit invalid signal _(from Obsolete Candidates)_

<!-- triage:close #608 reason="merged closing PR detected: PR #88 merged at 2026-08-21T10:00:00.000Z" -->
- [ ] Close #608 — merged closing PR detected: PR #88 merged at 2026-08-21T10:00:00.000Z _(from Obsolete Candidates)_
