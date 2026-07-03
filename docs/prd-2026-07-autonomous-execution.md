# PRD: Execution-State Substrate for Long-Running Work

Status: draft
Date: 2026-07-03
Source: 2026-07-03 skill-set review (a conversation review; its findings are restated in §2, so this document is self-contained). Charter objectives referenced: O4 (open-issue drift detectable without manual triage), O5 (automated spec reassess at completion boundaries — activated here), O6 (/goal completion-condition emission — stays deferred as a consumer-side concern).

## 1. Summary

dev-backlog's sprint contract quietly assumes a human at every session boundary. Long-running work — multi-day efforts, delegated fleets, future unattended runs — needs the same execution state to be **queryable, analyzable, and safely writable by non-human actors**, without dev-backlog deciding who runs them or how.

This PRD prepares that substrate. It does not build an autonomous runner. It (A) makes execution state machine-legible through JSON read surfaces, an actor-agnostic consumption contract, and a single health-check entry point; (B) fixes the open question of where shared sprint state should live (SSOT) via a scoped spike; (C) activates charter O5 in a signal-gated, report-only form; and (D) clears hygiene debt found in the 2026-07 skill review.

Everything here preserves the charter's core stance: GitHub Issues stay the source of truth, sync stays explicit, no daemon, no silent mutation.

## 2. Background and Current State

Findings from the 2026-07-03 skill-set review:

- **The machinery for machine-legible state already exists** — checkbox state machine (`[ ]`/`[~]`/`[x]`), `[run:...]` annotations, single-active-sprint guard (fail-loud), section-heading regexes, `_context.md` promotion. But it is documented only as a dev-relay pairing (`references/integration-contract.md`), not as a general contract any long-running actor can rely on.
- **Read surfaces are human-shaped.** `status.sh` / `next.sh` emit prose. An external loop, goal harness, or analyzer must re-parse markdown to answer "what is in flight?".
- **Health checks are scattered.** `objectives-check.js`, `component-lint.js`, `capabilities-doctor.js`, and smoke checks exist separately; nothing gives one verdict on backlog state health.
- **Spec files rot silently.** `spec-charter reassess` exists (report-only) but runs only when a human remembers. Charter O5 has been deferred since 2026-05.
- **SSOT is unresolved.** `backlog/` lives in the code repo's working tree. Multiple worktrees (relay-dispatch isolation) each see their own copy; sprint-state updates ride code branches. Candidate directions (separate state repo, GitHub Issue mirror) are un-evaluated.
- **Hygiene debt.** The `dev-backlog` description triggers on issue creation but the Mode Router has no such route; `argument-hint` omits `complete`; `init.sh` writes three config fields no script reads (`definition_of_done`, `auto_commit`, `date_format`); the legacy root `CHARTER.md` fallback rule is duplicated across four skills.

## 3. Goals and Non-Goals

### Goals

- G1. Any actor (human, relay executor, external loop, analyzer) can read current execution state through a stable machine interface instead of parsing markdown.
- G2. Any actor that mutates sprint state leaves traces a later session can attribute and orient from, using files alone. (Richer recovery — resuming or rolling back abandoned in-flight work — is out of scope.)
- G3. One command reports backlog/spec state health, usable by CI, close flows, and future schedulers.
- G4. The SSOT question has a recorded decision path: fixed evaluation criteria, a bounded spike, and a charter Decision row.
- G5. Spec drift is surfaced at completion boundaries without human memory (O5, signal-gated, report-only).
- G6. Review hygiene debt is cleared.

### Non-Goals

- **No budget/enforcement spec.** No enforcer exists yet; budget fields without an enforcer are dead spec. Revisit when a concrete runner exists.
- **No trigger ownership.** Who runs unattended sessions, and on what schedule (cron, Actions, routines), stays outside dev-backlog. The project provides the contract, not the daemon.
- **No new planning unit above sprint.** Charter Objectives and GitHub Milestones already provide the larger axis.
- **No /goal integration (O6).** Goal/loop harnesses are consumers of this substrate; nothing here emits or manages their completion conditions. O6 stays deferred.
- **No mandatory full reassess at every close.** Signal-gated only (see Workstream C).
- Unchanged: no daemon, no silent sync, no background mutation.

## 4. Workstream A — Substrate: Machine-Legible Execution State (core)

### A1. JSON read surfaces

`status.sh --json` and `next.sh --json` return structured state: active sprint (path, frontmatter, goal), plan items with checkbox state / issue number / PR annotation / run-id, next actionable batch, latest progress entries (most recent 5), and in-flight (`[~]`) items with age. Include a `schema_version` field; the JSON shape is documented in the integration contract and guarded by the same cross-project smoke gating as the trace grammar (S7). Human-readable output stays the default.

Snapshots are supported only as shell redirection (`--json > file`); no timestamped snapshot store is built.

### A2. Actor-agnostic consumption contract

Generalize `references/integration-contract.md` from "dev-relay ↔ dev-backlog" to a consumption contract for any long-running actor:

- **Read**: which files/sections mean what (already specified; re-scope the audience).
- **Write**: which sections an actor may append to (`## Progress`, `## Running Context`), which state transitions it may make (`[ ]→[~]`; `[~]→[x]` only when the line's pointer resolves to a merged PR or verified completion, recorded as a Progress entry), and which it must not (sprint frontmatter status, Plan item deletion).
- **Trace grammar**: every `[~]` line carries a pointer (PR, branch, or run-id) — promoted from a capabilities.md Behavior to contract text; a `[~]` line without one is *unmoored* and flagged by `backlog-doctor`. Non-human Progress entries carry an actor tag compatible with the existing `[run:...]` grammar. Any change to this grammar (which dev-relay's regexes parse) must be coordinated with dev-relay before landing.

### A3. `backlog-doctor` single entry point

One command aggregates existing checks plus a sprint shape lint:

- active-sprint invariant (exactly one, fail-loud on ambiguity)
- `objectives-check.js`, `component-lint.js`, `capabilities-doctor.js`
- sprint file shape (required sections present, checkbox grammar parseable)
- unmoored `[~]` signal: in-flight lines lacking a PR/branch/run-id pointer (per A2 trace grammar)
- stale in-flight signal: `[~]` items older than the staleness window (CLI flag `--stale-days`, default 7 — deliberately a flag, not a new config field)
- `_context.md` bloat signal

Output: human summary + `--json` with per-check verdicts. **Hard violations (non-zero exit):** ambiguous active sprint, unknown `component:` or objective ID, missing required section, unparseable checkbox grammar. **Soft signals (warn only):** unmoored `[~]`, stale `[~]`, `_context.md` bloat. This is the deterministic half of Workstream C and the intended health probe for CI and future schedulers.

### A4. Fresh-session recovery guarantee

Add an eval prompt (in the SKILL.md Eval Prompts section, per repo convention) and a smoke test pinning the property: a fresh agent session, given only the repo files, can name the active sprint, the next actionable batch, and in-flight work with owners/pointers. This is the acceptance gate for A1–A2 rather than a feature.

## 5. Workstream B — Shared State Location (SSOT) Decision

Today `backlog/` state is only trustworthy in the worktree that owns it. Before building sync tooling, fix the evaluation frame and run a bounded spike.

### Options

| Option | Shape | Notes |
| --- | --- | --- |
| (a) Status quo + mutation convention | `backlog/` stays in-repo; contract says sprint mutations happen only in the primary worktree / at merge boundaries | Cheapest; codifies current dev-relay practice; no cross-machine access |
| (b) Separate state repo | `backlog/` in its own repo (submodule or sibling clone) | Decouples state churn from code PRs; submodules still checkout-per-worktree (not a true single location); adds setup friction |
| (c) Sprint mirrored to a machine-managed GitHub Issue | Local file stays canonical; explicit sync mirrors it to an issue reusing the proven progress-issue machinery (managed-body marker, comment upsert keys) | Consistent with "GitHub = shared truth" and explicit sync; churn/noise cost unknown |

### Evaluation criteria

Explicit-sync preservation · worktree/machine accessibility · offline editing · Running Context churn cost · reuse of existing machinery · migration cost.

### Decision path

"Progress-issue machinery" above means the existing `progress-sync.js` pattern: a GitHub issue whose body is machine-managed behind a `<!-- dev-backlog:progress-issue -->` marker and whose comments are upserted under stable identity keys, giving idempotent re-sync (see `references/integration-contract.md`, Progress Reporting Boundary).

Leading candidate: **(c)**, because it reuses proven machinery and strengthens rather than bends the charter. But the decision is deliberately deferred to a spike issue that prototypes (c) against a real sprint, measures churn/noise, and compares against (a) as the null option. Outcome lands as a charter Decision row; implementation issues are cut only after that.

## 6. Workstream C — O5: Signal-Gated Reassess at Completion Boundaries

Report-only, no new infrastructure:

1. `sprint-close.sh` runs `backlog-doctor` as part of closing (deterministic, seconds).
2. The `complete` mode contract in SKILL.md gains one step: if doctor emits warnings, or ≥ N sprints (default 3) have closed since the last reassess report, recommend `spec-charter reassess` in the close summary. Reassess reports are dated files (`backlog/triage/YYYY-MM-DD-reassess.md`), so "sprints closed since last reassess" is computed from files alone — no new state field. In an attended close the human accepts the recommendation; an unattended session may run reassess directly (it is report-only) but must never run `amend`.
3. Reassess output stays a report; applying changes remains human-gated through `spec-charter amend` / `spec-grill`.

Follow-up (not this PRD's scope to implement, recorded for relay): relay-merge may consume the same doctor signal.

Charter effect: O5 moves `deferred → active` with this scoped wording; `validated` requires evidence of one full signal → reassess → amend cycle in dogfooding.

## 7. Workstream D — Hygiene

- D1. `dev-backlog` SKILL.md: add an issue-creation route to the Mode Router, backed by the existing Create workflow in `references/process.md` (decided: add the route rather than drop the "이슈 만들어" trigger — the workflow already exists and the trigger is useful); add `complete` to `argument-hint`.
- D2. Backlog.md demotion: remove `definition_of_done`, `auto_commit`, `date_format` from `init.sh` output; reword README Design Choices from "Builds on Backlog.md" to "task-file format is Backlog.md-compatible"; add a charter Non-Goal line stating new features are not constrained by Backlog.md conventions.
- D3. Single-source the legacy root `CHARTER.md` fallback rule in `spec-charter/references/spec-axis.md`; the four SKILL.md files keep one-line references only.

## 8. Sequencing and Epic Candidates

Dependency order: D is independent (ship first, small). A is the foundation. C depends on A3. B's spike can run parallel to A but its implementation waits for the decision.

| Epic | Issues (seed) | Depends on |
| --- | --- | --- |
| E1 Hygiene | D1 router/argument-hint · D2 Backlog.md demotion · D3 fallback single-sourcing | — |
| E2 Substrate | A1 JSON surfaces · A2 consumption contract rewrite · A3 backlog-doctor · A4 recovery eval/test | — |
| E3 SSOT spike | one spike issue: prototype (c), score all options against criteria, write charter Decision row | — (informed by A1) |
| E4 O5 activation | wire doctor into sprint-close · complete-mode contract text + signal rule · charter amend (O5 → active) | E2 (A3) |

Suggested milestone cut: E1+E2 as the first milestone; E3 spike and E4 as the second. (Scheduling suggestion only — E3 has no hard dependency and may be pulled forward.)

## 9. Success Criteria

- S1. A consumer obtains active sprint, next batch, in-flight items (with pointers and age), and latest progress from one `--json` command, without parsing markdown. (G1)
- S2. `backlog-doctor` flags each seeded violation — ambiguous active sprint, unknown `component:`, missing section, unmoored `[~]`, stale `[~]` — and exits non-zero on hard violations. (G3)
- S3. The fresh-session recovery eval passes: files alone suffice to orient. (G2)
- S4. Closing a sprint runs doctor automatically; when signals fire, the close summary names reassess as the next action; no spec file is mutated by automation. (G5)
- S5. The SSOT spike produces a charter Decision row choosing among (a)/(b)/(c) with recorded criteria scores. (G4)
- S6. A fresh `init.sh` run emits no dead config fields; README describes Backlog.md as format-compatible only; the fallback rule exists in exactly one reference file. (G6)
- S7. dev-relay smoke tests still pass after any trace-grammar change (contract compatibility preserved).

## 10. Risks and Open Questions

- **JSON schema becomes a second load-bearing contract.** Mitigation: `schema_version`, minimal field set, document in the integration contract, change only with cross-project smoke tests (S7).
- **Trace-grammar drift vs dev-relay regexes.** Any change to checkbox/annotation grammar must be coordinated; prefer strictly additive grammar.
- **Reassess signal thresholds are guesses.** Start conservative (doctor warnings OR 3 closed sprints), tune via dogfooding before promoting O5 to validated.
- **Doctor scope creep.** Doctor aggregates existing deterministic checks; semantic judgment stays in reassess. New checks require a named consumer.
- **Option (c) churn/noise is unmeasured.** That is precisely what the spike bounds; (a) remains the acceptable null result.
- Open: whether `next.sh --json` and `status.sh --json` share one implementation; whether the consumption contract stays inside `integration-contract.md` or becomes its own reference file.
