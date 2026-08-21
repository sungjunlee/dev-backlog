# dev-backlog Capabilities

The middle layer between [`charter.md`](charter.md) and the active sprint.

Capability headings are routing handles. Sprint `component:` names exactly one
slug. Concurrent active tracks partition by `component:` equality or by
`scope:` globs — one axis per track, never both.

Retired capabilities (never restore as living contracts; last texts at git
[`4fea158`](https://github.com/sungjunlee/dev-backlog/blob/4fea158/spec/capabilities.md)):
`backlog-sync`; `spec-charter` / `spec-system-map` / `spec-grill` (skills moved
to craftkit). Completed sprints that name a retired slug are not re-linted.

Mutation: [`spec/README.md`](README.md) § Mutation.

---

## Capability: tracker-task-truth

**Goal:** A repository uses live GitHub Issues as the standalone task-definition and lifecycle authority without mirrors, projections, or execution tools becoming co-authoritative.

**In-scope:**
- Live GitHub Issue list/read/create/update/close lifecycle
- Stable `#N` identity, Issue URLs, labels, milestone, assignees, and native relationships
- Fail-loud GitHub availability and authentication errors
- The explicit one-way legacy export (`sync-pull --legacy-export`), as a diagnostic/rollback surface only

**Out-of-scope:**
- Synchronizing multiple canonical trackers, or new tracker adapters of any kind
- Task-mirror features, generic tracker parity, or runtime tracker switching
- GitHub Projects fields as task specification or lifecycle state

### Expected Behaviors
- Task work resolves the effective specification from the live GitHub Issue. If that read fails, execution stops; a legacy mirror may be inspected only as diagnostic/rollback evidence and must be human-verified against GitHub before work resumes.
- Create, plan, work, and complete operations use the Issue's stable `#N` identity and update lifecycle state only through GitHub.
- Optional features report their availability explicitly; absence of Relay, Projects, Backlog.md, or the spec axis does not block the core Issue → PR path.
- `sync-pull` refuses without `--legacy-export`; with it, the export is one-way and idempotent, and `--update` refreshes frontmatter while preserving human-authored AC bodies (only machine-marker-managed bodies are overwritten).

### Hard Constraints
- Never dual-write task specification or lifecycle state.
- Never treat task files, sprint text, Projects fields, retrieval output, or generated memory as fallback authority after a GitHub failure.
- Never write to human-authored provider content: task bodies without a dev-backlog machine marker, comments, labels, and issue state are untouchable from the export path.
- A legacy export is never required, never authoritative, and never read back as execution input.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-08-16 | Absorb `backlog-sync` into this capability as the legacy-export behavior/constraint set (#377) | one diagnostic flag does not warrant a standalone capability contract; the bright line ("human-authored provider content is untouchable", exports never read back) belongs with the authority it protects | standalone `backlog-sync` capability |
| 2026-08-17 | Freeze the leftover export/compat runtime: no new features on `sync-pull`, `legacy-tracker.js`, or `{PREFIX}-N` parsing without a measured consumer (#379) | these are deletable compatibility seams, not a product to grow | implicit seam expansion |

---

## Capability: sprint-execution

**Goal:** An agent or human resuming work mid-session reads the active sprint file and acts on its in-flight items without re-asking what is going on.

**In-scope:**
- `backlog/sprints/*.md` body + frontmatter (status, milestone, objectives, and the track-scope key: `component:` or `scope:`)
- Checkbox state machine: `[ ]` not started → `[~]` in flight → `[x]` done
- `sprint-init.js`, `sprint-close.sh`, `find_active_sprint`/`resolve_track`, `next.sh`, `status.sh`

**Out-of-scope:**
- Tasks outside the active sprint (their specification and lifecycle remain in GitHub Issues)
- Sprint *content* authoring — humans write the Plan; this capability runs it
- Backlog grooming or stale-issue detection (`triage-grooming` capability)
- Simple work whose complete continuity fits in one GitHub Issue and its PR

### Expected Behaviors
- The default Issue → implementation → PR → closure path creates no sprint. A sprint is admitted only for ordered multi-Issue batches, delegated/parallel handoff, cross-Issue or cross-session context, or concurrent track coordination; duration, estimate, milestone membership, and Relay presence alone never trigger one.
- No two sprint files with `status: active` declare overlapping scope — overlap fails loud through the one shared `scopesOverlap` predicate (`component:` equality or `scope:` path-prefix collision; surfaced by `sprint-init` refusal, `sprint-state` `OVERLAPPING_TRACKS`, and the doctor's `Active tracks overlap on scope` verdict). Disjoint-scope tracks coexist as a portfolio; a single active track behaves exactly as before; once more than one track is active, any track without a declared axis cannot be proven disjoint and surfaces an informational doctor warning.
- Every `[~]` line carries a PR or branch ref in-line, or an explicit "no work yet" annotation — never an unmoored `[~]`.
- One successful `sprint-close.sh` invocation flips the sprint to `status: completed` and appends final Progress. No task directories are required; checked legacy mirrors are archived only when present.

### Hard Constraints
- Never mutate a sprint's `status: completed` back to `active`; completed sprints are immutable history.
- Never silently delete sprint Plan items — strike them with a Progress entry or convert to `[~]` with a parking note instead.
- Never copy Issue acceptance criteria into a sprint or let sprint checkbox state own Issue lifecycle.

### Learnings
<!-- LEARN:BEGIN -->
- 2026-07-03 (milestone 10, PRs #221-#227): commit the sprint file at open or dispatch worktrees cannot see it
- 2026-07-05 (PR #251): Bash scripts must parse flags position-independently like the Node scripts
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-07-12 | Replace the single-active-sprint invariant with track-partitioned scope disjointness (epic #289; human-gated pass #294) | disjoint-scope tracks remove the false serialization of unrelated work while overlap stays fail-loud through one shared predicate; single-track behavior is byte-identical (G4) | pre-#289 "exactly one active sprint" behavior |
| 2026-07-28 | The cannot-prove-disjoint warning fires when 2+ tracks are active and **any** of them is scopeless, not only when two or more are (#337) | one scopeless track next to a declared one is exactly the unprovable state; when more than one track is active, every track must declare an axis | 2026-07-12 pair-rule warning |
| 2026-07-31 | Admit sprints by execution complexity, not duration; keep simple Issue → PR work sprint-free | requiring a sprint for single-threaded work adds state without resolving a continuity problem | implicit sprint-for-all-work routing |

---

## Capability: triage-grooming

**Goal:** Open Issues are classified, related, flagged stale, aligned to charter Objectives, and reviewed for next action without humans maintaining a parallel triage spreadsheet.

**In-scope:**
- `backlog-triage` collect / relate / stale / report / apply pipeline
- Charter-aware Alignment Check (Issue → Objective mapping)
- Spec-aware Decision Review (`Do Now`, `Shape First`, `Defer`, `Drop / Close`)
- Triage snapshots (v2 collector) and the advisory triage report artifact

**Out-of-scope:**
- Deleting Issues (no path provided)
- Cross-repo triage (this capability operates against one repo at a time)
- Automatic mutation without explicit consent (see Hard Constraints)

### Expected Behaviors
- Default `backlog-triage` invocation is **advisory** — it produces a markdown report and never mutates GitHub state. Mutation requires `--apply`.
- Alignment Check maps every open Issue to ≥1 Objective OR surfaces it as an orphan in the report — no silent drops.
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
