# Relationships

**Purpose.** `triage-relate.js` reads a previously collected issue snapshot and emits read-only relationship edges for four snapshot-resident signals:

- `mentions` from plain `#123` references in issue bodies
- `blocks` from explicit blocking / closing phrases in issue bodies
- `depends-on` from explicit dependency phrases in issue bodies
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
  "kind": "mentions|blocks|depends-on|duplicate-candidate",
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

- `blocks` / `depends-on`

```json
{
  "phrase": "depends on #101",
  "snippet": "This depends on #101 before rollout."
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

## Deferred to #73

These signals are intentionally out of scope for `#62` because the current snapshot schema does not include the required fields:

- `comments`-based mention scan
  - Reason: the snapshot currently carries `issue.body` only, so comment text is unavailable without extending the snapshot in `#73`.
- `merged-pr-link` edge kind
  - Reason: PR linkage depends on `closing_prs` metadata that is also deferred to the `#73` snapshot extension.
