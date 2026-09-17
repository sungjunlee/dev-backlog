# Eval Prompts

Fresh-session recovery prompts for each skill. Each prompt names a scenario
a session might wake into with no prior conversation history, and the
"Expected:" text after it is the outcome a conforming session must reach.

These are test fixtures, not execution contract — they used to live as an
`## Eval Prompts` section inside each `SKILL.md`, where every session paid
their token cost whether or not it needed them. They now live here instead,
consumed by the #367 conformance cadence rather than read on every session.

- `dev-backlog.md` — prompts for the `dev-backlog` skill.
- `backlog-triage.md` — prompts for the `backlog-triage` skill.

Revised 2026-09-13 (#407): `dev-backlog.md` scenarios 3 and 7 Expected relaxed as over-specified per the 2026-09-12 conformance run.

Revised 2026-09-17 (#423): `dev-backlog.md` gains scenarios 11 (`.tracker=files` sprint-free work) and 12 (legacy `backlog/` layout); scenario 4 names three ordered issues.

Revised 2026-09-17 (#431): scenario 12 Expected accepts "run setup or ask before the move" once the migration path is named; the prohibitions (no two roots, no legacy hub, tasks/docs/completed untouched) are the graded part.

Revised 2026-09-17 (#443): scenarios 6, 7, 10, and 11 drop the deleted resolver script; the Work rail is a `gh issue view --json body,comments` read, with an `## Agent Brief` comment over the body and `spec_ref:` over both.
