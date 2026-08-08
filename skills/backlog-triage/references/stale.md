# Stale / Obsolescence

**Purpose.** `scripts/triage-stale.js` reads an issue snapshot from `triage-collect.js` and emits stale / obsolete candidates using snapshot-only signals. It does not call `gh`, re-fetch issues, or mutate anything.

## Implemented signals

| Signal | Triggering condition | Reason format | `suggested_action` |
| --- | --- | --- | --- |
| `inactive` | `updatedAt` is at least `stale_days` old and `milestone` is null | `inactive/stale: no activity for <days> days; exceeds stale_days threshold (<threshold>); no milestone assigned` | `close` |
| `wontfix` | Issue has a `wontfix` label (case-insensitive) | `labeled <matchedLabel>; explicit wontfix signal` | `close` |
| `invalid` | Issue has an `invalid` label (case-insensitive) | `labeled <matchedLabel>; explicit invalid signal` | `close` |
| `merged-closing-pr` | Optional `closing_prs[]` includes `state: "MERGED"` and non-empty `mergedAt` | `merged closing PR detected: PR #<n> merged at <mergedAt>` | `close` |

`stale_days` comes from `backlog/triage-config.yml` unless `--since N` is passed, in which case the CLI override wins.

Issues with any milestone are exempt from the `inactive` signal even if they are older than the threshold.

## Model-judged duplicate-of-closed

An open issue that duplicates a closed issue is judged by the model reading titles, bodies, labels, and comments — the script no longer does title-token matching. The model proposes it as an Obsolete Candidate with `suggested_action: merge-into:#<closed-issue>` (or `revisit` when the open issue should stay), and the evidence should name the target closed issue:

```json
{
  "target": {
    "number": 44,
    "title": "OAuth token refresh worker"
  },
  "reason": "open issue duplicates closed #44 with no substantive delta",
  "titles": {
    "open": "OAuth token refresh worker",
    "closed": "OAuth token refresh worker"
  }
}
```

Guidance: only merge-into when the open issue has no new requirements beyond the closed one; otherwise mark `revisit` and note what is still missing.

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

### `merged-closing-pr`

```json
{
  "source": "closing_prs",
  "pr": {
    "number": 88,
    "state": "MERGED",
    "mergedAt": "2026-04-18T01:15:00.000Z",
    "url": "https://github.com/owner/name/pull/88"
  },
  "updatedAt": "2026-04-18T01:00:00.000Z",
  "milestone": null
}
```

## Deferred follow-ups

- `Referenced code removed`: deferred because the current snapshot has no code-removal evidence and no follow-up implementation is defined yet.

Missing optional v2 fields (`closing_prs`, `closed_issues`) degrade to no candidates rather than errors.
