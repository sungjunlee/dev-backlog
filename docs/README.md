# Project Docs

Design records and pilot documentation. `spec/*` holds durable project
contracts; `skills/*/SKILL.md` and `references/` hold the agent execution
contract. Git history is the authoritative record — files here are
traceability, not live contracts. Do not re-read them before changing
current behavior.

## Living

Still in the working tree because a living spec or an open cadence points
here.

| File | What it records | Referenced by |
| --- | --- | --- |
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
| `spec-system-design.md` | #379 second-start compaction — mutation rules live in `spec/README.md` | [`c9c7284`](https://github.com/sungjunlee/dev-backlog/blob/c9c728490a8dde4d68fb20d43e17484ac001cf23/docs/spec-system-design.md) |
| `spec-history.md` | #385 — never-reuse list lives in the charter; full texts at [`4fea158`](https://github.com/sungjunlee/dev-backlog/blob/4fea158/spec/charter.md) | [`356ee39`](https://github.com/sungjunlee/dev-backlog/blob/356ee3971730fc4d6f4928520e25795f7bb27e8e/docs/spec-history.md) |
| `o3-drill-2026-08-16.md` | #381 — proof for retired O3; texts at git `4fea158` | [`9b2160c`](https://github.com/sungjunlee/dev-backlog/blob/9b2160cabc0704b6399a0c1bf4eab032e3dd8d09/docs/o3-drill-2026-08-16.md) |
| `mirrorless-github-pilot.md` | #381 after #350 closeout — product is already live Issues + optional sprints | [`9b2160c`](https://github.com/sungjunlee/dev-backlog/blob/9b2160cabc0704b6399a0c1bf4eab032e3dd8d09/docs/mirrorless-github-pilot.md) |
| `compatibility-subtraction.md` | #381 — GitHub-native freeze lives in `authority-contract.md` | [`9b2160c`](https://github.com/sungjunlee/dev-backlog/blob/9b2160cabc0704b6399a0c1bf4eab032e3dd8d09/docs/compatibility-subtraction.md) |
| `historical-retrieval-shadow.md` | #381 — #350 no-go lives in charter Decisions | [`9b2160c`](https://github.com/sungjunlee/dev-backlog/blob/9b2160cabc0704b6399a0c1bf4eab032e3dd8d09/docs/historical-retrieval-shadow.md) |
