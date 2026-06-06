---
id: BACK-73
title: 'enhance(backlog-triage): snapshot v2 schema for closing PRs, comments, and closed-issue scan'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone:
created_date: '2026-05-31'
---
## Description
Follow-up to #59 epic. Surfaced during Batch 2 reviews (#62, #63) and re-triaged on 2026-05-31.

## Why now

The current backlog-triage snapshot cannot support several high-signal checks:

- PR linkage: merged PR -> still-open issue requires per-issue closing PR references.
- Comment mentions: issue-to-issue edges in comments require optional issue comments.
- Duplicate of closed issue: stale/obsolete detection needs bounded closed-issue context.

The MVP scanners cover body-scan, keyword, and label signals. Snapshot v2 should add the missing data without breaking the default explicit-sync model.

## Scope

Extend `skills/backlog-triage/scripts/triage-collect.js` and snapshot consumers.

1. Default snapshot v2 schema
   - Add a snapshot schema/version marker.
   - Add per-issue `closing_prs: [{number, state, mergedAt, url}]`; empty array when no closing PR is linked.
   - Preserve the default one-fetch mental model; if GraphQL pagination is required, document exactly how it is invoked and why it is still one collection step.

2. Optional `--with-comments` enrichment
   - Default off.
   - Adds `comments: [{author, body, createdAt}]` to each issue.
   - May perform bounded per-issue calls; warn with expected API call count and concurrency cap.

3. Optional `--with-closed-issues` enrichment
   - Default off.
   - Adds top-level `closed_issues: [{number, title, body, closedAt}]`.
   - Bound by config window, defaulting to recently closed issues only.

4. Downstream gating
   - `triage-relate` PR-linkage and comment-mention scans should require the relevant snapshot fields/features.
   - `triage-stale` duplicate-of-closed scans should require `closed_issues`.
   - Missing optional fields must degrade clearly, not fail with undefined-field behavior.

## Explicit out of scope

- ML-based duplicate detection.
- Cross-repo issue resolution.
- Timeline events beyond closing-PR references.
- Changing `sync-pull.js` behavior unless the migration is trivial and behavior-preserving.

## Acceptance Criteria

- [ ] Snapshot contains an explicit schema/version marker.
- [ ] Per-issue `closing_prs` field is present on every default snapshot issue.
- [ ] Default collection path is documented as one explicit collection step.
- [ ] `--with-comments` is opt-in, documented with API-call cost, and concurrency-bounded.
- [ ] `--with-closed-issues` is opt-in and bounded by config.
- [ ] Existing schema tests are updated; new tests cover `closing_prs` via stubbed GraphQL/API response.
- [ ] Downstream relate/stale scanners gate optional signals on snapshot features instead of assuming fields exist.
- [ ] `sync-pull.js` behavior remains unchanged unless explicitly justified in the PR.
