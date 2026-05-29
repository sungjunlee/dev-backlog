---
last_amended: 2026-05-23
revision: 1
---

# dev-backlog Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
Humans and AI coding agents (Claude Code, Codex) sharing a project end up
re-deriving "what to do next, with what context, on what already in flight"
from raw GitHub Issues and scattered PR tabs every session. Decisions and
in-flight delegation status leak out of the issue tracker; continuity across
sessions is rebuilt from scratch each time.

## Approach           <!-- Tier 1 · Direction (human-gated) -->
Keep GitHub Issues as the canonical task spec; add a thin, explicit,
markdown-only execution hub (the active sprint file) that humans and agents
both read and update. Companion skills (`backlog-triage`, `spec-charter`,
`spec-system-map`, `spec-grill`) groom and orient the same GitHub-anchored state — they never
replace it.
No server, no daemon, no hidden state, no silent sync.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- A new issue tracker — collaborators already live in GitHub Issues; we add to it, not replace it.
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- A lifecycle-owning workflow engine (Fractal / gsd-2 style) — those conflict with the GitHub-anchored model; their patterns are absorbed, never integrated.
- Silent background sync — every pull and push is an explicit user action.
- A knowledge base / wiki replacement — `spec/charter.md` is a yardstick, `_context.md` is rediscovery-prone HOW-knowledge, neither is a long-form doc store.
- Per-vendor connectors (Jira, Linear, Notion) — out of scope, not the wedge.

## Objectives         <!-- Tier 2 · Predicates (add/remove human-gated; status proof-gated) -->
- O1 [validated] Claude Code, Codex, and humans read the same active sprint file as the single execution state · src: user
- O2 [validated] GitHub Issues remain the canonical task spec; no parallel issue store exists in dev-backlog · src: user
- O3 [active]    A user can answer "is this project still on track?" in under 5 minutes against a stable per-project reference axis (`spec/charter.md`) · src: user
- O4 [active]    Open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage · src: user
- O5 [deferred]  Automated `reassess` of `spec/charter.md` wired into `relay-merge` / sprint completion — deferred to a follow-up spec
- O6 [deferred]  `/goal` completion-condition auto-emission from `spec/charter.md` + active sprint — deferred to a follow-up spec

## Decisions          <!-- Tier 3 · History (immutable, append-only) -->
| date       | decision                                                                              | rationale                                                                                        | supersedes |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| 2026-04-18 | `backlog-triage` ships as a sibling skill, not folded into `dev-backlog`              | Different concern (grooming vs execution); folding would bloat the execution contract            | —          |
| 2026-05-22 | `backlog-charter` ships as a third sibling skill                                      | Different concern (axis lifecycle vs execution vs grooming); rerunnable create/amend skill model | —          |
| 2026-05-22 | `CHARTER.md` is a separate file at repo root, not merged into `_context.md`           | The axis must stay a <5-min-read yardstick; `_context.md`'s HOW-knowledge would dilute it        | —          |
| 2026-05-22 | The Alignment Check is prompt-driven inside `backlog-triage`, not a new `triage-*.js` | Issue→objective mapping is semantic, unlike the deterministic relate/stale scripts               | —          |
| 2026-05-22 | Patterns from Fractal and gsd-2 are absorbed, not integrated                          | Both own the whole project lifecycle and conflict with the GitHub-Issues-anchored model          | —          |
| 2026-05-29 | `backlog-charter` splits into `spec-charter` and `spec-grill`                         | Existing-repo onboarding needs a discoverable second step from project charter to capability contracts | 2026-05-22 |
| 2026-05-29 | New charter files live at `spec/charter.md`; root `CHARTER.md` is legacy fallback     | Charter, system map, and capabilities should share one project spec home under `spec/`           | 2026-05-22 |
