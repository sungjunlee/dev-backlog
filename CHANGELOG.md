# Changelog

All notable changes to `dev-backlog` land here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry links the GitHub issue (the canonical spec) and the merge PR (the shipped change).

## [Unreleased]

Nothing yet.

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

[Unreleased]: https://github.com/sungjunlee/dev-backlog/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/sungjunlee/dev-backlog/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/sungjunlee/dev-backlog/releases/tag/v0.3.0
