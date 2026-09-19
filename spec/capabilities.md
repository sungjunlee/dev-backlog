# dev-backlog Capabilities

The middle layer between [`charter.md`](charter.md) and the active sprint.

Capability headings are routing handles. Sprint `component:` is a free
track-scope string; by convention it names a capability heading here so relay
Learnings can route, but nothing lints it. Concurrent active tracks partition by
`component:` equality or by `scope:` globs — one axis per track, never both.

Retired capabilities (never restore as living contracts): `backlog-sync` last
text at git [`4fea158`](https://github.com/sungjunlee/dev-backlog/blob/4fea158/spec/capabilities.md);
`spec-charter` / `spec-system-map` / `spec-grill` (skills moved to craftkit).

Mutation: [`spec/README.md`](README.md) § Mutation.

---

## Capability: tracker-task-truth

**Goal:** A repository uses one declared task authority — GitHub Issues by default; the Backlog.md CLI or GitLab by a one-line `.dev-backlog/.tracker` — as the standalone task-definition and lifecycle authority without mirrors, projections, or execution tools becoming co-authoritative.

**In-scope:**
- Live task read/create/close lifecycle through the declared authority's CLI (`gh`, `backlog`, or `glab`), performed by the session; the verbs are the SKILL.md Task Authority table
- Stable `#N` identity (task N in the declared authority), plus the authority's native URLs, labels, milestone, assignees, and relationships when it has them
- Fail-loud CLI availability and authentication errors: a failed live read stops execution

**Out-of-scope:**
- A tracker abstraction, or an authority inferred from installed CLIs or switched at runtime (the authority is only ever the declared `.tracker` line, `github` when the file is absent): adding an authority means adding a table row (documented CLI verbs) plus its entry in the scripts' allow-list, and a row needs a measured consumer — the GitLab row is the one standing exception (unmeasured as of 2026-09-18, carried because it is one table row and one allow-list entry, no adapter, dropped at the next reassess if still unpinned); the `files` adapter code and ports stay parked at `v0.11.0`, the GitLab adapter at `a8ddb7d`
- Task mirrors, diagnostic exports, or any local copy of Issue state used as authority (triage reports are advisory, never authority)
- Scripts that wrap the authority CLI for reading tasks, resolving specifications, or seeding Plans; scripts never invoke `gh`, `backlog`, or `glab` for task state (`triage-apply` and `--close-milestone` are the GitHub-only exceptions)
- GitHub Projects fields as task specification or lifecycle state

### Expected Behaviors
- Task work reads the live task with the declared authority's Read verb (`gh issue view --json body,comments` by default); on GitHub the newest comment titled `## Agent Brief` overrides the body, and in every authority a `spec_ref:` line in the body naming a file or URL overrides the body (on GitHub, the Agent Brief as well). If that read fails, execution stops fail-closed; the authority is never inferred from which CLI is installed.
- Create, plan, work, and complete operations use the `#N` identity and update lifecycle state only through the declared authority's CLI.
- Optional features report their availability explicitly; absence of Relay, Projects, or the spec axis does not block the core Issue → PR path.

### Hard Constraints
- Never dual-write task specification or lifecycle state.
- Never treat sprint text, Projects fields, retrieval output, or generated memory as fallback authority after an authority read failure.
- Never write task bodies, comments, labels, or state from a script; every authority mutation is a deliberate CLI call the session makes. The one scripted exception is `triage-apply`, which mutates only anchors a human checked.

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
| 2026-08-16 | Absorb `backlog-sync` into this capability as the legacy-export behavior/constraint set (#377) | one diagnostic flag does not warrant a standalone capability contract; the bright line ("human-authored provider content is untouchable", exports never read back) belongs with the authority it protects | standalone `backlog-sync` capability |
| 2026-08-17 | Freeze the leftover export/compat runtime: no new features on `sync-pull`, `legacy-tracker.js`, or `{PREFIX}-N` parsing without a measured consumer (#379) | these are deletable compatibility seams, not a product to grow | implicit seam expansion |
| 2026-09-15 | Skill execution root is `.dev-backlog/` so it does not collide with Backlog.md's `backlog/` layout (`tasks/`, `docs/`, `config.yml`). The skill does not read `backlog/tasks/` and does not write it except explicit `sync-pull --legacy-export` (diagnostic/rollback). Sprint close does not archive `backlog/tasks/` (#412) | sharing `backlog/` made "natural Backlog.md support" false from day one; one execution root, no dual-write | implicit `backlog/` as skill root |
| 2026-09-15 | Freeze tracker adapter ports; diagnostic export moves to `exports/github-issues/`; adapter failure is fail-closed with no local-file fallback (#413) | freeze the seam before files/GitLab adapters; leftover `backlog/tasks/` is not product authority and not a Backlog.md compatibility layer | #412 export still writing `backlog/tasks/` |
| 2026-09-15 | `.tracker=files` is a first-class chosen authority via the Backlog.md CLI (#414) | same sprint loop, different substrate; CLI-only; fail-closed if the CLI is missing; never co-authority with GitHub; never parse `backlog/tasks/*.md` as a product API | GitHub-only `TRACKER_KEYS` |
| 2026-09-15 | `.tracker=gitlab` is a first-class forge adapter via `glab` on the frozen ports (#415) | thin CLI translation like github-tracker.js; identities `gitlab#N`; fail-closed; never co-authority; Forgejo/Gitea share forge field shapes and stay follow-ups | `TRACKER_KEYS` without gitlab |
| 2026-09-17 | GitHub-only again (G1/G2, charter rev 19, epic #440): `files` adapter, ports, `.tracker` selection, and `BACK-N` parked at `v0.11.0`; diagnostic export deleted; task reading is a session `gh` call, not a script (gate 2026-09-17) | no measured consumer for `files` or the export; tracker generality is a charter Non-Goal | 2026-09-15 `files` row; 2026-09-15 ports-freeze row; 2026-08-16/17 export rows |
| 2026-09-17 | `gitlab` is parked: no measured consumer (no `glab` installed, no repo pins the key); `TRACKER_KEYS` returns to `github`, `files`; the adapter stays retrievable at `a8ddb7d` (#421, #424; gate 2026-09-17) | charter measured-consumer rule | 2026-09-15 gitlab row |
| 2026-09-18 | Task authority generalized without code (charter rev 20, epic #472): `.dev-backlog/.tracker` is one line the session reads (absent = `github`; `backlog`/`files`; `gitlab`), the SKILL.md Task Authority table carries the read/create/close verbs, scripts stay authority-neutral (`sprint-state` JSON `tracker` field reflects the line; `--close-milestone` refuses non-GitHub). `backlog` is measured (maintainer repos on the Backlog.md CLI with no GitHub remote); `gitlab` is a documented, unmeasured row | GitHub-less and self-hosted use are maintainer needs; the remaining coupling was prose | 2026-09-17 G1/G2 row's prose (adapter parking stands); 2026-09-17 gitlab-parked row's prose (adapter stays at `a8ddb7d`) |
| 2026-09-19 | Clarification of the 2026-09-18 row: "without code" means without an adapter — v0.15.0 added 56 authority-neutral script lines (`readTaskAuthority` allow-list, JSON `tracker` field, `--close-milestone` guard, setup line) | the row was published with v0.15.0 and stays; the wording was wrong | wording of the 2026-09-18 row |

---

## Capability: sprint-execution

**Goal:** An agent or human resuming work mid-session reads the active sprint file and acts on its in-flight items without re-asking what is going on.

**In-scope:**
- `.dev-backlog/sprints/*.md` body + frontmatter (status, milestone, objectives, and the track-scope key: `component:` or `scope:`)
- Checkbox state machine: `[ ]` not started → `[~]` in flight → `[x]` done
- `sprint-init.js`, `sprint-close.sh`, `find_active_sprint`/`resolve_track`, `next.sh`, `status.sh`

**Out-of-scope:**
- Tasks outside the active sprint (their specification and lifecycle remain in the task authority)
- Sprint *content* authoring — humans write the Plan; this capability runs it
- Backlog grooming or stale-issue detection (`triage-grooming` capability)
- Simple work whose complete continuity fits in one Issue and its PR

### Expected Behaviors
- The default Issue → implementation → PR → closure path creates no sprint. A sprint is admitted only for ordered multi-Issue batches, delegated/parallel handoff, cross-Issue or cross-session context, or concurrent track coordination; duration, estimate, milestone membership, and Relay presence alone never trigger one.
- No two sprint files with `status: active` declare overlapping scope — overlap fails loud through the one shared `scopesOverlap` predicate (`component:` equality or `scope:` path-prefix collision; surfaced by `sprint-init` refusal, `sprint-state` `OVERLAPPING_TRACKS`, and the doctor's `Active tracks overlap on scope` verdict). Disjoint-scope tracks coexist as a portfolio; a single active track behaves exactly as before; once more than one track is active, any track without a declared axis cannot be proven disjoint and surfaces an informational doctor warning.
- Every `[~]` line carries a PR or branch ref in-line, or an explicit "no work yet" annotation — never an unmoored `[~]`.
- One successful `sprint-close.sh` invocation flips the sprint to `status: completed` and appends final Progress; it runs only when every Plan item is `[x]` or explicitly struck in Progress.

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
| 2026-09-15 | Sprint files, tracker pin, skill config, and triage artifacts live under `.dev-backlog/` (#412) | keep execution continuity off Backlog.md's `backlog/` tree; one root, no dual-write | implicit `backlog/sprints` as the sprint hub |
| 2026-09-17 | The doctor keeps only shared-state checks (active-track overlap, sprint shape, unmoored `[~]`, in-flight staleness, context bloat); the reassess-signal counter and tracker-selection checks retire (epic #440, #446; gate 2026-09-17) | reassess is a human judgment at sprint close, not a counter | rev-15 reassess cadence bookkeeping |
| 2026-09-17 | Spec-axis linters removed: `objectives:` and `component:` are unchecked metadata; `component:` is a free track-scope string compared only by `scopesOverlap`; no line budget on this file (#421, #426; gate 2026-09-17) | same upkeep species as the rev-15 status ladder; no consumer read their output | `component:` must resolve to a `## Capability:` heading |
| 2026-09-18 | The doctor keeps three checks — `active_sprint` (track overlap), `sprint_shape`, `in_flight_trace` (unmoored `[~]`); `in_flight_staleness` and `context_bloat` are deleted (v0.13.0, epic #456, #458). `next.sh` / `status.sh` render through `sprint-state.js --format text`, so the next batch has one implementation (v0.14.0, epic #467, #468) | staleness and bloat were judgments the session makes by reading the file; two parsers of one sprint file could disagree on the next batch | 2026-09-17 doctor row (five checks); bash-side batch selection in `next.sh` |

---

## Capability: triage-grooming

**Goal:** Open Issues are classified, related, flagged stale, aligned to charter Objectives, and reviewed for next action without humans maintaining a parallel triage spreadsheet.

**In-scope:**
- `backlog-triage` report written by the session from `gh` reads (fixed eight-section shape, anchors) and the `triage-apply` human-gated pipeline
- Charter-aware Alignment Check (Issue → Objective mapping)
- Spec-aware Decision Review (`Do Now`, `Shape First`, `Defer`, `Drop / Close`)
- The advisory triage report artifact under `.dev-backlog/triage/`

**Out-of-scope:**
- Deleting Issues (no path provided)
- Cross-repo triage (this capability operates against one repo at a time)
- Automatic mutation without explicit consent (see Hard Constraints)

### Expected Behaviors
- Default `backlog-triage` invocation is **advisory** — it produces a markdown report and never mutates GitHub state. Mutation requires `--apply`.
- Alignment Check maps every open Issue to ≥1 Objective OR surfaces it as an orphan in the report — no silent drops.
- Decision Review uses charter, capabilities, system map, active sprint context, and triage signals as bounded evidence, then emits non-mutating recommendations.

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
| 2026-09-17 | The collect/relate/stale/report scripts are deleted after a fixture-backed real-execution A/B showed the scripts-less report equivalent on both models (epic #440, #433; artifacts docs/conformance/2026-09-17-cc/433/) | scripts wrapped gh and recomputed judgments the session makes; only triage-apply passes the keep test | 2026-05-22/31 script-vs-prompt split |
