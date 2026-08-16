---
last_amended: 2026-08-16
revision: 15
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
state without creating a parallel task truth. The spec axis (`spec/*.md`) is
authored by craftkit's `spec-*` skills and consumed here as a read-only
yardstick. No server, no daemon, no hidden state, no silent sync.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- Tracker generality — GitHub Issues own task truth; no new tracker adapters, no multi-master sync, no SaaS connectors (Jira, Linear, Notion). Backlog.md compatibility survives only as explicit one-way legacy import/export.
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- Silent sync or dual-write state — every GitHub mutation is explicit; mirrors, Projects boards, indexes, and summaries are projections and never become independent write targets or fallback authorities.
- A lifecycle-owning workflow engine or a knowledge base — the spec axis is a yardstick and `_context.md` holds rediscovery-prone HOW-knowledge; neither is a doc store.
- Required ecosystem integrations — Relay, GitHub Projects, Backlog.md export, and retrieval/memory experiments stay optional and outside the core Issue → PR and sprint paths.

## Objectives         <!-- Tier 2 · Direction predicates (add/remove/retire human-gated; IDs stable, never reused) -->
- O10 — GitHub Issues are the standalone task-definition and lifecycle authority; simple Issue → PR work is sprint-free, while complex work preserves continuity in one admitted sprint per track without task mirrors, dual writes, or required ecosystem integrations.
- O1 — for admitted complex work, Claude Code, Codex, and humans read the same active sprint file as the single execution-continuity state.
- O3 — a user can answer "is this project still on track?" in under 5 minutes from this file plus the active sprint state.
- O4 — open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage.
- O5 — closing a sprint runs `backlog-doctor`, and the close summary recommends a human-gated `spec-charter reassess` when warranted; automation toward `spec/*` stays report-only.

Retired IDs (O6–O9), the pre-2026-08-16 status ladder, and all proof/adoption
evidence live in [`docs/spec-history.md`](../docs/spec-history.md).

## Decisions          <!-- Tier 3 · History (append-only; rows through rev 14 moved to docs/spec-history.md) -->
| date       | decision | rationale | supersedes |
| ---------- | -------- | --------- | ---------- |
| 2026-08-16 | The charter drops the proof-gate status ceremony: Objectives become status-free direction predicates; statuses, proofs, denominators, adoption counts, and prior Decisions rows move to `docs/spec-history.md` (#377) | the `[active]→[implemented]→[validated]` ladder generated synthetic measurement work (timed drills, cross-repo counts, reassess bookkeeping) whose upkeep cost exceeded its single-maintainer evidence value — one proof drill even leaked private-consumer details into this public repo; git, CHANGELOG, and docs/ already record history | rev-14 objective statuses; charter Decisions rows through rev 14 |
