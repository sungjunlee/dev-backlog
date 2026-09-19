# Conformance Runs

Fresh-session conformance of the prompt-judged surfaces, run before each
release tag and whenever a SKILL.md rail changes (#367).

Harness: build one prompt per model from `tests/evals/dev-backlog.md` with the
`Expected:` text stripped and the SKILL.md under test appended; run it as a
fresh session (Claude Fable 5.1 as a one-read subagent, GPT-6 Astra via
`codex exec --sandbox read-only`); the session grades each scenario PASS /
PARTIAL / FAIL against the Expected text, flagging unexpected asks (ASK) and
unexpected mutations (MUT). A rail change gets a before/after pair (old
SKILL.md × new evals, new SKILL.md × new evals); a deletion-only wave gets one
after-run against the previous record.

Retention: only the latest dated report (`YYYY-MM-DD-*.md`) and its raw
directory (prompts and model outputs) stay in the tree; the commit that lands
a new run deletes the previous report and raw directory. Earlier runs are in
git history.
