# Classification

**Purpose.** Document the bucketing rules `triage-collect.js` applies when it snapshots open issues — and the YAML schema (`backlog/triage-config.yml`) that parameterizes them.

## YAML schema

```yaml
theme_keywords:
  auth: [auth, oauth, token, session]
  docs: [docs, readme, guide]
activity_days:
  warm: 14
  cold: 60
comment_fetch_concurrency: 5
closed_issue_days: 180
closed_issue_limit: 200
stale_days: 60
duplicate_threshold: 0.75
```

- `theme_keywords` maps a theme name to title-keyword substrings. The first matching theme wins.
- `activity_days.warm` is the exclusive upper bound for the `recent` bucket.
- `activity_days.cold` is the exclusive upper bound for the `warm` bucket.
- `comment_fetch_concurrency` bounds `--with-comments` fan-out when comment hydration is enabled.
- `closed_issue_days` bounds the lookback window for `--with-closed-issues`.
- `closed_issue_limit` caps how many recent closed issues are collected for snapshot v2 enrichment.
- `stale_days` and `duplicate_threshold` are collected as config-as-data for downstream scripts (`triage-stale`, `triage-relate`); `triage-collect` does not apply them yet.

## Per-issue snapshot shape

Each entry in `snapshot.issues` has:

```json
{
  "number": 61,
  "title": "...",
  "body": "...",
  "labels": ["..."],
  "createdAt": "...",
  "updatedAt": "...",
  "milestone": "Backlog Triage MVP" | null,
  "closing_prs": [{ "number": 87, "state": "MERGED", "mergedAt": "...", "url": "..." }],
  "comments": [{ "author": "octocat", "body": "...", "createdAt": "..." }],
  "buckets": { "label": {...}, "theme": "...", "age": "...", "activity": "...", "milestone": "assigned" | "unassigned" }
}
```

`body` is always a string — empty (`""`) when `gh` returns null or the field is missing, never `undefined`. Downstream scripts (`triage-relate` today, and future `triage-stale` follow-ups if code-reference signals are added later) rely on body being present so they never need to re-fetch from `gh`.

`closing_prs` is always present and defaults to `[]`. It comes from GraphQL `closedByPullRequestsReferences`, so downstream analysis can distinguish issues already covered by merged PRs without a second fetch.

`comments` is optional and appears only when `triage-collect.js` runs with `--with-comments`. The default path stays at one GraphQL collection pass; comment hydration is an explicit cost/performance tradeoff.

Snapshot v2 may also add a top-level `closed_issues` array when `--with-closed-issues` is enabled:

```json
{
  "closed_issues": [
    { "number": 55, "title": "...", "body": "...", "closedAt": "..." }
  ]
}
```

This enrichment is opt-in and bounded by `closed_issue_days` and `closed_issue_limit` so the default advisory loop remains cheap.

## Bucketing rules

### Label bucket

`buckets.label` is a structured mirror of the existing dev-backlog label vocabulary:

- `type` = the first `type:*` label suffix, else `uncategorized`
- `priority` = the first `priority:*` label suffix, else `medium`
- `status` = the first `status:*` label suffix, else `todo`

Legacy plain labels (`bug`, `chore`, `docs`, `feature`, `refactor`) are accepted as `type` fallbacks to keep older repos readable.

### Theme bucket

`buckets.theme` comes from the issue title only. Match is case-insensitive substring search against `theme_keywords`. No match, or an empty theme map, yields `uncategorized`.

### Age bucket

`buckets.age` is derived from `createdAt` relative to the snapshot's `generated` timestamp:

- `<7d` for ages strictly less than 7 days
- `7-30d` for ages from 7 days up to but not including 30 days
- `30-90d` for ages from 30 days up to but not including 90 days
- `>90d` for ages of 90 days or more

### Activity bucket

`buckets.activity` is derived from `updatedAt` relative to `generated`:

- `recent` for ages strictly less than `activity_days.warm`
- `warm` for ages from `activity_days.warm` up to but not including `activity_days.cold`
- `cold` for ages of `activity_days.cold` or more

### Milestone bucket

`buckets.milestone` is `assigned` when the issue has a milestone title and `unassigned` when it does not.
