# Grill-Mode Heuristics for `spec/capabilities.md`

Use this reference in `backlog-charter` grill mode after walking the per-capability interview flow in `SKILL.md`. The flow, 3-axis predicate test, and tier gates live in `SKILL.md`; this file captures concrete dogfood patterns so future grill sessions do not relearn them.

## Naming: Slug Handle vs. Prose Contract

Capability headings are routing handles:

```md
## Capability: backlog-sync
```

Do not use a sentence or comma-separated name:

```md
## Capability: pulling open issues
## Capability: backlog-sync, task-progress-reporting
```

If the work touches several areas, keep the primary slug in sprint frontmatter and put the nuance in prose:

```yaml
component: "charter-management"
```

```md
Touches: charter-management primarily; also affects backlog-sync docs.
```

Bias: the slug is the address; Goal/Scope text is the explanation.

## Goal-Line Rewrites

Bad Goal lines usually describe diagnosis, implementation, or an internal tool. Good Goal lines describe what a user or agent can observe.

| Draft | Better |
|---|---|
| "Reduce context loss across sprints." | "An agent resuming work mid-session reads the active sprint file and acts on in-flight items without re-asking what is going on." |
| "`sync-pull.js` mirrors GitHub." | "Open GitHub Issues are mirrored into `backlog/tasks/*.md` without diverging on local AC checkbox state." |
| "Backlog triage with CHARTER awareness." | "Open Issues are classified, related, flagged stale, and aligned to CHARTER Objectives without humans maintaining a parallel triage spreadsheet." |
| "Keep CHARTER short." | "A user creates or amends `CHARTER.md` through tier-gated discipline and the file stays a 5-minute read." |

Move diagnosis-side framing to CHARTER Problem. Move scripts and file names to In-scope unless the script is the user-visible surface.

## Behavior vs. Hard Constraint

Use Behaviors for expected positive outcomes. Use Hard Constraints for bright lines that remain true even when a user asks for the tempting shortcut.

| Draft | Put it here | Why |
|---|---|---|
| "`sync-pull --update` preserves AC checkbox state." | Expected Behavior | It describes the normal successful outcome. |
| "Never overwrite a non-machine-managed task body during `--update`." | Hard Constraint | It forbids data loss even if a refresh would be convenient. |
| "Default triage produces a report and does not mutate GitHub." | Expected Behavior | It is the default flow users see. |
| "Never close, relabel, or comment without `--apply`." | Hard Constraint | It protects the source of truth from silent mutation. |

Avoid "never do X unless asked" as a Hard Constraint. The phrase "unless asked" is a loophole. If explicit user consent is valid, make it a Behavior with the consent condition.

## 3-Axis Test Examples

### Manipulability failure

Predicate:

> "`component-lint` passes for every sprint."

Problem: an agent can satisfy this by deleting `spec/capabilities.md`, because absence is an opt-in no-op.

Fix: separate the structural handle from the opt-in behavior.

> "When `spec/capabilities.md` exists, every non-empty sprint `component:` value resolves to one declared capability slug."

### Authority failure

Predicate:

> "Every run appends a Learning."

Problem: the agent can append low-signal filler after every run, satisfying the count while polluting future context.

Fix: encode the user intent.

> "A successful relay run appends at most one Learning only when it discovered a reusable pattern, measured fact, or constraint that future runs need."

### Distributional failure

Predicate:

> "`extract-signals` finds all capabilities from top-level dirs."

Problem: it fails on repos whose useful boundaries are commit scopes, packages, or workflows rather than directories.

Fix: scope the claim to draft seeding.

> "`extract-signals` reports deterministic candidates from repo signals and marks whether each candidate is directory-backed or commit-scope-only."

## Rerun Protocol

`backlog-charter grill <capability-slug>` may touch:

- `Goal`
- `In-scope`
- `Out-of-scope`
- `Expected Behaviors`
- `Hard Constraints`

It must not touch:

- `### Learnings`
- `### Decisions`
- other capability blocks
- `CHARTER.md`, unless the user separately invokes amend mode

If a rerun discovers a cross-cutting decision, append it to the relevant Decisions table or promote it to CHARTER via amend mode. Do not rewrite old Decisions rows.

## Capability Count Guidance

Keep the single-file `spec/capabilities.md` until it becomes hard to scan.

Split later when either trigger is true:

- the file exceeds roughly 500 lines
- capability ownership boundaries require separate review/merge paths

Until then, single-file is easier for agents: one read, one grep surface, fewer paths to rediscover.
