# Apply Semantics

**Purpose.** Authoritative reference for the anchor-comment apply contract used by the backlog-triage report renderer in #64 and the apply step in #65.

The report is a two-surface document:

- The anchor comment is the machine contract.
- The paired checkbox is the human confirmation surface.

## Anchor Grammar

The single regex contract for parsing a triage anchor is:

```regex
<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->
```

`skills/backlog-triage/scripts/triage-report.js` exports `parseAnchor(line)` so downstream code can import the shared parser instead of re-implementing this regex.

### Slot Semantics

- Verb slot: `([\w-]+)`
- Target slot: `#(\d+)`
- Args slot: optional free text payload captured as one string, later parsed as `key="value"` or `key=value`

The target slot is always the **first** `#N` after the verb. Example:

```html
<!-- triage:close-duplicate #42 target=#87 reason="duplicate of #87" -->
```

The target issue is `#42`. The later `#87` lives in the args payload and must not be mistaken for the anchor target.

## Supported MVP Verbs

The renderer in #64 emits these verbs:

- `close`
- `revisit`
- `close-duplicate`
- `set-priority`
- `assign-milestone`

Forward compatibility is required. A future unknown verb must parse without crashing the consumer. Consumers such as #65 should log and skip unknown verbs they do not implement.

## Args Sub-Grammar

Args are a flat key-value list:

- `key="value with spaces"`
- `key=value`

Quoted values are preferred for reasons, sprint names, and any value containing whitespace. Bare values are acceptable for compact tokens such as `value=high`, `cluster=auth`, or `target=#87`.

If a quoted value must contain a literal double quote, escape it as `\"`. In practice, prefer avoiding embedded quotes inside reason strings when a simpler phrasing works.

Examples:

```html
<!-- triage:close #104 reason="inactive/stale: no activity for 107 days" -->
<!-- triage:set-priority #101 value=high reason="theme auth has 4 recent/warm issues" -->
<!-- triage:assign-milestone #103 name="Sprint W17" cluster=auth -->
<!-- triage:close-duplicate #88 target=#42 reason="duplicate candidate converged on #42" -->
```

## Pair Invariant

Each actionable proposal follows this exact structure:

```markdown
<!-- triage:set-priority #101 value=high reason="theme auth has 4 recent/warm issues" -->
- [ ] Set priority:high on #101 — theme auth has 4 recent/warm issues
```

Rules:

- The anchor lives on its own line.
- The next non-blank line is the checkbox.
- One blank line between the anchor and checkbox is allowed.
- Reflowing surrounding markdown must not change the anchor line.

The checkbox is the approval toggle. The anchor without a checked box is inert.

## Collision Rules

The `triage:` prefix is intentionally distinct from the dev-backlog task-file acceptance marker syntax:

- Triaged reports may contain `<!-- triage:... -->`
- Dev-backlog task files may contain `<!-- AC:BEGIN -->` / `<!-- AC:END -->`

They must not be mixed in the same artifact. A task file must never contain `<!-- triage:` and a triage report must never contain `<!-- AC:BEGIN -->`.

## Duplicate Anchors Per Issue

Multiple actions may target the same issue when the actions are distinct. Example:

```html
<!-- triage:set-priority #42 value=high reason="linked to active auth work" -->
<!-- triage:assign-milestone #42 name="Sprint W17" cluster=auth -->
```

That is valid. These are separate proposals and therefore separate anchor+checkbox pairs.

The invalid case is duplicating the exact same action for the same issue without new meaning, for example two separate `close` anchors for `#42` that differ only by wording.

## Renderer / Apply Contract

The report renderer in #64 is responsible for:

- Emitting syntactically valid anchor comments
- Keeping anchors stable across re-runs for the same inputs
- Pairing every anchor with a checkbox
- Preserving the existing report on overwrite by moving it to `.bak`

The apply step in #65 is responsible for:

- Parsing anchors with the shared `parseAnchor(line)` helper
- Inspecting the paired checkbox state
- Logging and skipping unknown verbs
- Avoiding duplicate mutations when re-run

## Report Boundaries

The triage report must contain triage anchors only in actionable proposal sections. The current renderer emits actionable anchors in:

- `## Obsolete Candidates`
- `## Priority Proposals`
- `## Milestone Suggestions`

The flattened `## Apply Checklist` is a human summary of all emitted proposals. It should stay in sync with the actionable sections, but the authoritative machine contract is still the anchor line plus its paired checkbox.
