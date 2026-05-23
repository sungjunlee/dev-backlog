# <Project> Capabilities

This file is the middle layer between `CHARTER.md` (north star) and the active sprint (this week's tasks). Each capability describes one subsystem buckets-worth of work with a frozen-ish contract and a structurally-bounded live-feedback channel.

Mutation discipline (matches the design doc):

| Section | Who writes | When | Gate |
|---|---|---|---|
| `Goal`, `In-scope`, `Out-of-scope` | human via `backlog-charter grill` | when the contract changes | challenge + confirm + apply |
| `Expected Behaviors`, `Hard Constraints` | human via grill | when a behavior or bright-line changes | grill + 3-axis predicate test |
| `## Learnings` (between magic markers) | `append-learnings.js` only | end of every successful relay run tagged for this capability | structurally bounded append; rejects writes outside markers |
| `## Decisions` | human, append-only | when a capability-level decision is made | append-only by convention; promote to CHARTER if cross-cutting |

When this file exceeds ~500 lines, run `split-capabilities.js` to migrate to `spec/components/<name>.md`. Do not pre-split.

---

## Capability: <name>

**Goal:** <one sentence: what the user can observe when this works>

**In-scope:**
- <bullet>

**Out-of-scope:**
- <bullet — what this capability deliberately does not own>

### Expected Behaviors
- <verifiable predicate that passes the 3-axis test: authority + distributional + manipulability>
- <verifiable predicate>
- <verifiable predicate>

### Hard Constraints
- <bright-line: this capability never does X, even if asked>
- <bright-line>

### Learnings
<!-- LEARN:BEGIN -->
<!-- entries appended by dev-relay/scripts/append-learnings.js after each successful relay run -->
<!-- format: - YYYY-MM-DD (run #N): <one-line> [PR #X] -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |

---

<!-- Duplicate the "## Capability:" block above for each additional capability. -->
