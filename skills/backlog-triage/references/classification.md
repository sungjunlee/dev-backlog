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
stale_days: 60
duplicate_threshold: 0.75
```

- `theme_keywords` maps a theme name to title-keyword substrings. The first matching theme wins.
- `activity_days.warm` is the exclusive upper bound for the `recent` bucket.
- `activity_days.cold` is the exclusive upper bound for the `warm` bucket.
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
  "buckets": { "label": {...}, "theme": "...", "age": "...", "activity": "...", "milestone": "assigned" | "unassigned" }
}
```

`body` is always a string — empty (`""`) when `gh` returns null or the field is missing, never `undefined`. Downstream scripts (`triage-relate` for mention / blocks / depends-on scans, `triage-stale` for referenced-code-removed signal) rely on body being present so they never need to re-fetch from `gh`.

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
