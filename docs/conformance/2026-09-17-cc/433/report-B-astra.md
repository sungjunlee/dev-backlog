# Backlog Triage Report — 2026-09-17

Report path: `.dev-backlog/triage/2026-09-17-report.md`  
Mode: Report; advisory only. All actions await human acceptance.

## Classification

All 15 issues are open and were created on 2026-01-10, 250 days ago. The stale threshold is 60 days; inactivity before 2026-07-19 exceeds that threshold.

| Theme | Issues | Labels |
|---|---|---|
| Authentication | #601, #602, #603, #611 | `auth`; #601 also `bug` |
| Billing | #608, #609, #610, #612, #613 | `billing`; #610 and #613 also `bug` |
| Explicit disposition | #606, #607 | `wontfix`, `invalid`, respectively |
| Unspecified or outside objectives | #604, #605, #614, #615 | None |

| Issue | Title | Inactivity, days | Milestone / sprint context |
|---|---|---:|---|
| #601 | Login page times out under load | 7 | No milestone |
| #602 | Add retry to auth client | 5 | No milestone; depends on #601 |
| #603 | Old auth issue kept alive by the sprint | 228 | No milestone; protected by active Plan; PR #90 open |
| #604 | Cold issue nobody owns | 245 | No milestone |
| #605 | Cold but milestoned | 240 | `Later` |
| #606 | Marked wontfix | 47 | No milestone |
| #607 | Marked invalid | 33 | No milestone |
| #608 | Already fixed by a merged PR | 28 | No milestone; closing PR #88 merged |
| #609 | Code-fence mention must not count | 6 | No milestone |
| #610 | Reconciliation drift on refunds | 3 | No milestone; latest supplied comment September 14 |
| #611 | Session refresh | 12 | No milestone; protected by active Plan |
| #612 | Parked billing spike | 200 | No milestone; protected by active Running Context |
| #613 | Refund reconciliation off by one cent | 8 | No milestone |
| #614 | Self mention should be ignored | 9 | No milestone |
| #615 | Orphan with no objective | 2 | No milestone |

Inactivity uses supplied `updatedAt` values except #610, whose later comment establishes activity on September 14; its listed `updatedAt` is September 13. Assignees were omitted from the supplied records, so ownership is unknown.

## Relationships

Each row records one evidenced relationship. Opposite dependency wording is preserved without reversing its meaning.

| Directed edge | Evidence |
|---|---|
| #601 **blocks** #602 | #601 body: “Blocks #602.” Thus #602 waits for #601. |
| #602 **depends-on** #601 | #602 body: “Depends on #601 landing first.” Same dependency, independently stated. |
| #602 **references** PR #77 comment `issuecomment-1` | Explicit pull-request comment URL in #602; context only, not a dependency or closing relationship. |
| #603 **linked-to** open PR #90 | Active sprint Plan associates #603 with PR #90. |
| #604 **mentions** #605 | #604 body: “Mentions #605 in passing.” No dependency established. |
| #610 **mentions / questions duplication with** #613 | #610 body: “Duplicate-looking of #613?” Duplication remains unconfirmed. |
| #610 **related-to** #608 | Alice’s September 14 comment: “Also related to #608 which was already merged.” |
| #614 **mentions** #611 | #614 body: “Real mention: #611.” No dependency established. |
| PR #88 **closes** #608 | Supplied merged-PR record: `closesIssue: 608`; merged August 21. |

Excluded: #609’s fenced example mentioning #601, #614’s self-reference, and any interpretation of PR #77’s URL as issue #77. The unnamed “drift report” in #613 does not establish an additional numbered edge. PR #88 establishes a fix for #608, not for #610.

## Obsolete Candidates

| Issue | Evidence | Assessment |
|---|---|---|
| #603 | 228 inactive days; no milestone | Date-based candidate, but active Plan prohibits closure. |
| #604 | 245 inactive days; no milestone | Stale candidate; insufficient substance to establish obsolescence. |
| #605 | 240 inactive days; milestone `Later` | Excluded from the stale-without-milestone criterion. |
| #606 | `wontfix`; “We will not do this.” | Supported closure candidate. |
| #607 | `invalid`; “Not a real bug.” | Supported closure candidate. |
| #608 | Closing PR #88 merged | Supported closure candidate. |
| #610 / #613 | Similar titles and tentative duplicate wording | Possible duplicate pair; comments establish relatedness to #608, not equivalence between these issues. |
| #612 | 200 inactive days; no milestone | Date-based candidate, but active Running Context prohibits closure. |

#603, #611, and #612 are protected from all closure proposals by the active sprint. No confirmed duplicate or recently closed duplicate target was supplied.

<!-- triage:revisit #603 reason="Confirm current progress and acceptance criteria against open PR #90; active sprint Plan protects this issue from closure" -->
- [ ] revisit #603 - Confirm current progress and acceptance criteria against open PR #90; active sprint Plan protects this issue from closure

<!-- triage:revisit #604 reason="245 inactive days with no milestone; establish scope, objective alignment, and continued need before deciding closure" -->
- [ ] revisit #604 - 245 inactive days with no milestone; establish scope, objective alignment, and continued need before deciding closure

<!-- triage:close #606 reason="Explicit wontfix label and body confirm the work will not be done" -->
- [ ] close #606 - Explicit wontfix label and body confirm the work will not be done

<!-- triage:close #607 reason="Explicit invalid label and body state this is not a real bug" -->
- [ ] close #607 - Explicit invalid label and body state this is not a real bug

<!-- triage:close #608 reason="Merged closing PR #88 already exists" -->
- [ ] close #608 - Merged closing PR #88 already exists

<!-- triage:revisit #610 reason="Compare reproduction and acceptance criteria with #613 and the fix in PR #88 for #608 before deciding duplication or regression" -->
- [ ] revisit #610 - Compare reproduction and acceptance criteria with #613 and the fix in PR #88 for #608 before deciding duplication or regression

<!-- triage:revisit #612 reason="Confirm the parked spike's resume condition; active sprint Running Context protects this issue from closure" -->
- [ ] revisit #612 - Confirm the parked spike's resume condition; active sprint Running Context protects this issue from closure

## Priority Proposals

No existing priority labels were supplied. These proposals reflect user impact, objective alignment, and dependency order.

<!-- triage:set-priority #601 value=high -->
- [ ] set-priority #601 - high: User-facing login failures undermine O1 and block #602.

<!-- triage:set-priority #610 value=high -->
- [ ] set-priority #610 - high: Refund discrepancies directly undermine O2; investigate alongside duplicate and regression checks.

<!-- triage:set-priority #602 value=medium -->
- [ ] set-priority #602 - medium: Auth resilience supports O1, but implementation waits for #601 to land.

<!-- triage:set-priority #611 value=medium -->
- [ ] set-priority #611 - medium: Session refresh supports O1 and is already in the active sprint Plan.

Priority for #613 remains unresolved pending comparison with #610. The supplied evidence does not establish enough scope or impact to change priorities on the remaining issues.

## Milestone Suggestions

No milestone assignments are proposed.

- `2026-09 fixture` is active and therefore ineligible for assignment proposals. #603 and #611 already appear in its Plan; #612 appears in Running Context. Their null GitHub milestone fields do not override this restriction.
- `Later` is the existing milestone for #605. Its active and wait-gated status was not supplied, so it is not a verified destination for additional issues.
- No other eligible milestone was supplied. #602 also explicitly waits for #601; no scheduling commitment is inferred.

## Alignment

Charter revision 1 defines O1, reliable and observable authentication, and O2, exact and auditable billing reconciliation.

| Issue | Objective or orphan | Basis |
|---|---|---|
| #601 | O1 | Login timeouts directly affect authentication reliability. |
| #602 | O1 | Auth-client retries support reliable authentication. |
| #603 | O1 | Auth issue explicitly included in the auth-rework Plan. |
| #604 | **Orphan** | No substantive scope or objective connection supplied. |
| #605 | **Orphan** | A future milestone alone does not establish alignment. |
| #606 | **Orphan** | Disposition is explicit, but substantive scope is absent. |
| #607 | **Orphan** | Invalid report with no objective connection supplied. |
| #608 | O2, provisional | Billing label and its relationship to refund reconciliation support this mapping; original scope is sparse. |
| #609 | O2, provisional | Billing label is the only alignment evidence; substantive scope needs clarification. |
| #610 | O2 | One-cent refund discrepancies directly violate exact reconciliation. |
| #611 | O1 | Refresh-token behavior belongs to authentication reliability. |
| #612 | O2, provisional | Billing spike; the reconciliation or audit outcome is unspecified. |
| #613 | O2 | Refund reconciliation off by one cent directly affects exactness. |
| #614 | **Orphan** | Mentioning #611 does not establish this issue’s own objective. |
| #615 | **Orphan** | Renaming the repository mascot has no stated connection to O1 or O2. |

<!-- triage:revisit #609 reason="Define a substantive billing problem and acceptance criteria; a fenced example and billing label do not establish actionable scope" -->
- [ ] revisit #609 - Define a substantive billing problem and acceptance criteria; a fenced example and billing label do not establish actionable scope

<!-- triage:revisit #614 reason="Define this issue's own scope and charter objective; mentioning #611 alone does not establish alignment" -->
- [ ] revisit #614 - Define this issue's own scope and charter objective; mentioning #611 alone does not establish alignment

## Decision Review

The charter tier is available. The capability tier (`spec/capabilities.md`) and system-map tier (`spec/system-map.md`) were not supplied and are treated as unavailable for this review; their filesystem absence cannot be verified in this simulation. Detailed acceptance criteria are also absent from the supplied issue bodies.

“Do Now” identifies current execution or investigation priorities; it does not add issues to the active sprint.

| Decision | Issue | Rationale |
|---|---|---|
| Do Now | #601 | Investigate and resolve user-facing login failures; unlocks #602. |
| Defer | #602 | Explicitly waits for #601 to land. |
| Do Now | #603 | Continue active sprint work and verify PR #90 progress; closure prohibited. |
| Shape First | #604 | Establish scope, alignment, and continued need before disposition. |
| Defer | #605 | Already planned for `Later`; scope and alignment remain unclear. |
| Drop-Close | #606 | Explicit `wontfix` disposition supports closure. |
| Drop-Close | #607 | Explicit `invalid` disposition supports closure. |
| Drop-Close | #608 | Merged closing PR #88 supports closure. |
| Shape First | #609 | No actionable billing problem is described. |
| Do Now | #610 | Investigate exactness failure and compare #613 and PR #88 before implementation. |
| Do Now | #611 | Continue the active sprint Plan’s session-refresh work. |
| Defer | #612 | Explicitly parked in Running Context; clarify resume condition; closure prohibited. |
| Shape First | #613 | Compare with #610 to establish distinct scope or confirmed duplication. |
| Shape First | #614 | Define independent scope and alignment beyond its mention of #611. |
| Defer | #615 | Outside current charter objectives; no urgency or closure evidence supplied. |

All 15 open issues appear exactly once in this decision table. Closure proposals target only #606, #607, and #608.

## Apply Checklist

All 13 anchored actions are repeated once below with identical arguments. All remain unchecked. Apply deduplicates identical accepted actions; no GitHub or specification changes occur in Report mode.

<!-- triage:revisit #603 reason="Confirm current progress and acceptance criteria against open PR #90; active sprint Plan protects this issue from closure" -->
- [ ] revisit #603 - Confirm current progress and acceptance criteria against open PR #90; active sprint Plan protects this issue from closure

<!-- triage:revisit #604 reason="245 inactive days with no milestone; establish scope, objective alignment, and continued need before deciding closure" -->
- [ ] revisit #604 - 245 inactive days with no milestone; establish scope, objective alignment, and continued need before deciding closure

<!-- triage:close #606 reason="Explicit wontfix label and body confirm the work will not be done" -->
- [ ] close #606 - Explicit wontfix label and body confirm the work will not be done

<!-- triage:close #607 reason="Explicit invalid label and body state this is not a real bug" -->
- [ ] close #607 - Explicit invalid label and body state this is not a real bug

<!-- triage:close #608 reason="Merged closing PR #88 already exists" -->
- [ ] close #608 - Merged closing PR #88 already exists

<!-- triage:revisit #610 reason="Compare reproduction and acceptance criteria with #613 and the fix in PR #88 for #608 before deciding duplication or regression" -->
- [ ] revisit #610 - Compare reproduction and acceptance criteria with #613 and the fix in PR #88 for #608 before deciding duplication or regression

<!-- triage:revisit #612 reason="Confirm the parked spike's resume condition; active sprint Running Context protects this issue from closure" -->
- [ ] revisit #612 - Confirm the parked spike's resume condition; active sprint Running Context protects this issue from closure

<!-- triage:set-priority #601 value=high -->
- [ ] set-priority #601 - high: User-facing login failures undermine O1 and block #602.

<!-- triage:set-priority #610 value=high -->
- [ ] set-priority #610 - high: Refund discrepancies directly undermine O2; investigate alongside duplicate and regression checks.

<!-- triage:set-priority #602 value=medium -->
- [ ] set-priority #602 - medium: Auth resilience supports O1, but implementation waits for #601 to land.

<!-- triage:set-priority #611 value=medium -->
- [ ] set-priority #611 - medium: Session refresh supports O1 and is already in the active sprint Plan.

<!-- triage:revisit #609 reason="Define a substantive billing problem and acceptance criteria; a fenced example and billing label do not establish actionable scope" -->
- [ ] revisit #609 - Define a substantive billing problem and acceptance criteria; a fenced example and billing label do not establish actionable scope

<!-- triage:revisit #614 reason="Define this issue's own scope and charter objective; mentioning #611 alone does not establish alignment" -->
- [ ] revisit #614 - Define this issue's own scope and charter objective; mentioning #611 alone does not establish alignment