---
milestone: 2026-07 adoption hardening
status: active
started: 2026-07-06
due: TBD
objectives: [O3]
component: "sprint-execution"
---

# adoption-hardening

## Goal
A cold adopter with no craftkit and no `spec/*` files can finish one full sprint cycle with zero dangling cross-repo pointers and a minimum-path Quick Start — proven by a smoke eval that is RED today and GREEN at sprint close.

## Plan

### Batch 1 — RED gate (E1 #262)
- [x] #252 test(dev-backlog): cold-adopter eval prompt and smoke coverage (V1) (~30min) — cold-adopter smoke landed; 2 gates RED as designed

### Batch 2a — spec-axis decoupling (E2 #263), ordered
- [x] #253 docs(dev-backlog): add spec-fallback.md consumption-side degradation reference (A1) (~30min) — 452w/33 lines, consumption-side only; unblocks #254/#255
- [x] #254 docs(backlog-triage): re-point Report Evidence off required ../spec-charter reads (A2) (~20min) — re-pointed to intra-bundle fallback; craftkit now when-installed
- [x] #255 docs(dev-backlog): re-point backlog-boundaries and Core Contracts to local fallback (A3) (~20min) — E2 done; A2/A3 gate now enforced (GATE_A2A3=1)

### Batch 2b — first-run minimum path (E3 #264), parallel with 2a
- [ ] #256 docs(readme): reorder Quick Start to the no-spec minimum path (B1) (~20min)
- [ ] #257 docs(dev-backlog): frame related-skills as optional below the Mode Router (B2) (~20min)
- [ ] #258 feat(dev-backlog): omit objectives/component frontmatter when spec files are absent (B3) (~30min) — coordinate relay frontmatter contract in AC

### Batch 3 — contract hygiene (E4 #265)
- [ ] #259 docs(dev-backlog): extract script inventory to references/scripts.md (C1) (~20min)
- [ ] #260 docs(dev-backlog): compress reassess accounting to one sentence + pointer (C2) (~20min)
- [ ] #261 feat(dev-backlog): checkbox-repair runbook and doctor message link (C3) (~30min)

## Running Context
- objectives: `[O3]` — spec-axis decoupling (E2) + first-run path (E3) both serve "stable per-project reference axis readable in <5 min"; the PRD §8 candidate objective (cold-adopter portability) is human-gated via `spec-charter amend` and is NOT claimed here.
- component: `sprint-execution` — the dominant contract being hardened. #254 also touches `triage-grooming`; keep that as prose, not a second `component:`.
- Anti-goal from PRD top risk: `spec-fallback.md` (#253) is consumption-side only and capped ~1 page — it must NOT drift into a second spec-axis authority (the 2026-06/07 silent-fork failure mode).
- Rejected in review: pi's `anchors:` merge of objectives/component — breaks the dev-relay frontmatter contract.
- **RED gates to flip as fixes land** (in `scripts/smoke-test.sh`): `GATE_B3=1` when #258 merges (sprint-init omits spec fields); `GATE_A2A3=1` when #254 AND #255 merge (no `../spec-charter/` reads in `skills/`). Each trips an `XPASS` reminder in the smoke summary if the fix lands before the gate is flipped.
- Pre-existing flake (out of scope): the live-repo `status: shows sprint name` smoke assertion depends on `gh issue list` and can fail intermittently on network; offline cold-adopter section is deterministic.

## Progress
- 2026-07-06 — Sprint opened from `docs/prd-2026-07-adoption-hardening.md` (commit 96c9e1a). Milestone #12, epics #262–#265, issues #252–#261 registered. Plan sequenced RED→decouple/first-run→hygiene.
- 2026-07-07 — Batch 1 done. #252 (V1) landed: SKILL.md cold-adopter eval prompt + spec-less smoke section (GREEN degradation asserts) + 2 gated `xfail` targets (B3 #258, A2/A3 #254/#255). Suite 139/139 pass, 2 xfail, 0 xpass. RED baseline recorded on #252.
- 2026-07-07 — Batch 2a started. #253 (A1) landed: `references/spec-fallback.md` — the consumption-side degradation contract (four-combo matrix, single CHARTER.md fallback rule, explicit triage skip lines, one "authoring lives in craftkit" pointer). No `../spec-charter/` path added, so the A2/A3 gate stays RED until #254/#255 re-point. Unblocks #254/#255.
- 2026-07-07 — #254 (A2) landed: backlog-triage Report Evidence + References re-pointed onto the intra-bundle `spec-fallback.md`; craftkit's `spec-charter` demoted to when-installed enhancement; evidence-tier now stated in the report. Also tightened the V1 A2/A3 gate to match only `../spec-charter/references/` in `*.md` (it was over-broad — caught its own source and the negative eval-prompt mention, so it could never have flipped GREEN). Gate now matches only `backlog-boundaries.md` → flips GREEN when #255 lands.
- 2026-07-07 — **Batch 2a / E2 complete.** #255 (A3) landed: `backlog-boundaries.md` + SKILL.md Core Contracts + References re-pointed to `references/spec-fallback.md`; craftkit is authoring-home-when-installed. Zero `../spec-charter/` reads remain in `skills/`. The A2/A3 gate flipped XPASS → enforced (`GATE_A2A3=1`), now a regression guard. Suite 140/140, 1 xfail (B3 only). doctor pass.
