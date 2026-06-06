---
id: BACK-190
title: 'enhance(backlog-triage): add stale signals for merged PRs and closed duplicates'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 
created_date: '2026-06-06'
---
## Description
## Context

#73 added the collector-side data needed for stronger obsolete-candidate detection: per-issue `closing_prs` and optional top-level `closed_issues`. `triage-stale.js` still uses only inactivity and explicit labels, so the richer snapshot fields are not yet used for stale decisions.

## Desired change

Add conservative stale/obsolete candidates based on snapshot-v2 fields.

Candidate signals:
- open issue has a merged closing PR in `closing_prs`
- open issue appears to duplicate a recently closed issue from `closed_issues`

## Acceptance Criteria

- [ ] Merged closing-PR candidates require `closing_prs` evidence and include PR number/url/mergedAt in candidate evidence.
- [ ] Duplicate-of-closed candidates run only when top-level `closed_issues` is present.
- [ ] Duplicate-of-closed matching is conservative and tested against false positives.
- [ ] Missing optional fields degrade cleanly without warnings or undefined-field behavior.
- [ ] Stale docs and tests cover enabled and absent-field paths.

