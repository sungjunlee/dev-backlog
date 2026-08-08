# Relationships

**Purpose.** The `## Relationships` section of the triage report maps how open issues connect to each other and to merged closing PRs. Deterministic signals come from `triage-relate.js`; semantic judgment (blocking, dependency, duplication) is the model's job and is rendered from the model's own edge JSON.

## Script-generated Edges (deterministic)

`triage-relate.js` reads a previously collected issue snapshot and emits read-only edges for snapshot-resident signals that need no interpretation:

- `mentions` from plain `#123` references in issue bodies
- `comment-mentions` from plain `#123` references in optional issue comments
- `merged-pr-link` from per-issue merged closing PR metadata

Every emitted edge carries evidence taken directly from the snapshot so downstream report rendering can show why the relationship was inferred without re-fetching from GitHub.

### `mentions`

- Source: `issue.body`
- Match rule: plain `#123` references outside fenced code blocks
- Filters:
  - ignore self-references (`#100` inside issue `100`)
  - ignore references inside URL tokens such as GitHub links or `/path#fragment`
- Confidence: `0.75`
- Evidence:
  - `match`: matched issue reference, for example `#123`
  - `snippet`: normalized sentence/line fragment containing the match

### `comment-mentions`

- Source: `issue.comments[].body`
- Gate: runs only when `comments` is present as an array; missing or malformed optional fields emit no edges
- Match rule: same issue-reference parser as body `mentions`
- Filters:
  - ignore self-references
  - ignore references to issues absent from `snapshot.issues`
  - ignore fenced-code and URL-fragment noise
- Confidence: `0.65`
- Evidence:
  - `source`: `"comment"`
  - `author`: comment author when present
  - `createdAt`: comment timestamp when present
  - `match`: matched issue reference
  - `snippet`: normalized sentence/line fragment containing the match

### `merged-pr-link`

- Source: `issue.closing_prs`
- Gate: runs only when `closing_prs` is present as an array
- Match rule: emit only entries with `state: "MERGED"` and a non-empty `mergedAt`
- Confidence: `1`
- Action semantics: advisory relationship evidence only; it does not independently create priority or milestone proposals. `triage-stale.js` is responsible for turning the same snapshot metadata into an explicit close candidate.
- Evidence:
  - `source`: `"closing_prs"`
  - `pr.number`: closing PR number
  - `pr.state`: closing PR state
  - `pr.mergedAt`: merge timestamp
  - `pr.url`: closing PR URL when present

## Model-judged Edges (semantic)

Blocking, dependency, and duplication require reading issue intent, so they are judged by the model reading the snapshot, not by phrase matching or title token overlap. The model emits edges in the same shape as the script (kind, confidence, evidence) and passes them to `triage-report.js --model-actions`.

### `blocks`

- Read `issue.body` and comment bodies for explicit statements that issue X blocks issue Y, or closes it once completed.
- Only emit for issues that exist in the snapshot; never for `#999`-style dangling references.
- Confidence: `1` when the phrasing is explicit, lower when inferred.
- Evidence:
  - `phrase`: normalized matched phrase, for example `Blocks #123`
  - `snippet`: normalized sentence/line fragment containing the phrase

### `depends-on`

- Read `issue.body` and comment bodies for explicit dependency statements: `blocked by #123`, `depends on #123`, `depends-on #123`, or equivalent intent.
- Only emit for issues that exist in the snapshot.
- Confidence: `1` when explicit, lower when inferred.
- Evidence:
  - `phrase`: normalized matched phrase, for example `depends on #123`
  - `snippet`: normalized sentence/line fragment containing the phrase

### `duplicate-candidate`

- Compare open issues against each other and against closed issues, judging semantic duplication from titles, bodies, labels, and comments — not title-token overlap alone.
- Emit one canonical edge with the smaller issue number as `from`.
- Evidence:
  - `reason`: short human-readable why this is a duplicate candidate
  - `titles.from`: lower-numbered issue title
  - `titles.to`: higher-numbered issue title

A duplicate of a closed issue should be proposed as an Obsolete Candidate (close / merge-into), not only as a relationship edge — see `references/stale.md`.

## Evidence Schema

All edges share the outer shape:

```json
{
  "from": 100,
  "to": 101,
  "kind": "mentions|comment-mentions|blocks|depends-on|merged-pr-link|duplicate-candidate",
  "confidence": 0.75,
  "evidence": {}
}
```

Evidence payloads vary by kind:

- `mentions`

```json
{
  "match": "#101",
  "snippet": "See also #101 before filing a follow-up."
}
```

- `comment-mentions`

```json
{
  "source": "comment",
  "author": "octocat",
  "createdAt": "2026-04-18T01:00:00.000Z",
  "match": "#101",
  "snippet": "Follow-up lives in #101."
}
```

- `blocks` / `depends-on`

```json
{
  "phrase": "depends on #101",
  "snippet": "This depends on #101 before rollout."
}
```

- `merged-pr-link`

```json
{
  "source": "closing_prs",
  "pr": {
    "number": 88,
    "state": "MERGED",
    "mergedAt": "2026-04-18T01:15:00.000Z",
    "url": "https://github.com/owner/name/pull/88"
  }
}
```

- `duplicate-candidate`

```json
{
  "reason": "same OAuth refresh flow as #200 with no substantive delta",
  "titles": {
    "from": "OAuth token refresh flow",
    "to": "OAuth token refresh flow redesign"
  }
}
```

`triage-relate.js` is intentionally read-only. Close or duplicate proposals still require report review plus an accepted apply checkbox before any GitHub mutation.
