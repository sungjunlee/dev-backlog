# dev-backlog Capabilities

The middle layer between [`CHARTER.md`](../CHARTER.md) and the active sprint. Each block describes one subsystem-worth of work with a frozen-ish contract and a structurally bounded live-feedback channel.

Mutation discipline matches [`docs/spec-system-design.md`](../docs/spec-system-design.md): Goal/Scope/Behaviors/HardConstraints are human-gated via `spec-grill`; `## Learnings` is appended only by a bounded `append-learnings` writer between magic markers; `## Decisions` is append-only by convention.

Capability headings are strict routing handles. Use one lowercase slug after `## Capability:` and point sprint `component:` frontmatter at exactly one of those slugs. Put secondary touches in sprint prose, not in frontmatter.

---

## Capability: sprint-execution

**Goal:** An agent or human resuming work mid-session reads the active sprint file and acts on its in-flight items without re-asking what is going on.

**In-scope:**
- `backlog/sprints/*.md` body + frontmatter (status, milestone, objectives)
- Checkbox state machine: `[ ]` not started → `[~]` in flight → `[x]` done
- `sprint-init.js`, `sprint-close.sh`, `find_active_sprint`, `next.sh`, `status.sh`

**Out-of-scope:**
- Tasks outside the active sprint (those live in `backlog/tasks/`)
- Sprint *content* authoring — humans write the Plan; this capability runs it
- Backlog grooming or stale-issue detection (`triage-grooming` capability)

### Expected Behaviors
- Exactly one sprint file with `status: active` exists per `backlog/sprints/` at all times — concurrent actives fail loud (find_active_sprint surfaces the conflict).
- Every `[~]` line carries a PR or branch ref in-line, or an explicit "no work yet" annotation — never an unmoored `[~]`.
- Closing a sprint via `sprint-close.sh` is atomic: the sprint flips `status: completed` AND its done-checkbox issues move into `backlog/completed/` in one invocation, not in two steps.

### Hard Constraints
- Never mutate a sprint's `status: completed` back to `active`; completed sprints are immutable history.
- Never silently delete sprint Plan items — strike them with a Progress entry or convert to `[~]` with a parking note instead.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |

---

## Capability: backlog-sync

**Goal:** Open GitHub Issues are mirrored into `backlog/tasks/*.md` without diverging on local AC checkbox state.

**In-scope:**
- `sync-pull.js` (with and without `--update`), task-file frontmatter (number, title, labels, milestone, assignees)
- AC checkbox preservation in task bodies for non-machine-managed issues
- Idempotent re-runs against unchanged GitHub state

**Out-of-scope:**
- Writing to GitHub (this capability is read-only; mutations live elsewhere)
- Monthly progress-issue lifecycle (`task-progress-reporting` capability)
- Cross-repo mirroring

### Expected Behaviors
- `sync-pull` on a fresh checkout produces `backlog/tasks/*.md` with no token prompt beyond `gh auth` already being valid.
- `sync-pull --update` refreshes frontmatter while leaving AC checkbox state intact, **except** for issues whose incoming body starts with the `<!-- dev-backlog:progress-issue month= -->` marker — those are intentionally overwritten because their bodies are machine-managed.
- Running `sync-pull` twice against unchanged GitHub state produces byte-identical task files on the second run.

### Hard Constraints
- Never call any `gh` subcommand that writes to GitHub from this capability — it is structurally read-only.
- Never overwrite a non-machine-managed task body during `--update`; only frontmatter is replaced.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-05-23 | `--update` preserves AC bodies for everything except machine-managed `progress-issue` markers | local AC checkboxes are user state; machine-managed bodies have no user state to lose | — |

---

## Capability: spec-charter

**Goal:** A user creates, amends, or reassesses `CHARTER.md` through tier-gated discipline, and the file stays a 5-minute read.

**In-scope:**
- `spec-charter` create + amend + reassess modes
- Three-tier discipline (Direction / Predicates / History) and the proof gate for Objective status advances
- `check-size.js` budget enforcement after every amend
- Brownfield handoff guidance to `spec-grill` after initial CHARTER creation

**Out-of-scope:**
- Authoring per-capability contracts in `spec/capabilities.md` (`spec-grill` capability)
- Charter deletion — no supported path
- Reading `CHARTER.md` from sibling skills (each does it directly; this capability does not gate reads)

### Expected Behaviors
- After `amend` lands a real diff, `revision` increments by exactly 1 and `last_amended` advances to that day; a no-op invocation never bumps either field.
- Every Objective status advance (`active` → `validated` / `deferred`) is refused unless a cited PR, check, or relay run whose Done Criteria match the predicate is provided in the same invocation.
- `check-size.js` runs at the end of every successful amend and emits the size summary line; if word or line budgets exceed, the script also emits at least one actionable suggestion.

### Hard Constraints
- Never edit or delete an existing Decisions row — reversal is a new row with `supersedes`, never a mutation.
- Never auto-advance an Objective's status without cited evidence, even when explicitly asked. The proof gate is unconditional.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-05-22 | CHARTER is a separate file at repo root, not merged into `_context.md` | Yardstick must stay <5-min; HOW-knowledge would dilute it | — |
| 2026-05-22 | `backlog-charter` is a third sibling skill, not folded into `dev-backlog` | Different concern (axis lifecycle vs. execution) | — |
| 2026-05-29 | `backlog-charter` is renamed to `spec-charter` for CHARTER lifecycle work | The artifact is a project spec axis, not a backlog-only helper | 2026-05-22 |

---

## Capability: spec-grill

**Goal:** A user turns existing repo signals into compact `spec/capabilities.md` capability contracts instead of stopping at a project-wide CHARTER.

**In-scope:**
- `spec-grill` greenfield and brownfield capability authoring
- `extract-signals.js` raw candidate seeding from README, CHARTER, source roots, harness files, and commit scopes
- Capability admission, Goal/Scope interview, Expected Behaviors, and Hard Constraints
- `templates/capabilities.md` and `references/capabilities.md`

**Out-of-scope:**
- Mutating `CHARTER.md` direction or Objectives (`spec-charter` capability)
- Appending runtime Learnings after relay runs (bounded writer contract outside grill)
- Treating directory names or commit scopes as accepted capabilities without interview admission

### Expected Behaviors
- On brownfield repos without `spec/capabilities.md`, `extract-signals.js --repo-root <target> --json` emits deterministic raw candidates and labels signal authority before any contract is accepted.
- `spec-grill <capability-slug>` edits only the named capability block and leaves other capability blocks, Learnings, and Decisions untouched.
- Every accepted Behavior and Hard Constraint passes the authority, distributional, and manipulability axes before it is committed.

### Hard Constraints
- Never write a capability solely because a same-named directory or commit scope exists; raw signals require admission, merge, split, or refusal.
- Never edit `### Learnings` between magic markers during grill; Learnings cleanup is a separate user-approved Learning Action.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-05-29 | Capability authoring moves from hidden `backlog-charter grill` mode to `spec-grill` | Existing-repo users need a discoverable second step after `spec-charter create` | — |

---

## Capability: triage-grooming

**Goal:** Open Issues are classified, related, flagged stale, and aligned to CHARTER Objectives without humans maintaining a parallel triage spreadsheet.

**In-scope:**
- `backlog-triage` collect / relate / stale / report / apply pipeline
- CHARTER-aware Alignment Check (Issue → active Objective mapping)
- Triage snapshots (v2 collector) and the advisory triage report artifact

**Out-of-scope:**
- Deleting Issues (no path provided)
- Cross-repo triage (this capability operates against one repo at a time)
- Automatic mutation without explicit consent (see Hard Constraints)

### Expected Behaviors
- Default `backlog-triage` invocation is **advisory** — it produces a markdown report and never mutates GitHub state. Mutation requires `--apply`.
- Alignment Check maps every open Issue to ≥1 active Objective OR surfaces it as an orphan in the report — no silent drops.
- A `triage-collect` snapshot is reproducible: against unchanged GitHub state, two invocations produce a byte-identical snapshot modulo `collected_at` timestamp.

### Hard Constraints
- Never close, relabel, or comment on an Issue from the triage pipeline without the explicit `--apply` flag — read-only by structural default.
- Never propose closing an Issue that is referenced in an active sprint's Plan or Running Context, regardless of how stale it looks.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-05-22 | Alignment Check is prompt-driven inside `backlog-triage`, not a new `triage-*.js` | Issue → Objective mapping is semantic, unlike the deterministic relate/stale scripts | — |

---

## Capability: task-progress-reporting

**Goal:** A monthly GitHub Progress issue exists with append-only entries from sprint activity, and closes idempotently at month-end.

**In-scope:**
- `progress-sync.js` and the github/relay/render helpers
- Per-month Progress issue body (markers + appended entries)
- `--finalize` month-end behavior

**Out-of-scope:**
- Per-PR comments (separate concern, lives in dev-relay)
- Non-monthly cadences (weekly, quarterly)
- Reactions, likes, or any non-text engagement

### Expected Behaviors
- Against unchanged sprint state, two `progress-sync` invocations produce a byte-identical Progress issue body — idempotent within the month.
- `--finalize` adds the month-end block **and** closes the target month's issue exactly once; a second `--finalize` is a no-op on an already-closed issue.
- Every appended Progress entry carries a sprint reference and a date; bare prose entries are rejected at write time.

### Hard Constraints
- Never overwrite an existing Progress entry once appended — corrections land as a new entry that references the original by date.
- Never `--finalize` a Progress issue whose target month is still the current calendar month.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
