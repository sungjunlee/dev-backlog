# Conformance Runs

Fresh-session conformance grades observed task outcomes. It runs before each
release tag, whenever a skill rail changes, and before a runtime deletion wave
changes the baseline.

## Run

From the repository root, run all nine controlled scenarios with one command:

```bash
node tests/evals/outcome-conformance.js \
  --model gpt-6-astra \
  --reasoning low \
  --output docs/conformance/YYYY-MM-DD-outcome-before
```

Each scenario gets a clean workspace, the current local skills, and controlled
`gh` and `backlog` executables. Sessions have workspace write access but no need
for network access. The output directory contains the prompt, runner logs, final
answer, invocation log, file-change set, and machine-readable outcome for every
scenario, plus `summary.json`.

The final answer is audit material only. Grading reads:

- **invocations** — authority/rail argv and exit status from controlled fakes;
- **file changes** — SHA-256 before/after snapshots, excluding recorder files;
- **stops** — a failing guard or authority read followed by no forbidden call
  or file effect.

There is no `Expected:` answer in a model prompt and no model self-grade.
Deterministic recorder tests run as part of the ordinary Node suite without
launching Codex.

## Compare and intentional changes

A later run can compare its outcome signature with a retained baseline:

```bash
node tests/evals/outcome-conformance.js \
  --model gpt-6-astra \
  --reasoning low \
  --compare docs/conformance/YYYY-MM-DD-outcome-before/summary.json \
  --output /tmp/dev-backlog-outcome-after
```

A changed invocation, file-change set, or check result is `REGRESSION` by
default. For an intentional behavior change:

1. update the scenario's explicit outcome checks in the same reviewed change;
2. cite the authorizing issue with `--expect-change scenario-id=#N`; and
3. retain the before/after evidence in the new report.

Example for the runtime changes covered by #498 and #499:

```bash
node tests/evals/outcome-conformance.js \
  --compare docs/conformance/YYYY-MM-DD-outcome-before/summary.json \
  --expect-change orient-next-batch=#498 \
  --expect-change close-sprint-bounded-effects=#498 \
  --expect-change fresh-repository-plan=#499 \
  --output /tmp/dev-backlog-outcome-after
```

The marker changes a passing, observed delta to `EXPECTED_CHANGE`; it cannot
turn a failed outcome check into a pass, and an unused marker fails the run.
This keeps an issue-linked expectation change distinct from accepting a new
baseline after a regression.

## Retention

Keep only the latest dated report (`YYYY-MM-DD-*.md`) and its raw directory in
the tree. The change that lands a new run removes the previous report and raw
directory. Earlier runs remain in git history. A report records the base SHA,
runner/model, scenario status table, guarantee map, and validation results; its
raw directory is the harness output named by the report.
