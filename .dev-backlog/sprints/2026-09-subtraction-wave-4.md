---
milestone: 2026-09 subtraction wave 4
status: active
started: 2026-09-18
due: TBD
scope: ["skills/**", "tests/**", "docs/**", "README.md", "CHANGELOG.md", "VERSION"]
---

# subtraction-wave-4

## Goal

The two keep-test candidates left open at v0.13.0 are gone — one implementation of the next batch (node) and no rollout gates in the smoke test — released as v0.14.0 (epic #467).

## Plan

### Batch 1 — parallel (disjoint files)

- [ ] #468 next.sh / status.sh render text from sprint-state.js; delete bash sprint parsing (est: 2h)
- [ ] #469 smoke-test.sh: delete GATE_* / gated_assert scaffolding (est: 30m)

### Batch 2 — release

- [ ] #470 release v0.14.0: CHANGELOG, VERSION, conformance after-run, tag (est: 1h)

## Running Context

- Keep test unchanged from #456. #468 is the one admitted refactor (a cut would remove the human text surface README points at); JSON stays byte-identical because dev-relay consumes it.
- Implementer/reviewer: #468 Opus subagent → Astra review; #469 session → Sol review; both via codex exec.

## Progress

- 2026-09-18: sprint opened; epic #467, issues #468–#470, milestone 26.
  