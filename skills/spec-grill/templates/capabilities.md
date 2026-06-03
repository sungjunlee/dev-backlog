# <Project> Capabilities

This file is the middle layer between `spec/charter.md` (north star) and the active sprint (this week's tasks). Each capability describes one subsystem buckets-worth of work with a frozen-ish contract and a structurally-bounded live-feedback channel.

Use loose prose and strict handles. Goal, scope, behaviors, sprint Plan, and Running Context are where agents can explain nuance. Capability IDs and sprint `component:` values are routing handles: use one lowercase slug such as `sprint-execution`, not a sentence or comma-separated list.

Mutation discipline (matches the design doc):

| Section | Who writes | When | Gate |
|---|---|---|---|
| `Goal`, `In-scope`, `Out-of-scope` | human via `spec-grill` | when the contract changes | challenge + confirm + apply |
| `Expected Behaviors`, `Hard Constraints` | human via grill | when a behavior or bright-line changes | grill + 3-axis predicate test |
| `## Learnings` (between magic markers) | `append-learnings.js` only | end of every successful relay run tagged with this primary capability slug | structurally bounded append; rejects writes outside markers |
| `## Decisions` | human, append-only | when a capability-level decision is made | append-only by convention; promote to `spec/charter.md` if cross-cutting |

Compactness budget:

- Target 5-10 capabilities.
- Warn above 12 capabilities or 400 lines.
- Split above 500 lines, above 15 capabilities, or when ownership boundaries demand separate review paths.
- Keep the most recent 5-7 Learnings inline per capability; promote durable rules to Decisions and archive older history outside this hot file.

Do not create one capability per feature folder. A capability is a durable contract boundary with distinct Behaviors and Hard Constraints.

Do not store issue-specific acceptance criteria, relay Done Criteria, scoring rubrics, or review notes here. Those belong to GitHub/task files, sprint files, and dev-relay run artifacts. Capability specs may be informed by that evidence, but they record only durable contracts.

---

## Capability: <slug>

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
<!-- entries appended by the bounded append-learnings writer after successful relay runs -->
<!-- format: - YYYY-MM-DD (run #N): <one-line> [PR #X] -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |

---

<!-- Duplicate the "## Capability:" block above for each additional capability. -->
