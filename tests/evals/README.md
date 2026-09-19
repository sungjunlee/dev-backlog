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

Scenario history is in git; the current `dev-backlog.md` has thirteen scenarios (12–13 cover a non-GitHub task authority since v0.15.0).
