# PRD: Multi-Track Sprints — Component-Partitioned Concurrent Execution

Status: draft
Date: 2026-07-11
Scope: cross-repo — `dev-backlog` (owns the invariant) and `dev-relay` (coordinated consumer). Coordinated change per `references/integration-contract.md` ("Changes to checkbox, annotation, path, or section patterns parsed by `dev-relay` must be coordinated with `dev-relay` before landing").

## 1. Summary

dev-backlog enforces **exactly one `status: active` sprint per `backlog/sprints/` directory**. This is not a documentation convention — it is a hard invariant enforced at four layers: `sprint-init.js` throws on a second active sprint, `backlog-doctor.js` fails on multiple active, `sprint-state.js` throws `MULTIPLE_ACTIVE_SPRINTS`, and the shell resolvers (`status.sh`, `next.sh`) exit non-zero. dev-relay duplicates the same singleton assumption in `append-learnings.js:resolveActiveSprint`.

The invariant does two distinct jobs, and only one of them is essential:

1. **Orient determinism** (essential) — a fresh agent asking "what do I work on next?" must get a unique answer from files alone.
2. **Cross-track conflict avoidance** (incidental) — because a single planner orders every batch, parallel dispatch is file-disjoint for free ("intra-batch items MUST be mutually parallel-safe").

Job (1) does not actually require a global singleton — it requires that the "next work" question be *unambiguous per track*. Job (2) is the real cost of going multi-track, and the singleton was silently paying it.

This PRD replaces the global singleton with a **track-partitioned** model: multiple sprints may be `status: active` concurrently, each owning a disjoint scope. "Multiple active sprints" stops being an error state and becomes a **portfolio**. Orient determinism is preserved by parameterizing the "next" question by track; conflict avoidance is preserved by declaring per-track scope and warning on overlap.

Crucially, **a repo with one active sprint behaves identically to today** — multi-track semantics only engage when a second track is opened. Existing repos need zero migration.

## 2. Background — What the Singleton Costs Today

The motivating goal (owner, 2026-07): in an AI-agent-driven workflow, throughput comes from opening as many *controllable* parallel tracks as possible. "Sprint" is a friendly name; the underlying object is really "one of several concurrent workstreams in an org." The singleton forces every goal through one serialization point, which is the wrong default when the executor is a fleet of agents, not one human.

dev-backlog already has two layers of parallel *execution* (within-sprint parallel-safe batches; `[~]` in-flight markers + `relay-fleet` fan-out). What it lacks is parallel *tracks* — independent Goal/Plan/Progress units running at once. That is the gap this PRD closes.

### Enforcement inventory (what must change)

**dev-backlog:**

| Location | Current behavior | Nature |
|---|---|---|
| `scripts/sprint-init.js:206` | throws `Active sprint already exists … Close it before creating another` | hard refusal |
| `scripts/sprint-state.js:321` | throws `MULTIPLE_ACTIVE_SPRINTS` | hard, JSON fail-loud |
| `scripts/backlog-doctor.js:220` | `active_sprint` check `fail` on `Multiple active sprint files found` | hard check |
| `scripts/lib.sh:26` (`find_active_sprint`) | returns 1-or-fail; code 2 on multiple | shell resolver |
| `scripts/status.sh:28`, `next.sh:33` | print "Multiple active sprints found. Resolve…" and exit non-zero | shell resolver |
| `scripts/context-hook.sh:30` | one-line summary via `find_active_sprint` (single) | PreToolUse hook |
| `scripts/sprint-close.sh:50` | closes "the" active sprint | lifecycle |
| `scripts/sprint-mirror.js:91` | mirrors `state.active_sprint` (singular) | GitHub mirror |
| SKILL.md:43,95 + `references/process.md:27` | "Exactly one sprint … refuse a second" | contract prose |

Note: `lib.sh` already ships `find_active_sprints` (plural, sorted list) — the plural primitive exists; only the consumers assume singular.

**dev-relay:**

| Location | Current behavior | Nature |
|---|---|---|
| `skills/relay-merge/scripts/append-learnings.js:150` (`resolveActiveSprint`) | scans `backlog/sprints/`, returns `multiple_active_sprints` failure on >1 | **only hard-coded singleton in dev-relay** |
| `skills/relay-merge/SKILL.md:80` | prose: "If `backlog/sprints/` has an active sprint file, update it" (Plan `[x]`, Progress, Running Context) | agent-driven, singleton by prose |
| `skills/relay/SKILL.md:42` | prose: "If `backlog/sprints/` has an active sprint, read Running Context and batch info" | agent-driven, singleton by prose |
| `skills/relay-merge/scripts/sprint-close-report.js:93` | already takes `--sprint <path>` | **already agnostic — the model to follow** |

The Plan-checkbox and Progress writes are performed by the agent following `relay-merge/SKILL.md` prose, not by a deterministic script. Only capability-Learnings append (`append-learnings.js`) and sprint-close reporting (`sprint-close-report.js`) are scripted — and one of those two is already path-parameterized. So the dev-relay code surface to change is **one function**; the rest is prose that must teach "which track."

## 3. Goals and Non-Goals

### Goals

- G1. Multiple sprints may be `status: active` concurrently in one `backlog/sprints/`, each a self-contained Goal/Plan/Running Context/Progress track.
- G2. Orient determinism is preserved: `orient`/`next` with no argument yields either a single deterministic answer (one active track) or an explicit portfolio view (many tracks); `next <track>` is always deterministic.
- G3. Cross-track file conflicts are made visible: each active track may declare a scope, and the doctor warns/fails on overlap between active tracks — re-establishing at the portfolio layer the disjointness the singleton gave for free.
- G4. **Zero migration for single-track repos.** A repo with one active sprint produces byte-identical **human-readable text** output — `status.sh`/`next.sh` non-JSON, `backlog-doctor` text lines, and exit codes — to pre-change behavior. The `--json` surface is explicitly **exempt**: it changes by design (`schema_version` 1→2, new `active_sprints[]`), and its back-compat is preserved by the retained `active_sprint` field (per R5), not by byte-identity. Every "byte-identical" claim in this PRD means text output.
- G5. dev-relay operations accept an explicit track/sprint handle (path or component); single-active discovery remains a fallback convenience, not a hard requirement. This is the agnostic seam — dev-relay stays usable against any track without assuming a global singleton.
- G6. The multi-track scenario is a permanent regression gate (eval prompt + smoke coverage), written before the resolvers change.

### Non-Goals

- **No automatic conflict resolution.** The doctor *detects* scope overlap; it does not merge, reorder, or serialize tracks. Two tracks that must touch the same files remain a human/planner decision.
- **No cross-track scheduler or dependency graph.** Tracks are independent by construction. Inter-track ordering is out of scope; if two workstreams depend on each other they belong in one track's batched Plan.
- **No change to checkbox states, trace grammar, section headings, or PR-annotation regex.** The sprint-file grammar is frozen. Only frontmatter gains an optional field, and `active_sprint(s)` JSON shape extends (schema_version bump).
- **No GitHub-side multi-sprint object.** GitHub Issues remain the source of truth; tracks are a local execution-hub concept. `sprint-mirror.js` mirrors per-track, not a new aggregate issue.
- **No unbounded fan-out.** "Open as many as possible" is bounded by *disjoint coherent scope*, not by a hard cap. The natural limit is the number of non-overlapping scopes the repo actually has; the doctor enforces disjointness, not a count.
- **No daemon, no silent sync, no background mutation** (unchanged project stance).

## 4. The Reframe — Track-Partitioned Sprints

A **track** is an independently-active sprint. Track *identity* and track *scope* are separate concerns:

- **Identity** = the sprint slug (its filename stem, e.g. `2026-07-auth-system`). Always unique, always present, works for cold adopters with no spec axis. This is how `next <track>` addresses a track.
- **Scope** = what the track owns, for conflict detection. Declared via one of, in priority order:
  1. `component:` — the existing frontmatter capability handle (maps to `spec/capabilities.md`). When present, two active tracks MUST NOT share a `component:`.
  2. `scope:` — a new **optional** frontmatter list of path prefixes/globs the track owns (e.g. `scope: ["src/auth/**", "src/session/**"]`). Used when there is no capability axis but the owner still wants overlap detection.
  3. none — a track with no declared scope. Permitted (cold-adopter minimum), but the doctor cannot prove disjointness, so it emits an informational note rather than a guarantee.

The uniqueness invariant moves **down one level**: not "one active sprint globally," but "**no two active tracks with overlapping scope.**" Disjoint tracks coexist freely; overlapping tracks are the new failure signal.

### Behavior by active-track count

| Active tracks | `orient` / `next` (no arg) | `next <track>` | Doctor `active_sprint` check |
|---|---|---|---|
| 0 | today's "no active sprint → plan" path | n/a | pass (normal between sprints) |
| 1 | **identical to today** — single deterministic answer | resolves to that track | pass |
| N>1, disjoint scope | **portfolio view**: each track + its next batch | deterministic per track | pass |
| N>1, overlapping scope | portfolio view **+ overlap warning** | deterministic per track | **fail** (overlap), was "multiple = fail" |

The row that changes meaning is the last two: "multiple active" is no longer intrinsically an error. It is an error *only when scopes overlap*.

## 5. Design — dev-backlog Side

### 5.1 Frontmatter

Add one optional field; everything else unchanged.

```yaml
status: active
component: "auth-system"        # existing; now also the primary scope key
scope: ["src/auth/**"]          # NEW, optional; overlap-detection when no component axis
```

`scope:` is omitted entirely when unused (same omission discipline as `component:`/`objectives:` for cold adopters — see `references/spec-fallback.md`). An absent `scope:` is never an error.

**Scope-overlap predicate (one shared implementation).** Overlap detection is needed independently by three consumers — `sprint-state.js` (`OVERLAPPING_TRACKS`), `sprint-init.js` (refuse-on-overlap), and `backlog-doctor.js` (`fail`). Define it **once** as `scopesOverlap(a, b)` in `lib.js` and have all three import it, to avoid three divergent checks: `component:` → exact string equality; `scope:` globs → normalized path-prefix containment (overlap iff either normalized prefix contains the other). Two scopeless tracks are "cannot prove disjoint," handled as `warn`, not overlap.

### 5.2 Resolution — portfolio-aware, single-active-identical

- `lib.sh`: consumers switch from `find_active_sprint` (1-or-fail) to `find_active_sprints` (existing plural primitive). A new helper `resolve_track "$SPRINTS_DIR" "$TRACK"` returns the sprint whose slug (or `component:`) matches `$TRACK`.
- `next.sh` / `status.sh`: no arg + 1 active → today's output verbatim; no arg + N active → portfolio block (one stanza per track, each with its next batch / in-flight); `--track <slug>` → deterministic single-track output. The "Multiple active sprints found … exit 1" branch is **replaced**, not merely relaxed: N active with disjoint scope is a success.
- `sprint-state.js`: bump `schema_version` to `2`. No arg emits `active_sprints: [ … ]` (array) plus `active_sprint` retained as a back-compat convenience = the sole element when N==1, else `null`. `--track <slug>` / `--component <slug>` emit today's single-object shape (this `--component` output is the cross-repo inverse-resolver contract consumed by dev-relay, §6). `MULTIPLE_ACTIVE_SPRINTS` is no longer thrown for disjoint tracks; it is replaced (via `scopesOverlap`) by an `OVERLAPPING_TRACKS` error only when scopes collide. **Schema-bump atomicity:** raising `SCHEMA_VERSION` breaks every `schema_version !== 1` guard in the same repo — the verified consumer is `sprint-mirror.js:87` (throws today on `!== 1`), which MUST be updated in the same PR or single-track mirror breaks (a G4 violation). `backlog-doctor.js`'s own `SCHEMA_VERSION` is an independent doctor-JSON schema and is unaffected.
- `sprint-init.js`: refusal changes from "any second active" to "second active track whose scope overlaps an existing active track." Disjoint (or explicitly `--track`-named, scope-declared) sprints are created without refusal. Cold-adopter path (no `component`, no `scope`) with an existing scopeless active track → warn-and-allow (can't prove overlap), matching the doctor's informational stance.
- `context-hook.sh`: N==1 → today's one-liner; N>1 → compact `N tracks active: <slug>(next), <slug>(next)…`.
- `sprint-close.sh`: requires `--track <slug>` (or an unambiguous single active) to pick which track to close.
- `sprint-mirror.js`: mirrors per track; `--track` selects, default when N==1.

### 5.3 Doctor

The `active_sprint` check is rewritten as a **disjointness** check:

- 0 active among sprint files present → today's warn/pass logic unchanged.
- 1 active → `pass` ("Exactly one active sprint …") — unchanged string for back-compat of any consumer grepping it.
- N active, all scopes disjoint (by `component:` or `scope:`) → `pass` with a portfolio summary ("N active tracks, scopes disjoint").
- N active, ≥2 scopes overlap → `fail` ("Active tracks overlap on scope: <a> ∩ <b>").
- N active, ≥2 tracks scopeless (cannot prove disjoint) → `warn` (informational; recommends declaring `component:`/`scope:`).

Per-track checks (`sprint_shape`, `in_flight_trace`, `in_flight_staleness`, `objectives_check`, `component_lint`) run **per active track** and report which track each verdict belongs to.

### 5.4 Back-compat guarantee (G4)

Every changed script has a fast path: `if active_count == 1: <emit today's exact output>`. The multi-track code only runs when a second track exists. This is the acceptance test for Phase 1 — a single-track fixture must produce identical **text** output and exit codes before/after (not `--json`, which changes by design per G4). The fixture snapshots `status.sh`/`next.sh` non-JSON text and `backlog-doctor` text; it must never snapshot `--json`.

## 6. Design — dev-relay Side (Coordinated)

The whole point of the agnostic seam (G5): dev-relay should never *discover* "the one active sprint" as a hard requirement. It should take the track as input, with single-active discovery as a convenience default. `sprint-close-report.js --sprint <path>` already proves this works.

**Missing seam to build first.** No relay component currently maps **task/issue → owning sprint**. The two existing directions are `append-learnings.js` (sprint → `component:`) and `sprint-close-report.js` (sprint → checked-off issues). The partitioned model needs the *inverse*: given a merged issue and its `component:`, find the active track whose frontmatter `component:` matches. This resolver does not exist yet and is the enabling primitive for §6.1–§6.3 — build it once (dev-backlog side, exposed via `sprint-state.js --track`/`--component`) and have every relay writer call it instead of scanning for the lone `status: active`.

### 6.1 `append-learnings.js` (the one hard-coded singleton)

- Add `--sprint <path>` (explicit target) and `--track <slug>`/`--component <slug>` (resolve within `backlog/sprints/`). Mirror `sprint-close-report.js`'s flag.
- **Thread the handle through the call site.** `finalize-run.js:671` and `:723` invoke `appendLearnings({ repo, runId, pr, synthesis })` — **only `repo` is passed, no sprint path**, so there is no injection point today. The seam must be added at `finalize-run.js` too: pass the run's resolved track/component down to `appendLearnings`, don't let the leaf self-discover.
- `resolveActiveSprint`: when the run supplies its track/component, resolve to that track. Fall back to single-active discovery only when exactly one is active. Return `multiple_active_sprints` **only** when N>1 *and* no track was supplied — genuine ambiguity, not merely "more than one exists."
- The relay run already knows its issue/task and (via the owning sprint's frontmatter) the `component:`; that is the natural key for the capability-Learning append.

### 6.2 relay-merge / relay prose

- `relay-merge/SKILL.md:80`: "update the active sprint file" → "update the sprint file that owns this task's track — resolve by the task's `component:`/track, or the single active sprint when only one is active." Same for the Plan `[x]`, Progress, and Running Context writes (these are agent-performed, so this is a prose contract change, not code).
- `relay/SKILL.md:42`: same track-resolution clause for the read side.

### 6.3 relay-fleet, relay-dispatch, relay-plan

Audited (2026-07-11 coupling inventory): `relay-fleet.js`/`merge-queue.js` have **zero** direct sprint-file access, and `relay-dispatch`/`relay-review`/`relay-ready`/`relay-config` have none either. `relay-plan` only reads active-sprint notes as *ambient* planning context (`signals.md:27` explicitly downgrades them below GitHub issues), so it does not break under N tracks.

The one real exposure is **indirect and confirmed**: a fleet fans out N children, and every child merges via `finalize-run.js → append-learnings.js`. If a fleet's leaves span *different* components/tracks, each child merge hits `resolveActiveSprint`, sees multiple active sprints, and **fails loud on every merge** (learnings silently stop recording). `relay-fleet/references/design.md:185` records the intended mapping — "one fleet per sprint batch" — but it is unwired, so nothing enforces that a fleet's leaves share a track.

Design consequence: a fleet is invoked **per track**. The batch handed to a fleet already belongs to one track, so the per-sprint batch-as-wave parallel-safety guarantee is unchanged *within* a track. Cross-track parallelism = multiple fleets against different tracks, safe precisely because tracks have disjoint scope (§5.3). Once §6.1's threaded handle lands, each child merge writes to its own track and the fail-loud disappears. relay-fleet should additionally tag each leaf with its owning track so a mixed-track fleet is either rejected up front or routed per-leaf, not left to fail at merge time.

### 6.4 Integration contract (`references/integration-contract.md`)

- Bump the JSON `schema_version` documentation to `2`; document `active_sprints[]` and the retained `active_sprint` back-compat semantics.
- Replace "Ambiguous active sprint state is fail-loud" with "Multiple active tracks are a portfolio; **overlapping-scope** tracks are fail-loud."
- "Relay-Merge Sprint Update Format" and "Capability Learnings Append Contract": add the track-resolution key (task `component:`/track → sprint file) so the writer targets the correct track when N>1.
- The `component:` routing section gains: "When multiple sprints are active, `component:` is also the primary track-scope key; two active tracks MUST NOT share a `component:`."

## 7. Migration Plan

Phased, test-first, back-compat preserved throughout. dev-backlog Phase 1 can land and ship value alone (multi-track planning/orient) before dev-relay Phase 2; single-track relay keeps working in the interim because N==1 discovery is unchanged.

- **Phase 0 — RED gate (dev-backlog).** Add eval prompt + `smoke-test.sh` fixture: "Orient in a repo with two disjoint active tracks (`auth`, `billing`); expected: portfolio view names both tracks and each next batch; `next --track auth` is deterministic; doctor passes." Add an overlap fixture (two tracks sharing a `component:`) expecting doctor `fail`. Both are expected to fail against HEAD — the RED record.
- **Phase 1 — dev-backlog resolvers (additive, back-compat).** Introduce `scope:`; teach `next.sh`/`status.sh`/`sprint-state.js`/`context-hook.sh`/`sprint-init.js`/`sprint-close.sh`/`sprint-mirror.js` the portfolio + `--track` paths; rewrite the doctor `active_sprint` check as disjointness (all three overlap sites consume the one shared `scopesOverlap` helper). Single-track **text** output byte-identical (G4 acceptance); the `sprint-state.js` schema bump lands atomically with the `sprint-mirror.js:87` guard update. SKILL.md/`process.md` prose updated from "exactly one" to "one per track / disjoint scope." Phase 0 evals go GREEN. **Phase 1e (human-gated, per D3):** amend `spec/capabilities.md` (`:28`, `:69`, `:7`) through `spec-grill` to replace the singleton invariant with the disjoint-track invariant, and update `system-map.md:36` descriptive prose. This gates the prose flip — code may land behind it, but the governed invariant must be amended by a human-run spec pass, not by the working agent.
- **Phase 2 — dev-relay (coordinated).** Build the issue/component → sprint resolver (§6 intro); add `--sprint`/`--track`/`--component` to `append-learnings.js` and thread the handle from `finalize-run.js:671/723`; teach relay-merge/relay prose track resolution; tag fleet leaves with their owning track (§6.3). Audit is already complete (2026-07-11 inventory): the only code lock-in is `append-learnings.js`; relay-fleet/dispatch/review/ready/config have no direct sprint access and relay-plan is ambient-only. Integration-contract schema_version → 2. Coordinated per the contract's change-coordination clause.
- **Phase 3 — docs.** README multi-track section; CHANGELOG; charter/system-map note if the "one active sprint" appears as a durable rule there (check `spec/`).

## 8. Risks and Mitigations

- **R1 — Overlap detection is only as good as declared scope.** Tracks with no `component:`/`scope:` can silently touch the same files. *Mitigation:* doctor `warn` on ≥2 scopeless active tracks; docs recommend declaring scope when going multi-track. This is strictly better than today's silence (today you simply cannot have two tracks).
- **R2 — Human attention doesn't scale like agent throughput.** A portfolio of many tracks can exceed what an owner can review coherently. *Mitigation:* the bound is disjoint-coherent-scope, surfaced by the doctor; the portfolio view is designed to be a compact dashboard, not N full dumps. "Controllable line" is the design axis, not raw count.
- **R3 — dev-relay/dev-backlog version skew.** A repo with a Phase-1 dev-backlog (multi-track) and a pre-Phase-2 dev-relay. *Mitigation:* N==1 behavior is identical, so single-track relay is unaffected; multi-track + old relay degrades to "old relay refuses on multiple active" — a loud, safe failure, not silent corruption. Phase 2 removes the refusal.
- **R4 — Back-compat regression in the single-track path.** *Mitigation:* G4 text-output fixture (not `--json`) is a merge gate for Phase 1. A distinct hazard: the `schema_version` bump breaks `sprint-mirror.js:87`'s guard on the single-track path — mitigated by landing the guard update atomically with the bump (§5.2).
- **R5 — `active_sprint` (singular) JSON consumers break.** *Mitigation:* retain `active_sprint` = the sole element when N==1 (the overwhelming existing case), `null` when N>1; new consumers read `active_sprints[]`. schema_version bump signals the change.

## 9. Resolved Decisions

- D1 (was Q1). **Scope grammar.** `component:` is the scope key when present; `scope:` globs are the fallback for repos without a capability axis; a single track never declares both. (`scope:` values are repo-relative path globs.)
- D2 (was Q2). **No auto-derived scope.** `sprint-init.js` requires explicit `scope:`/`component:`; it never infers scope from issues' touched paths, because inference produces false-confident disjointness.
- D3 (was Q3). **The singleton is a durable capability contract, and its amendment is human-gated.** Confirmed in `spec/capabilities.md`: `:28` ("Exactly one sprint file with `status: active` … at all times — concurrent actives fail loud"), `:69` (`sprint-mirror` "exits non-zero when there is no single unambiguous active sprint"), and `:7` (`component:` points at "exactly one" slug). These are `spec-grill`-owned (craftkit) capability contracts, so the amendment routes through the spec skill and is **human-gated** — no working agent silently edits `capabilities.md`. Charter O1 ("read the same active sprint file as the single execution *state*") is about shared state, not sprint count, and is **compatible** with multi-track — each track remains a single shared file. `system-map.md:36` ("writes one active file") is descriptive prose to update, not a governed invariant. This makes the capability amendment a distinct, human-gated workstream (§7 Phase 1e), not a prose edit folded into a code change.
- D4 (was Q4). **Portfolio ordering** is `started:` ascending — stable, cheap, no urgency heuristic.
