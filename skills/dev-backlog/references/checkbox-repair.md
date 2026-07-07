# Checkbox repair runbook

"The doctor warned about an unmoored `[~]` — now what?" One page from detect to repair. The checkbox grammar itself is unchanged; this only tells you how to move an item back into a valid state.

## Detect

A `[~]` (in-flight) Plan item is **unmoored** when it carries no pointer to the work: no PR, no branch, and no run-id.

- `backlog-doctor.js` raises the `in_flight_trace` check to **warn** (soft, non-blocking) and lists each offending item.
- In `--json`, each listed item has `unmoored: true`.

```bash
node skills/dev-backlog/scripts/backlog-doctor.js --json | node -e '
const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
const c = j.checks.find((x) => x.name === "in_flight_trace");
if (c.status === "warn") console.log(c.detail.items.filter((i) => i.unmoored));
'
```

## Repair — pick one

Choose by what is actually true of the item:

1. **Work is in flight → add a pointer.** Append exactly one of these to the Plan line:
   - `→ PR #<n> (<state>)` — an open/merged PR, e.g. `→ PR #87 (reviewing)`.
   - `[branch:<name>]` — a working branch with no PR yet.
   - `[run:<run-id>]` — a dispatched relay/agent run.
   ```markdown
   - [~] #42 OAuth2 flow → PR #87 (reviewing)
   ```

2. **Marked in-flight but nothing started yet → annotate "no work yet."** Keep `[~]` but state it explicitly so the warn is intentional, not an accident:
   ```markdown
   - [~] #42 OAuth2 flow — no work yet (holding batch slot)
   ```

3. **The item should not be in flight → demote or strike.** Move it back to `[ ]`, or strike it and record why in `## Progress`:
   ```markdown
   - [ ] #42 OAuth2 flow
   ```
   ```markdown
   ## Progress
   - 2026-07-07: #42 returned to not-started — dispatch was premature.
   ```

Never leave a bare `[~]` with no pointer and no annotation — that is exactly the state the doctor flags. Re-run `backlog-doctor.js` to confirm the warn clears.

## Grammar reference

Pointer and annotation shapes are defined in [`integration-contract.md`](integration-contract.md); this runbook only sequences the fix.
