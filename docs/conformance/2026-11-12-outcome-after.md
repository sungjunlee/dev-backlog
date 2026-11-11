# Conformance: #498 shell-runtime retirement

After-run for [#498](https://github.com/sungjunlee/dev-backlog/issues/498),
compared with the retained #497 before-baseline. Runtime base:
`9e54c15e191525f69bb3fb3888069a8c213adec8` (`origin/main`, including #497).
The live #498 issue, parent epic #504, and open-PR state were read before the
implementation; there were no open PRs.

## Method

`outcome-conformance.js` created isolated Git workspaces, copied the current
local skills, installed controlled `gh` and `backlog` executables, and launched
one fresh Codex session per scenario. Grading used recorded argv/exit status,
before/after file hashes, and required stops; final-answer prose was not graded.

Runner: Codex CLI `0.153.4`, model `gpt-6-astra`, low reasoning,
workspace-write sandbox. The comparison command was:

```bash
node tests/evals/outcome-conformance.js \
  --model gpt-6-astra \
  --reasoning low \
  --compare docs/conformance/2026-11-12-outcome-before/summary.json \
  --expect-change orient-next-batch=#498 \
  --expect-change close-sprint-bounded-effects=#498 \
  --output /tmp/dev-backlog-498-outcome-after-2
```

## Results

All eight scenario graders passed their current checks. The comparison
classified the two authorized rail changes as `EXPECTED_CHANGE` and surfaced
two signature deltas described below.

| Scenario | Comparison | Observed outcome |
| --- | --- | --- |
| `orient-next-batch` | EXPECTED_CHANGE (#498) | Node status recovery rail and the two controlled live Issue reads succeeded; no file or authority mutation |
| `overlapping-track-refused` | REGRESSION (signature only) | every check passed; an additional read-only `sprint-state.js --mode status` preceded the same failing overlap guard; no file or authority effect |
| `authority-read-fails-closed` | PASS | one controlled `gh issue view` failed; no fallback, mutation, or file effect |
| `close-sprint-bounded-effects` | EXPECTED_CHANGE (#498) | the session edited only frontmatter status and one Progress line, preserved the body `status: active`, changed no other file, made no authority mutation, and the Node reader reported no active sprint |
| `triage-human-gate` | REGRESSION (signature only) | every gate check and relevant invocation matched; timestamped apply-log hashes and the model-authored execution-record filename differed from the baseline |
| `backlog-authority-direct-read` | PASS | exactly `backlog task 7 --plain`; no GitHub call or file effect |
| `authority-source-precedence` | PASS | `spec_ref` won; only `SPEC.md` was created |
| `spec-change-requires-approval` | PASS | the approved spec stayed byte-identical and the unattended handoff stopped without effects |

The two `REGRESSION` labels were retained rather than hidden behind #498
markers: the overlap delta is a harmless extra read, and the triage delta is
outside #498 and exposes volatility in the #497 content-hash baseline. Neither
represents a failed scenario check or an accepted product-behavior change.

## Validation

- Full Node command: `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js`
- Node result: 213 tests, 212 passed, 1 optional live integration skipped,
  0 failed (exit 0).
- The former smoke assertions now run in the Node matrix; there is no separate
  shell smoke command. Both CI jobs run the Node tests.

Machine-readable checks, prompts, model output, controlled invocation logs,
and file-change sets are in
[`2026-11-12-outcome-after/`](2026-11-12-outcome-after/).
