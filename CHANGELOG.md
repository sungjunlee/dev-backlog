# Changelog

All notable changes to `dev-backlog` land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry links the GitHub issue (the canonical spec) and the merge PR (the shipped change).

## [Unreleased]

## [0.8.0] — 2026-07-20

Headline: **configured tracker adapters** — exactly one adapter owns canonical task truth per repo, keeping the existing `github` flow as the frozen compatibility baseline and adding a fully offline `local` canonical store beside it (objectives O8/O9) — and **multi-track sprints**, which retire the global "exactly one active sprint" singleton in favor of component-partitioned concurrent tracks (epic [#289](https://github.com/sungjunlee/dev-backlog/issues/289), PRD `docs/prd-2026-07-multi-track-sprints.md`). Windows also becomes a verified first-class execution path, alongside the writing-great-skills review batch. Semver: the tracker/local-adapter surface and the multi-track model are additive and backward-compatible with 0.7.0 GitHub flows (single-track output and GitHub behavior stay byte-identical), so this is a minor bump — 0.7.0 → 0.8.0.

### Added

- **Configured tracker adapters — one adapter owns canonical task truth per repo** (O9). A deep, capability-gated tracker seam: the active tracker is chosen only from configuration, defaults to `github` when unset, resolution probes only the configured adapter, and the runtime never silently switches trackers on failure. Required lifecycle and identity stay small; milestones, PR relationships, mirrors, progress issues, comments, and closing semantics are capability-gated and fail closed before mutation. Design frozen in `docs/tracker-adapter-design.md`. Shipped in phases:
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
- `spec/system-map.md` "Executable Evidence" now records the O8/O9 acceptance proof (PR [#303](https://github.com/sungjunlee/dev-backlog/pull/303)) as merged and both objectives `[validated]`, and adds a Project-Wide Invariant for Windows-first-class execution; the `docs/tracker-adapter-design.md` twin line is synced. Closes [#315](https://github.com/sungjunlee/dev-backlog/issues/315) / PR [#317](https://github.com/sungjunlee/dev-backlog/pull/317).
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

[Unreleased]: https://github.com/sungjunlee/dev-backlog/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/sungjunlee/dev-backlog/releases/tag/v0.3.0
