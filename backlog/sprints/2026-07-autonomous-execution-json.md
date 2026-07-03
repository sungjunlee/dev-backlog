---
milestone: 2026-07 autonomous execution
status: active
started: 2026-07-03
due: TBD
objectives: [O1]
component: "sprint-execution"
---

# Autonomous Execution JSON

## Goal
Actors can read current sprint execution state from status/next JSON without parsing markdown.

## Plan
### Batch 1 - JSON read surfaces
- [~] #211 Add --json structured read surfaces to status.sh and next.sh (~2hr) [branch:issue-211]

## Running Context
- JSON read surfaces must preserve the existing checkbox and trace grammar; structured output is a reader of that grammar, not a replacement for it.

## Progress
- 2026-07-03: #211 started; implementing status.sh --json and next.sh --json through one Node-owned sprint-state parser.
- 2026-07-03: #211 implemented sprint-state.js JSON emission, shell delegation, schema docs, smoke JSON checks, and node parser tests. Verification: smoke-test, node --test, component-lint, and objectives-check pass locally.
