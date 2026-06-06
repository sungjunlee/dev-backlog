# Relationships

**Purpose.** `triage-relate.js` reads a previously collected issue snapshot and emits read-only relationship edges for snapshot-resident signals:

- `mentions` from plain `#123` references in issue bodies
- `comment-mentions` from plain `#123` references in optional issue comments
- `blocks` from explicit blocking / closing phrases in issue bodies
- `depends-on` from explicit dependency phrases in issue bodies
- `merged-pr-link` from per-issue merged closing PR metadata
- `duplicate-candidate` from title-token Jaccard overlap

Every emitted edge carries evidence taken directly from the snapshot so downstream report rendering can show why the relationship was inferred without re-fetching from GitHub.

## Implemented Heuristics

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

### `blocks`

- Source: `issue.body`
- Keywords used by `scanBlocks`:
  - `blocks #123`
  - `closes #123`
- Confidence: `1`
- Evidence:
  - `phrase`: normalized matched phrase, for example `Blocks #123`
  - `snippet`: normalized sentence/line fragment containing the phrase

### `depends-on`

- Source: `issue.body`
- Keywords used by `scanDependsOn`:
  - `blocked by #123`
  - `depends on #123`
  - `depends-on #123`
- Confidence: `1`
- Evidence:
  - `phrase`: normalized matched phrase, for example `depends on #123`
  - `snippet`: normalized sentence/line fragment containing the phrase

### `merged-pr-link`

- Source: `issue.closing_prs`
- Gate: runs only when `closing_prs` is present as an array
- Match rule: emit only entries with `state: "MERGED"` and a non-empty `mergedAt`
- Confidence: `1`
- Action semantics: advisory relationship evidence only; this does not imply an automatic close recommendation
- Evidence:
  - `source`: `"closing_prs"`
  - `pr.number`: closing PR number
  - `pr.state`: closing PR state
  - `pr.mergedAt`: merge timestamp
  - `pr.url`: closing PR URL when present

### `duplicate-candidate`

- Source: `issue.title`
- Threshold: `backlog/triage-config.yml -> duplicate_threshold`
- Confidence: Jaccard similarity score
- Canonicalization:
  - compare each issue pair once
  - emit a single edge with the smaller issue number as `from`
- Evidence:
  - `score`: rounded Jaccard score (`4` decimal places)
  - `overlap`: sorted shared title tokens
  - `titles.from`: lower-numbered issue title
  - `titles.to`: higher-numbered issue title

## Jaccard Tokenization Rules

Title similarity uses the following normalization before scoring:

- lowercase the title
- extract tokens with regex `[a-z0-9]+`
- drop one-character tokens
- deduplicate tokens per title by converting to a set
- compute `overlap / union`

If the union is empty, the score is `0` and no edge is emitted.

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
  "score": 0.8,
  "overlap": ["flow", "oauth", "refresh", "token"],
  "titles": {
    "from": "OAuth token refresh flow",
    "to": "OAuth token refresh flow redesign"
  }
}
```

## Deferred follow-ups

`triage-relate.js` is intentionally still read-only. Turning `merged-pr-link` into a stale / obsolete close candidate belongs to `triage-stale.js` and is tracked separately in #190.
