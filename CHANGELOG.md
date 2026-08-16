# Changelog

All notable changes to `dev-backlog` land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry links the GitHub issue (the canonical spec) and the merge PR (the shipped change).

## [Unreleased]

## [0.10.0] — 2026-08-16

Headline: **the GitHub-native core simplification wave.** GitHub Issues become the standalone task-definition and lifecycle authority behind an explicit contract; task specs resolve live with no mirror layer; the pilot that proved it retires required mirrors; and the zero-adopter compatibility machinery goes with them. GitHub Projects was measured as a planning projection and deliberately declined. Triage judgment moves from scripts to the prompt with a deterministic wire validator. Semver: minor bump, 0.9.0 → 0.10.0 — the GitHub path is behavior-compatible throughout; the removals had zero measured adopters. **v1.0.0 is reserved** for the #350 decision bundle (decision + milestone 19 close + O5 reassess + sprint close) so the 1.0 cut cannot precede the milestone's own evidence gate ([#370](https://github.com/sungjunlee/dev-backlog/issues/370)).

### Added

- **GitHub-native authority contract** — `references/authority-contract.md` fixes the reduced product boundary: sole-owner state routing, sprint admission by execution complexity (not duration or estimate), and optional ecosystem integrations that can never acquire write authority. Closes [#345](https://github.com/sungjunlee/dev-backlog/issues/345) / PR [#351](https://github.com/sungjunlee/dev-backlog/pull/351).
- **Live effective-task-spec resolver** — `effective-task-spec.js` resolves task intent, AC, lifecycle, source ref, and a stable SHA-256 content digest from the live Issue (or one explicit `spec_ref`), with no task-mirror consultation and fail-closed behavior when the authority cannot resolve. Closes [#346](https://github.com/sungjunlee/dev-backlog/issues/346) / PR [#352](https://github.com/sungjunlee/dev-backlog/pull/352).
- **Doc-drift check** — `doc-drift-check.js` fails when agent-facing docs (`SKILL.md`, `references/*.md`, `_context.md`) mention a `.js`/`.sh` script that no longer exists under a skill's `scripts/`; its test suite carries a live-repo assertion so CI enforces the net continuously. First slice of the conformance suite ([#367](https://github.com/sungjunlee/dev-backlog/issues/367)).

### Changed

- **Docs/spec cleanup after the 2026-08-15 4-way review** — fixed bundle-escaping doc links, pruned dead `progress-sync` gotchas, resolved dangling `tracker-adapter-design.md` references via the v0.9.0 tag, and amended the charter to rev 13 (evidence-scope denominators; O8/O9 historical stubs). PR [#360](https://github.com/sungjunlee/dev-backlog/pull/360).
- **Shadow-gate amendments A1/A2 (pre-registered)** — the #350 protocol now auto-no-goes on fewer than 10 organic questions, and Arm C is scored on marginal recall/error over Arm B instead of the caching-measuring 20%-faster bar. Closes [#364](https://github.com/sungjunlee/dev-backlog/issues/364).
- **Charter rev 14 — O3 `implemented`** — the 5-minute on-track answer is proven by a timed drill across 5 consumer repos (`docs/o3-drill-2026-08-16.md`); the denominator is repos carrying a spec-charter-format predicate axis. Closes [#363](https://github.com/sungjunlee/dev-backlog/issues/363).

### Removed

- **backlog-triage judgment heuristics** — replaced ~265 lines of semantic judgment (`scanPhraseEdges`/`scanBlocks`/`scanDependsOn`, title-Jaccard duplicates in relate/stale, and rule-based `buildPriorityActions`/`buildMilestoneActions`) with prompt-level rubric guidance. Scripts now emit deterministic signals only (mentions, merged-PR links, dates, labels); the model's judged blocks/depends-on/duplicate edges and priority/milestone proposals enter the report through the new `triage-report.js --model-actions PATH`, keeping anchors, dedupe, and the Apply Checklist deterministic. Net −491 script/test lines. Closes [#358](https://github.com/sungjunlee/dev-backlog/issues/358).

- **Monthly Progress sync and sprint issue publication** — removed 3,758 lines of scripts and dedicated tests after their intended adoption windows finished. Only one monthly issue was ever created (`Progress: April 2026`, #46; none in May–July), and the four sprint issues (#230, #234, #237, #239) were all created on 2026-07-03/04 with none since. No core lifecycle script or dev-relay integration invokes either feature, and `task-progress-reporting` accumulated no Learnings. Closes [#340](https://github.com/sungjunlee/dev-backlog/issues/340).
- **Required task mirrors** — the GitHub-native core now resolves task specification, AC, and lifecycle directly from live Issues. Fresh setup and complete sprint execution require no `backlog/tasks/` or `backlog/completed/`; `sync-pull --legacy-export` remains an explicit one-way diagnostic/rollback boundary. Closes [#347](https://github.com/sungjunlee/dev-backlog/issues/347).
- **Zero-adopter local tracker and generic compatibility machinery** — measured adoption found 0 of 17 consumers selecting a non-default tracker and GitHub remotes in all 18 known consumers. The local JSON store, local lifecycle tests, and generic/local design surface are removed; GitHub failure is fail-loud with no fallback, while Backlog.md remains manual import/explicit export compatibility only. Closes [#348](https://github.com/sungjunlee/dev-backlog/issues/348).

### Notes

- **GitHub Projects: measured and declined.** A live pilot (private Project #5, real Issues #345–#350, two planning cycles) showed no repeated value over milestones + labels — cycle 2 needed four writes plus a read-back (45.8 s) where milestones + labels read the same six Issues in one 4.0 s call, and the sprint Plan already held execution order. No Project profile or abstraction ships. Closes [#349](https://github.com/sungjunlee/dev-backlog/issues/349) / PR [#355](https://github.com/sungjunlee/dev-backlog/pull/355).
- The #350 shadow benchmark (historical-retrieval memory decision) remains open by design; its decision window opens 2026-08-28 and v1.0.0 waits for that bundle.

## [0.9.0] — 2026-07-27

Headline: **`local` is re-tiered from a second tracker into one storage substrate.** 0.8.0 shipped the tracker seam and put `github` and `local` behind it as peers, but they were never the same kind of thing: `github-tracker.js` is 172 lines of translator over `gh`, while `local-tracker.js` had grown to 1,391 — a transactional file database plus a YAML round-trip serializer — because Markdown was chosen as its canonical store. Every tracker we would add next (`gitlab`, `gitea`, `jira`, `linear`) is the translator kind. This release fixes the tier model, deletes the machinery that only existed to support the wrong one, and records a size budget so generalization stays linear. Semver: additive-to-neutral for `github`, the only mode in use; breaking for `local`, which has zero adopters and therefore ships no migration path — a deliberate, dated decision taken while that window is open. Minor bump, 0.8.0 → 0.9.0.

Net effect: **−2,556 lines** of scripts and tests (26,984 → 24,428) with no capability removed, and Windows gets *more* honest rather than less.

### Changed

- **Local canonical store is JSON; task files become derived mirrors** (BREAKING for `tracker: local`). `backlog/local-tracker.json` is the sole local authority, and `backlog/tasks/` + `backlog/completed/` are one-way projections — exactly the role they already held in `github` mode. The binding rule: a mirror is **never** parsed back as truth, so the `tracker-task-truth` "never two co-authoritative stores" constraint is satisfied more cleanly than the shape it replaces, where Markdown was canonical *and* hand-editable *and* lock-arbitrated at once. `local-tracker.js` 1,391 → 597 lines. Closes [#321](https://github.com/sungjunlee/dev-backlog/issues/321) / PR [#327](https://github.com/sungjunlee/dev-backlog/pull/327).
- **Concurrent-write safety is revision-based compare-and-swap, not a lock.** The store carries a monotonic `revision`; a mutation reads at N, writes a complete fsynced candidate, and claims `.local-tracker.revision-{N+1}.json` through no-overwrite `link`. A losing writer *helps the existing claim across* — it is content-complete — then re-reads and retries within a bounded budget; exhaustion fails closed rather than writing unconditionally. Crash debris is inert by construction: revision-identified files a later writer can complete or clean, never a mutual-exclusion primitive left in an unknown state.
- **Tracker selection moves to `backlog/.tracker`**, a single line read with `readFileSync().trim()` and validated fail-closed. `config.yml` is never written again — which is what removes the reason its 395-line selection tokenizer existed. It is still *read* for its other fields through the unchanged `lib.js:parseSimpleYaml`. Legacy compatibility is exact: an existing `tracker:` key with no `.tracker` resolves as before and is migrated on the next setup run without editing `config.yml`, so the PR #301 Learning "preserve user YAML bytes" now holds permanently and trivially; a repo with neither still defaults to `github` with zero migration. `setup-dev-backlog.js` 1,007 → 567 lines. Closes [#322](https://github.com/sungjunlee/dev-backlog/issues/322) / PR [#328](https://github.com/sungjunlee/dev-backlog/pull/328).
- **Adapter tiering and a size budget are now design contract**: a seam (`tracker.js`), remote translators (**≤200 lines**, holding no durable state), and exactly one storage substrate (`local`). The rule — *an adapter over 200 lines is not an adapter, it is a substrate; stop and re-tier* — is what keeps "support more trackers" a linear cost. Recorded in the [historical v0.9.0 adapter design](https://github.com/sungjunlee/dev-backlog/blob/v0.9.0/docs/tracker-adapter-design.md) § "Adapter Tiers (v0.9.0)". Closes [#320](https://github.com/sungjunlee/dev-backlog/issues/320) / PR [#326](https://github.com/sungjunlee/dev-backlog/pull/326).

### Fixed

- **The three Windows lock-race skips are gone, not re-documented.** `t.skip("Windows prevents replacing an open lock pathname; Ubuntu covers this POSIX race")` existed only because of the allocation lock. Compare-and-swap has no lock pathname to reclaim, so the replacement coverage runs on Ubuntu and Windows alike. Windows-specific code stays at 68 lines (`bash-runtime.js` 44 + `portable-path.js` 24) plus the `windows-latest` CI job.
- **Every rename is followed by a parent-directory fsync**, degrading gracefully on platforms that refuse directory handles. Without it a process-kill test passes while a power loss still loses the directory entry.
- **Contract prose that had gone false is corrected.** `SKILL.md`'s Core Contracts and two narrative lines still described local task files as canonical records after #321 made that untrue, and shipped that way on main. Corrected together with `references/process.md`. Closes [#323](https://github.com/sungjunlee/dev-backlog/issues/323) / PR [#329](https://github.com/sungjunlee/dev-backlog/pull/329).

### Removed

- The `setup-dev-backlog.js` YAML tokenizer (~395 lines: `tokenizeYamlLine`, `consumeQuotedToken`, `decodeDoubleQuotedScalar`, `validAnchorOrAliasName`, `isBlockScalarHeader`, `mutateTrackerText`, and friends). It existed to write one key into user-owned YAML safely; nothing writes that file now.
- The `local-tracker.js` frontmatter YAML parse/serialize path and its verbatim-byte / CRLF preservation, together with the binary test fixtures that made the test file register as binary.
- `.local-tracker.lock`, its `pid:token` stamps, liveness probing, retry loop, close compensation, rollback, and split-store detection.

### Notes

Three review rounds on #321 and three on #322 each found a real defect, and the pattern was consistent: **deleting code without knowing why it existed returns you to the same place.** Atomic rename replaces the lock's torn-write prevention but not its serialization of the read-modify-write critical section (round 1 lost concurrent writers); a minimal lock fixes that but reintroduces exactly the crash-wedge the original pid stamps and liveness probing existed to survive (round 2); and replacing the selection tokenizer with a simple reader silently accepted configs that previously failed closed (both #322 rounds). Acceptance criteria were amended in the open — in the issues themselves — rather than letting an implementation quietly contradict a frozen contract.

Two guarantees are narrowed on purpose and recorded as decisions, not gaps: the legacy `config.yml` read **refuses** escape-encoded quoted keys and explicit mapping keys instead of decoding them, and a `tracker:` sequence inside a multi-line quoted scalar may be over-counted. Both err toward an actionable refusal, never toward a silent selection. Decoding them would mean rebuilding the tokenizer this release deletes; measured 2026-07-26, exactly one repository of the 19 consuming dev-backlog carries a `tracker:` key at all, and this release migrates it.

`legacy-tracker.js` (125 lines) is deliberately its own module: it is a deletable unit that disappears wholesale when legacy support is dropped.

## [0.8.0] — 2026-07-20

Headline: **configured tracker adapters** — exactly one adapter owns canonical task truth per repo, keeping the existing `github` flow as the frozen compatibility baseline and adding a fully offline `local` canonical store beside it (objectives O8/O9) — and **multi-track sprints**, which retire the global "exactly one active sprint" singleton in favor of component-partitioned concurrent tracks (epic [#289](https://github.com/sungjunlee/dev-backlog/issues/289), PRD `docs/prd-2026-07-multi-track-sprints.md`). Windows also becomes a verified first-class execution path, alongside the writing-great-skills review batch. Semver: the tracker/local-adapter surface and the multi-track model are additive and backward-compatible with 0.7.0 GitHub flows (single-track output and GitHub behavior stay byte-identical), so this is a minor bump — 0.7.0 → 0.8.0.

### Added

- **Configured tracker adapters — one adapter owns canonical task truth per repo** (O9). A deep, capability-gated tracker seam: the active tracker is chosen only from configuration, defaults to `github` when unset, resolution probes only the configured adapter, and the runtime never silently switches trackers on failure. Required lifecycle and identity stay small; milestones, PR relationships, mirrors, progress issues, comments, and closing semantics are capability-gated and fail closed before mutation. Design frozen in the [historical v0.8.0 adapter design](https://github.com/sungjunlee/dev-backlog/blob/v0.8.0/docs/tracker-adapter-design.md). Shipped in phases:
  - `tracker.js` configured-only resolver plus the core adapter seam; the `local` slot stays explicitly unavailable until the local adapter lands. Interface and `gh`-coupling inventory were frozen first. Closes [#272](https://github.com/sungjunlee/dev-backlog/issues/272) / PR [#280](https://github.com/sungjunlee/dev-backlog/pull/280) and [#273](https://github.com/sungjunlee/dev-backlog/issues/273) / PR [#282](https://github.com/sungjunlee/dev-backlog/pull/282).
  - Tracker-neutral task identity: one exact task-ref seam for GitHub `#N` and local `{PREFIX}-N[.M]`; sprint state exposes additive `tracker`/`id`/`ref` and retains GitHub `issue_number` so existing consumers keep working. Closes [#274](https://github.com/sungjunlee/dev-backlog/issues/274) / PR [#284](https://github.com/sungjunlee/dev-backlog/pull/284).
  - GitHub behind the seam: the GitHub adapter owns required lifecycle translation and confines direct `gh` calls to itself plus explicit milestone/mirror/progress/PR/comment/triage transports; core callers resolve only the configured tracker. GitHub is now the frozen compatibility baseline. Closes [#275](https://github.com/sungjunlee/dev-backlog/issues/275) / PR [#286](https://github.com/sungjunlee/dev-backlog/pull/286).
- **Offline local canonical tracker** — a fully offline `local` adapter that owns canonical list/read/create/update/close with `{PREFIX}-N[.M]` refs via the shared exact parser. Allocation inspects both active and completed tasks and never overwrites on collision or concurrency (atomic lock capture, crash recovery, fail-closed filesystem handling). In `local` mode task files are canonical (they stay GitHub mirrors in `github` mode); provider-only features fail with actionable, path-aware capability errors. Closes [#276](https://github.com/sungjunlee/dev-backlog/issues/276) / PR [#298](https://github.com/sungjunlee/dev-backlog/pull/298).
- **Idempotent tracker-aware setup / migration contract** — `setup-dev-backlog` may detect evidence only to *recommend* an initial tracker choice; the persisted selection is immutable unless the user explicitly changes it, and re-runs preserve every user-authored byte (zero-migration, byte-idempotent re-runs). Closes [#277](https://github.com/sungjunlee/dev-backlog/issues/277) / PR [#301](https://github.com/sungjunlee/dev-backlog/pull/301).
- **Dual-mode acceptance proof** (O8) — a table-driven end-to-end proof runs the same core sprint cycle in both `github` and `local` mode, asserting exact provider argv, persisted tracker state, decimal local refs, path-aware capability errors, and GitHub backward-compatibility. Closes [#278](https://github.com/sungjunlee/dev-backlog/issues/278) / PR [#303](https://github.com/sungjunlee/dev-backlog/pull/303).
- **Multi-track sprints**: multiple `status: active` sprints may coexist when their scopes are disjoint (`component:` equality or `scope:` path-glob collision = overlap, decided by the single shared `scopesOverlap` predicate in `lib.js`). Single-track behavior is byte-identical (G4, fixture-verified against the pre-change scripts). Shipped in phases:
  - `sprint-state.js` `schema_version` 2 — `active_sprints[]` portfolio plus retained back-compat single-track fields; `--track`/`--component` selectors; `OVERLAPPING_TRACKS` replaces `MULTIPLE_ACTIVE_SPRINTS` and fires only on scope collision. `next.sh`/`status.sh`/`context-hook.sh` render a portfolio for N>1 disjoint tracks. Closes [#291](https://github.com/sungjunlee/dev-backlog/issues/291) / PR [#300](https://github.com/sungjunlee/dev-backlog/pull/300).
  - `backlog-doctor.js` `active_sprint` check rewritten as scope-disjointness (pass portfolio / fail overlap with `Active tracks overlap on scope` / informational warn for ≥2 scopeless tracks); per-sprint checks fan out per active track with track-tagged verdicts. Closes [#293](https://github.com/sungjunlee/dev-backlog/issues/293) / PR [#305](https://github.com/sungjunlee/dev-backlog/pull/305).
  - Lifecycle track-awareness: `sprint-init.js` refuses only overlapping scopes (new `--scope "glob[,glob]"` flag; scopeless-next-to-scopeless warns and allows), `sprint-close.sh --track`, `sprint-mirror.js --track`. Closes [#292](https://github.com/sungjunlee/dev-backlog/issues/292) / PR [#307](https://github.com/sungjunlee/dev-backlog/pull/307).
  - `spec/capabilities.md` singleton invariant amended to track-partitioned disjointness via a human-gated `spec-grill` pass; `spec/system-map.md` Core Flows de-singularized. Closes [#294](https://github.com/sungjunlee/dev-backlog/issues/294) / PR [#308](https://github.com/sungjunlee/dev-backlog/pull/308).
  - Docs: `references/integration-contract.md` documents JSON `schema_version: 2`, the portfolio/overlap contract, and track resolution for relay-merge updates and capability-Learnings appends; SKILL.md, `references/process.md`, and README prose flipped off the singleton. Closes [#295](https://github.com/sungjunlee/dev-backlog/issues/295).

### Fixed

- **Windows first-class verification**: repository text is pinned to LF,
  platform-neutral paths serialize with `/` (portable-path seam), Node
  acceptance tests explicitly resolve Git for Windows Bash instead of ambient
  WSL Bash, and CI now runs the full Node and Bash suites on Windows. The POSIX
  open-file lock-race tests stay enforced on Ubuntu and are documented as
  Windows skips rather than weakening the production lock invariant. Closes
  [#311](https://github.com/sungjunlee/dev-backlog/issues/311) / PR [#314](https://github.com/sungjunlee/dev-backlog/pull/314).
- `sprint-close.sh` now parses flags position-independently: `--dry-run` without a positional backlog-dir works, positional/flags accept any order, and unknown `--*` flags fail loud instead of being treated as a directory; smoke-test coverage added. Closes [#247](https://github.com/sungjunlee/dev-backlog/issues/247) / PR [#251](https://github.com/sungjunlee/dev-backlog/pull/251).
- `sprint-init.test.js` "produces frontmatter compatible with find_active_sprint" no longer depends on the test runner's cwd containing a `spec/` directory (pre-existing rot from the #258 omission change; pinned with explicit overrides). Fixed in PR [#307](https://github.com/sungjunlee/dev-backlog/pull/307).

### Changed

- `skills/dev-backlog/references/process.md` re-synced with the SKILL.md execution contract: Complete routes through `sprint-close.sh` (doctor + reassess signal), Plan step 0 states the refuse rule instead of an inline `status:` flip, and Plan covers `component:` and `sprint-init.js`. Closes [#243](https://github.com/sungjunlee/dev-backlog/issues/243).
- `VERSION` and CHANGELOG link definitions aligned with v0.7.0 (`[0.6.0]`/`[0.7.0]` compare links, `[Unreleased]` repointed). Closes [#244](https://github.com/sungjunlee/dev-backlog/issues/244).
- `skills/backlog-triage/SKILL.md` documents the snapshot v2 collect flags `--with-comments` / `--with-closed-issues` and which report signals need them. Closes [#245](https://github.com/sungjunlee/dev-backlog/issues/245).
- `skills/dev-backlog/SKILL.md` reassess-signal paragraph compressed to defer accounting details to `references/integration-contract.md`; craftkit provenance stated once per SKILL.md; stale "upcoming backlog-doctor" wording moved to present tense. Closes [#246](https://github.com/sungjunlee/dev-backlog/issues/246).
- `skills/dev-backlog/references/integration-contract.md` component example swapped to the live `sprint-execution` slug. Closes [#248](https://github.com/sungjunlee/dev-backlog/issues/248).
- `docs/spec-system-design.md` gains a dated provenance note for the 0.7.0 spec-* move; the dead research-survey link now cites git history (pre-`cd31a2b`) with the restore decision tracked in [craftkit#124](https://github.com/sungjunlee/craftkit/issues/124). Closes [#249](https://github.com/sungjunlee/dev-backlog/issues/249).
- `spec/system-map.md` "Executable Evidence" now records the O8/O9 acceptance proof (PR [#303](https://github.com/sungjunlee/dev-backlog/pull/303)) as merged and both objectives `[validated]`, and adds a Project-Wide Invariant for Windows-first-class execution; the [historical v0.8.0 adapter design](https://github.com/sungjunlee/dev-backlog/blob/v0.8.0/docs/tracker-adapter-design.md) twin line is synced. Closes [#315](https://github.com/sungjunlee/dev-backlog/issues/315) / PR [#317](https://github.com/sungjunlee/dev-backlog/pull/317).
- Signal-driven reassess: the post-multi-track reassess cycle ran and found no v0.8.0 release blockers (backlog-doctor 8/8, capabilities-doctor ok, component-lint clean); report `backlog/triage/2026-07-20-reassess.md`. Closes [#312](https://github.com/sungjunlee/dev-backlog/issues/312) / PR [#316](https://github.com/sungjunlee/dev-backlog/pull/316).

### Removed

- The former `spec-charter`, `spec-system-map`, and `spec-grill` capability blocks in `spec/capabilities.md` (maintainer-approved follow-up to the 0.7.0 move; their contracts live with the craftkit skill definitions). Legacy sprint `component: "spec-grill"` handles cleared with dated notes.

## [0.7.0] — 2026-07-04

Headline: the `spec-charter`, `spec-grill`, and `spec-system-map` skills moved to [craftkit](https://github.com/sungjunlee/craftkit), which is now their canonical home.

### Removed

- `skills/spec-charter/`, `skills/spec-grill/`, and `skills/spec-system-map/`. These copies had diverged from craftkit's fork since 2026-06-21; craftkit's lineage carried the newer scripts and normalization, so it wins ownership.

### Added

- `skills/dev-backlog/references/backlog-boundaries.md` — the backlog-side file boundaries split out of the old shared `spec-axis.md`, scoped to `dev-backlog` and `backlog-triage`.

### Changed

- `README.md` — replaced the in-repo spec-series quick start with a pointer to install `spec-charter`/`spec-grill`/`spec-system-map` from craftkit, and adjusted the maintainer discovery check to expect two skills.
- `skills/dev-backlog/SKILL.md` — related-skills intro now references the spec-* skills by name (installed via craftkit) instead of broken in-repo sibling links; the spec-axis boundary pointer now resolves from the installed `spec-charter` skill, with backlog-side boundaries pointing at the new `references/backlog-boundaries.md`.
- `skills/backlog-triage/SKILL.md` — `../spec-charter/references/*` citations now note they resolve from the installed `spec-charter` skill (shipped with craftkit); backlog-side boundaries now point at `../dev-backlog/references/backlog-boundaries.md`.

## [0.6.0] — 2026-05-29

Headline: the `backlog-charter` surface splits into the spec-series skills (`spec-charter`, `spec-grill`, `spec-system-map`), and active spec artifacts consolidate under `spec/`. (Entry materialized retroactively from the former Unreleased section when 0.7.0 shipped.)

### Changed

- Consolidated active spec-series artifacts under `spec/`: `spec/charter.md`, `spec/system-map.md`, and `spec/capabilities.md`, with root `CHARTER.md` retained only as a legacy fallback. Added `spec-system-map`, `spec/README.md`, dogfood `spec/system-map.md`, and script/docs compatibility updates. Closes [#161](https://github.com/sungjunlee/dev-backlog/issues/161), [#162](https://github.com/sungjunlee/dev-backlog/issues/162), [#163](https://github.com/sungjunlee/dev-backlog/issues/163), [#164](https://github.com/sungjunlee/dev-backlog/issues/164), and [#165](https://github.com/sungjunlee/dev-backlog/issues/165).
- Split the old `backlog-charter` surface into the spec-series skills `spec-charter` and `spec-grill`. `spec-charter` owns charter create/amend/reassess; `spec-grill` owns `spec/capabilities.md` capability-contract authoring. Closes [#157](https://github.com/sungjunlee/dev-backlog/issues/157), [#158](https://github.com/sungjunlee/dev-backlog/issues/158), and [#159](https://github.com/sungjunlee/dev-backlog/issues/159).

## [0.5.0] — 2026-05-22

Headline: new sibling skill **`backlog-charter`** for creating and amending an opt-in `CHARTER.md` project reference axis. Closes [#84](https://github.com/sungjunlee/dev-backlog/issues/84), [#85](https://github.com/sungjunlee/dev-backlog/issues/85), [#86](https://github.com/sungjunlee/dev-backlog/issues/86), [#87](https://github.com/sungjunlee/dev-backlog/issues/87), [#88](https://github.com/sungjunlee/dev-backlog/issues/88), [#89](https://github.com/sungjunlee/dev-backlog/issues/89), and [#90](https://github.com/sungjunlee/dev-backlog/issues/90).

### Added

- New skill `skills/backlog-charter/` with a `CHARTER.md` template, create/amend contract, amendment guidance, and shared alignment mapping reference.
- `skills/backlog-charter/templates/charter.md` defines the 3-tier charter format: Direction, Predicates, and History.
- `skills/backlog-charter/references/alignment.md` defines semantic issue→Objective mapping, drift severities, and coverage-line format for triage and sprint planning.
- `skills/backlog-charter/references/amendment.md` defines Tier 1 challenge checks, Tier 2 proof-gate rules, the no-rubber-stamp rule, and bloat checks.

### Changed

- `skills/dev-backlog/scripts/sprint-init.js` now emits `objectives: []` in sprint frontmatter, with tests updated to lock the field.
- `skills/dev-backlog/SKILL.md` documents CHARTER-aware sprint planning and graceful degradation when no repo-root `CHARTER.md` exists.
- `skills/backlog-triage/SKILL.md` now includes a prompt-driven CHARTER-aware Alignment Check and `## Alignment` report section.

## [0.4.0] — 2026-04-18

Headline: new sibling skill **`backlog-triage`** for interactive open-issue grooming. Closes epic [#59](https://github.com/sungjunlee/dev-backlog/issues/59).

### Added

- New skill `skills/backlog-triage/` with five scripts that run from the target project root:
  - `triage-collect.js` — snapshots open issues to `backlog/triage/.cache/<ISO-timestamp>.json` ([#61](https://github.com/sungjunlee/dev-backlog/issues/61) / PR [#68](https://github.com/sungjunlee/dev-backlog/pull/68))
  - `triage-relate.js` — emits mentions / blocks / depends-on / duplicate-candidate edges from a snapshot ([#62](https://github.com/sungjunlee/dev-backlog/issues/62) / PR [#72](https://github.com/sungjunlee/dev-backlog/pull/72))
  - `triage-stale.js` — flags inactive + wontfix + invalid candidates with structured evidence ([#63](https://github.com/sungjunlee/dev-backlog/issues/63) / PR [#71](https://github.com/sungjunlee/dev-backlog/pull/71))
  - `triage-report.js` — renders a single markdown report with anchor+checkbox proposals; idempotent via `.bak` ([#64](https://github.com/sungjunlee/dev-backlog/issues/64) / PR [#74](https://github.com/sungjunlee/dev-backlog/pull/74))
  - `triage-apply.js` — parses the report and applies accepted actions via `gh`; default dry-run, `--apply` gated behind confirmation, idempotent via JSONL audit log ([#65](https://github.com/sungjunlee/dev-backlog/issues/65) / PR [#75](https://github.com/sungjunlee/dev-backlog/pull/75))
- Anchor-comment contract `<!-- triage:<verb> #N key="value" ... -->` paired with a visible checkbox. Verb set: `close`, `revisit`, `close-duplicate`, `set-priority`, `assign-milestone`. Grammar documented in `skills/backlog-triage/references/apply.md`.
- Four authoritative reference docs: `classification.md`, `relationships.md`, `stale.md`, `apply.md` — each opens with a `**Purpose.**` statement tying it to the script it specifies.
- Skill scaffold with SKILL.md execution contract ([#60](https://github.com/sungjunlee/dev-backlog/issues/60) / PR [#67](https://github.com/sungjunlee/dev-backlog/pull/67)).

### Changed

- `skills/dev-backlog/references/workflow-patterns.md` — `## Backlog Review` section now delegates to the `backlog-triage` skill; the prior `gh`-only recipe is preserved as a labeled `### Manual fallback` ([#66](https://github.com/sungjunlee/dev-backlog/issues/66) / PR [#77](https://github.com/sungjunlee/dev-backlog/pull/77)).
- `skills/dev-backlog/SKILL.md` — added a related-skills cross-link to `skills/backlog-triage/SKILL.md` ([#66](https://github.com/sungjunlee/dev-backlog/issues/66) / PR [#77](https://github.com/sungjunlee/dev-backlog/pull/77)).
- `README.md` — new `## Backlog Triage` section framing when to reach for `backlog-triage` vs `dev-backlog`, with the full review → apply command preview.
- Snapshot shape — every snapshot issue now carries a `body` field so downstream scanners can stay pure snapshot consumers without re-fetching from `gh` ([#69](https://github.com/sungjunlee/dev-backlog/issues/69) / PR [#70](https://github.com/sungjunlee/dev-backlog/pull/70)).

### Deferred

Tracked for post-0.4.0 work — not blocking the release.

- [#73](https://github.com/sungjunlee/dev-backlog/issues/73) — snapshot v2 via GraphQL: `closing_prs`, optional `--with-comments` / `--with-closed-issues`. Unblocks the `merged-pr-link` edge, the `PR already merged` stale signal, and the `duplicate of closed` stale signal.
- [#76](https://github.com/sungjunlee/dev-backlog/issues/76) — end-to-end integration test for `triage-apply` against a disposable scratch repo, gated behind `TRIAGE_APPLY_INTEGRATION=1`.

## [0.3.0] — baseline

Initial public release — `dev-backlog` skill with sprint files, task files, progress-sync, sync-pull, and Claude Code + Codex compatibility. See the initial commit (`0df6a1f`) for the baseline scope.

[Unreleased]: https://github.com/sungjunlee/dev-backlog/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/sungjunlee/dev-backlog/releases/tag/v0.3.0
