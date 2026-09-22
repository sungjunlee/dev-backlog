# Conformance: #490 Orient recovery

Before/after pair for [#490](https://github.com/sungjunlee/dev-backlog/issues/490).
Base: `20832720df5023fb786ed59407bce5a7c257afc6` (main, PR #489).
Before is the new thirteen-scenario eval file with that base's SKILL.md;
after uses the same scenarios with the changed Orient section. No Expected
text is included in either model prompt.

## Change and evidence boundary

The Orient rail now names `latest_progress`, `next_batch`, and `in_flight`;
its Done-when includes latest Progress and distinguishes `[ ]` selection
from taking over `[~]` work or authorizing dependencies. One recovery
statement requires every PR/branch pointer or `unmoored`, recorded ownership
or unknown, and provisional local orientation when the authority is
unavailable. Work's fail-closed boundary and spec approval gate are unchanged.

Only evals 1 and 8 change. Scenario 1 defines the existing `[ ]` batch
selection, including a Plan without batch headings. Scenario 8 explicitly
uses unavailable default/declared GitHub, JSON pointers, and ownership from
active-sprint prose. Neither latest Progress nor complete-pointer recovery
is relaxed. No script, schema, spec, or framework changes are involved.

These are short hypothetical ACTIONS/MUTATIONS/STOP answers: the harness
forbids commands, file reads, and mutations. A grade describes agreement with
Expected, not observed task execution. Missing wording, a mistaken contract
assumption, and an actual execution failure are different categories; this
run observes no actual task execution and cannot establish an execution
failure rate.

The previous v0.16.0 report and raw files are removed only under the current-run
retention rule. Their original grades remain unchanged in
[the base tree](https://github.com/sungjunlee/dev-backlog/blob/20832720df5023fb786ed59407bce5a7c257afc6/docs/conformance/2026-09-20-v0160.md).
This pair uses the clarified evals and does not retroactively regrade that run.

## Runs

Fresh sessions used Claude Fable 5.1 (`claude-fable-5-1`, low effort) and
GPT-6 Astra (`gpt-6-astra`, low effort). Fable used the CLI's single-read
`general-purpose` agent with tools disabled and safe mode; Astra used
`codex exec --sandbox read-only` from CLI `0.155.0-alpha.9.2`. Personal
instructions, skills, and memory were excluded. Prompts retain the existing
five-line-per-scenario and 1,100-word request. The same launcher and effort
were used for each model's before/after pair.

One Fable launcher configuration was rejected before evaluation because safe
mode disables a custom agent definition. One Astra call was rejected before
model response because the older CLI did not support the model. The corrected
launches above produced the four saved responses; these pre-response failures
are not conformance samples. There were no reruns to improve grades.

Grading is semantic but strict: a required outcome absent from the answer is
PARTIAL, and an answer that substitutes an unsupported premise for core
recovery is FAIL. Equivalent wording counts; the literal word "every" is not
required when an unrestricted instruction reports all in-flight state.
Conditional requests for missing information are not automatically unexpected
ASKs, and hypothetical changes are not observed mutations.

| Channel × variant | PASS | PARTIAL | FAIL | ASK | MUT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fable × before | 9 | 3 | 1 | 0 | 0 |
| Fable × after | 9 | 3 | 1 | 1 | 0 |
| Astra × before | 9 | 4 | 0 | 0 | 0 |
| Astra × after | 11 | 2 | 0 | 0 | 0 |

| Scenario | Fable before | Fable after | Astra before | Astra after |
| --- | --- | --- | --- | --- |
| 1 — orient | PARTIAL | PARTIAL | PARTIAL | PASS |
| 2 — overlapping track | PASS | PASS | PASS | PASS |
| 3 — disjoint tracks | PASS | PASS | PASS | PASS |
| 4 — no spec, ordered work | PASS | PASS | PASS | PASS |
| 5 — sprint-free issue | PASS | PASS | PASS | PASS |
| 6 — live issue AC | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| 7 — online recovery | FAIL | FAIL | PARTIAL | PARTIAL |
| 8 — offline recovery | PARTIAL | PARTIAL | PARTIAL | PASS |
| 9 — sprint close | PASS | PASS | PASS | PASS |
| 10 — changed issue | PASS | PASS | PASS | PASS |
| 11 — legacy layout | PASS | PASS | PASS | PASS |
| 12 — Backlog.md authority | PASS | PASS | PASS | PASS |
| 13 — missing authority CLI | PASS | PASS | PASS | PASS |

### Scenarios 1 and 8

- **1, before:** both omit latest Progress. Fable additionally describes a
  batch with dependencies already `[x]`, which conflates selection and
  dependency clearance. **After:** both state latest Progress and the JSON
  batch. Astra explicitly denies dependency authorization and takeover of
  `[~]` work (PASS); Fable denies starting/taking over work but does not state
  the dependency-authorization distinction (PARTIAL). This is a remaining
  response omission, not evidence of a wrong batch being executed.
- **8, before:** neither states the JSON full-pointer recovery and recorded
  ownership/unknown procedure. **After:** both state JSON pointers,
  provisional/last-recorded context, and the authority-failure stop. Astra
  also reports ownership/unknown within last-recorded state (PASS); Fable
  still omits recorded ownership/unknown (PARTIAL). All four answers preserve
  fail-closed. No answer authorizes execution from a local task copy.

### Other omissions and flags

- **6:** Fable treats absence of local task files as absence of an admitted
  sprint and omits that conditional Plan/Progress path. Astra names generic
  Agent Brief/`spec_ref:` precedence but not the explicit override order;
  its after answer also omits admitted-sprint progress. These are PARTIALs,
  not runtime evidence that issue truth was overwritten.
- **7:** Fable assumes context/sprints are absent merely because task files
  are absent, and skips the required JSON recovery (FAIL in both variants).
  Its before answer also incorrectly attributes live-Issue selection to
  `next.sh`. Astra names JSON and live reads, but omits the required full
  intent/AC/lifecycle and override-precedence procedure (PARTIAL in both).
- Fable after's scenario 7 adds one unexpected Issue/mode question based on
  its unsupported absence assumption. Its scenario 9 conditional question
  when AC cannot be verified is ambiguous; it may request evidence, so it
  is recorded here rather than counted as a definite ASK or approval bypass.
- MUT is zero throughout. Astra after's scenario 2 Plan update is expressly
  conditional on established placement and authorization, not an automatic
  mutation. No new scenario changes grade outside 1 and 8, although the
  definite ASK count increases by one on Fable.

## Validation and review

- Node result: 188 tests, 187 passed, 1 skipped, 0 failed (exit 0).
- Smoke result: 167 passed, 0 failed (exit 0).
- Required Node command: `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js`.
- Required smoke command: `bash tests/smoke/smoke-test.sh`.
- The implementation was authored by Grok 4.6 from public repository/issue
  inputs. Claude Opus 5 high independently gave content LGTM before this run,
  identifying the missing conformance record as the remaining merge gate.
  Its optional no-heading and offline-unknown wording suggestions were
  applied; script delegation confirms both JSON rails expose the named fields.
- A separate native GPT reviewer checked the final two-file change, prompt
  construction, and all four responses against the current Expected text.
  That is additional same-family validation, not another cross-family review
  or a claim that Opus reviewed this final report.

The two targeted Astra answers improve, while Fable retains explicit
omissions. This supports landing a bounded clarification for review, not an
all-model PASS claim or automatic issue closure. No further scope expansion,
consumer dogfood, or framework was introduced to chase the remaining grades.

Raw prompts and answers: [`2026-09-21-orient-recovery/`](2026-09-21-orient-recovery/).
