# Project Docs

Design records, PRDs, and pilot documentation. `spec/*` holds durable project
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
| [`mirrorless-github-pilot.md`](mirrorless-github-pilot.md) | Runbook proving live GitHub Issues plus sprint files need no `backlog/tasks/` or `backlog/completed/` (#347). | `references/github-sync.md`, `historical-retrieval-shadow.md` |
| [`historical-retrieval-shadow.md`](historical-retrieval-shadow.md) | Active shadow benchmark (epic #350, open) comparing legacy mirror grep vs live sources vs disposable reports before any project-memory product decision. | epic #350 |
| [`github-projects-projection-pilot.md`](github-projects-projection-pilot.md) | GitHub Projects as an optional read-only projection; concluded optional, not core (#349). | `references/github-sync.md` |
| [`spec-system-design.md`](spec-system-design.md) | Layered spec-system architecture (charter → system-map → capabilities → learnings) and mutation discipline. | `spec/capabilities.md` |
| [`prd-2026-07-multi-track-sprints.md`](prd-2026-07-multi-track-sprints.md) | PRD for component-partitioned concurrent sprint tracks (#289). Carries a historical note where removed machinery is referenced. | `spec/capabilities.md` |

## Historical

Shipped or concluded work; kept for traceability, not re-read as current
behavior.

| File | What it records |
| --- | --- |
| [`prd-2026-07-adoption-hardening.md`](prd-2026-07-adoption-hardening.md) | PRD for standalone first-run for non-author adopters (shipped in 0.8.0). |
| [`prd-2026-07-autonomous-execution.md`](prd-2026-07-autonomous-execution.md) | PRD for machine-legible execution state (shipped in 0.8.0). |
| [`unattended-consumer-pilot.md`](unattended-consumer-pilot.md) | Session contract pilot for unattended consumer sessions (issue #238). |
| [`plans/2026-07-16-windows-portability-design.md`](plans/2026-07-16-windows-portability-design.md) | Windows portability design (shipped in 0.8.0). |
| [`superpowers/`](superpowers/) | 2026-05 superpowers adoption analysis for the charter reference axis (superseded by the in-repo spec axis and the craftkit `spec-*` skills). |
