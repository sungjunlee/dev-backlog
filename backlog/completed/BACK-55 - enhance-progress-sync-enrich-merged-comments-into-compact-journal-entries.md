---
id: BACK-55
title: 'enhance(progress-sync): enrich merged comments into compact journal entries'
status: To Do
labels:
  - enhancement
priority: medium
milestone: April 2026 Progress Journal Enrichment
created_date: '2026-04-17'
---
## Description
## Why

The monthly progress issue currently records merged work with comments that mostly show only the PR number and title.

That is enough for a ledger, but it is too thin for the intended journal use case. When someone reviews the month later, they should be able to see which task was closed, when the PR landed, and what AI/relay context existed without opening several extra tabs.

## Scope

- Keep the monthly progress issue body as a compact summary snapshot
- Enrich merged-progress comments so they read like compact journal entries
- Add deterministic metadata only: linked issue refs, landed time, and AI/relay context when available
- Preserve managed-comment reconciliation so existing entries update in place

## Acceptance Criteria

- Merged comments include more context than only PR number/title
- Linked issue refs are shown when GitHub provides them, with a small fallback from relay metadata when available
- Landed time is shown in a stable deterministic format
- AI/relay context remains compact and human-readable when a relay manifest is provided
- `node --test skills/dev-backlog/scripts/*.test.js` passes

## Out of Scope

- LLM-generated prose summaries
- Long changelog-style comment bodies
- Redesigning the top-level monthly summary body
- Broad changes to stuck-comment semantics
