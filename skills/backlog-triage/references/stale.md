# Stale / Obsolescence

**Purpose.** `scripts/triage-stale.js` reads an issue snapshot from `triage-collect.js` and emits stale / obsolete candidates using snapshot-only signals. It does not call `gh`, re-fetch issues, or mutate anything.

## Implemented signals

| Signal | Triggering condition | Reason format | `suggested_action` |
| --- | --- | --- | --- |
| `inactive` | `updatedAt` is at least `stale_days` old and `milestone` is null | `inactive/stale: no activity for <days> days; exceeds stale_days threshold (<threshold>); no milestone assigned` | `close` |
| `wontfix` | Issue has a `wontfix` label (case-insensitive) | `labeled <matchedLabel>; explicit wontfix signal` | `close` |
| `invalid` | Issue has an `invalid` label (case-insensitive) | `labeled <matchedLabel>; explicit invalid signal` | `close` |

`stale_days` comes from `backlog/triage-config.yml` unless `--since N` is passed, in which case the CLI override wins.

Issues with any milestone are exempt from the `inactive` signal even if they are older than the threshold.

## Evidence schema

Each candidate includes a non-empty `evidence` object.

### `inactive`

```json
{
  "updatedAt": "2025-12-01T00:00:00.000Z",
  "generated": "2026-08-01T00:00:00.000Z",
  "daysSinceUpdate": 243,
  "thresholdDays": 60,
  "milestone": null,
  "labels": []
}
```

### `wontfix` / `invalid`

```json
{
  "matchedLabel": "wontfix",
  "labels": ["wontfix"],
  "updatedAt": "2026-06-01T00:00:00.000Z",
  "milestone": null
}
```

For `invalid`, only `matchedLabel` and `labels` change accordingly.

## Deferred to #73 / follow-up

- `PR already merged`: deferred to #73 because the current snapshot does not include `closing_prs` linkage.
- `Duplicate of closed`: deferred to #73 because the current snapshot does not include closed-issue state for duplicate targets.
- `Referenced code removed`: deferred because the current snapshot has no code-removal evidence and no follow-up implementation is defined yet.
