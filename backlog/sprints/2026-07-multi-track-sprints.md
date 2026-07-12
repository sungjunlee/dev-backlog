---
milestone: 2026-07 multi-track sprints
status: active
started: 2026-07-11
due: TBD
objectives: [O1]
component: "sprint-execution"
---

# multi-track-sprints

## Goal
Replace the global single-active-sprint invariant with a component-partitioned model — multiple disjoint-scope tracks active at once — with single-track behavior byte-identical. Tracked by epic #289; design in `docs/prd-2026-07-multi-track-sprints.md`. dev-relay coordination is a separate repo epic (`sungjunlee/dev-relay#954`).

## Plan

### Batch 1 — RED gate (test-first)
- [x] #290 Phase 0: multi-track RED gate — evals + smoke fixtures → PR #297 (merged)

### Batch 2 — Resolver foundation
- [x] #291 Phase 1a: scope: frontmatter + portfolio-aware read resolvers → PR #300 (merged)

### Batch 3 — Behavior (parallel-safe: disjoint files)
- [x] #292 Phase 1b: sprint lifecycle track-awareness (init/close/mirror) → PR #307
- [x] #293 Phase 1c: backlog-doctor active_sprint → scope-disjointness check → PR #305 (merged)

### Batch 4 — Spec amendment (HUMAN-GATED)
- [x] #294 Phase 1e: amend capabilities.md singleton invariant → PR #308 (human-run spec-grill pass 2026-07-12)

### Batch 5 — Docs + contract
- [x] #295 Phase 3: docs + integration-contract schema_version → 2 → PR #309

## Running Context
- Design + decisions frozen in `docs/prd-2026-07-multi-track-sprints.md` (§9 D1–D4 resolved).
- The singleton is a durable capability contract, not just SKILL prose: `spec/capabilities.md:28` (sprint-execution invariant), `:69` (backlog-sync/sprint-mirror), `:7` (component single-slug). Amendment is human-gated via spec-grill → tracked as #294, which gates the SKILL/process prose flip in #295.
- Charter O1 ("single execution **state**") is about shared state, not sprint count — compatible with multi-track, but its wording is a candidate for a human-gated clarification alongside #294. Do not silently amend the charter.
- dev-relay coupling is shallow: the only hard code-level singleton is `append-learnings.js:resolveActiveSprint` (dev-relay#955); the rest is prose (dev-relay#956) + an indirect fleet fail-loud (dev-relay#957). `sprint-close-report.js --sprint <path>` is the agnostic pattern to replicate.
- Back-compat is the merge gate for Batch 2–3: single-active output must stay byte-identical (PRD G4). The G4 anchor lives in smoke-test.sh (single-track doctor/next.sh text; never snapshot --json).
- `scopesOverlap()` in `scripts/lib.js` is the ONE overlap predicate — sprint-state and backlog-doctor consume it; #292's sprint-init refusal must import it too, never re-implement.
- This sprint file was held out of #296 (a second active sprint was still illegal pre-#293) and re-added 2026-07-12 as the sole active after the tracker-adapter sprint closed.

## Progress
- 2026-07-11: sprint planned. Epic #289 + children #290–#295 filed; dev-relay epic #954 + #955–#957 filed. Design doc landed in docs/ (uncommitted).
- 2026-07-12: Batches 1–2 landed while the sprint file was held: #290 RED gate (PR #297), #291 Phase 1a resolvers (PR #300) — sprint-state schema 2, portfolio + --track/--component, scopesOverlap in lib.js.
- 2026-07-12: #293 Phase 1c landed (PR #305) — doctor scope-disjointness with per-track fan-out; GATE_MT_DISJOINT/GATE_MT_OVERLAP enforced, smoke 172/172, 0 xfail; single-active output verified byte-identical. Sprint file re-added as sole active.
- 2026-07-12: #292 Phase 1b — sprint-init refuses only on scope overlap (--scope flag, D2 explicit), sprint-close/--track, sprint-mirror/--track; init/close single-track G4 verified byte-identical (text + exit codes + written files); fixed the cwd-dependent sprint-init.test.js #13 rot. Smoke 187/187.
- 2026-07-12: #294 human-gated spec-grill pass — capabilities.md sprint-execution invariant flipped to track-partitioned scope disjointness, backlog-sync sprint-mirror predicate rewritten per-track, header notes component: as the track-scope key; Decisions rows appended in both capabilities; system-map Core Flows 4/5 de-singularized (the originally cited :36 line no longer existed post tracker-adapter refactor). Unblocks #295.
- 2026-07-12: #295 docs — integration-contract documents schema_version 2 (active_sprints[] + retained v1 fields), portfolio/overlap contract, track resolution for relay-merge and Learnings appends; SKILL.md/process.md/scripts.md/README prose flipped off the singleton (no residual "exactly one active sprint" claim); CHANGELOG multi-track entry; multi-track eval prompt un-gated. dev-relay#954 coordination comment posted. dev-backlog side of epic #289 complete — remaining work is dev-relay #955/#956/#957.
