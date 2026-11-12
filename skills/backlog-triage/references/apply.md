# Apply Semantics

**Purpose.** Authoritative reference for the anchor-comment apply contract used by the session-written backlog-triage report and the apply step in #65.

The report has one approval surface, `## Apply Checklist`, where each proposal pairs:

- The anchor comment is the machine contract.
- The paired checkbox is the human confirmation surface.

## Anchor Grammar

The single regex contract for parsing a triage anchor is:

```regex
^ {0,3}<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->[ \t]*$
```

`skills/backlog-triage/scripts/anchor.js` exports `parseAnchor(line)` so downstream code can import the shared parser instead of re-implementing this regex. `triage-apply.js` consumes that helper.

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

The session-written report emits these verbs:

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
<!-- triage:assign-milestone #103 milestone="Sprint W17" cluster=auth -->
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
- Frontmatter, fenced or indented code, and an anchor embedded in other text are never approval syntax.
- Reflowing surrounding markdown must not change the anchor line.

The checkbox is the approval toggle. The anchor without a checked box is inert.

## Duplicate Anchors Per Issue

Multiple actions may target the same issue when the actions are distinct. Example:

```html
<!-- triage:set-priority #42 value=high reason="linked to active auth work" -->
<!-- triage:assign-milestone #42 milestone="Sprint W17" cluster=auth -->
```

That is valid. These are separate proposals and therefore separate anchor+checkbox pairs.

For `assign-milestone`, `milestone=` is canonical. Apply accepts legacy `name=` only when `milestone=` is absent; supplying both with different values is invalid. Accepted known actions are validated together before any GitHub call or apply-log write, including in dry-run. Any of the following fails the whole report with its line numbers:

- an issue number that is not a positive safe integer;
- argument text that is not whitespace-separated `key=value` / `key="value"` pairs, or a key given twice;
- a missing or blank required argument, an invalid `set-priority` value or `close-duplicate` target (`#N` with N a positive safe integer, not the issue itself), or any value containing a NUL character or more than 16,000 UTF-8 bytes;
- two priority or two milestone assignments for the same issue, whether the values differ or repeat with other arguments changed (legacy `name=` counts as `milestone=`), or two different duplicate targets;
- more than one accepted closing action (`close` or `close-duplicate`) for the same issue.

Unchecked actions remain inert and unknown verbs keep their skip-and-log behavior. In apply mode, an absent `.dev-backlog/.tracker` or a first line of `github` is required; any other or unreadable authority stops before a write.

The invalid case is duplicating the exact same action for the same issue without new meaning, for example two separate `close` anchors for `#42` that differ only by wording.

## Report / Apply Contract

The session-written report is responsible for:

- Emitting each syntactically valid anchor exactly once under `## Apply Checklist`
- Pairing every anchor with a checkbox

The apply step in #65 is responsible for:

- Rejecting any anchor outside the single `## Apply Checklist`, then parsing checklist anchors with the shared `parseAnchor(line)` helper
- Inspecting the paired checkbox state
- Logging and skipping unknown verbs
- Avoiding duplicate mutations when re-run

## Report Boundaries

Prose sections carry recommendation evidence without anchors. `## Apply Checklist` is the only fixed heading, the only parsed section, and the only location for anchor+checkbox pairs. Each proposal appears once. Exact duplicate actions in the checklist are ambiguous and rejected; distinct actions for one issue remain valid subject to the conflict checks above.

An anchor anywhere else is rejected before a GitHub call or apply-log write, whether its checkbox is checked or unchecked. To migrate an older duplicated report, consolidate each action under `## Apply Checklist`, remove every outside anchor, and explicitly recheck the intended approvals. Merely unchecking the outside copy is insufficient.

The action key remains `(verb, issueNumber, normalizedArgs)`, where normalized args have sorted keys and trimmed string values. For `assign-milestone`, legacy `name=` is keyed as `milestone=` when the values do not disagree, preserving valid apply-log history across migration and preventing completed commands from repeating.

## Apply log and recovery

Apply validates the whole accepted set and GitHub authority before creating an empty ledger, then opens the actual append path before any provider call. A known unwritable sink therefore stops with no GitHub effect. Successful commands are logged one at a time; after an ordinary later provider failure, re-running logs completed commands as `already-applied` and executes only the remaining accepted work.

If a provider reports success and the following append fails, Apply stops before the next command, identifies the attempted command, and says the effect may have completed. Verify remote state before manual recovery. Apply does not retry within that invocation, and without a durable uncertainty record a separate blind invocation cannot be made safe automatically; there is no intent journal, lock, or exactly-once guarantee.
