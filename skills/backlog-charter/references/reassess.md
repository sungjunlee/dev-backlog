# Reassess-Mode Heuristics

Use this reference in `backlog-charter reassess` after reading the Reassess Mode section in `SKILL.md`. The mode is a report-only stale-spec review. It helps the user decide whether to run `backlog-charter amend`, `backlog-charter grill <capability>`, or a separate user-approved Learnings compaction edit.

## Operating Principle

Reassess is the controller review, not the writer.

- Sensors: `## Learnings`, sprint `component:` handles, doctor/lint output, recent sprint context.
- Diagnosis: the reassess report.
- Controller action: user-approved `amend`, `grill`, or compaction.
- Forbidden shortcut: silently editing accepted CHARTER direction or capability contracts during reassess.

The default answer can be "no change." Do not manufacture churn just because the user asked for a reassessment.

If the user accepts a Learning Action, end reassess and perform a separate user-approved manual edit. Do not treat that edit as part of reassess diagnosis.

## Evidence Order

Prefer bounded evidence before broad reading:

1. `capabilities-doctor.js --json` for compactness, marker health, and inline Learnings count.
2. `component-lint.js --json` for sprint `component:` routing drift.
3. `CHARTER.md` Objectives and Decisions when a recommendation could affect project-wide direction.
4. `spec/capabilities.md` capability blocks named by the evidence.
5. Latest five completed sprint files, plus the active sprint when it exists.

If a script is missing, say it was skipped and continue with file reads. Missing `CHARTER.md` or `spec/capabilities.md` is not an error; it is an opt-in state with a next-step recommendation.

## Report Shape

Use this structure unless the user asks for a shorter answer:

```md
## Reassess Report

### Evidence
- <script/file signal and what it means>

### No Change
- <area that still matches current evidence>

### Grill Candidates
- <capability> — evidence: <signal>; suspected change: <contract area>; next: `backlog-charter grill <capability>`

### Amend Candidates
- <CHARTER item> — evidence: <signal>; suspected change: <direction/objective/decision>; next: `backlog-charter amend`

### Learning Actions
- Keep inline: <recent high-signal Learnings>
- Promote: <Learning> — evidence: <repetition or durable rule>; next: separate user-approved compaction edit
- Archive: <history no longer needed in startup context> — evidence: <age/no longer active>; next: separate user-approved compaction edit

### Missing Evidence
- <what was absent or skipped>

### Recommended Next Step
- <one command or human action>
```

Separate evidence from recommendation. The evidence says what was observed; the recommendation says what the user may choose to do.

## Recommendation Rules

### No Change

Recommend no change when Learnings are sparse, recent, non-repetitive, and do not contradict Goal/Scope/Behaviors/Hard Constraints. A clean doctor result plus no component drift is usually enough for no-change unless the user supplied contrary context.

### Grill Candidate

Recommend `backlog-charter grill <capability>` when any of these are true:

- repeated Learnings show a new durable behavior or constraint
- current Behaviors are too weak to explain how recent work succeeded
- a Hard Constraint has been worked around repeatedly
- the capability is over budget because contract text and Learnings are mixed together
- component usage shows the capability owns work its Scope does not mention

Do not rewrite the capability during reassess. Name the block and the suspected edit.

### Amend Candidate

Recommend `backlog-charter amend` when evidence affects project-wide direction:

- a repeated Learning changes multiple capabilities
- an Objective appears validated or deferred but lacks proof
- a Non-Goal is repeatedly violated by accepted work
- a capability-level Decision is cross-cutting enough to belong in CHARTER

Do not weaken an Objective so the available proof appears sufficient.

### Learning Action

Keep recent Learnings inline when they are still useful startup context.

Promote a Learning to `## Decisions` when it has become a durable capability rule. Promote to CHARTER Decisions only when it affects more than one capability or changes the project-wide axis.

Archive older Learnings when they are useful history but no longer startup context. Reassess may recommend archive/compaction, but the actual edit is human-gated.

## Failure Modes

- **Churn generator:** every reassess proposes edits. Fix by allowing "no change" and requiring evidence.
- **Semantic overreach:** deterministic counts are treated as proof of stale content. Fix by labeling counts as signals, not conclusions.
- **Silent self-editing:** reassess edits Goal/Scope/Behaviors while diagnosing. Fix by routing through amend/grill.
- **Unbounded scan:** the agent reads the whole repo and invents drift. Fix by starting from scripts and a bounded sprint window.
- **Name confusion:** `spec-grill` or `spec-reassess` is described as callable before it exists. Fix by calling them reserved/non-callable future names.

## Reserved Names

Today the callable skill is `backlog-charter`. The names `spec-grill`, `spec-reassess`, and `spec-learn` are reserved/non-callable future split candidates. Mention them only when discussing naming policy or split triggers, not as commands the user can run.
