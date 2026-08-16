# Historical Retrieval Shadow Benchmark

Issue: [#350](https://github.com/sungjunlee/dev-backlog/issues/350)

Started: 2026-07-31

Earliest decision: 2026-08-28 (four weeks)

Six-week boundary: 2026-09-11

## Status

The shadow is active. Day-0 fixes the questions, scoring, source-bearing live
baseline, and disposable-report protocol. It does not make a product decision.
At least ten organic questions across all three repository classes and at least
two weeks of real reuse are still required before the earliest decision date.

No compiled report, topic graph, search index, or automatic per-PR memory is
committed. Retrieval output is disposable evidence and never authoritative
current status.

## Arms and authority boundary

- **A — legacy mirror grep:** search only historical files under
  `backlog/tasks/` and `backlog/completed/`. *2026-08-05: `backlog/completed/` was
  retired — its 63 files were all CLOSED GitHub Issues and are preserved in git
  history; Arm A's mirror surface is now effectively `backlog/tasks/` (empty) and
  git history.*
- **B — live sources:** query GitHub Issues and PRs, Git history, and existing
  spec, ADR, sprint, or evidence documents.
- **C — disposable report:** compile the same live sources on demand into a
  temporary report, then answer from that report. The report stays outside the
  repository and must expose its freshness.

Every material answer claim must point to an Issue, PR, commit, spec, ADR, or
committed evidence document. A source failure cannot silently fall back to a
mirror or stale report. It preserves the previous report bytes and exits
non-zero without a write.

## Gold questions

The set is frozen for Day-0 scoring. D1 and D4 intentionally ask about the
contract at that historical point; answering with the later mirrorless product
boundary is an error.

### dev-backlog

| ID | Historical question | Gold answer criteria | Gold sources |
| --- | --- | --- | --- |
| D1 | What execution evidence made #278 consider the GitHub/local tracker base complete? | The same create-to-complete matrix ran for both trackers; compatibility and unsupported-capability failure were fixed; Node 652 and smoke 157/157 passed. | [#278](https://github.com/sungjunlee/dev-backlog/issues/278), [PR #303](https://github.com/sungjunlee/dev-backlog/pull/303), [`d3c4903`](https://github.com/sungjunlee/dev-backlog/commit/d3c49036a52f0aa93ebb1807865ffd83ef7a75f3) |
| D2 | How did the multi-track resolver represent a portfolio without breaking the single-track contract? | It added `scope:`, shared `scopesOverlap()`, schema v2 `active_sprints[]`, retained `active_sprint` for N=1, and failed only overlapping tracks with `OVERLAPPING_TRACKS`. | [#291](https://github.com/sungjunlee/dev-backlog/issues/291), [PR #300](https://github.com/sungjunlee/dev-backlog/pull/300), [`2d46ae1`](https://github.com/sungjunlee/dev-backlog/commit/2d46ae1bc0017d67bc786bff76c02ca717749c76) |
| D3 | Which three boundaries broke the Windows-support claim, and how were they repaired? | Git CRLF conversion, public Windows separators, and WSL/Git Bash path-domain mismatch; repaired with LF attributes, public `/` normalization, and an explicit Git-for-Windows Bash/path bridge plus Windows CI. | [#311](https://github.com/sungjunlee/dev-backlog/issues/311), [PR #314](https://github.com/sungjunlee/dev-backlog/pull/314), [`6e30430`](https://github.com/sungjunlee/dev-backlog/commit/6e30430c0e6b273b13ed32e1c499bea3991b797f) |
| D4 | Why was the progress-sync/sprint-mirror axis removed, and what boundary was then preserved? | One Progress issue, four sprint mirrors, and zero core/Relay consumers justified removing 33 files/net 4,039 lines; marker parsing/reading, task mirror sync-pull, and human provider-content protection were then preserved. | [#340](https://github.com/sungjunlee/dev-backlog/issues/340), [PR #343](https://github.com/sungjunlee/dev-backlog/pull/343), [`89cffbb`](https://github.com/sungjunlee/dev-backlog/commit/89cffbbdd7a3aa9ccc9368f9430b826cb5c26147) |
| D5 | What authority placement and explicit product exclusions did #345 establish? | Issues own task definition/lifecycle, sprints own complex execution continuity, specs/ADRs own durable decisions, and retrieval is derived; dual writes, automatic memory, new tracker/mirror expansion, and required ecosystem dependencies are excluded. | [#345](https://github.com/sungjunlee/dev-backlog/issues/345), [PR #351](https://github.com/sungjunlee/dev-backlog/pull/351), [`0eab284`](https://github.com/sungjunlee/dev-backlog/commit/0eab284b1e88a586b5824bdd4c654fdd66c0d6e2) |
| D6 | What is the effective task-spec authority order and fail-closed contract? | Explicit `spec_ref` wins, otherwise the Issue body; the result includes a source ref and stable SHA-256 revision, and unavailable canonical/explicit sources fail rather than switching authority. | [#346](https://github.com/sungjunlee/dev-backlog/issues/346), [PR #352](https://github.com/sungjunlee/dev-backlog/pull/352), [`d7f8edc`](https://github.com/sungjunlee/dev-backlog/commit/d7f8edca5ce557d842058877d6bf52aa8889c570) |
| D7 | What observed result allowed the mirrorless pilot to retire task mirrors? | Both consumer repositories recovered AC 5/5, used sprint handoff, and closed live Issues; orientation was 0.69/0.71 seconds with zero blocking incidents and zero mirror diff. | [#347](https://github.com/sungjunlee/dev-backlog/issues/347), [PR #353](https://github.com/sungjunlee/dev-backlog/pull/353), [pilot evidence](https://github.com/sungjunlee/dev-backlog/blob/dc23b96f07a411ebeedd45210176c9b209e00112/docs/mirrorless-github-pilot.md) |

### dev-relay

| ID | Historical question | Gold answer criteria | Gold sources |
| --- | --- | --- | --- |
| R1 | What resolution contract keeps append-learnings from selecting the wrong active sprint? | Explicit sprint/track/component, then merged-Issue component through the dev-backlog resolver, then single-active fallback; pass resolved ownership to the leaf and add no Relay Markdown parser. | [#955](https://github.com/sungjunlee/dev-relay/issues/955), [PR #1051](https://github.com/sungjunlee/dev-relay/pull/1051), [PR #1055](https://github.com/sungjunlee/dev-relay/pull/1055), [`df0d007`](https://github.com/sungjunlee/dev-relay/commit/df0d007d43b0dfa6f2f02ac75992be3f6b946882) |
| R2 | How did human relay/relay-merge sprint reads and writes change for multi-track? | Resolve the task component/track owner with `sprint-state.js`; write Plan, Progress, and Running Context to the same owner; use the old fallback only for N=1. | [#956](https://github.com/sungjunlee/dev-relay/issues/956), [PR #1052](https://github.com/sungjunlee/dev-relay/pull/1052), [`fe2d62c`](https://github.com/sungjunlee/dev-relay/commit/fe2d62c8c96b1f973b65153075c0908f8e48e1a8) |
| R3 | How did fleet make mixed-track work safe before dispatch? | Attach resolved owner track/component to each leaf and manifest; fail closed on missing/mixed/contradictory ownership or resume drift, and reject symlink escape by realpath. | [#957](https://github.com/sungjunlee/dev-relay/issues/957), [PR #1055](https://github.com/sungjunlee/dev-relay/pull/1055), [`1d6f3ba`](https://github.com/sungjunlee/dev-relay/commit/1d6f3bae66819735efaf002d4121c3a77fae2aba) |
| R4 | Which seam was intentionally retained when frozen relay-orca was removed, and at what scale? | Remove 108 files/about 25,691 lines and about 331 seconds per gate; preserve the generic coordination-marker seam, invariant, CLI schema, and recovery guard byte-for-byte; reduce CI to nine suites. | [#1089](https://github.com/sungjunlee/dev-relay/issues/1089), [PR #1092](https://github.com/sungjunlee/dev-relay/pull/1092), [`30efab9`](https://github.com/sungjunlee/dev-relay/commit/30efab98da8cdf52e14f04ab09d2235fbeb2c898) |
| R5 | What final degradation contract fixed review-runner ENOBUFS on large diffs? | Raise shared git/gh buffers to 16 MiB with overrides; above 512 KiB use stat plus omitted-file list and record marker/size/threshold while preserving `--diff-file` priority and recovery errors. | [#1091](https://github.com/sungjunlee/dev-relay/issues/1091), [PR #1094](https://github.com/sungjunlee/dev-relay/pull/1094), [`4e7d041`](https://github.com/sungjunlee/dev-relay/commit/4e7d041420faf471f8c8fdf29af0d631b3f726de) |
| R6 | How did standard assurance model its round budget after one changes-requested round? | Record inspectable `round_budget` separating internal/post-publication phases from substantive failures; separate protocol verification from the failure cap, count rubric failure immediately, and retain policy extension as exceptional. | [#1106](https://github.com/sungjunlee/dev-relay/issues/1106), [PR #1124](https://github.com/sungjunlee/dev-relay/pull/1124), [`3632390`](https://github.com/sungjunlee/dev-relay/commit/363239071496aeea63a81aae1968e4624aeaf551) |
| R7 | Which three authority/binding defects in verification evidence did #1116 repair? | Follow the manifest custom-rubric anchor, remove stale `verification_runs` with audit on recovery/reconciliation/rebrand, and require the verified tree to equal the final commit/tree. | [#1116](https://github.com/sungjunlee/dev-relay/issues/1116), [PR #1120](https://github.com/sungjunlee/dev-relay/pull/1120), [`3546d97`](https://github.com/sungjunlee/dev-relay/commit/3546d97071fc35aa04d0b4c1e36fcdadaffca737) |

### Consumer repositories

| ID | Historical question | Gold answer criteria | Gold sources |
| --- | --- | --- | --- |
| C1 | Why did aibris #139 define agent session/transcript storage as retention rather than safety, and what protected it? | About 11 GB of Codex sessions made this discovery, age aggregation, and user choice; default and `--risky` cannot delete transcripts without an explicit retention selector, and orphans are bucket aggregates. | [aibris #139](https://github.com/sungjunlee/aibris/issues/139) |
| C2 | Which authority error and privacy boundary did dear-scene #267's owner-evidence campaign address? | Prevent one airport-scene judgment from generalizing to a whole trip by binding each question to the shown photo/moment and exact owner answer; preserve unanswered state and exclude private raw evidence from GitHub. | [dear-scene #267](https://github.com/sungjunlee/dear-scene/issues/267) |
| C3 | How did the aibris cases distinguish sprint use for complex product work from a controlled mirrorless transition? | #139 needed a complex product sprint; #171/PR #172 was a docs-only episode whose sprint held live-Issue intent and handoff, not task authority, mirrors, or product changes. | [aibris #139](https://github.com/sungjunlee/aibris/issues/139), [aibris #171](https://github.com/sungjunlee/aibris/issues/171), [aibris PR #172](https://github.com/sungjunlee/aibris/pull/172), [pilot evidence](https://github.com/sungjunlee/dev-backlog/blob/dc23b96f07a411ebeedd45210176c9b209e00112/docs/mirrorless-github-pilot.md) |
| C4 | Where did the privacy-heavy dear-scene campaign and mirrorless pilot each place authority? | #267 kept domain truth in local-only lineage and exact owner evidence with aggregates on GitHub; #293/PR #294 kept task intent/AC/lifecycle in the live Issue and branch/handoff in the sprint. | [dear-scene #267](https://github.com/sungjunlee/dear-scene/issues/267), [dear-scene #293](https://github.com/sungjunlee/dear-scene/issues/293), [dear-scene PR #294](https://github.com/sungjunlee/dear-scene/pull/294), [pilot evidence](https://github.com/sungjunlee/dev-backlog/blob/dc23b96f07a411ebeedd45210176c9b209e00112/docs/mirrorless-github-pilot.md) |
| C5 | What were the quantitative and lossless results of the aibris mirrorless pilot? | AC 5/5 and open state in 0.69 seconds, sprint branch/handoff, close dry-run exit 0, zero task/completed mirror diff, and PR #172 closed #171. | [aibris #171](https://github.com/sungjunlee/aibris/issues/171), [aibris PR #172](https://github.com/sungjunlee/aibris/pull/172), [`0f22c48`](https://github.com/sungjunlee/aibris/commit/0f22c4868eb0259dbe3b868937a29312cf3870ac) |
| C6 | What were the dear-scene pilot's quantitative results, and how were pre-existing doctor findings handled? | AC 5/5 and open state in 0.71 seconds, close dry-run exit 0, zero mirror diff, and PR #294 closed #293; unrelated M5 doctor findings were isolated from the passing pilot track. | [dear-scene #293](https://github.com/sungjunlee/dear-scene/issues/293), [dear-scene PR #294](https://github.com/sungjunlee/dear-scene/pull/294), [`7ac2196`](https://github.com/sungjunlee/dear-scene/commit/7ac21961853aa21a504515becd3241772e05c3fa) |

## Scoring

For each question, record at most three ranked source pointers. A question is a
top-3 hit when at least one ranked pointer matches any source in its gold row.
Macro top-3 recall is hit questions divided by all scored questions and is the
go/no-go metric. A major factual error is a claim that reverses the historical
decision, changes the named authority, or materially misstates a threshold or
observed result.

Arm C also reports a diagnostic pointer-level recall over a frozen 41-pointer
search subset: the Issue and PR pointers used by its query cases. That subset
excludes the 18 commit and committed-evidence pointers in the gold table because
the Day-0 compiler fetched Issue/PR records only. It is not substituted for the
20-question macro metric. The per-question subset denominator and hits are
recorded below, so 37/41 can be independently summed.

Elapsed time starts immediately before the first retrieval and stops when the
answer and ranked pointers are ready. Tool calls count user-visible GitHub,
Git, filesystem-search, or compiled-report query boundaries. Report compilation
and repair are maintenance, not query time, and are recorded separately.

Arm C is scored on marginal retrieval value over Arm B only: it must retain at
least 90% top-3 recall, show a marginal recall or error-rate improvement over
Arm B on the organic question set, have zero major errors, and project to no
more than 15 minutes of maintenance per month. Median elapsed time and tool
calls are still recorded as diagnostics but are not a go criterion: the
original 20%-faster bar compared a pre-compiled local file (0.794 ms) against
live network calls (5.952 s), which any cached artifact clears — it measured
caching, not retrieval value. *(Amended 2026-08-16 — see Amendments A2.)*

## Day-0 results

Environment: macOS; `gh 2.97.0`; authenticated `project`, `repo`, and existing
repository scopes. The earlier Projects pilot remains an observation from its
recorded `gh 2.85.0` environment.

| Arm | Coverage / top-3 hit | Major errors | Median query time | Median tool calls | Maintenance |
| --- | --- | ---: | ---: | ---: | ---: |
| A — legacy mirrors | 2/20 direct mirrors present (10% source coverage) | not scored | not scored | not scored | n/a |
| B — live sources | 20/20 (100%) | 0 | 5.952 s | 2 | none |
| C — disposable report | 20/20 hits; 37/41 Issue/PR pointers (90.24%) | 0 | 0.794 ms conservative | 1 local query + 0.05 amortized external compile | 6.27 min/month projected |

Arm A had direct historical mirrors only for D1/#278 and D3/#311. Thirteen
questions target other repositories and cannot exist in this checkout's mirror
corpus. It is therefore an unavailable baseline, not a zero-latency answer.

Arm B used 34 GitHub reads and one local committed-document read. Clean
collection wall time was about 195 seconds; the sum of unique-source latency
was 113.277 seconds. Per-question independent reproduction produced the table's
median, 20/20 source hits, and no observed major factual error.

Arm C fetched 34 source records in one GraphQL call and compiled 20 entries.
Fetch took 17.999 seconds and validation/write took 1.112 seconds, for 19.111
seconds total. The 321,273-byte temporary report had SHA-256
`850ac4cb6fbd2e5e7af00b3d3083d950c601e3936daefce9591c203a6fc302c7`.
Warm local retrieval over 1,000 repetitions per question had a 0.082 ms median
in the initial run and 0.794 ms in an independent identical-path rerun. The
conservative 0.794 ms value is used for the gate; scheduler, cache, and timer
noise at this scale does not affect the comparison with 5.952 seconds. Each
answer uses one local report-query call. Amortizing the one external compile
over these 20 questions adds 0.05 external calls per query. Arm C produced
20/20 question hits, 37/41 eligible Issue/PR pointer hits, and no major factual
error.

The conservative maintenance projection assumes four monthly regenerations at
19.111 seconds each plus five minutes for failure and source review: 6.27
minutes per month. Arm C clears the synthetic Day-0 accuracy, improvement, and
maintenance thresholds, but this result cannot satisfy the organic reuse gate.

## Day-0 observation log

Pointer shorthand is `repo#N` for an Issue, `repo!N` for a PR, and a short SHA
or `pilot` for committed evidence. `match/0` means the observed answer matched
the row's gold criteria and had zero major errors. B time is the source-bearing
retrieval observation. C time is the independent 1,000-iteration rerun; its one
call is the local compiled-report query. `C pointers` are ranked, and `hits`
uses the frozen Issue/PR subset described above.

| ID | B ms / calls | B ranked pointers | B answer/error | C ms / calls | C ranked pointers | C hits |
| --- | ---: | --- | --- | ---: | --- | ---: |
| D1 | 5,220 / 2 | `dev-backlog#278`, `dev-backlog!303`, `d3c4903` | match/0 | 1.326 / 1 | `dev-backlog!303`, `dev-backlog#345`, `dev-backlog#278` | 2/2 |
| D2 | 5,312 / 2 | `dev-backlog#291`, `dev-backlog!300`, `2d46ae1` | match/0 | 0.571 / 1 | `dev-backlog#291`, `dev-backlog!300`, `dev-relay!1055` | 2/2 |
| D3 | 4,672 / 2 | `dev-backlog#311`, `dev-backlog!314`, `6e30430` | match/0 | 0.859 / 1 | `dev-backlog!314`, `dev-backlog#311`, `dev-backlog!351` | 2/2 |
| D4 | 3,304 / 2 | `dev-backlog#340`, `dev-backlog!343`, `89cffbb` | match/0 | 1.164 / 1 | `dev-backlog#340`, `dev-backlog!343`, `dev-backlog#345` | 2/2 |
| D5 | 4,167 / 2 | `dev-backlog#345`, `dev-backlog!351`, `0eab284` | match/0 | 0.645 / 1 | `dev-backlog#345`, `dev-backlog!351`, `dear-scene#267` | 2/2 |
| D6 | 7,927 / 2 | `dev-backlog#346`, `dev-backlog!352`, `d7f8edc` | match/0 | 0.843 / 1 | `dev-backlog#346`, `dev-backlog!352`, `dev-relay#1116` | 2/2 |
| D7 | 6,964 / 3 | `dev-backlog#347`, `dev-backlog!353`, `pilot` | match/0 | 0.953 / 1 | `dev-backlog#347`, `dev-backlog#278`, `dev-backlog!343` | 1/2 |
| R1 | 11,239 / 3 | `dev-relay#955`, `dev-relay!1051`, `df0d007` | match/0 | 1.013 / 1 | `dev-relay#955`, `dev-relay!1055`, `dev-relay#956` | 2/3 |
| R2 | 5,726 / 2 | `dev-relay#956`, `dev-relay!1052`, `fe2d62c` | match/0 | 1.113 / 1 | `dev-relay!1052`, `dev-relay#956`, `dev-backlog#347` | 2/2 |
| R3 | 10,192 / 2 | `dev-relay#957`, `dev-relay!1055`, `1d6f3ba` | match/0 | 0.620 / 1 | `dev-relay!1055`, `dev-relay#957`, `dev-relay#955` | 2/2 |
| R4 | 5,847 / 2 | `dev-relay#1089`, `dev-relay!1092`, `30efab9` | match/0 | 1.284 / 1 | `dev-relay#1089`, `dev-relay!1092`, `dev-backlog#345` | 2/2 |
| R5 | 6,249 / 2 | `dev-relay#1091`, `dev-relay!1094`, `4e7d041` | match/0 | 0.383 / 1 | `dev-relay!1094`, `dev-relay#1091`, `dev-relay!1092` | 2/2 |
| R6 | 13,351 / 2 | `dev-relay#1106`, `dev-relay!1124`, `3632390` | match/0 | 0.801 / 1 | `dev-relay!1124`, `dev-relay!1051`, `dev-relay#1106` | 2/2 |
| R7 | 7,605 / 2 | `dev-relay#1116`, `dev-relay!1120`, `3546d97` | match/0 | 0.874 / 1 | `dev-relay#1116`, `dev-relay!1120`, `dev-relay#1089` | 2/2 |
| C1 | 2,467 / 1 | `aibris#139` | match/0 | 0.708 / 1 | `aibris#139`, `dear-scene#267`, `dev-relay#955` | 1/1 |
| C2 | 3,651 / 1 | `dear-scene#267` | match/0 | 0.786 / 1 | `dear-scene#267`, `aibris#139`, `dev-relay!1055` | 1/1 |
| C3 | 7,560 / 3 | `aibris#139`, `aibris!172`, `pilot` | match/0 | 0.640 / 1 | `dev-backlog#347`, `aibris#171`, `aibris!172` | 2/3 |
| C4 | 8,077 / 3 | `dear-scene#267`, `dear-scene!294`, `pilot` | match/0 | 0.174 / 1 | `dear-scene#267`, `dev-backlog#347`, `dear-scene#293` | 2/3 |
| C5 | 6,057 / 2 | `aibris#171`, `aibris!172` | match/0 | 0.168 / 1 | `aibris#171`, `dev-backlog#347`, `aibris!172` | 2/2 |
| C6 | 5,686 / 2 | `dear-scene#293`, `dear-scene!294` | match/0 | 0.558 / 1 | `dear-scene!294`, `dear-scene#293`, `dev-backlog#347` | 2/2 |

The Arm B median recomputes to 5,952 ms and two calls. The conservative Arm C
median recomputes to 0.794 ms and one local call; its hit column sums to 37/41,
while every row has at least one hit. Gold answer criteria above are the
source-backed observed-answer comparison, rather than duplicated prose here.

## Disposable report protocol

Arm C writes to a sibling temporary file, validates the complete 20-record
schema, then atomically renames it over the previous temporary report. The
report header contains distinct `compiled_at`, `sources_through`, and
`human_verified_at` fields. `human_verified_at` remains null until a person
checks the compiled claims; it is never inferred from successful retrieval.

Any missing source, authentication error, incomplete record, or schema failure
must exit non-zero before rename. The evidence run records the prior report
SHA-256, injects one missing source, and requires the post-failure SHA-256 and
mtime to remain identical. Temporary report bytes are not copied into this
repository.

The Day-0 failure probe replaced one dear-scene source with a nonexistent
source. GraphQL exited 2. Before and after, the report SHA-256 was the exact
value above, mtime epoch was `1785504674`, size was 321,273 bytes, and no
candidate file remained. The previous report was therefore preserved without
a write.

## Organic shadow log

Benchmark questions are not reuse. For each real historical question, append a
manual evidence comment to #350 with this JSONL-compatible shape:

```json
{"question_id":"O-001","repo_class":"dev-backlog","observed_at":"RFC3339","organic":true,"arm":"B","elapsed_ms":0,"tool_calls":0,"top3_sources":[],"gold_hits":0,"major_errors":0,"minor_errors":0,"compiled_at":null,"sources_through":null,"human_verified_at":"RFC3339","maintenance_minutes":0}
```

The decision requires at least ten organic questions covering dev-backlog,
dev-relay, and consumer repositories, at least two weeks between first and last
real reuse, and no decision before 2026-08-28. Fewer than ten organic questions
at the decision date is an **automatic no-go**: either extend the shadow window
with a dated note, or close #350 with "Arm B suffices". The null result — no
compiler admitted — is the pre-declared, expected, and acceptable outcome;
neither thin data nor a retroactively manufactured "organic" log can produce a
go. *(Amended 2026-08-16 — see Amendments A1.)* If live sources remain
sufficient, close #350 with no compiler. If Arm C wins every gate, propose a
separate `project-memory` skill and human-gated charter amendment; do not
productize it inside this issue.

## Amendments

The protocol above is frozen by design; changes are pre-registered here with
date and rationale before the decision window opens, analogous to a human-gated
charter amendment. Operative text is edited in place and marked with its
amendment ID.

- **A1 (2026-08-16) — auto no-go on thin data.** Original text allowed a
  decision whose organic-reuse precondition was silently unmet or met by
  after-the-fact labeling. Amended: fewer than ten organic questions at the
  decision date is an automatic no-go (extend the window or close with "Arm B
  suffices"), and the null result is pre-declared acceptable. Rationale:
  goodharting risk — 0/10 organic entries at the halfway mark made a
  thin-data or manufactured-"organic" go structurally possible. Source: #364;
  2026-08-15 direction/strategy review concern #4.
- **A2 (2026-08-16) — latency criterion replaced by marginal value.** Original
  text required Arm C to beat the better usable baseline's median elapsed time
  or tool calls by at least 20%. Amended: Arm C is scored on marginal recall /
  error rate over Arm B only; latency and tool-call medians remain recorded
  diagnostics. Rationale: the 20% bar compared a warm local file read
  (0.794 ms) with live network retrieval (5.952 s) — any cached artifact
  passes, so the criterion measured caching, not retrieval value. The Day-0
  table's "clears the synthetic thresholds" claim is correspondingly
  historical: it reflects the pre-amendment gate set. Source: #364; 2026-08-15
  direction/strategy review recommendation #2.
- Amendment authority: #350's go criteria in the issue body retain their
  original wording as filed history; where they conflict with A1/A2, this
  amended protocol governs the decision. Recorded on #350 by comment at
  amendment time.
