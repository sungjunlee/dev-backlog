# Charter Amendment Guidance

Use this reference in `spec-charter` amend mode after re-reading the current repo-root `CHARTER.md`. The default bias is stability: no change unless concrete evidence shows the charter is stale, weak, or newly validated.

## Tier 1 Challenge Checklist

Tier 1 covers Problem, Approach, and Non-Goals. It is human-gated: propose, challenge, confirm, then apply.

Problem:

- Does it still describe the actual pain the project exists to solve?
- Is it diagnosis-only, without solution language hidden inside it?
- Has recent work revealed a narrower, broader, or different pain?
- Would a new contributor understand why this project should exist?

Approach:

- Is this still how work is really being done?
- Does it describe a guiding policy rather than a task list?
- Has execution proven the current approach ineffective or misleading?
- Is the approach specific enough to reject plausible but wrong work?

Non-Goals:

- Has any Non-Goal silently been violated by recent issues, PRs, or sprint plans?
- Is each Non-Goal still an intentional boundary with a reason?
- Should a violated Non-Goal become an accepted direction change, or should the violating work be dropped?
- Are any Non-Goals stale because the project scope has legitimately moved?

## Tier 2 Proof Gate

Objective status advances are proof-gated. Advancing `active` to `validated` or `deferred` requires cited evidence that matches the objective predicate.

Acceptable proof includes:

- A merged PR that closes or visibly satisfies the predicate.
- A passing check, test, or smoke run that demonstrates the predicate.
- A relay run whose Done Criteria match the predicate and completed successfully.

If proof is absent or does not match the predicate, refuse the status advance and flag the missing evidence. Do not weaken the objective so the proof appears sufficient.

Adding or removing objectives is human-gated, not proof-gated. Removed objective IDs are never reused.

## No Rubber-Stamp Rule

Re-apply pushback on every amend. Treat requested changes as proposals, not instructions to silently accept.

- Default to no change unless there is concrete evidence.
- Ask what changed in the world, backlog, or execution record.
- Prefer precise diffs over broad rewrites.
- Preserve the charter's role as a yardstick; do not mutate it to declare victory.

## Bloat Check

Protect the ~5-minute-read property on every amendment.

- Challenge additions that duplicate `README.md`, `CLAUDE.md`, or `_context.md`.
- Collapse long `deferred` objective lists when they no longer guide active work.
- Move operational HOW-knowledge to `_context.md`.
- Keep Decisions append-only, but avoid recording trivia as decisions.
