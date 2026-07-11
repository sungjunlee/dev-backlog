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
- [ ] #290 Phase 0: multi-track RED gate — evals + smoke fixtures

### Batch 2 — Resolver foundation
- [ ] #291 Phase 1a: scope: frontmatter + portfolio-aware read resolvers

### Batch 3 — Behavior (parallel-safe: disjoint files)
- [ ] #292 Phase 1b: sprint lifecycle track-awareness (init/close/mirror)
- [ ] #293 Phase 1c: backlog-doctor active_sprint → scope-disjointness check

### Batch 4 — Spec amendment (HUMAN-GATED)
- [ ] #294 Phase 1e: amend capabilities.md singleton invariant

### Batch 5 — Docs + contract
- [ ] #295 Phase 3: docs + integration-contract schema_version → 2

## Running Context
- Design + decisions frozen in `docs/prd-2026-07-multi-track-sprints.md` (§9 D1–D4 resolved).
- The singleton is a durable capability contract, not just SKILL prose: `spec/capabilities.md:28` (sprint-execution invariant), `:69` (backlog-sync/sprint-mirror), `:7` (component single-slug). Amendment is human-gated via spec-grill → tracked as #294, which gates the SKILL/process prose flip in #295.
- Charter O1 ("single execution **state**") is about shared state, not sprint count — compatible with multi-track, but its wording is a candidate for a human-gated clarification alongside #294. Do not silently amend the charter.
- dev-relay coupling is shallow: the only hard code-level singleton is `append-learnings.js:resolveActiveSprint` (dev-relay#955); the rest is prose (dev-relay#956) + an indirect fleet fail-loud (dev-relay#957). `sprint-close-report.js --sprint <path>` is the agnostic pattern to replicate.
- Back-compat is the merge gate for Batch 2–3: single-active output must stay byte-identical (PRD G4).

## Progress
- 2026-07-11: sprint planned. Epic #289 + children #290–#295 filed; dev-relay epic #954 + #955–#957 filed. Design doc landed in docs/ (uncommitted).
