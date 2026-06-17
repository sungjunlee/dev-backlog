---
id: BACK-190
title: 'enhance(backlog-triage): add stale signals for merged PRs and closed duplicates'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-06 execution guard and stale signals
created_date: '2026-06-17'
---
## Description
## Context

#73 added the collector-side data needed for stronger obsolete-candidate detection: per-issue `closing_prs` and optional top-level `closed_issues`. `triage-stale.js` still uses only inactivity and explicit labels, so the richer snapshot fields are not yet used for stale decisions.

## Desired change

Add conservative stale/obsolete candidates based on snapshot-v2 fields.

Candidate signals:
- open issue has a merged closing PR in `closing_prs`
- open issue appears to duplicate a recently closed issue from `closed_issues`

Keep relationship evidence advisory unless `triage-stale` explicitly turns it into a conservative stale/obsolete signal. A `merged-pr-link` edge by itself must not boost planning priority or sprint assignment.

## Acceptance Criteria

- [x] Merged closing-PR candidates require `closing_prs` evidence and include PR number/url/mergedAt in candidate evidence.
- [x] Duplicate-of-closed candidates run only when top-level `closed_issues` is present.
- [x] Duplicate-of-closed matching is conservative and tested against false positives.
- [x] Missing optional fields degrade cleanly without warnings or undefined-field behavior.
- [x] `merged-pr-link` relationship edges alone do not generate `set-priority` or `assign-milestone` proposals.
- [x] Issues referenced in the active sprint Plan or Running Context never receive close or close-duplicate proposals, even when stale/obsolete signals match.
- [x] Stale docs and tests cover enabled, absent-field, advisory-only, and active-sprint-protected paths.
