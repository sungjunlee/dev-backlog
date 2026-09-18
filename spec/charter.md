---
last_amended: 2026-09-18
revision: 20
---

# dev-backlog Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
Humans and AI coding agents (Claude Code, Codex) sharing a project end up
re-deriving "what to do next, with what context, on what already in flight"
from raw tracker state every session. Decisions and in-flight delegation
status leak out of the tracker; continuity across sessions is rebuilt from
scratch each time.

## Approach           <!-- Tier 1 · Direction (human-gated) -->
Use one declared task authority — GitHub Issues by default, the Backlog.md CLI or GitLab by a one-line `.dev-backlog/.tracker` — as the sole task-definition and lifecycle authority. Simple
Issue → PR work needs no sprint. When dependency, delegation, cross-session
context, or parallel-track complexity requires execution continuity, add one
thin, explicit, markdown-only sprint file per admitted track that humans and
agents both read and update. Companion skill `backlog-triage` grooms GitHub
state (GitHub-only) without creating a parallel task truth. `spec/*.md` is an optional
read-only yardstick. No server, no daemon, no hidden state, no silent sync.

This repo is a personal toolkit, not an externally adopted product. Keep the
hot path small enough to start again.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- Tracker abstraction in code — the task authority is one `.dev-backlog/.tracker` line the session reads; scripts stay authority-neutral (`#N` refs, sprint files) and there is no adapter layer, port, export, or per-tracker script. Supported authorities are rows of the SKILL.md Task Authority table (GitHub Issues by default; Backlog.md CLI; GitLab), each a documented set of CLI verbs plus one allow-list entry, not an adapter; a new row needs a **measured consumer** (a maintainer-run repo that pins it and uses it), with one standing exception: the GitLab row is carried unmeasured because it costs one line of prose and no code, and it is dropped at the next reassess if no repo has pinned it. The `files` adapter, the frozen adapter ports, and the diagnostic export stay parked at tag `v0.11.0`. No multi-master sync, no SaaS connectors (Jira, Linear, Notion).
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- Silent sync or dual-write state — every authority mutation is explicit; mirrors, Projects boards, indexes, and summaries are projections and never become independent write targets or fallback authorities.
- A lifecycle-owning workflow engine or a knowledge base — the spec axis is a yardstick and `_context.md` holds rediscovery-prone HOW-knowledge; neither is a doc store.
- Required ecosystem integrations — Relay and GitHub Projects stay optional. No compiled project-memory / retrieval layer (#350 no-go).
- Wrapping `gh` — a script survives only as a guard on shared or irreversible state, a deterministic check a session cannot cheaply redo, or a wire contract another tool consumes (today only the `sprint-state` JSON, read by dev-relay). Task reading, spec resolution, milestone seeding, and issue listing are calls to the declared authority's CLI (`gh` by default) that the session makes itself.

## Objectives         <!-- Tier 2 · Direction predicates (add/remove/retire human-gated; IDs stable, never reused) -->
- O10 — The declared task authority (GitHub Issues by default) is the standalone task-definition and lifecycle authority; simple Issue → PR work is sprint-free, while complex work preserves continuity in one admitted sprint per track without task mirrors, dual writes, or required ecosystem integrations.
- O1 — for admitted complex work, Claude Code, Codex, and humans read the same active sprint file as the shared execution-continuity state (one file per admitted track; not a unique-sprint-count invariant).
- O4 — open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage.

Retired IDs (never reuse): O3, O5–O9. Full texts: git
[`4fea158`](https://github.com/sungjunlee/dev-backlog/blob/4fea158/spec/charter.md).

## Decisions          <!-- Tier 3 · History (append-only; rows through rev 14 live at git 4fea158) -->
| date       | decision | rationale | supersedes |
| ---------- | -------- | --------- | ---------- |
| 2026-08-16 | The charter drops the proof-gate status ceremony: Objectives become status-free direction predicates; statuses, proofs, denominators, adoption counts, and prior Decisions rows move to `docs/spec-history.md` (#377) | the `[active]→[implemented]→[validated]` ladder generated synthetic measurement work (timed drills, cross-repo counts, reassess bookkeeping) whose upkeep cost exceeded its single-maintainer evidence value — one proof drill even leaked private-consumer details into this public repo; git, CHANGELOG, and docs/ already record history | rev-14 objective statuses; charter Decisions rows through rev 14 |
| 2026-08-17 | Personal-toolkit posture: no cold external-adopter test this wave; right-size the public surface (#369) | every load-bearing adoption figure is a single-maintainer ecosystem; a 426-line adopter README is sized for a goal that has never been validated | implicit external-adopter framing |
| 2026-08-17 | #350 historical-retrieval shadow is **no-go**: Arm B (live sources) suffices; no compiler, no project-memory skill, no committed retrieval artifact (#362) | amendment A1 required ≥10 organic questions; the log stayed 0/10, so a 2026-08-28 go was already impossible | 2026-07-31 memory-requires-a-measured-gate holding pattern |
| 2026-08-17 | Freeze leftover compatibility runtime: no new features on `sync-pull --legacy-export`, `legacy-tracker.js`, or `{PREFIX}-N` parsing without a measured consumer | those seams survived #348 as deletable compatibility, not as a product surface; expanding them recreates the generality the GitHub-native core removed | implicit "keep the seams warm" |
| 2026-08-17 | Living Objectives are O10, O1, O4 only. O3 and O5 retire (texts in `docs/spec-history.md`). O1 wording is *shared* state per admitted track, not sprint count (#379) | O3/O5 kept generating the measurement ceremony rev 15 stopped paying for; O1's "single" predates multi-track (#373) | rev-15 five-objective set; O1 "single execution-continuity state" |
| 2026-08-21 | Working-tree spec archive retired: never-reuse list stays in the charter; full retired texts live at git `4fea158`. `docs/spec-history.md` is Removed (#385) | the living tree only needs the never-reuse constraint; a verbatim archive duplicated git | `docs/spec-history.md` as the living history home |
| 2026-09-17 | Tracker rule as shipped: one configured authority per repo; adapters are CLI translation on frozen ports; a new adapter requires a measured consumer. `files` qualifies (Backlog.md CLI installed and in use); `gitlab` does not (no `glab`, no pinning repo) and is parked at its merge commit `a8ddb7d` (#421, #424; gate 2026-09-17) | the 2026-08-17 freeze already said seams expand only for a measured consumer; #415 shipped without one | rev-17 "no new tracker adapters" non-goal and the implicit three-key freeze |
| 2026-09-17 | GitHub-only again (G1): the `files` adapter and the tracker abstraction (`tracker.js`, ports, `.tracker` selection, `BACK-N` refs) are parked at tag `v0.11.0`; the diagnostic export `sync-pull --legacy-export` / `legacy-tracker.js` is deleted (G2, lifting the 2026-08-17 freeze row); the doctor's reassess-signal counter is retired — reassess is a human call at sprint close (epic #440, #442; gate 2026-09-17 "권장대로 진행") | no repo pins `files` and no export was ever produced; tracker generality is a Non-Goal; the wave's keep test admits only guards, deterministic checks, and consumed wire contracts | rev-18 measured-consumer adapter rule as applied to `files`; 2026-08-17 export freeze; rev-15 reassess cadence bookkeeping |
| 2026-09-17 | Spec-axis linters are removed; `objectives:` and `component:` are unchecked sprint metadata. At runtime `component:` is a free track-scope string compared only by `scopesOverlap`; naming a capability heading stays a routing convention for relay Learnings, not a checked contract. O4 is served by the `backlog-triage` Alignment section (#421, #426; gate 2026-09-17) | the linters were the same species of upkeep as the rev-15 status ladder, and no consumer reads their output; frontmatter linting never detected open-issue drift | rev-14 "component resolves to a capability heading" contract |
| 2026-09-18 | Task authority generalized without code (rev 20, epic #472; gate 2026-09-18 "권장하는 대로 계속 진행"): one `.dev-backlog/.tracker` line read by the session (absent = `github`; `backlog` with `files` as the legacy spelling; `gitlab`), a three-verb table in SKILL.md replaces the `gh` rails, +56 script lines read the line (allow-list `github`, `backlog`/`files`, `gitlab`; anything else fails loud), make the JSON `tracker` field honest, and keep `--close-milestone` GitHub-only. The parked `files` adapter code stays parked; `backlog` is measured (maintainer repos with the Backlog.md CLI and no GitHub remote), `gitlab` is a documented row until a repo pins it | GitHub stays priority 0, but GitHub-less use via Backlog.md and self-hosted GitLab are real maintainer needs; the coupling that #440 left was prose plus one JSON field, so generality costs a table, not an adapter | rev-19 "Tracker generality" Non-Goal and the 2026-09-17 G1 row's prose (its code parking stands) |
