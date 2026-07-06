# PRD: Adoption Hardening — Standalone First Run for Non-Author Adopters

Status: draft
Date: 2026-07-06
Source: 2026-07-06 multi-model review (codex, opencode/minimax-m3, pi via /delegate, plus a writing-effective-skills rubric pass; convergent findings are restated in §2, so this document is self-contained). Charter objectives referenced: O1/O2 (unchanged, this PRD defends them for non-author adopters), O3 (yardstick readability benefits from the token diet). A candidate new objective on non-author adoption is proposed in §8 and routes through `spec-charter amend` (human-gated), not through this PRD.

## 1. Summary

dev-backlog's core design — GitHub Issues own *what*, the active sprint file owns *how*, sync stays explicit — survived a three-model external review intact. What did not survive is the assumption that the reader is the author: the skill contract tells agents to resolve references inside a **different repo's installed skill** (craftkit's `spec-charter`), fronts spec-governance machinery before a first sprint is ever closed, and spends always-loaded SKILL.md tokens on reference material. Every reviewer independently found the same failure class, and all of it would have been caught by one baseline test: **a fresh agent, in a repo without craftkit, trying to reach a first closed sprint.**

This PRD hardens adoption. It (A) writes that missing cold-adopter test first, as a failing gate; (B) removes the runtime dependency on craftkit by inlining a consumption-side degradation contract; (C) reorders the first-run path so the no-spec/no-relay minimum comes first and empty spec fields stop being ceremony; and (D) pays down SKILL.md token debt and gives the unmoored-`[~]` doctor warning a repair path.

Nothing here changes the charter's stance: GitHub Issues stay the source of truth, craftkit stays the canonical home of the spec-* authoring skills, sync stays explicit.

## 2. Background and Current State

Convergent findings from the 2026-07-06 review (3/3 models, restated):

- **Cross-repo reference resolution is the top portability risk.** `skills/backlog-triage/SKILL.md` (Report Evidence, References) and `skills/dev-backlog/references/backlog-boundaries.md` instruct agents to read `../spec-charter/references/alignment.md` and `../spec-charter/references/spec-axis.md`. Those paths exist only when craftkit is installed as a sibling skill, in a layout no platform guarantees. When absent, nothing fails loud — triage silently renders "Alignment: skipped" and boundary questions dangle.
- **The minimum adoption path is buried.** A new adopter meets related-skills pointers, the spec axis, relay interop, mirror issues, and reassess accounting before the five-command happy path (init → sync-pull → sprint-init → next → close). The heaviest parts of the contract are optional, but they are not *priced* as optional.
- **Empty spec fields are ceremony.** A sprint in a repo with no `spec/` still carries `objectives: []` and `component: ""` — fields the agent must generate and lint scripts must special-case, meaning nothing.
- **SKILL.md token debt.** The script flag inventory (~25 lines) and the reassess accounting paragraph (SKILL.md ~line 121) are reference material living in the always-loaded execution contract. The same accounting is already documented in `references/integration-contract.md`.
- **Unmoored `[~]` has detection but no repair surface.** `backlog-doctor` warns; the fix (annotate `[branch:...]`/`[run:...]`/PR pointer, or strike with a Progress entry) lives dispersed across capabilities prose and the integration contract. No single page answers "the doctor warned — now what?"

Reviewer divergences resolved for this PRD: eval prompts stay in SKILL.md (they double as behavior spec and are cheap) but gain the missing bootstrap case; pi's proposal to merge `objectives:`/`component:` into one field is **rejected** (breaks the relay-parsed frontmatter contract for marginal gain — field omission achieves most of the benefit); opencode's sprint-mirror/charter-tension note is recorded as a one-line charter clarification candidate, not a workstream.

## 3. Goals and Non-Goals

### Goals

- G1. A fresh agent session in a repo **without craftkit installed** can run the full orient → plan → work → close cycle from this repo's files alone, with every spec-axis degradation rule resolvable locally.
- G2. The first-run path a new adopter sees — in README and in SKILL.md — is the no-spec, no-relay, no-triage minimum; spec axis, relay interop, and mirroring are priced as opt-in extensions.
- G3. Sprints in spec-less repos carry no empty spec ceremony: absent spec files mean omitted fields, and validation treats omission-when-absent as pass.
- G4. `skills/dev-backlog/SKILL.md` sheds reference material without losing contract force; existing eval prompts still pass.
- G5. A doctor unmoored-`[~]` warning names one runbook that repairs it.
- G6. The cold-adopter scenario is a permanent regression gate (eval prompt + smoke coverage), written before the fixes land.

### Non-Goals

- **No spec-* authoring skill fork.** craftkit remains the canonical home of `spec-charter`/`spec-system-map`/`spec-grill` (charter Decision 2026-07-04). The local fallback covers *consumption-side degradation only* — what dev-backlog does when spec files or the skills are absent — never authoring semantics. The 2026-06/07 silent fork must not recur through this door.
- **No new SSOT or mirror work.** Sprint SSOT was decided 2026-07-03; untouched.
- **No relay contract grammar changes.** Checkbox states, trace grammar, section headings, and the JSON schemas are frozen here; frontmatter field omission is the only touch and is coordinated (§7).
- **No `anchors:` field merge** (rejected divergence, §2).
- Unchanged: no daemon, no silent sync, no background mutation.

## 4. Workstream V — Cold-Adopter Verification Gate (write first)

Per writing-effective-skills discipline: the test precedes the fix. This workstream lands first and is *expected to fail* against current HEAD.

### V1. Cold-adopter eval + smoke coverage

- Add to the SKILL.md Eval Prompts section: "Orient and plan in a repo with no `backlog/`, no `spec/`, no root `CHARTER.md`, and no craftkit skills installed; open GitHub issues exist." Expected: bootstrap `backlog/`, route to `plan`, produce an active sprint with spec fields omitted, and never chase a `../spec-charter/...` path.
- Add a deterministic smoke case (`smoke-test.sh`): in a fixture without spec files, `sprint-init.js` / `objectives-check.js` / `component-lint.js` / `backlog-doctor.js` all pass with omitted fields (after B-workstream lands), and no skill/reference file instructs an unconditional read of a `../spec-charter/` path (assert via grep over `skills/`).

The eval run against current HEAD is the RED record; A and B make it GREEN.

## 5. Workstream A — Spec-Axis Decoupling (standalone degradation contract)

### A1. Local fallback reference

New `skills/dev-backlog/references/spec-fallback.md` (~1 page, consumption-side only):

- The four-combo degradation matrix — charter present/absent × capabilities present/absent — and what `objectives:` / `component:` mean in each cell (including the legacy root `CHARTER.md` fallback rule, stated once).
- What triage Alignment and Decision Review do when charter/capabilities/system-map are missing (skip with an explicit "skipped because X absent" line in the report — never silent).
- One pointer: "authoring semantics and spec-axis boundaries live in craftkit's `spec-charter`; when installed, its `references/spec-axis.md` and `references/alignment.md` deepen this fallback but are never required."

### A2. Re-point backlog-triage

`skills/backlog-triage/SKILL.md`: Report Evidence and References sections stop *requiring* `../spec-charter/...` reads. Alignment/Decision Review run from `spec/*` files + the local fallback; the craftkit references become "when installed" enhancements. Report output states which evidence tier was used.

### A3. Re-point dev-backlog boundary docs

`skills/dev-backlog/references/backlog-boundaries.md` and the SKILL.md Core Contracts bullet: spec-axis boundary pointer targets `references/spec-fallback.md` locally, with craftkit named as the authoring home — same demotion as A2.

## 6. Workstream B — First-Run Minimum Path

### B1. README first-screen reorder

Quick Start shows the five-command minimum cycle and the `/dev-backlog` session loop with **zero** spec/relay/triage mentions; spec axis, relay integration, and triage keep their sections but move behind an explicit "Optional extensions" boundary with one-line pricing ("adds X, requires Y").

### B2. SKILL.md minimum-path framing

The Related-skills paragraph moves below the Mode Router and gains one framing sentence: none of it is required for the core cycle. Plan-mode step 1 and the Sprint File Contract table state the omission rule (B3) instead of the empty-value rule.

### B3. Field omission semantics

When `spec/charter.md` (and legacy root `CHARTER.md`) are absent, sprints omit `objectives:` entirely; when `spec/capabilities.md` is absent or nothing fits, sprints omit `component:`. Changes: `sprint-init.js` (stop emitting empty fields when spec absent), `objectives-check.js` / `component-lint.js` / `backlog-doctor.js` (omission-when-absent = pass; present-but-invalid stays a hard fail), `references/file-format.md` + `references/integration-contract.md` (frontmatter table marks both fields optional). Existing sprints with `objectives: []` stay valid (additive tolerance, no migration).

## 7. Workstream C — Contract Hygiene

- C1. **Script inventory extraction.** New `skills/dev-backlog/references/scripts.md` carries the full script/flag table. SKILL.md keeps the resolution rule (2–3 lines) plus one-line mentions of the six core scripts (`init.sh`, `sync-pull.js`, `sprint-init.js`, `next.sh`/`status.sh`, `sprint-close.sh`, `backlog-doctor.js`).
- C2. **Reassess paragraph compression.** SKILL.md Complete-mode reassess accounting shrinks to one sentence + pointer to `references/integration-contract.md` § Backlog Doctor JSON Surface (already the detailed home).
- C3. **Checkbox repair runbook.** New `skills/dev-backlog/references/checkbox-repair.md`: detect (doctor warn / `--json` `unmoored: true`) → repair (add PR/branch/run pointer; or explicit "no work yet" annotation; or strike + Progress entry). `backlog-doctor.js` unmoored warn text names the runbook path. Grammar itself unchanged.

Relay coordination: B3 omission and C3 message text are additive; confirm dev-relay's sprint frontmatter reads (if any) tolerate absent keys before landing B3 — recorded as an AC on the B3 issue, mirroring the S7 pattern from the substrate PRD.

## 8. Charter Touch (proposal only, human-gated)

Candidate amendment for a future `spec-charter amend`, recorded here and not executed by this PRD:

- New objective candidate: "A non-author adopter without craftkit reaches a first closed sprint using README + SKILL.md alone" — src: 2026-07-06 external review; V1 is its measurement.
- Approach clarification candidate (one line): the sprint mirror is an explicit-sync, marker-scoped exception to "no derived write surfaces."

## 9. Sequencing and Epic Candidates

V first (RED), then A and B in parallel (both GREEN the gate), C independent and small.

| Epic | Issues (seed) | Depends on |
| --- | --- | --- |
| E1 Cold-adopter gate | V1 eval prompt + smoke case (lands failing where fixture-able; grep assertion may land with A) | — |
| E2 Spec-axis decoupling | A1 `spec-fallback.md` · A2 backlog-triage re-point · A3 boundary-doc re-point | A2/A3 after A1 |
| E3 First-run minimum path | B1 README reorder · B2 SKILL.md framing · B3 field omission (scripts + contract docs, relay-coordination AC) | — |
| E4 Contract hygiene | C1 scripts.md extraction · C2 reassess compression · C3 checkbox-repair runbook + doctor message | — |

Suggested milestone cut: one milestone ("2026-07 adoption hardening"), all four epics; E1's eval flips from RED to GREEN as the milestone's closing check.

## 10. Success Criteria

- S1. The cold-adopter eval passes: a fresh session in a craftkit-less, spec-less repo bootstraps, plans, and closes without chasing any `../spec-charter/` path. (G1, G6)
- S2. `grep -r '\.\./spec-charter' skills/` matches only "when installed" enhancement phrasing — no required-read instruction. (G1)
- S3. README's first screen and SKILL.md's pre-router content contain the minimum cycle only; extensions are priced behind an explicit boundary. (G2)
- S4. In a spec-less fixture, `sprint-init.js` emits no `objectives:`/`component:` keys and all four validators pass; with spec files present, invalid IDs still hard-fail. (G3)
- S5. `skills/dev-backlog/SKILL.md` drops ≥30 lines net while every pre-existing eval prompt still passes. (G4)
- S6. A seeded unmoored `[~]` produces a doctor warn that names `references/checkbox-repair.md`, and the runbook resolves it in one pass. (G5)
- S7. dev-relay smoke tests pass unchanged after B3 (frontmatter omission is additive). 

## 11. Risks and Open Questions

- **Fallback fork risk (the big one).** `spec-fallback.md` could drift into a second spec-axis authority — the exact failure mode of the 2026-06/07 silent fork. Mitigation: consumption-side scope only, ~1 page hard cap, explicit "authoring lives in craftkit" pointer, and `capabilities-doctor`-style compactness is not extended to it (it is a reference, not a spec).
- **Omission semantics ripple.** Four scripts special-case empty values today; omission must be additive (absent key = same meaning as empty when spec absent, warn-level when spec present). Existing dogfood sprints are grandfathered.
- **Token diet can cut muscle.** S5 gates the diet on the existing eval prompts; anything the evals need stays.
- **README reorder vs. current adopters.** Links into README sections may shift; keep anchors stable where possible.
- Open: whether `spec-fallback.md` should be shared by both skills via one file (backlog-triage referencing `../dev-backlog/references/spec-fallback.md` — an intra-repo sibling path that *is* guaranteed by the bundle) or duplicated per skill; default is the shared intra-bundle path since both skills ship together.
