---
last_amended: 2026-08-17
revision: 16
---

# dev-backlog Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
Humans and AI coding agents (Claude Code, Codex) sharing a project end up
re-deriving "what to do next, with what context, on what already in flight"
from raw tracker state every session. Decisions and in-flight delegation
status leak out of the tracker; continuity across sessions is rebuilt from
scratch each time.

## Approach           <!-- Tier 1 · Direction (human-gated) -->
Use GitHub Issues as the sole task-definition and lifecycle authority. Simple
Issue → PR work needs no sprint. When dependency, delegation, cross-session
context, or parallel-track complexity requires execution continuity, add one
thin, explicit, markdown-only sprint file per admitted track that humans and
agents both read and update. Companion skill `backlog-triage` grooms GitHub
state without creating a parallel task truth. `spec/*.md` is an optional
read-only yardstick. No server, no daemon, no hidden state, no silent sync.

This repo is a personal toolkit, not an externally adopted product. Keep the
hot path small enough to start again.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- Tracker generality — GitHub Issues own task truth; no new tracker adapters, no multi-master sync, no SaaS connectors (Jira, Linear, Notion). Backlog.md compatibility survives only as explicit one-way legacy import/export.
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- Silent sync or dual-write state — every GitHub mutation is explicit; mirrors, Projects boards, indexes, and summaries are projections and never become independent write targets or fallback authorities.
- A lifecycle-owning workflow engine or a knowledge base — the spec axis is a yardstick and `_context.md` holds rediscovery-prone HOW-knowledge; neither is a doc store.
- Required ecosystem integrations — Relay, GitHub Projects, and Backlog.md export stay optional. No compiled project-memory / retrieval layer (#350 no-go).

## Objectives         <!-- Tier 2 · Direction predicates (add/remove/retire human-gated; IDs stable, never reused) -->
- O10 — GitHub Issues are the standalone task-definition and lifecycle authority; simple Issue → PR work is sprint-free, while complex work preserves continuity in one admitted sprint per track without task mirrors, dual writes, or required ecosystem integrations.
- O1 — for admitted complex work, Claude Code, Codex, and humans read the same active sprint file as the shared execution-continuity state (one file per admitted track; not a unique-sprint-count invariant).
- O4 — open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage.

Retired IDs (O3, O5–O9), the pre-2026-08-16 status ladder, and all proof/adoption
evidence live in [`docs/spec-history.md`](../docs/spec-history.md).

## Decisions          <!-- Tier 3 · History (append-only; rows through rev 14 moved to docs/spec-history.md) -->
| date       | decision | rationale | supersedes |
| ---------- | -------- | --------- | ---------- |
| 2026-08-16 | The charter drops the proof-gate status ceremony: Objectives become status-free direction predicates; statuses, proofs, denominators, adoption counts, and prior Decisions rows move to `docs/spec-history.md` (#377) | the `[active]→[implemented]→[validated]` ladder generated synthetic measurement work (timed drills, cross-repo counts, reassess bookkeeping) whose upkeep cost exceeded its single-maintainer evidence value — one proof drill even leaked private-consumer details into this public repo; git, CHANGELOG, and docs/ already record history | rev-14 objective statuses; charter Decisions rows through rev 14 |
| 2026-08-17 | Personal-toolkit posture: no cold external-adopter test this wave; right-size the public surface (#369) | every load-bearing adoption figure is a single-maintainer ecosystem; a 426-line adopter README is sized for a goal that has never been validated | implicit external-adopter framing |
| 2026-08-17 | #350 historical-retrieval shadow is **no-go**: Arm B (live sources) suffices; no compiler, no project-memory skill, no committed retrieval artifact (#362) | amendment A1 required ≥10 organic questions; the log stayed 0/10, so a 2026-08-28 go was already impossible | 2026-07-31 memory-requires-a-measured-gate holding pattern |
| 2026-08-17 | Freeze leftover compatibility runtime: no new features on `sync-pull --legacy-export`, `legacy-tracker.js`, or `{PREFIX}-N` parsing without a measured consumer | those seams survived #348 as deletable compatibility, not as a product surface; expanding them recreates the generality the GitHub-native core removed | implicit "keep the seams warm" |
| 2026-08-17 | Living Objectives are O10, O1, O4 only. O3 and O5 retire (texts in `docs/spec-history.md`). O1 wording is *shared* state per admitted track, not sprint count (#379) | O3/O5 kept generating the measurement ceremony rev 15 stopped paying for; O1's "single" predates multi-track (#373) | rev-15 five-objective set; O1 "single execution-continuity state" |
