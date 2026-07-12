# dev-backlog Capabilities

The middle layer between [`charter.md`](charter.md) and the active sprint. Each block describes one subsystem-worth of work with a frozen-ish contract and a structurally bounded live-feedback channel.

Mutation discipline matches [`docs/spec-system-design.md`](../docs/spec-system-design.md): Goal/Scope/Behaviors/HardConstraints are human-gated via `spec-grill`; `## Learnings` is appended only by a bounded `append-learnings` writer between magic markers; `## Decisions` is append-only by convention.

Capability headings are strict routing handles. Use one lowercase slug after `## Capability:` and point sprint `component:` frontmatter at exactly one of those slugs. Put secondary touches in sprint prose, not in frontmatter. Since multi-track sprints (PRD 2026-07, epic #289), `component:` also serves as a track's scope key: concurrent active tracks partition by `component:` equality — or by explicit `scope:` path globs when no component axis fits — one axis per track, never both.

The former `spec-charter`, `spec-system-map`, and `spec-grill` capability blocks were removed on 2026-07-05: those skills moved to craftkit in 0.7.0 (charter Decision 2026-07-04), so their contracts live with the skill definitions there. This file keeps only capabilities this repo owns.

---

## Capability: tracker-task-truth

**Goal:** A repository explicitly selects one canonical task tracker and completes the same core sprint cycle without hidden synchronization or provider-specific assumptions leaking into sprint execution.

**In-scope:**
- Persisted tracker selection and availability probing
- Normalized list/read/create/update/close task lifecycle
- Stable task identity, display references, links, and capability reporting
- `github` and `local` adapters

**Out-of-scope:**
- Synchronizing multiple canonical trackers
- GitLab, Gitea, Forgejo, Jira, Linear, or Notion adapters before the seam is proven
- Provider-specific milestones, PR links, mirror issues, progress issues, and close-keyword semantics

### Expected Behaviors
- Setup persists exactly one tracker selection, and every later command uses that selection or fails with an actionable availability error.
- `github` and `local` expose the same normalized task lifecycle and stable task references needed by create, plan, work, and complete operations.
- Capability discovery reports optional features explicitly so callers either invoke supported behavior or return a clear unsupported-capability result.

### Hard Constraints
- Runtime never silently changes the configured tracker or treats two task stores as co-authoritative.
- The normalized interface never fabricates provider semantics; unsupported milestones, PR relationships, publications, and closing links fail clearly.

### Learnings
<!-- LEARN:BEGIN -->
- 2026-07-11 (Sprint tracker-seam, PRs #271/#280/#282/#284/#286): Configured tracker resolution must never use availability failure to choose another store; missing configuration is a stable GitHub compatibility rule, while explicit local remains unavailable until persistence lands.
- 2026-07-11 (PR #284): Exact task-ref matching needs tests for numeric collisions, decimal descendants, punctuation, alphanumeric suffixes, hyphenated foreign prefixes, and numeric slugs; visual regex review missed several of these boundaries.
- 2026-07-11 (PR #286): Moving GitHub calls behind a provider seam must preserve marker ownership in dry-run as well as apply mode, keep injection/argv/output compatibility, and confine direct `gh` calls to the lifecycle adapter or explicit capability transports.
- 2026-07-11 (PR #298): A canonical local Markdown store needs exact-ID allocation across active and completed tasks, fail-closed filesystem boundaries, metadata-only body preservation, and crash-recoverable archive semantics; merely replacing `gh` commands is not sufficient.
- 2026-07-12 (PR #301): Setup must treat tracker-less repositories as legacy GitHub authority, pin before an explicit switch, preserve user YAML bytes, and never use provider evidence as runtime selection or migration authority.
- 2026-07-12 (#278 implementation proof): One table-driven subprocess matrix can freeze the legacy GitHub cycle and prove the offline local cycle; optional-feature failures need one typed serializer so JSON and human boundaries carry identical remediation before effects.
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-07-11 | Admit `tracker-task-truth` as a separate capability from `backlog-sync` | canonical ownership and task lifecycle are required in every mode; mirroring and publication are optional transport behaviors | — |

---

## Capability: sprint-execution

**Goal:** An agent or human resuming work mid-session reads the active sprint file and acts on its in-flight items without re-asking what is going on.

**In-scope:**
- `backlog/sprints/*.md` body + frontmatter (status, milestone, objectives, and the track-scope key: `component:` or `scope:`)
- Checkbox state machine: `[ ]` not started → `[~]` in flight → `[x]` done
- `sprint-init.js`, `sprint-close.sh`, `find_active_sprint`/`resolve_track`, `next.sh`, `status.sh`

**Out-of-scope:**
- Tasks outside the active sprint (those live in `backlog/tasks/`)
- Sprint *content* authoring — humans write the Plan; this capability runs it
- Backlog grooming or stale-issue detection (`triage-grooming` capability)

### Expected Behaviors
- No two sprint files with `status: active` declare overlapping scope — overlap fails loud through the one shared `scopesOverlap` predicate (`component:` equality or `scope:` path-prefix collision; surfaced by `sprint-init` refusal, `sprint-state` `OVERLAPPING_TRACKS`, and the doctor's `Active tracks overlap on scope` verdict). Disjoint-scope tracks coexist as a portfolio; a single active track behaves exactly as before; two scopeless actives cannot be proven disjoint and surface an informational doctor warning.
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
| 2026-07-12 | Replace the single-active-sprint invariant with track-partitioned scope disjointness (epic #289, PRD `docs/prd-2026-07-multi-track-sprints.md`; human-gated pass #294) | disjoint-scope tracks remove the false serialization of unrelated work while overlap stays fail-loud through one shared predicate; single-track behavior is byte-identical (G4) | pre-#289 "exactly one active sprint" behavior |

---

## Capability: backlog-sync

**Goal:** Canonical tracker tasks are materialized locally and supported execution state is explicitly published without either direction ever diverging human-authored content.

**In-scope:**
- `sync-pull.js` (with and without `--update`), task-file frontmatter, and adapter-provided task identity
- AC checkbox preservation in task bodies for non-machine-managed issues
- `sprint-mirror.js`: explicit publish of one active sprint track (`--track` selects when multiple are active) to a marker-identified (`<!-- dev-backlog:sprint-mirror sprint=<slug> -->`) read-only mirror issue
- Idempotent re-runs in both directions against unchanged state

**Out-of-scope:**
- Canonical task ownership and lifecycle (`tracker-task-truth` capability)
- Writing to human-authored provider content (task bodies without a dev-backlog machine marker, comments, labels, state)
- Monthly progress-issue lifecycle (`task-progress-reporting` capability)
- Cross-repo mirroring

### Expected Behaviors
- `sync-pull` on a fresh checkout produces `backlog/tasks/*.md` with no token prompt beyond `gh auth` already being valid.
- `sync-pull --update` refreshes frontmatter while leaving AC checkbox state intact, **except** for issues whose incoming body starts with the `<!-- dev-backlog:progress-issue month= -->` marker — those are intentionally overwritten because their bodies are machine-managed.
- Running `sync-pull` twice against unchanged GitHub state produces byte-identical task files on the second run.
- Repeated `sprint-mirror` runs resolve to the same marker-identified issue via find-by-marker body upsert — never a duplicate mirror issue; the sprint file stays canonical and untouched.
- `sprint-mirror` mirrors exactly one track per invocation and never guesses: one active track needs no flag; multiple active tracks require `--track <slug>` and exit non-zero without it (naming the tracks); zero actives or a no-match selector exit non-zero. It renders state only through `sprint-state.js` — no second markdown parser.

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
| 2026-07-12 | `sprint-mirror` becomes per-track: `--track` selects among multiple active tracks instead of failing on any second active (epic #289; human-gated pass #294) | the per-slug marker already made mirrors track-idempotent; only selection needed to change, and refusing to guess is preserved | 2026-07-04 single-active mirror selection |

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
