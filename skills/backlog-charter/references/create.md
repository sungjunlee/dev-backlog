# Charter Create Mode: Signals, Interview, Seed Decisions

Use this reference in `backlog-charter` create mode after confirming no repo-root `CHARTER.md` exists. The goal is a defensible first revision that survives its own proof gate — not a perfect axis on day one. Stability comes from amend mode; create mode just has to set a credible starting point.

## 1. Signal Collection (Priority + Conflict)

Create mode step 1 draws from repo signals. When signals are rich, weight them by intent fidelity; when they are missing, fall back rather than stalling.

### Priority order

1. **`README.md`** — outward-facing problem framing, audience, and approach. Highest fidelity for Problem and Approach.
2. **Open epics and issues** — current execution surface; useful for Objectives and active scope.
3. **Recent commits** (last ~30 merged PRs) — what is actually being built; corrects for stale README.
4. **`CHANGELOG.md`** — shipped reality; useful when commits are noisy.
5. **`CLAUDE.md`** (or `AGENTS.md`, `GEMINI.md`) — development-harness conventions: local commands, agent workflow, and guardrails.

Stop at the first three signals that produce a coherent draft. More signals beyond that mean diminishing returns and longer interview prep.

### Fallback when README is absent or stale

- Derive Problem from the **5 most-recurring issue titles** plus any pinned issue or epic.
- Derive Approach from the **5 most recent merged PRs** — what choices keep recurring across them?
- Surface the absence in the interview: "There is no README — I drafted Problem from issue titles; correct me where I'm wrong."

### Conflict handling

`CLAUDE.md` / `AGENTS.md` can explain how to work in the repo, but they are not product authority by default. Use them to seed questions about conventions and workflow; do not let them override README, issues, shipped behavior, or user answers unless they explicitly describe product boundaries.

When signals disagree (e.g., README says "CLI tool," CLAUDE.md says "web app," commits show both), do not pick silently.

- Name the conflict explicitly in the interview.
- Ask which surface is the project's current center of gravity.
- Prefer the most recent signal as a tiebreaker only if the user has no answer.

Silent picks pollute Problem and Approach for the life of the charter.

## 2. Interview Checklist

Create mode step 2 is an interview to fill and sharpen Problem, Approach, Non-Goals, and initial Objectives. Run the prompts below in order. Each question has a default frame; offer it as a starting point, do not impose it.

### Problem framing

Pick the closest frame and pressure-test it:

- **AI-context-loss** — "Agents and humans re-derive state every session; nothing persists between them."
- **Shared-state-missing** — "Humans and tools each have their own view; no single read-it-once surface."
- **Source-of-truth-without-abandonment** — "An existing tool (GitHub, Jira) is canonical; we add to it without replacing it."
- **Other** — let the user name it; do not force a frame.

Confirm the frame is **diagnosis-only** — no solution language leaks into Problem.

### Approach (the wedge test)

> "What is the wedge that would shrink if scope shrunk?"

The answer names the irreducible Approach. If the user names a tool ("we use GitHub Issues"), keep digging — the wedge is the *choice* behind the tool, not the tool itself.

Pressure-test: "If we removed everything else, would this still be the project?" If no, the wedge is wrong.

### Non-Goals elicitation

> "What would you say no to even if a user asked for it?"

Then:

> "What has a contributor already proposed that you rejected, and why?"

Both questions surface real Non-Goals (intentional rejections with rationale) rather than abstract anti-patterns. Three to six entries is healthy; ten is bloat.

### Initial Objectives

> "Name 2–3 outcomes a user could observe today, and mark status by current shipped reality."

Use the shape `O<n> [status]    <verifiable predicate> · src: user`. Default new objectives to `active` unless the user has shipped evidence (then `validated`) or deliberately parked them (then `deferred`).

For predicate quality, follow [`objectives.md`](objectives.md): five good and five bad worked examples, common rewrite patterns, and the 30-second test. Run any draft objective through the 30-second test before committing it.

## 3. Seed Decisions

Create mode step 3 writes the file from `templates/charter.md`. The Decisions table may be left empty.

### Default: empty is fine

Decisions accrue naturally through amend mode as cross-cutting choices get made. An empty Decisions table on revision 1 is not a defect.

### When to seed 3–5 rows

Seed only when the project has prior artifacts that already record direction:

- Design documents or RFCs that locked an architectural choice.
- ADRs (Architectural Decision Records).
- Notable merged PRs whose descriptions explain a non-obvious direction.

Pull three to five entries, no more. Each row needs `date`, `decision`, `rationale`, and (if reversing prior direction) `supersedes`.

### Immutability from revision 2 onward

Whatever lands in Decisions on revision 1 — including seeded entries — is immutable from revision 2 onward. A reversal is a new row with `supersedes`, never an edit or delete. Mention this to the user before seeding so they do not overpopulate optimistically.

## Outcome

A first-revision charter produced via this checklist should:

- Read in under 5 minutes (run [`check-size.js`](../scripts/check-size.js) if available).
- Carry Problem / Approach / Non-Goals that survived a challenge round, not first-draft acceptance.
- List 2–3 Objectives, each one the 30-second test would pass.
- Have an empty or lightly-seeded Decisions table.
- Match in shape (not content) the charter dev-backlog created for itself on 2026-05-23.
