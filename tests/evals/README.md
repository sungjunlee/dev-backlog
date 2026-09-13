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
