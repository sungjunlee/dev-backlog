# dev-backlog Capabilities

The middle layer between [`charter.md`](charter.md) and the active sprint. Each block describes one subsystem-worth of work with a frozen-ish contract and a structurally bounded live-feedback channel.

Mutation discipline matches [`docs/spec-system-design.md`](../docs/spec-system-design.md): Goal/Scope/Behaviors/HardConstraints are human-gated via `spec-grill`; `## Learnings` is appended only by a bounded `append-learnings` writer between magic markers; `## Decisions` is append-only by convention.

Capability headings are strict routing handles. Use one lowercase slug after `## Capability:` and point sprint `component:` frontmatter at exactly one of those slugs. Put secondary touches in sprint prose, not in frontmatter.

The former `spec-charter`, `spec-system-map`, and `spec-grill` capability blocks were removed on 2026-07-05: those skills moved to craftkit in 0.7.0 (charter Decision 2026-07-04), so their contracts live with the skill definitions there. This file keeps only capabilities this repo owns.

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
- 2026-07-03 (milestone 10, PRs #221-#227): execution-substrate sprint delivered via 7 relay runs — JSON read surfaces, actor-agnostic consumption contract, backlog-doctor, recovery gate; key lesson: commit the sprint file at open or dispatch worktrees cannot see it
- 2026-07-03 (run #issue-216-20260703140629614-43632130): relay-merge of PR #229 [PR #229]
- 2026-07-05 (run #issue-247-20260705054603535-f8fa8f1d): Bash scripts must parse flags position-independently like the Node scripts; positional-first ${1:-default} broke flag-only invocation (sprint-close) [PR #251]
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |

---

## Capability: backlog-sync

**Goal:** GitHub Issues and local backlog state mirror each other in both directions — issues into `backlog/tasks/*.md`, the active sprint out to a machine-managed mirror issue — without either direction ever diverging human-authored content.

**In-scope:**
- `sync-pull.js` (with and without `--update`), task-file frontmatter (number, title, labels, milestone, assignees)
- AC checkbox preservation in task bodies for non-machine-managed issues
- `sprint-mirror.js`: explicit publish of the single active sprint to a marker-identified (`<!-- dev-backlog:sprint-mirror sprint=<slug> -->`) read-only mirror issue
- Idempotent re-runs in both directions against unchanged state

**Out-of-scope:**
- Writing to human-authored GitHub content (issue bodies without a dev-backlog machine marker, comments, labels, state)
- Monthly progress-issue lifecycle (`task-progress-reporting` capability)
- Cross-repo mirroring

### Expected Behaviors
- `sync-pull` on a fresh checkout produces `backlog/tasks/*.md` with no token prompt beyond `gh auth` already being valid.
- `sync-pull --update` refreshes frontmatter while leaving AC checkbox state intact, **except** for issues whose incoming body starts with the `<!-- dev-backlog:progress-issue month= -->` marker — those are intentionally overwritten because their bodies are machine-managed.
- Running `sync-pull` twice against unchanged GitHub state produces byte-identical task files on the second run.
- Repeated `sprint-mirror` runs resolve to the same marker-identified issue via find-by-marker body upsert — never a duplicate mirror issue; the sprint file stays canonical and untouched.
- `sprint-mirror` exits non-zero when there is no single unambiguous active sprint (zero or multiple actives); it never guesses, and it renders state only through `sprint-state.js` — no second markdown parser.

### Hard Constraints
- The only GitHub writes this capability may perform are creating, and body-editing, issues that carry its own `dev-backlog:sprint-mirror` marker; human-authored issue bodies, comments, labels, and issue state are untouchable.
- Never overwrite a non-machine-managed task body during `--update`; only frontmatter is replaced.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-05-23 | `--update` preserves AC bodies for everything except machine-managed `progress-issue` markers | local AC checkboxes are user state; machine-managed bodies have no user state to lose | — |
| 2026-07-04 | Capability widens from read-only pull to bidirectional mirroring; the read-only bright line narrows to "human-authored content is untouchable" | sprint-mirror (PR #233, SSOT decision charter rev.4) writes only marker-identified machine-managed bodies; push-direction mirroring belongs with mirroring, not with monthly journaling | — |

---

## Capability: triage-grooming

**Goal:** Open Issues are classified, related, flagged stale, aligned to charter Objectives, and reviewed for next action without humans maintaining a parallel triage spreadsheet.

**In-scope:**
- `backlog-triage` collect / relate / stale / report / apply pipeline
- Charter-aware Alignment Check (Issue → active Objective mapping)
- Spec-aware Decision Review (`Do Now`, `Shape First`, `Defer`, `Drop / Close`)
- Triage snapshots (v2 collector) and the advisory triage report artifact

**Out-of-scope:**
- Deleting Issues (no path provided)
- Cross-repo triage (this capability operates against one repo at a time)
- Automatic mutation without explicit consent (see Hard Constraints)

### Expected Behaviors
- Default `backlog-triage` invocation is **advisory** — it produces a markdown report and never mutates GitHub state. Mutation requires `--apply`.
- Alignment Check maps every open Issue to ≥1 active Objective OR surfaces it as an orphan in the report — no silent drops.
- Decision Review uses charter, capabilities, system map, active sprint context, and triage signals as bounded evidence, then emits non-mutating recommendations.
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
| 2026-05-31 | Decision Review is prompt-driven and report-only inside `backlog-triage` | Final backlog recommendations need semantic spec evidence; `triage-apply.js` should remain limited to explicit issue mutations | — |

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
