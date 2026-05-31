# Decision Review

Decision Review is the final editorial layer in a backlog-triage report. It turns classification, relationship, stale, and spec-alignment evidence into a maintainer-facing recommendation: do this now, shape it first, defer it, or drop/close it.

This pass is prompt-driven and report-only. Do not add a deterministic `triage-*.js` script for the semantic judgment unless repeated dogfood shows a narrow, parseable subproblem. Do not mutate `spec/` files from backlog-triage.

## Evidence Order

Read bounded evidence in this order:

1. `spec/charter.md`; if absent, fall back to legacy root `CHARTER.md`; if both are absent, continue without charter evidence.
2. `spec/capabilities.md` when present.
3. `spec/system-map.md` when present.
4. Active sprint context when present, especially in-flight work and protected issue references.
5. Issue snapshot from `triage-collect.js`.
6. Relationship output from `triage-relate.js`.
7. Stale or obsolete output from `triage-stale.js`.

Missing files are graceful no-ops. Say which evidence was used and which evidence was absent; do not invent spec authority.

## Buckets

### Do Now

Use for issues that strongly advance an active charter Objective, are ready enough to execute, and have high timing or leverage. Favor issues that unblock multiple related issues, protect an active sprint, or close a visible drift gap.

### Shape First

Use for issues that look valuable but are not ready to execute. Common reasons:

- acceptance criteria or success conditions are unclear
- the issue spans multiple capabilities and no primary owner is obvious
- it needs a design, spec, or dependency decision before implementation
- it may fit the charter, but the link to an active Objective is weak

### Defer

Use for issues that are valid but not timely. They may fit a deferred Objective, require unavailable prerequisites, duplicate a future milestone theme, or be lower leverage than the current sprint direction.

### Drop / Close

Use only when there is explicit evidence: charter Non-Goal contradiction, capability Out-of-scope or Hard Constraint violation paired with charter misalignment or staleness, a superseding issue/PR, obsolete product direction, or a clear duplicate. Lack of capability fit alone is not enough to recommend closing.

If the report proposes closing, keep the normal anchor-comment apply contract. Decision Review prose alone must not imply mutation.

## Core Rubric

For each issue, make a one-line judgment using these factors:

| Factor | Ask |
| --- | --- |
| Objective fit | Does this advance an active charter Objective, or does it contradict a Non-Goal? |
| Timing | Does this belong in the current or next planning horizon? |
| Leverage | Does it unblock, simplify, validate, or retire meaningful work? |
| Readiness | Are acceptance criteria, dependencies, and owner boundaries clear enough? |
| Stale/contradiction risk | Is there evidence that the issue is obsolete, duplicated, or outside accepted constraints? |

## Capability Fit

When `spec/capabilities.md` exists, use each capability's `Goal`, `In-scope`, `Out-of-scope`, and `Hard Constraints` as evidence.

- Suggest a primary `component:` candidate when the issue cleanly maps to one capability. This is sprint-planning guidance, not a write to the issue.
- Flag multi-capability issues as `Shape First` unless the primary capability is clear.
- Treat explicit Out-of-scope or Hard Constraint conflicts as strong evidence, but do not close on capability mismatch alone. Pair it with charter misalignment, staleness, duplication, or explicit out-of-scope evidence.

## System Map Check

When `spec/system-map.md` exists, use it only for high-level boundary, flow, storage/external-system, or invariant contradictions. Do not use it for detailed capability ownership; that belongs to `spec/capabilities.md`.

In the report, distinguish:

- **System-map contradiction:** violates a project-wide boundary or invariant.
- **Capability-fit concern:** unclear or conflicting ownership within accepted capability contracts.

## Report Shape

Place Decision Review after `## Alignment` and before `## Apply Checklist`:

```markdown
## Decision Review
Evidence used: `spec/charter.md`; `spec/capabilities.md`; active sprint; snapshot; relationships; stale signals.
Evidence absent: `spec/system-map.md`.

### Do Now
- #42 - Advances O3, fits `triage-grooming`, ready AC, unblocks #43.

### Shape First
- #44 - Valuable but spans `triage-grooming` and `sprint-execution`; pick a primary component before implementation.

### Defer
- #45 - Valid but tied to deferred O5; keep out of the current sprint.

### Drop / Close
- #46 - Contradicts Non-Goal "no daemon" and has no active Objective fit.
```

Do not include anchors for non-mutating recommendations. Only include close/relabel/milestone anchors when the normal apply contract supports the action and a human can accept it with a checkbox.
