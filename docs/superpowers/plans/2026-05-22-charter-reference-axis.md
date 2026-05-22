# CHARTER Reference Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in per-project `CHARTER.md` reference axis, plus the `backlog-charter` skill that creates/amends it, `sprint-init` integration, and a CHARTER-aware Alignment Check in `backlog-triage`.

**Architecture:** A new `backlog-charter` skill in the `dev-backlog` repo owns the create/amend lifecycle of a repo-root `CHARTER.md` with a 3-tier mutation discipline (Direction / Predicates / History). `dev-backlog` sprint planning and `backlog-triage` read the charter and degrade gracefully when it is absent. The work is mostly Markdown/prompt authoring (`SKILL.md`, template, reference docs); the only executable-code change is one frontmatter line in `sprint-init.js`.

**Tech Stack:** Markdown SKILL files; Node.js built-in test runner (`node --test`) for the single script change; `gh` CLI unaffected.

**Read first:** `docs/superpowers/specs/2026-05-22-charter-reference-axis-design.md` — the approved design spec. It is the content authority for every section this plan tells you to author.

---

## File Structure

**New files (all under `skills/backlog-charter/`):**

| File | Responsibility |
|------|----------------|
| `SKILL.md` | Agent contract: create mode, amend mode, the 3-tier discipline |
| `templates/charter.md` | The `CHARTER.md` template emitted in create mode |
| `references/amendment.md` | Deep guidance for amend mode — challenge heuristics, proof-gate rules |
| `references/alignment.md` | Shared work↔objective mapping logic + severity rules (consumed by `backlog-triage` and `dev-backlog`) |

**Modified files:**

| File | Change |
|------|--------|
| `skills/dev-backlog/scripts/sprint-init.js` | Add `objectives: []` to the generated sprint frontmatter |
| `skills/dev-backlog/scripts/sprint-init.test.js` | Update `buildSprintContent` expectation |
| `skills/dev-backlog/SKILL.md` | Sprint frontmatter gains `objectives:`; planning reads `CHARTER.md`; graceful degradation |
| `skills/backlog-triage/SKILL.md` | Add the Alignment Check analysis + `## Alignment` report section |
| `CLAUDE.md`, `CHANGELOG.md`, `VERSION` | Record the new skill |
| `../CLAUDE.md` (harness-stack root) | dev-backlog is now a 3-skill project |

`CHARTER.md` itself is a per-project artifact created at runtime by the skill — it is **not** committed by this plan.

---

## Task 1: Scaffold `backlog-charter` skill + CHARTER template

**Files:**
- Create: `skills/backlog-charter/templates/charter.md`
- Create: `skills/backlog-charter/references/.gitkeep`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p skills/backlog-charter/templates skills/backlog-charter/references
touch skills/backlog-charter/references/.gitkeep
```

- [ ] **Step 2: Write the CHARTER template**

Create `skills/backlog-charter/templates/charter.md` with exactly this content. Angle-bracket text is placeholder copy the skill replaces during create mode; HTML comments are tier markers that stay in the file.

```markdown
---
last_amended: <YYYY-MM-DD>
revision: 1
---

# <Project> Charter

## Problem            <!-- Tier 1 · Direction (human-gated) -->
<1-2 sentences: the problem this project exists to solve. Diagnosis only — no solution language.>

## Approach           <!-- Tier 1 · Direction (human-gated) -->
<1-2 sentences: the guiding policy — how the problem is being solved.>

## Non-Goals          <!-- Tier 1 · Direction (human-gated) -->
- <something deliberately not done> — <reason>

## Objectives         <!-- Tier 2 · Predicates (add/remove human-gated; status proof-gated) -->
- O1 [active] <verifiable predicate, e.g. "a user can log in with Google"> · src: user

## Decisions          <!-- Tier 3 · History (immutable, append-only) -->
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
```

- [ ] **Step 3: Verify the files exist**

Run: `ls -R skills/backlog-charter`
Expected: shows `templates/charter.md` and `references/.gitkeep`.

- [ ] **Step 4: Commit**

```bash
git add skills/backlog-charter/templates/charter.md skills/backlog-charter/references/.gitkeep
git commit -m "feat(backlog-charter): add CHARTER.md template + skill scaffold"
```

---

## Task 2: Write `backlog-charter/SKILL.md`

**Files:**
- Create: `skills/backlog-charter/SKILL.md`

Author authority: design spec sections "Artifact — `CHARTER.md`" and "Skill — `backlog-charter`". Keep the file lean (target < 200 lines); push deep detail to `references/` (Task 3).

- [ ] **Step 1: Write the frontmatter**

```markdown
---
name: backlog-charter
argument-hint: "[create|amend]"
description: Create and amend CHARTER.md — a durable per-project reference axis (problem, approach, non-goals, verifiable objectives, decisions) that sprints and backlog triage are measured against. Use to establish or evolve project direction, 프로젝트 축, 기준, 헌장.
compatibility: Requires git. Works on Claude Code and Codex.
metadata:
  related-skills: "dev-backlog, backlog-triage"
---
```

- [ ] **Step 2: Write the overview + "What CHARTER.md is" section**

Cover: `CHARTER.md` lives at repo root, peer of `README.md`; it is the reference axis the backlog is measured against; opt-in per project; must stay under a ~5-minute read; operational know-how does NOT belong here (that is `_context.md`). Include the Document Roles table from the spec.

- [ ] **Step 3: Write the "3 Tiers" section**

Reproduce the spec's 3-tier table verbatim — columns `Tier | Sections | Mutation discipline | Rationale`, rows for Tier 1 Direction (Problem/Approach/Non-Goals, human-gated), Tier 2 Predicates (Objectives; status advance proof-gated, add/remove human-gated), Tier 3 History (Decisions, append-only). State the principle: a stable core makes the moving parts meaningful; this tiering is the safeguard against the axis self-evolving into a rubber-stamp.

- [ ] **Step 4: Write the "Create mode" section**

Routing: invoked with no `CHARTER.md` present → create mode. Steps: (1) draft from repo signals — `README.md`, `CLAUDE.md`, open epics/issues, recent commits; (2) interview the user to fill and sharpen Problem, Approach, Non-Goals, initial Objectives; (3) write `CHARTER.md` from `templates/charter.md` with `revision: 1` and today's `last_amended`. State the Objective conventions: verifiable predicates not tasks; mixed rigor allowed (runnable check ideal, "observable" statement acceptable); `O<n>` IDs; removed IDs never reused; `src:` records provenance.

- [ ] **Step 5: Write the "Amend mode" section**

Routing: invoked with `CHARTER.md` present → amend mode. Re-read the file, then apply the 3-tier discipline: Tier 1 + objective add/remove → surface stale/weak items, challenge them (no rubber-stamping), propose concrete diffs, confirm with the user, apply. Tier 2 status advance → require proof (cite merged PR / passing check / relay run); without proof, refuse and flag. Tier 3 Decisions → append-only; never edit/delete a row; reversal is a new `supersedes` row. Finally bump `last_amended` and `revision`. Note that amend mode can take a `backlog-triage` Alignment Check report as a seed of proposed changes. Note that direct hand-edits of `CHARTER.md` are allowed (it is the user's file) — this skill is simply the disciplined path. Point to `references/amendment.md` for the deep challenge/proof heuristics.

- [ ] **Step 6: Write the "References" section**

List `references/amendment.md` (challenge + proof-gate heuristics) and `references/alignment.md` (the shared work↔objective mapping logic, also consumed by `backlog-triage` and `dev-backlog`).

- [ ] **Step 7: Verify**

Run: `wc -l skills/backlog-charter/SKILL.md`
Expected: under ~200 lines. Read the file start to finish — every section from Steps 1-6 is present, no "TODO"/"TBD", routing between create and amend modes is unambiguous.

- [ ] **Step 8: Commit**

```bash
git add skills/backlog-charter/SKILL.md
git commit -m "feat(backlog-charter): add SKILL.md create/amend contract"
```

---

## Task 3: Write `backlog-charter` reference docs

**Files:**
- Create: `skills/backlog-charter/references/amendment.md`
- Modify: replace `skills/backlog-charter/references/.gitkeep` with `references/alignment.md`

- [ ] **Step 1: Write `references/amendment.md`**

Deep guidance for amend mode. Contents: (a) the challenge checklist for Tier 1 — for each of Problem/Approach/Non-Goals, the questions that detect staleness/weakness (e.g. "does Problem still describe the actual pain? is Approach still how work is really done? has any Non-Goal silently been violated?"); (b) the proof-gate rule for Tier 2 — what counts as proof for `active → validated` (a merged PR closing the predicate, a passing check, a relay run whose Done Criteria match the predicate) and the explicit instruction to refuse advancement without it; (c) the "no rubber-stamp" rule — re-apply pushback on every amend, default to "no change" unless there is concrete evidence (stability bias); (d) the bloat check — challenge any violation of the ~5-minute-read property; `deferred` objectives may be collapsed.

- [ ] **Step 2: Write `references/alignment.md`**

The shared mapping logic. Contents: (a) how to map an open issue/epic to Objective ID(s) — semantic inference from issue title/body against objective predicates; an issue may map to zero, one, or many objectives; (b) the three drift findings with severity — `orphan work` (issue maps to no objective; medium), `neglected objective` (an `active` objective with no open issue advancing it; medium), `contradiction` (an issue that violates a Non-Goal; high); (c) the coverage line format — e.g. `"7/9 open issues → objectives ✓ · O3 has no work ⚠"`; (d) the note that mapping is not driven by mandatory issue tags — tags in issue bodies are optional hints only.

```bash
rm skills/backlog-charter/references/.gitkeep
```

- [ ] **Step 3: Verify**

Run: `ls skills/backlog-charter/references`
Expected: `alignment.md` and `amendment.md` (no `.gitkeep`). Read both — concrete rules, no placeholders.

- [ ] **Step 4: Commit**

```bash
git add skills/backlog-charter/references/
git commit -m "docs(backlog-charter): add amendment + alignment reference docs"
```

---

## Task 4: `sprint-init.js` — emit `objectives` frontmatter

**Files:**
- Modify: `skills/dev-backlog/scripts/sprint-init.test.js`
- Modify: `skills/dev-backlog/scripts/sprint-init.js:53-79` (the `buildSprintContent` function)

- [ ] **Step 1: Update the test expectation first (TDD red)**

Open `skills/dev-backlog/scripts/sprint-init.test.js`. Find the test(s) that assert on `buildSprintContent` output (search for `buildSprintContent` and for `status: active`). In every expected-frontmatter assertion, add an `objectives: []` line immediately after the `due:` line, so the expected frontmatter block reads:

```
---
milestone: ...
status: active
started: ...
due: ...
objectives: []
---
```

- [ ] **Step 2: Run the test to verify it fails (red)**

Run: `node --test skills/dev-backlog/scripts/sprint-init.test.js`
Expected: FAIL — the `buildSprintContent` assertion(s) mismatch because the generated content still lacks the `objectives: []` line.

- [ ] **Step 3: Add the frontmatter line to `buildSprintContent`**

In `skills/dev-backlog/scripts/sprint-init.js`, the `buildSprintContent` function returns a template string. Add `objectives: []` to the frontmatter block, between the `due:` line and the closing `---`:

```javascript
  return `---
milestone: ${milestone}
status: active
started: ${started}
due: ${due}
objectives: []
---

# ${topic}
```

(Leave the rest of the function — `# ${topic}`, `## Goal`, `## Plan`, etc. — unchanged.)

- [ ] **Step 4: Run the test to verify it passes (green)**

Run: `node --test skills/dev-backlog/scripts/sprint-init.test.js`
Expected: PASS — all `buildSprintContent` assertions match.

- [ ] **Step 5: Run a dry-run smoke check**

Run: `node skills/dev-backlog/scripts/sprint-init.js "smoke-test" --dry-run`
Expected: printed skeleton contains the line `objectives: []` in its frontmatter.

- [ ] **Step 6: Commit**

```bash
git add skills/dev-backlog/scripts/sprint-init.js skills/dev-backlog/scripts/sprint-init.test.js
git commit -m "feat(dev-backlog): sprint-init emits objectives frontmatter field"
```

---

## Task 5: `dev-backlog/SKILL.md` — CHARTER integration

**Files:**
- Modify: `skills/dev-backlog/SKILL.md` (Sprint File Format ~62-106, section table ~138-144, Process ~201-209)

Author authority: design spec section "Integration → dev-backlog `sprint-init` reads `CHARTER.md`" and "Graceful degradation".

- [ ] **Step 1: Add `objectives:` to the documented sprint frontmatter**

In the `## Sprint File Format` code block, add `objectives: [O1, O3]` to the example frontmatter (after `due:`). Add a sentence: the `objectives` frontmatter field lists the `CHARTER.md` Objective IDs this sprint advances; it is `[]` when the project has no `CHARTER.md`.

- [ ] **Step 2: Add a "Charter alignment" note to the planning process**

In the `## Process` section (and/or `references/process.md` where the Plan step is detailed), add: when planning a sprint, if `CHARTER.md` exists at repo root, read its `active` Objectives first; derive the sprint as the projection of those objectives onto not-yet-done work; record the advanced objective IDs in the sprint file's `objectives:` frontmatter. If `CHARTER.md` does not exist, plan exactly as before and leave `objectives: []`.

- [ ] **Step 3: Add the section-table row**

In the "What each section does" table, the `objectives` frontmatter field is covered by the Step 1 sentence; ensure the Goal row still reads correctly. No new table row is required — keep the change minimal.

- [ ] **Step 4: Verify line budget and coherence**

Run: `wc -l skills/dev-backlog/SKILL.md`
Expected: under 250 lines (the file's stated limit). Read the changed sections — the CHARTER read is described, graceful degradation when absent is explicit.

- [ ] **Step 5: Commit**

```bash
git add skills/dev-backlog/SKILL.md skills/dev-backlog/references/process.md
git commit -m "feat(dev-backlog): sprint planning reads CHARTER.md objectives"
```

(If `references/process.md` was not modified, drop it from the `git add`.)

---

## Task 6: `backlog-triage/SKILL.md` — Alignment Check

**Files:**
- Modify: `skills/backlog-triage/SKILL.md` (Two-Phase Model ~27-33, Report Shape ~86-116, Process ~136-145)

Author authority: design spec section "Integration → backlog-triage Alignment Check". The Alignment Check is **prompt-driven** — it is an analysis the agent performs, not a new `triage-*.js` script (issue→objective mapping is semantic, unlike the deterministic relate/stale scripts).

- [ ] **Step 1: Add the Alignment Check to the Phase 1 analysis description**

In `## Two-Phase Model → Phase 1`, add Alignment Check as an analysis step: when `CHARTER.md` exists at repo root, the agent maps open issues to its Objectives using `../backlog-charter/references/alignment.md`, and emits an `## Alignment` report section. State explicitly that this step is prompt-driven (not a script) and is skipped entirely when `CHARTER.md` is absent (graceful degradation).

- [ ] **Step 2: Add `## Alignment` to the Report Shape**

In `## Report Shape`, add an `## Alignment` section to the example report, before `## Apply Checklist`. It contains: the coverage line; `orphan work` items; `neglected objective` items; `contradiction` items (highest severity); and a `Proposed CHARTER changes` subsection that formats the findings as a seed for `backlog-charter` amend.

- [ ] **Step 3: Add an Alignment row to the "Relationship to dev-backlog" table**

Add a row: `CHARTER alignment of open issues | backlog-triage (report)`. Keep `CHARTER.md` mutations owned by `backlog-charter` — note that the triage report only *proposes*; applying changes is `backlog-charter` amend (gated).

- [ ] **Step 4: Update the Process section**

In `## Process`, note that the Alignment Check runs during Analyze when `CHARTER.md` is present, and that its `Proposed CHARTER changes` feed `backlog-charter` amend — they are not applied by `triage-apply.js` (which only mutates GitHub issues).

- [ ] **Step 5: Verify**

Read the file start to finish — the Alignment Check is described as prompt-driven, graceful degradation is explicit, and `CHARTER.md` mutation ownership stays with `backlog-charter`. Confirm no claim that a `triage-align.js` script exists.

- [ ] **Step 6: Commit**

```bash
git add skills/backlog-triage/SKILL.md
git commit -m "feat(backlog-triage): add CHARTER-aware Alignment Check"
```

---

## Task 7: Record the new skill (docs, version, changelog)

**Files:**
- Modify: `VERSION`, `CHANGELOG.md`, `CLAUDE.md`, `../CLAUDE.md` (harness-stack root)

- [ ] **Step 1: Bump VERSION**

Read `VERSION`, increment the minor version (new feature), write it back. Example: `1.4.0` → `1.5.0`.

- [ ] **Step 2: Add a CHANGELOG entry**

Prepend a new entry to `CHANGELOG.md` describing: new `backlog-charter` skill + `CHARTER.md` reference axis; `sprint-init` emits `objectives` frontmatter; `backlog-triage` gains a CHARTER-aware Alignment Check. Match the existing CHANGELOG format (read the top entry first).

- [ ] **Step 3: Update `dev-backlog/CLAUDE.md`**

In the `## Project Structure` block, add `backlog-charter/` alongside `dev-backlog/` and `backlog-triage/`. If there is a skill count or list, update it to three skills.

- [ ] **Step 4: Update the harness-stack root `CLAUDE.md`**

In `../CLAUDE.md`, the dev-backlog row currently says "(2 skills)" / "Two skills". Update to three skills and add a one-line description of `backlog-charter` (creates/amends `CHARTER.md`, the project reference axis).

- [ ] **Step 5: Verify**

Run: `cat VERSION && head -20 CHANGELOG.md`
Expected: bumped version; new changelog entry at the top. Confirm both CLAUDE.md files mention `backlog-charter`.

- [ ] **Step 6: Commit**

```bash
git add VERSION CHANGELOG.md CLAUDE.md
git commit -m "docs: record backlog-charter skill (version, changelog, CLAUDE.md)"
```

Note: `../CLAUDE.md` is the harness-stack workspace file, which is **not** a git repo — it is edited in Step 4 but not committed (it stays out of the `git add` above).

---

## Verification (whole feature)

After Task 7, confirm end to end:

- [ ] No `CHARTER.md` present → `node skills/dev-backlog/scripts/sprint-init.js "x" --dry-run` still works; frontmatter has `objectives: []`.
- [ ] `node --test skills/dev-backlog/scripts/sprint-init.test.js` passes.
- [ ] `skills/backlog-charter/` has `SKILL.md`, `templates/charter.md`, `references/amendment.md`, `references/alignment.md`.
- [ ] Manually dry-run the skill logic: in a scratch dir with no `CHARTER.md`, the create-mode steps in `SKILL.md` are followable; with a `CHARTER.md` present, amend mode routes correctly and the proof gate refuses an unproven `active → validated`.
- [ ] Both SKILL.md files describe graceful degradation when `CHARTER.md` is absent.

## Self-Review notes (already applied)

- **Spec coverage:** artifact (T1-2), skill create/amend (T2-3), 3-tier discipline (T2-3), sprint-init integration (T4-5), Alignment Check (T6), graceful degradation (T5-6), document roles (T2), version/docs (T7). Deferred items (automated reassess, `/goal` emission, independent-review routing, mandatory issue tagging) are out of scope per the spec and intentionally absent.
- **No new triage script:** the Alignment Check is prompt-driven by design — issue→objective mapping is semantic. Task 6 Step 5 explicitly guards against implying a `triage-align.js`.
- **Naming consistency:** `backlog-charter`, `CHARTER.md`, `objectives` frontmatter key, `O<n>` IDs, `references/alignment.md`, `references/amendment.md` are used identically across all tasks.
