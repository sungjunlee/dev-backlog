# Changelog

All notable changes to `dev-backlog` land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry links the GitHub issue (the canonical spec) and the merge PR (the shipped change).

## [Unreleased]

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

[Unreleased]: https://github.com/sungjunlee/dev-backlog/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/sungjunlee/dev-backlog/releases/tag/v0.3.0
