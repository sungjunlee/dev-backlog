# Project Docs

Design records and pilot documentation. `spec/*` holds durable project
contracts; `skills/*/SKILL.md` and `references/` hold the agent execution
contract; this directory holds the records of how current behavior was decided
and proven. Git history is the authoritative record — docs here are kept for
traceability, not re-read as live contracts.

## Living

Referenced by current code, specs, or open work. Read these before changing
related behavior.

| File | What it records | Referenced by |
| --- | --- | --- |
| [`compatibility-subtraction.md`](compatibility-subtraction.md) | Subtraction proof for the removed zero-adopter local tracker and generic compatibility machinery (#348). | README, `references/process.md`, `references/scripts.md`, `spec/system-map.md` |
| [`historical-retrieval-shadow.md`](historical-retrieval-shadow.md) | Active shadow benchmark (epic #350, open) comparing legacy mirror grep vs live sources vs disposable reports before any project-memory product decision. Amended 2026-08-16 (#364). | epic #350 |
| [`mirrorless-github-pilot.md`](mirrorless-github-pilot.md) | Runbook proving live GitHub Issues plus sprint files need no `backlog/tasks/` or `backlog/completed/` (#347). Retirement candidate once #350 closes — the shadow doc cites it only through pinned commit links. | `historical-retrieval-shadow.md` (pinned links) |
| [`spec-system-design.md`](spec-system-design.md) | Layered spec-system architecture (charter → system-map → capabilities → learnings) and mutation discipline. | `spec/capabilities.md` |
| [`spec-history.md`](spec-history.md) | Archive of the spec axis's externalized history: rev-14 objective texts with statuses/proofs, charter and capability Decisions rows, and moved Learnings (#377). | `spec/charter.md`, `spec/capabilities.md`, `spec/README.md` |
| [`o3-drill-2026-08-16.md`](o3-drill-2026-08-16.md) | Timed on-track drill across 5 consumer repos — the proof behind charter rev 14's O3 `implemented` status (#363). | `docs/spec-history.md` |
| [`conformance/`](conformance/) | Dated cross-model conformance runs for prompt-judged surfaces (#367); retention rule in its README. | `conformance/README.md`, #367 |

## Removed

Deleted docs stay reachable through git history and release tags. Immutable
records — completed sprint files, CHANGELOG entries, triage reports, and dated
`spec/*` Decisions rows — may still cite these by their old paths; that is
expected and not drift.

| File | Removed by | Last published version |
| --- | --- | --- |
| `tracker-adapter-design.md` | #348 subtraction (PR #354, commit `3865a37`) | [v0.9.0](https://github.com/sungjunlee/dev-backlog/blob/v0.9.0/docs/tracker-adapter-design.md) |
| `prd-2026-07-adoption-hardening.md` | 2026-08-16 docs cleanup — shipped in 0.8.0 (charter O7 validated) | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/prd-2026-07-adoption-hardening.md) |
| `prd-2026-07-autonomous-execution.md` | 2026-08-16 docs cleanup — shipped in 0.8.0 (charter O4/O5 validated) | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/prd-2026-07-autonomous-execution.md) |
| `prd-2026-07-multi-track-sprints.md` | 2026-08-16 docs cleanup — shipped in 0.8.0 (epic #289) | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/prd-2026-07-multi-track-sprints.md) |
| `unattended-consumer-pilot.md` | 2026-08-16 docs cleanup — pilot concluded (#238) | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/unattended-consumer-pilot.md) |
| `github-projects-projection-pilot.md` | 2026-08-16 docs cleanup — pilot concluded: Projects optional, not core (#349) | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/github-projects-projection-pilot.md) |
| `plans/2026-07-16-windows-portability-design.md` | 2026-08-16 docs cleanup — shipped in 0.8.0 | [v0.10.0](https://github.com/sungjunlee/dev-backlog/blob/v0.10.0/docs/plans/2026-07-16-windows-portability-design.md) |
| `superpowers/` (2026-05 charter-reference-axis plan + spec) | 2026-08-16 docs cleanup — superseded by the in-repo spec axis and the craftkit `spec-*` skills | [v0.10.0](https://github.com/sungjunlee/dev-backlog/tree/v0.10.0/docs/superpowers) |
