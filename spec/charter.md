---
last_amended: 2026-07-11
revision: 8
---

# dev-backlog Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
Humans and AI coding agents (Claude Code, Codex) sharing a project end up
re-deriving "what to do next, with what context, on what already in flight"
from raw tracker tasks and scattered change tabs every session. Decisions and
in-flight delegation status leak out of the selected task tracker; continuity
across sessions is rebuilt from scratch each time.

## Approach           <!-- Tier 1 · Direction (human-gated) -->
Select exactly one configured tracker adapter as the canonical task spec for a
repository; add a thin, explicit, markdown-only execution hub (the active
sprint file) that humans and agents both read and update. GitHub remains the
compatibility baseline, while local task files are the first alternative
canonical store. Companion skill `backlog-triage` grooms supported tracker
state — it never creates a parallel task truth. The spec axis
(`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`) is authored by
craftkit's `spec-charter`/`spec-system-map`/`spec-grill` skills and consumed
here as read-only yardsticks.
No server, no daemon, no hidden state, no silent sync.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- A universal or multi-master issue tracker — one configured adapter owns task truth; dev-backlog does not synchronize canonical stores.
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- A lifecycle-owning workflow engine (Fractal / gsd-2 style) — those conflict with the tracker-anchored model; their patterns are absorbed, never integrated.
- Silent background sync — every pull and push is an explicit user action.
- A knowledge base / wiki replacement — `spec/charter.md` is a yardstick, `_context.md` is rediscovery-prone HOW-knowledge, neither is a long-form doc store.
- Broad SaaS connector proliferation (Jira, Linear, Notion) — out of scope; only explicitly supported forge/local adapters belong to the product boundary.
- Backlog.md convention-following — the task-file format stays Backlog.md-compatible, but new features are not constrained by Backlog.md conventions.

## Objectives         <!-- Tier 2 · Predicates (add/remove human-gated; status proof-gated) -->
- O1 [validated] Claude Code, Codex, and humans read the same active sprint file as the single execution state · src: user
- O3 [active]    A user can answer "is this project still on track?" in under 5 minutes against a stable per-project reference axis (`spec/charter.md`) · src: user
- O4 [validated] Open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage · src: user (proof: backlog-doctor PR #226 + sprint-close signal PR #229; live automatic catches 2026-07-03/04 — deferred-O5 objective reference at sprint open, unmoored `[~]` signals at close)
- O5 [validated] Closing a sprint runs `backlog-doctor`; when doctor emits warnings or 3+ sprints have closed since the last dated reassess report (`backlog/triage/YYYY-MM-DD-reassess.md`), the close summary recommends `spec-charter reassess`. Report-only: unattended sessions may run reassess but never amend · src: user (proof: first full cycle 2026-07-04 — close signal → `backlog/triage/2026-07-04-reassess.md` → human-gated amend revision 5)
- O6 [deferred]  `/goal` completion-condition auto-emission from `spec/charter.md` + active sprint — deferred to a follow-up spec
- O7 [validated] A repo with no craftkit and no `spec/` files can complete a full sprint cycle from this bundle alone, with no dangling cross-repo spec pointers · src: user (proof: adoption-hardening milestone #12 closed 14/14 on 2026-07-07; PRD §8 candidate measured by V1 cold-adopter gates)
- O8 [active]    The same core sprint cycle is proven on both `github` and `local`, while GitHub's existing task, milestone, mirror, progress, and closing-link behavior remains backward compatible · src: user
- O9 [active]    Exactly one configured tracker adapter owns canonical task truth per repository; runtime never silently changes the selected tracker · src: user

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
| 2026-05-31 | `backlog-triage` adds spec-aware Decision Review as a prompt-driven report layer      | Final issue recommendations need semantic evidence from charter, capabilities, system map, and sprint context; mutations stay explicit | —          |
| 2026-07-03 | Backlog.md demoted from design ancestor to format-compat surface                      | No script reads its config fields; compat is a task-file format guarantee, not a design constraint | —          |
| 2026-07-03 | Sprint SSOT: local sprint file stays canonical and is committed at explicit boundaries; a machine-managed GitHub issue mirror (marker + body upsert) is the optional shared read surface; no separate state repo | Spike #215: mirror reuses progress-issue machinery with ~zero timeline noise; a submodule state repo adds friction without solving worktree visibility; the committed-file convention already proved necessary (#211 incident) | —          |
| 2026-07-04 | `spec-charter`/`spec-system-map`/`spec-grill` move to craftkit; dev-backlog consumes `spec/*` as read-only yardsticks (0.7.0, PR #242) | The skills author durable repo contracts and stand alone without a backlog; craftkit carries the skill-quality machinery; a two-week silent fork proved dual ownership untenable | —          |
| 2026-07-11 | Exactly one configured tracker adapter owns task truth per repository; initial adapters are `github` and `local`, with GitHub as the compatibility baseline | Migration must stage task-ID and `gh` coupling behind a compatibility-preserving seam; capability-gated extensions prevent a lowest-common-denominator interface, while single ownership prevents multi-master sync | — |
