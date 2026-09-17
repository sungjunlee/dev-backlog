# Backlog Triage Report — 2026-09-17

Source: `gh issue list --state open` (15 open issues), `gh issue view 610 --comments`, `gh pr list --state merged` (PR #88 closes #608), `spec/charter.md` (revision 1), active sprint `.dev-backlog/sprints/2026-09-fixture.md` (milestone `2026-09 fixture`, scope `src/auth/**`). Stale threshold: 60 days (`.dev-backlog/triage-config.yml`) → inactive since before 2026-07-19. Advisory only; nothing is mutated until Apply.

In-flight issues (named in the active sprint Plan or Running Context, never proposed for close): #603, #611, #612.

## Classification

### By theme

| Theme | Issues |
|---|---|
| Auth | #601, #602, #603, #611, #614 |
| Billing | #608, #609, #610, #612, #613 |
| Housekeeping / unclassified | #604, #605, #606, #607, #615 |

### By label

| Label | Issues |
|---|---|
| `auth` | #601, #602, #603, #611 |
| `billing` | #608, #609, #610, #612, #613 |
| `bug` | #601, #610, #613 |
| `wontfix` | #606 |
| `invalid` | #607 |
| (no labels) | #604, #605, #614, #615 |

### By age (all created 2026-01-10; age = days since last update as of 2026-09-17)

| Bucket | Issues |
|---|---|
| Active (updated ≤ 14 days) | #601 (7d), #602 (5d), #609 (6d), #610 (4d), #611 (12d), #613 (8d), #614 (9d), #615 (2d) |
| Cooling (15–60 days) | #606 (47d), #607 (33d), #608 (28d) |
| Stale (> 60 days) | #603 (228d, in sprint Plan), #604 (245d), #605 (240d, milestone `Later`), #612 (200d, in sprint Running Context) |

Milestones: #605 → `Later`; all others unmilestoned. Assignees: none reported.

## Relationships

One edge per fact; direction follows the evidence phrase.

- `#601 blocks #602` — #601 body: "Blocks #602" (#602 waits for #601).
- `#602 depends-on #601` — #602 body: "Depends on #601 landing first" (#602 waits for #601; corroborates the edge above).
- `#602 references PR #77` — #602 body links `pull/77#issuecomment-1` for context; a PR pointer, not an issue edge.
- `#604 mentions #605` — #604 body: "Mentions #605 in passing".
- `#610 mentions #613` — #610 body: "Duplicate-looking of #613?" (duplicate candidate, see Obsolete Candidates).
- `#610 mentions #608` — comment by alice (2026-09-14): "Also related to #608 which was already merged".
- `#614 mentions #611` — #614 body: "Real mention: #611".
- `PR #88 closes #608` — merged 2026-08-21 (`gh pr list --state merged`).
- `#603 → PR #90 (open)` — active sprint Plan, Batch 1.

Excluded evidence:
- #609 → #601: the only mention is inside a code fence (example log); not counted.
- #614 → #614: self mention; ignored.

## Obsolete Candidates

Stale (> 60 days inactive, no milestone):

<!-- triage:close #604 reason="no activity since 2026-01-15 (245 days), no milestone, no owner" -->
- [ ] close #604 - no activity since 2026-01-15 (245 days), no milestone, no owner

`wontfix` / `invalid` labels:

<!-- triage:close #606 reason="labeled wontfix; body states it will not be done" -->
- [ ] close #606 - labeled wontfix; body states it will not be done

<!-- triage:close #607 reason="labeled invalid; body states it is not a real bug" -->
- [ ] close #607 - labeled invalid; body states it is not a real bug

Merged closing PR:

<!-- triage:close #608 reason="merged PR #88 already closes this issue (merged 2026-08-21)" -->
- [ ] close #608 - merged PR #88 already closes this issue (merged 2026-08-21)

Duplicates:

<!-- triage:close-duplicate #613 target=#610 reason="same refund off-by-one-cent symptom; #610 carries the comment thread and the newer activity" -->
- [ ] close-duplicate #613 target=#610 - same refund off-by-one-cent symptom; #610 carries the comment thread and the newer activity

Stale but not proposed for close:
- #603 — stale since 2026-02-01 but on the active sprint Plan (Batch 1, PR #90 open). Boundary: no close.
- #605 — stale since 2026-01-20 but milestoned (`Later`); excluded by rule.
- #612 — stale since 2026-03-01 but parked in the active sprint Running Context ("do not close it"). Boundary: no close.

<!-- triage:revisit #603 reason="228 days without update while on the active Plan; confirm PR #90 is still moving or re-shape" -->
- [ ] revisit #603 - 228 days without update while on the active Plan; confirm PR #90 is still moving or re-shape

<!-- triage:revisit #605 reason="240 days idle under milestone Later; confirm the milestone is still intended" -->
- [ ] revisit #605 - 240 days idle under milestone Later; confirm the milestone is still intended

## Priority Proposals

<!-- triage:set-priority #601 value=high -->
- [ ] set-priority #601 value=high - production bug (504s under load), blocks #602, charter O1

<!-- triage:set-priority #610 value=high -->
- [ ] set-priority #610 value=high - billing reconciliation bug with active thread; charter O2 demands exactness

<!-- triage:set-priority #602 value=medium -->
- [ ] set-priority #602 value=medium - auth resilience, but waits on #601

<!-- triage:set-priority #611 value=medium -->
- [ ] set-priority #611 value=medium - already on the active sprint Plan (Batch 1)

<!-- triage:set-priority #609 value=low -->
- [ ] set-priority #609 value=low - billing note with no concrete defect stated

<!-- triage:set-priority #614 value=low -->
- [ ] set-priority #614 value=low - only a pointer to #611; no standalone work described

<!-- triage:set-priority #615 value=low -->
- [ ] set-priority #615 value=low - cosmetic rename, no objective

## Milestone Suggestions

Active milestone `2026-09 fixture` is excluded as a target. Existing non-active milestone: `Later`.

<!-- triage:assign-milestone #610 milestone="Later" -->
- [ ] assign-milestone #610 milestone="Later" - billing work is outside the active auth-scoped sprint; park in the next queue

<!-- triage:assign-milestone #609 milestone="Later" -->
- [ ] assign-milestone #609 milestone="Later" - billing follow-up, same queue as #610

Not proposed: #601 and #602 fit the auth sprint's scope but the active milestone is off-limits; revisit once `2026-09 fixture` closes. #611 and #603 are already carried by the sprint file.

## Alignment

Charter: `spec/charter.md` revision 1 — O1 authentication flows reliable and observable; O2 billing reconciliation exact and auditable.

| Issue | Objective | Basis |
|---|---|---|
| #601 | O1 | login timeouts = auth reliability |
| #602 | O1 | auth client retry |
| #603 | O1 | auth issue on the auth sprint |
| #604 | orphan | no objective stated |
| #605 | orphan | "planned for later", no objective stated |
| #606 | orphan | wontfix, no objective |
| #607 | orphan | invalid, no objective |
| #608 | O2 | billing label, already fixed |
| #609 | O2 | billing label (weak; no defect described) |
| #610 | O2 | refund reconciliation drift |
| #611 | O1 | session refresh |
| #612 | O2 | billing spike |
| #613 | O2 | refund reconciliation (duplicate of #610) |
| #614 | O1 (weak) | only via its pointer to #611 |
| #615 | orphan | mascot rename serves no objective |

## Decision Review

Absent spec tiers: `spec/capabilities.md` and `spec/system-map.md` are not present; only the charter was available for judgment.

| Bucket | Issues | Rationale |
|---|---|---|
| Do Now | #601, #610, #611, #603 | #601 is a live bug blocking #602; #610 is a billing correctness bug; #611 and #603 are on the active sprint Plan |
| Shape First | #602, #612, #614, #605 | #602 needs #601 first and a concrete retry policy; #612 is a parked spike with no AC; #614 has no standalone scope; #605 needs a restated goal before its milestone means anything |
| Defer | #609, #615 | no defect or objective pressure; low priority |
| Drop-Close | #604, #606, #607, #608, #613 | stale/unowned, wontfix, invalid, merged PR #88, duplicate of #610 |

## Apply Checklist

<!-- triage:close #604 reason="no activity since 2026-01-15 (245 days), no milestone, no owner" -->
- [ ] close #604 - no activity since 2026-01-15 (245 days), no milestone, no owner

<!-- triage:close #606 reason="labeled wontfix; body states it will not be done" -->
- [ ] close #606 - labeled wontfix; body states it will not be done

<!-- triage:close #607 reason="labeled invalid; body states it is not a real bug" -->
- [ ] close #607 - labeled invalid; body states it is not a real bug

<!-- triage:close #608 reason="merged PR #88 already closes this issue (merged 2026-08-21)" -->
- [ ] close #608 - merged PR #88 already closes this issue (merged 2026-08-21)

<!-- triage:close-duplicate #613 target=#610 reason="same refund off-by-one-cent symptom; #610 carries the comment thread and the newer activity" -->
- [ ] close-duplicate #613 target=#610 - same refund off-by-one-cent symptom; #610 carries the comment thread and the newer activity

<!-- triage:revisit #603 reason="228 days without update while on the active Plan; confirm PR #90 is still moving or re-shape" -->
- [ ] revisit #603 - 228 days without update while on the active Plan; confirm PR #90 is still moving or re-shape

<!-- triage:revisit #605 reason="240 days idle under milestone Later; confirm the milestone is still intended" -->
- [ ] revisit #605 - 240 days idle under milestone Later; confirm the milestone is still intended

<!-- triage:set-priority #601 value=high -->
- [ ] set-priority #601 value=high - production bug (504s under load), blocks #602, charter O1

<!-- triage:set-priority #610 value=high -->
- [ ] set-priority #610 value=high - billing reconciliation bug with active thread; charter O2 demands exactness

<!-- triage:set-priority #602 value=medium -->
- [ ] set-priority #602 value=medium - auth resilience, but waits on #601

<!-- triage:set-priority #611 value=medium -->
- [ ] set-priority #611 value=medium - already on the active sprint Plan (Batch 1)

<!-- triage:set-priority #609 value=low -->
- [ ] set-priority #609 value=low - billing note with no concrete defect stated

<!-- triage:set-priority #614 value=low -->
- [ ] set-priority #614 value=low - only a pointer to #611; no standalone work described

<!-- triage:set-priority #615 value=low -->
- [ ] set-priority #615 value=low - cosmetic rename, no objective

<!-- triage:assign-milestone #610 milestone="Later" -->
- [ ] assign-milestone #610 milestone="Later" - billing work is outside the active auth-scoped sprint; park in the next queue

<!-- triage:assign-milestone #609 milestone="Later" -->
- [ ] assign-milestone #609 milestone="Later" - billing follow-up, same queue as #610
