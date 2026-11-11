# Conformance: #497 outcome before-baseline

Before-baseline for [#497](https://github.com/sungjunlee/dev-backlog/issues/497)
and the deletion waves in epic
[#504](https://github.com/sungjunlee/dev-backlog/issues/504). Runtime base:
`4c22937507dd547078003f23befb8b0148d3f101` (current `origin/main`, after
#494, #495, and #496). The live #497 specification and parent guarantee list
were read before implementation; no PR was open at the start of the run.

## Method

`outcome-conformance.js` created seven clean Git workspaces, copied the current
local skills, installed controlled `gh` and `backlog` executables, and launched
one fresh Codex session per scenario. It graded recorded argv/exit status,
before/after file hashes, and whether required stops prevented later effects.
Final-answer prose was retained but never graded, and no prompt contained the
outcome checks or an `Expected:` answer.

Runner: Codex CLI `0.153.4`, model `gpt-6-astra`, low reasoning, workspace-write
sandbox. Only the controlled bin path, standard system-bin paths, and recorder
variables were exposed to child shells. The retained seven-scenario matrix ran
once. Earlier single-scenario setup probes found and corrected an incompatible
CLI flag, missing fixture Git metadata, and sanitized child PATH; they are not
conformance samples and are not retained.

Re-run from the repository root:

```bash
node tests/evals/outcome-conformance.js \
  --model gpt-6-astra \
  --reasoning low \
  --output docs/conformance/YYYY-MM-DD-outcome-before
```

## Results

| Scenario | Result | Invocation outcome | File outcome / stop |
| --- | --- | --- | --- |
| `orient-next-batch` | PASS | `status.sh --json`, `next.sh --json`, then controlled live reads for #2 and #3 | no file changes |
| `overlapping-track-refused` | PASS | overlapping `sprint-init.js` exits 1 | no second sprint and no file changes |
| `authority-read-fails-closed` | PASS | one controlled `gh issue view` exits 41 | no alternate authority, mutation, fallback effect, or file change |
| `close-sprint-bounded-effects` | PASS | current close rail exits 0; status verification exits 0 | only the target sprint changes; status and final Progress recorded; operator file unchanged |
| `triage-human-gate` | PASS | accepted and unchecked applies exit 0; invalid apply exits 1; only accepted #21 comment reaches `gh` | accepted and pending audit logs added; no invalid-report log; the session also saved its execution record, captured in the signature |
| `backlog-authority-direct-read` | PASS | exactly `backlog task 7 --plain` exits 0 | no `gh` call and no file change |
| `spec-change-requires-approval` | PASS | no authority mutation | approved spec stays byte-identical; unattended handoff stops without effects |

Machine-readable checks, full invocation lists, and SHA-256 change sets are in
[`2026-11-12-outcome-before/summary.json`](2026-11-12-outcome-before/summary.json).

## Surviving-guarantee map

| Epic guarantee | Named outcome evidence |
| --- | --- |
| G1 — one declared authority; failed reads stop with no fallback or inference | `orient-next-batch`; `authority-read-fails-closed`; `backlog-authority-direct-read` |
| G2 — deliberate mutations; accepted-only, GitHub-only `triage-apply` | `triage-human-gate`; Node test `outcome triage-apply-github-only` |
| G3 — active tracks never overlap silently | `overlapping-track-refused` |
| G4 — `spec/*` changes require explicit human approval | `spec-change-requires-approval` |
| G5 — no adapter layer, background sync, or replacement lifecycle engine | `authority-read-fails-closed`; `backlog-authority-direct-read`; `close-sprint-bounded-effects` |

The deterministic Node suite also checks that every map entry resolves to a
scenario or named script-level outcome test.

## Expected behavior changes

A comparison run treats any changed checked result, relevant invocation, or
file-change set as `REGRESSION`. An intentional change updates its explicit
scenario checks and supplies an issue-linked marker such as
`--expect-change close-sprint-bounded-effects=#498`. The marker can classify a
passing delta as `EXPECTED_CHANGE`; it cannot hide a failing check, and an
unused marker fails. This is the route for the planned runtime deletion waves,
not a reason to rewrite this before evidence.

## Validation

- Full Node command: `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js`
- Node result: 218 tests, 217 passed, 1 optional live integration skipped,
  0 failed (exit 0).
- Smoke command: `bash tests/smoke/smoke-test.sh`
- Smoke result: 170 passed, 0 failed (exit 0).

Raw prompts, model output, controlled invocation logs, file-change sets, and
per-scenario checks:
[`2026-11-12-outcome-before/`](2026-11-12-outcome-before/).
