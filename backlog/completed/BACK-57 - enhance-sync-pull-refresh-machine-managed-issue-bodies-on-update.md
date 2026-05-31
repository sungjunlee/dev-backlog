---
id: BACK-57
title: 'enhance(sync-pull): refresh machine-managed issue bodies on --update'
status: Done
labels: []
priority: medium
milestone:
created_date: '2026-04-17'
---
## Description
## Problem
`sync-pull.js --update` currently rewrites task frontmatter but preserves the existing markdown body.

That is the right default for normal task mirrors because it protects local Acceptance Criteria checkbox state. But it also means machine-managed issues, especially the monthly progress issue, can drift stale in `backlog/tasks/` even when GitHub has fresher generated content.

Concrete example observed in April 2026:
- GitHub `#46` summary says `Merged PRs (month) | 14`
- Local `BACK-46` mirror still says `Merged / completed | 9`

## Goal
Keep the current safe default for normal task files, while letting machine-managed issue mirrors refresh their body from GitHub in the smallest explicit way.

## Acceptance Criteria
- `sync-pull.js --update` refreshes the markdown body for machine-managed issues such as the monthly progress issue.
- Normal task mirrors still preserve their existing body and AC checkbox state under `--update`.
- The discriminator is explicit and narrow, not a broad heuristic.
- Command-level tests lock the update semantics so future cleanup does not regress the contract.
- CLI flags and JSON output stay stable.

## Notes
- Prefer a minimal rule that keys off the existing machine-managed marker instead of introducing broad behavior changes.
- This is follow-up work from the progress journal enrichment shipped in PR #56.
