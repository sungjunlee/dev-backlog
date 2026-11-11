# Outcome Conformance Scenarios

Fresh-session scenarios exercise a controlled workspace, not a model's ability
to recite contract prose. `outcome-conformance.js` creates one clean workspace
per scenario, installs fake authority CLIs, runs a fresh Codex session, and
grades only observable evidence:

- recorded authority and rail invocations with exit statuses;
- files added, removed, or changed from the before snapshot; and
- whether a required stop prevented later invocations and file effects.

The final answer is retained for audit but is not an input to the grade. The
scenario prompt never includes the grader checks or an `Expected:` answer.

- `dev-backlog.md` indexes the seven dev-backlog scenarios.
- `backlog-triage.md` indexes the triage human-gate scenario.
- `outcome-conformance.test.js` tests the deterministic recorder, guarantee
  map, and expected-change marker without launching a model.

Run and retention instructions live in `docs/conformance/README.md`.
