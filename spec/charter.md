---
last_amended: 2026-08-16
revision: 14
---

# dev-backlog Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
Humans and AI coding agents (Claude Code, Codex) sharing a project end up
re-deriving "what to do next, with what context, on what already in flight"
from raw tracker tasks and scattered change tabs every session. Decisions and
in-flight delegation status leak out of the selected task tracker; continuity
across sessions is rebuilt from scratch each time.

## Approach           <!-- Tier 1 · Direction (human-gated) -->
Use GitHub Issues as the sole task-definition and lifecycle authority. Simple
Issue → PR work needs no sprint. When dependency, delegation, cross-session
context, or parallel-track complexity requires execution continuity, add one
thin, explicit, markdown-only sprint file per admitted track that humans and
agents both read and update. Companion skill `backlog-triage` grooms GitHub state — it never creates
a parallel task truth. The spec axis
(`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`) is authored by
craftkit's `spec-charter`/`spec-system-map`/`spec-grill` skills and consumed
here as read-only yardsticks.
No server, no daemon, no hidden state, no silent sync.

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- A universal, pluggable, or multi-master issue tracker — GitHub Issues own task truth; dev-backlog does not synchronize canonical stores.
- A database, server, or background daemon — Markdown + bash + node built-ins only; no mystery state.
- A lifecycle-owning workflow engine (Fractal / gsd-2 style) — those conflict with the tracker-anchored model; their patterns are absorbed, never integrated.
- Silent background sync — every pull and push is an explicit user action.
- A knowledge base / wiki replacement — `spec/charter.md` is a yardstick, `_context.md` is rediscovery-prone HOW-knowledge, neither is a long-form doc store.
- Broad SaaS connector proliferation (Jira, Linear, Notion) or new tracker adapters — out of scope.
- Backlog.md convention-following — the task-file format stays Backlog.md-compatible, but new features are not constrained by Backlog.md conventions.
- Dual-write state or automatic memory writes — mirrors, Projects, indexes, and summaries are projections and never become independent write targets.
- Hard Relay, Matt Pocock skill, GitHub Projects, or Backlog.md dependencies — each may be used optionally without entering the core path.

## Objectives         <!-- Tier 2 · Predicates (add/remove human-gated; status: active → implemented → validated, proof-gated) -->
Evidence scope: adoption figures below are measured within a single-maintainer
ecosystem — 17 consumer repos other than this one, 18 known consumers counting
it (as of 2026-07-28); each objective cites its own denominator. None of it is
independent external-team adoption.
- O1 [validated] For complex work admitted to a sprint, Claude Code, Codex, and humans read the same active sprint file as the single execution-continuity state · src: user (adoption 2026-07-27: 146 sprints across 17 repos other than this one)
- O3 [implemented] A user can answer "is this project still on track?" in under 5 minutes against a stable per-project reference axis (`spec/charter.md`) · src: user (proof: agent-run timed drill 2026-08-16, `docs/o3-drill-2026-08-16.md` — median 4.8 s / worst 7.5 s agent wall-clock, ≈1–2 min human-scaled estimate; denominator: 5 drilled of 6 local consumer repos carrying `spec/charter.md`, 4/5 assessable — prose-charter repos without the O-predicate axis are outside the method. Path to `[validated]`: the drill recurs at ≥2 dated reassess reports or one human-run end-to-end confirmation)
- O4 [validated] Open-issue drift (orphan work, neglected objectives, contradictions) is detectable without manual triage · src: user (proof: backlog-doctor PR #226 + sprint-close signal PR #229; live automatic catches 2026-07-03/04 — deferred-O5 objective reference at sprint open, unmoored `[~]` signals at close; adoption 2026-07-27: `backlog/triage/` reports in 7 repos other than this one)
- O5 [validated] Closing a sprint runs `backlog-doctor`; when doctor emits warnings or 3+ sprints have closed since the last dated reassess report (`backlog/triage/YYYY-MM-DD-reassess.md`), the close summary recommends `spec-charter reassess`. Report-only: unattended sessions may run reassess but never amend · src: user (proof: first full cycle 2026-07-04 — close signal → `backlog/triage/2026-07-04-reassess.md` → human-gated amend revision 5; adoption 2026-07-27: dated reassess reports in 3 repos other than this one — survival-alpha, beopsuny-skill, aibris)
- O6 [deferred]  `/goal` completion-condition auto-emission from `spec/charter.md` + active sprint — deferred to a follow-up spec
- O7 [validated] A repo with no craftkit and no `spec/` files can complete a full sprint cycle from this bundle alone, with no dangling cross-repo spec pointers · src: user (proof: adoption-hardening milestone #12 closed 14/14 on 2026-07-07; PRD §8 candidate measured by V1 cold-adopter gates; adoption 2026-07-27: 10 of the 17 repos other than this one run sprints with no `spec/` axis at all, up to 15 sprints each)
- O8 [implemented] Historical (superseded by O10, 2026-07-31; retained so sprint references resolve): core sprint cycle demonstrated on `github` and `local` without silent switching · src: user (proof: PRs #286/#298/#303; see Decisions 2026-07-27/28/31)
- O9 [implemented] Historical (superseded by O10, 2026-07-31; retained so sprint references resolve): exactly one configured adapter owned task truth during the tracker-seam phase · src: user (proof: PRs #282/#298/#301/#303; see Decisions 2026-07-31)
- O10 [active] GitHub Issues are the standalone task-definition and lifecycle authority; simple Issue → PR work is sprint-free, while complex work preserves continuity in one admitted sprint per track without task mirrors, dual writes, or required ecosystem integrations · src: user (adoption evidence 2026-07-27: 0 of 17 other consumer repos selected a non-default tracker; 2026-07-28: all 18 known consumer repos had a GitHub remote)

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
| 2026-07-27 | Objective status splits `implemented` (producer-side proof) from `validated` (cited use outside this repo); O8 and O9 move to `implemented` | measured 2026-07-27 across 17 other repos consuming dev-backlog: `local` has 0 adopters and 0 set a non-default tracker, yet both objectives read `validated` on merged-PR proof while v0.9.0 was deleting 2,556 lines from one of those axes for being built at the wrong size. Vocabulary defined by craftkit `spec-charter` (craftkit#165) | — |
| 2026-07-28 | O8 stays `[implemented]` by design: `local` proved the seam admits a non-GitHub adapter, and user adoption of `local` is not a goal of O8 | measured 2026-07-28: all 18 repos consuming dev-backlog have a GitHub remote, so `local`'s premise has zero instances and O8 cannot reach `[validated]` by waiting. Restating the objective's purpose is honest; manufacturing an adopter or deleting a working adapter is not. O8's predicate also drops `mirror` and `progress` because #340 deleted that behavior — that is removing a reference to deleted code, **not** weakening a predicate so its proof looks sufficient | — |
| 2026-07-31 | GitHub Issues become the sole task-definition/lifecycle authority; sprints are admitted by execution complexity, while tracker generalization and task mirrors leave the target product boundary | measured adoption found 0 of 17 consumers selecting a non-default tracker and all 18 known consumers on GitHub; preserving unused generality would prolong dual-state and compatibility cost without user evidence. O8/O9 cease to direct product work but remain implemented historical IDs so completed sprint references still resolve | 2026-07-11 configured-tracker direction; 2026-07-28 O8 retention |
| 2026-07-31 | Remove the zero-adopter local tracker; retain Backlog.md only as explicit one-way legacy import/export | mirrorless GitHub execution covers create/read/update/close and sprint continuity without task directories or optional ecosystem tools, so the unused local substrate has no remaining product or portability invariant | 2026-07-26 local JSON authority decision |
| 2026-07-31 | Relay, Matt Pocock skills, GitHub Projects, Backlog.md compatibility, and retrieval/memory experiments remain optional projections or techniques | the standalone Issue → PR and complex-sprint paths must survive without ecosystem dependencies; projections cannot acquire write authority, and memory requires a separate measured gate | — |
| 2026-08-16 | O3 moves `[active]` → `[implemented]` on the 2026-08-16 timed drill; its denominator is consumer repos carrying a spec-charter-format predicate axis | agent-run drill across 5 consumer repos (#363 Option A): median 4.8 s wall-clock, worst 7.5 s, 4/5 assessable — the one miss (sjlee-ops) has a prose charter with no O-predicate axis, making the axis format the method's precondition rather than a failure of the 5-minute bar; human gate satisfied by explicit user approval 2026-08-16 on the #363 proposal | — |
