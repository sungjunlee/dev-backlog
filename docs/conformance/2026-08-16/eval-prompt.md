# Task: produce backlog-triage model-actions JSON

You are running the model-judgment step of the `backlog-triage` skill for the repository `sungjunlee/dev-backlog`. Scripts have already collected a snapshot of open GitHub Issues (appended below). Your job is to produce the `--model-actions` JSON array that the deterministic renderer (`triage-report.js`) will validate and merge into an advisory triage report.

## Contract (from SKILL.md)

Model-judged actions (`--model-actions`) are a JSON array of action objects. Sections `priority` / `milestone` / `obsolete` carry a positive `issueNumber`, `verb`, `summary`, and `args` with the mutation payload; section `relationship` carries `args.from` / `args.to` / `args.kind` for a model-judged edge.

Allowed verbs per section:
- `priority`: `set-priority` — args: `{ "value": "...", "reason": "..." }`
- `milestone`: `assign-milestone` — args: `{ "name": "..." }`; top-level `sprintName` (required, string, groups a candidate sprint cluster) and optional `cluster`
- `obsolete`: `close`, `revisit`, `close-duplicate` — args include a `reason`; `close-duplicate` also needs `args.target` like `"#12"`
- `relationship`: `edge` — args: `{ "from": N, "to": N, "kind": "...", "evidence": { "phrase": "..." } }`; allowed kinds: `mentions`, `comment-mentions`, `blocks`, `depends-on`, `duplicate-candidate`, `merged-pr-link`

Example entries:

```json
[
  {
    "section": "priority",
    "verb": "set-priority",
    "issueNumber": 42,
    "args": { "value": "high", "reason": "customer-reported outage blocks the auth theme" },
    "summary": "Set priority:high on #42 — customer-reported outage blocks the auth theme"
  },
  {
    "section": "milestone",
    "verb": "assign-milestone",
    "issueNumber": 43,
    "args": { "name": "Sprint W34" },
    "cluster": "auth",
    "sprintName": "Sprint W34",
    "summary": "Assign Sprint W34 to #43 — auth cluster"
  },
  {
    "section": "relationship",
    "verb": "edge",
    "args": { "from": 45, "to": 46, "kind": "blocks", "evidence": { "phrase": "Blocks #46" } },
    "summary": "Blocks edge 45 -> 46"
  }
]
```

Rules:
- The model owns semantic judgment only: blocks/depends-on/duplicate edges, priority proposals, milestone proposals, obsolete candidates. Deterministic signals (plain mentions, merged-PR links, stale dates) are already handled by scripts — do not duplicate plain `mentions` edges unless they carry semantic meaning beyond a textual reference.
- Duplicate proposals are deduped by `(verb, issueNumber, normalizedArgs)` — do not emit the same action twice.
- Issues referenced in the active sprint Plan or Running Context are protected from close / close-duplicate proposals.
- The report is advisory; propose only what the issue bodies actually support, with evidence-bearing reasons.

## Repository context

- Active sprint `2026-07-github-native-core-simplification` (milestone "2026-08 GitHub-native core simplification", `component: "tracker-task-truth"`): batches 1–4 merged; its only remaining Plan item is `[~] #350`, a deliberate wait state (shadow-benchmark decision window 2026-08-28 → 2026-09-11). #350 is protected work.
- Issues #361–#373 were all filed on 2026-08-16 as follow-ups distilled from a 2026-08-15 4-way independent project review; each body carries its own context, checklist, and source attribution.
- Charter objectives referenced by bodies: O3 (5-minute on-track answer), O5 (reassess loop), O10 (GitHub-native authority).

## Output format

Reply with ONLY the JSON array (no prose, no markdown fences). It must parse with `JSON.parse` as-is.

## Snapshot (open issues)

{
  "issues": [
    {
      "number": 350,
      "title": "epic: benchmark historical retrieval before admitting project memory",
      "labels": [
        "enhancement",
        "epic"
      ],
      "milestone": "2026-08 GitHub-native core simplification",
      "createdAt": "2026-07-31T05:02:23Z",
      "updatedAt": "2026-07-31T14:03:40Z",
      "body": "## Outcome\n\nMeasure whether agents actually need a compiled historical retrieval layer, and admit only the smallest layer that demonstrably outperforms live GitHub/Git/spec search.\n\n## Baseline\n\nCollect 20 representative historical questions from dev-backlog, dev-relay, and consuming-repository work. Compare:\n\n1. raw task-mirror grep,\n2. `gh` + Git history + existing spec/ADR/context sources,\n3. a non-committed, on-demand compiled report.\n\n## Guardrails\n\n- No committed topic graph or automatic per-PR memory update in the initial experiment.\n- Derived output contains no authoritative current status.\n- Every material claim links to an Issue, PR, commit, ADR, or spec source.\n- Freshness distinguishes `compiled_at`, `sources_through`, and `human_verified_at`.\n- Partial source/API failure preserves existing output and performs no write.\n\n## Go criteria\n\n- [ ] Top-3 source recall is at least 90%.\n- [ ] Material claims have source pointers and no major factual error is observed.\n- [ ] Median retrieval time or tool calls improve by at least 20%.\n- [ ] Monthly maintenance cost is at most 15 minutes.\n- [ ] The result is reused for real historical questions during a 4–6 week shadow period.\n\n## Decision\n\n- If the baseline sources are sufficient, close with no compiler.\n- If the on-demand experiment wins, propose a separate `project-memory` skill and human-gated charter amendment.\n- A committed artifact requires a separate follow-up decision with a single integration writer, source cursor"
    },
    {
      "number": 361,
      "title": "Sustain the #350 organic question log — 0/10 at the halfway mark, first entry due ~2026-08-28",
      "labels": [
        "enhancement",
        "epic"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:10Z",
      "updatedAt": "2026-08-16T07:48:28Z",
      "body": "The shadow protocol (`docs/historical-retrieval-shadow.md`, lines ~202–216) requires **≥10 organic historical questions** logged as JSONL comments on #350, spanning 3 repo classes, with ≥2 weeks between first and last reuse. As of 2026-08-15 the log has **0 entries** at the halfway mark of the measurement window.\n\nTimeline math: the earliest decision date is 2026-08-28 and the 6-week boundary is 2026-09-11. With the 2-week span requirement, the first entry must land by ~2026-08-28 or the epic cannot decide inside its own window — it either drifts or forces a gate-violating shortcut.\n\n**Action:** during normal work in dev-backlog, dev-relay, and consumer repos, log each real \"what happened historically?\" question as a #350 comment in the prescribed JSONL shape, at the moment it occurs. No code work is blocked; this is the only load-bearing task in the repo right now.\n\nSource: 2026-08-15 delivery/progress review (4-way independent review), ranked its #1 next move.\n"
    },
    {
      "number": 362,
      "title": "#350 decision branch A: no-compiler closeout (Arm B suffices)",
      "labels": [
        "enhancement",
        "epic"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:11Z",
      "updatedAt": "2026-08-16T07:48:30Z",
      "body": "If the #350 shadow benchmark decision lands **no-go** (Arm B suffices — live sources + disposable reports, no compiler), execute a clean closeout so the epic ends with subtraction discipline intact:\n\n- [ ] Record the decision + evidence summary in `docs/historical-retrieval-shadow.md` (mark the shadow concluded)\n- [ ] Close epic #350 with the decision comment linking the organic log\n- [ ] Close milestone 19 (2026-08 GitHub-native core simplification)\n- [ ] Run the O5 reassess owed at the sprint close (3-close threshold reached)\n- [ ] Close the `2026-07-github-native-core-simplification` sprint\n- [ ] Cut v1.0.0 as the bundled release ritual (see the v0.10.0/v1.0.0 tagging issue)\n- [ ] Confirm no retrieval/memory surface acquired write authority or a committed artifact during the shadow\n\nPre-filed so the 2026-08-28 decision lands on a prepared backlog instead of an empty one. Mutually exclusive with the go-branch issue.\n\nSource: 2026-08-15 delivery/progress review, recommended next move #4.\n"
    },
    {
      "number": 363,
      "title": "Resolve charter O3 this cycle: measured on-track drill or demote into the O5 reassess loop",
      "labels": [
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:12Z",
      "updatedAt": "2026-08-16T07:48:28Z",
      "body": "O3 (\"answer *is this project still on track?* in under 5 minutes against `spec/charter.md`\") has been `[active]` for months with no sprint pointed at it, no proof plan, and part of its substance migrated to craftkit with the spec-* skills (0.7.0). The v0.9.0 sprint explicitly parked work against it (\"belongs with the O3 portfolio work, not here\") and nothing picked it up. A charter whose flagship discipline is proof-gated status cannot carry a proof-free active objective indefinitely.\n\nResolve it this cycle, either way:\n\n- **Option A (measure):** run a timed drill — in 3–5 consumer repos, answer \"is this on track?\" against the repo charter, record times and whether the 5-minute bar holds; cite as proof and move O3 toward `implemented`/`validated` with its own denominator.\n- **Option B (demote/absorb):** fold O3's residue into the validated O5 reassess loop and demote it with a Decisions row, same as the O8/O9 treatment.\n\nSource: 2026-08-15 direction/strategy review [HIGH, \"zombie objective\", recommendation #1] and Codex second opinion (recommendation #3) — flagged independently by both.\n"
    },
    {
      "number": 364,
      "title": "Amend the historical-retrieval-shadow gates before the 2026-08-28 decision",
      "labels": [
        "documentation",
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:28Z",
      "updatedAt": "2026-08-16T07:48:51Z",
      "body": "Two gate defects in `docs/historical-retrieval-shadow.md` should be amended **before** the 2026-08-28 decision, not after:\n\n1. **Auto no-go on thin data:** fewer than 10 organic questions ⇒ automatic no-go (extend the window or close with \"Arm B suffices\"). Pre-declare the null result as the expected/acceptable outcome so a thin-data or manufactured-\"organic\" decision is structurally impossible.\n2. **Trivially-passable latency criterion:** the \"beat baseline by 20%\" bar compares a pre-compiled local file (0.794 ms) against live network calls (5.952 s) — any cached artifact clears it. It measures caching, not retrieval value. Score Arm C on **marginal recall / error rate over Arm B only** and drop or re-base the speed criterion.\n\nThe protocol is frozen by design, so this is a deliberate pre-registered amendment with rationale, analogous to a human-gated charter amend — record the change and its date in the doc.\n\nSource: 2026-08-15 direction/strategy review, concern #4 (goodharting risk) and recommendation #2.\n"
    },
    {
      "number": 365,
      "title": "#350 decision branch B: project-memory skill proposal + human-gated charter amendment",
      "labels": [
        "enhancement",
        "epic"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:29Z",
      "updatedAt": "2026-08-16T07:48:49Z",
      "body": "If the #350 shadow benchmark decision lands **go** (Arm C shows marginal recall/error value over Arm B under the amended criteria, with ≥10 organic questions), this is the entry point for admitting project memory:\n\n- [ ] Write the project-memory skill proposal: scope, storage boundary (disposable, source-attributed, never auto-written to an authority — per system-map invariants), maintenance budget vs the measured ~6 min/month projection\n- [ ] Draft the human-gated charter amendment adding the objective (new O-number, `[active]`, with a proof plan and its own denominator)\n- [ ] Define the measured adoption gate that would move it `implemented → validated`\n- [ ] Decide placement: dev-backlog capability vs sibling skill (cf. the 2026-04-18 sibling-skill decision pattern)\n\nThe charter amendment is human-gated; nothing here is executed without the #350 evidence gate passing first. Mutually exclusive with the no-go closeout issue.\n\nSource: 2026-08-15 delivery/progress review, recommended next move #4; charter Decision 2026-07-31 (memory requires a separate measured gate).\n"
    },
    {
      "number": 366,
      "title": "GitHub resilience: failure-mode acceptance matrix and operator runbook for gh-backed paths",
      "labels": [
        "enhancement",
        "epic"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:31Z",
      "updatedAt": "2026-08-16T07:49:19Z",
      "body": "The mirrorless pilot proved **correctness** of fail-loud GitHub authority (exact argv, no fallback) but not **resilience**. There is no explicit contract for rate-limit budgets, backoff, auth expiry, or partial-outage behavior across the orient/work/triage paths.\n\nScope:\n\n- [ ] Inventory `gh` call counts per operation class (orient, work, sprint init/close, triage collect/apply)\n- [ ] Acceptance matrix: rate-limited, auth-expired, and partial-outage responses each verified fail-loud **and effect-free** (no partial state written) — extend the fake-`gh` acceptance harness rather than hitting the network\n- [ ] Operator runbook: what the user sees and does for each failure class (retry timing, `gh auth` refresh, when to stop)\n- [ ] Decide whether any path needs a documented retry/backoff (default remains: no silent retry, no fallback authority)\n\nEmpirical nudge: during the 2026-08-15 PR #360 review cycle, CodeRabbit was rate-limited three consecutive times — external-service limits are a real operating condition, not a hypothetical.\n\nSource: Codex second opinion (2026-08-15 4-way review), recommendation #1.\n"
    },
    {
      "number": 367,
      "title": "SKILL.md conformance suite: periodic fresh-session evals on Claude and Codex + doc-drift check",
      "labels": [
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:32Z",
      "updatedAt": "2026-08-16T07:48:50Z",
      "body": "#358 moved triage judgment (blocks/depends-on/duplicates, priority/milestone proposals) from scripts to prompt guidance. Deterministic tests can no longer catch model-conformance drift: a model emitting malformed or over-eager `--model-actions` is only caught by the wire validator, not by anything measuring judgment quality or omission.\n\nScope:\n\n- [ ] Run the fresh-session Eval Prompts in both SKILL.md files as a periodic conformance suite on Claude Code **and** Codex\n- [ ] Compare triage model-actions across models: missing sections, over-mutation, dedupe-key violations, verb misuse (`close-duplicate` vs `revisit`)\n- [ ] Add a doc-drift check that greps agent-facing docs (`_context.md`, SKILL.md, references/) for symbols deleted from `scripts/` — the 2026-08-15 cleanup found `progress-sync` gotchas surviving its deletion by two weeks\n- [ ] Decide cadence (per release? per reassess?) and where results land (triage report? docs/)\n\nSource: Codex second opinion (2026-08-15 4-way review), recommendation #2; also flagged as prompt-contract model-variance risk in its blind-spot list.\n"
    },
    {
      "number": 368,
      "title": "Multi-track sprints: adoption checkpoint against the validated bar at next reassess",
      "labels": [
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:33Z",
      "updatedAt": "2026-08-16T07:48:50Z",
      "body": "Multi-track sprints (epic #289, shipped 0.8.0) sit today where `local` sat in June: kept on the \"costs ~0 while unused\" argument. It has real dogfood evidence (`scope:`-partitioned 2-track run in the subtraction milestone) — more than `local` ever had — but by the repo's own vocabulary it is `implemented`, not `validated`, and nothing tracks it against that bar.\n\nAction: at the next reassess (due at the current sprint close), add an adoption checkpoint —\n\n- [ ] Count `scope:`/`component:` multi-active usage across consumer repos\n- [ ] If used beyond this repo: cite it and move the capability toward `validated`\n- [ ] If unused: record the finding and let the same evidence-gate that killed `local` render its verdict at a stated horizon (e.g. two more reassess cycles)\n\nSource: 2026-08-15 direction/strategy review [LOW, concern #5 + recommendation #6].\n"
    },
    {
      "number": 369,
      "title": "Decide the external-adoption goal: cold-adopter test or right-size the public surface",
      "labels": [
        "documentation",
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:34Z",
      "updatedAt": "2026-08-16T07:48:53Z",
      "body": "Every load-bearing adoption figure comes from an 18-repo single-maintainer ecosystem (now stated explicitly in charter rev 13), and the git history has effectively one author — design, release, and consumer knowledge all bus-factor 1. The README (430 lines, badges, MIT, install flow) is sized for external adopters, but no validation has ever involved one.\n\nDecide explicitly, then act:\n\n- **If external adoption is a goal:** include one cold external-adopter test in the next milestone (someone else's repo, no author assistance; measure against the O7 cold-adopter gates), and consider a second release-capable maintainer for bus-factor relief.\n- **If not:** right-size the public surface (README length, badge/CI apparatus) to a personal-toolkit posture and record the decision in the charter Decisions table.\n\nSource: 2026-08-15 direction/strategy review [HIGH, concern #2 + recommendation #3]; Codex second opinion (bus factor, recommendation #3).\n"
    },
    {
      "number": 370,
      "title": "Cut v0.10.0 now; reserve v1.0.0 for the #350 decision bundle",
      "labels": [
        "documentation",
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:35Z",
      "updatedAt": "2026-08-16T07:49:00Z",
      "body": "Shipped-but-untagged contract changes since v0.9.0: mirrorless GitHub default (#347/#353), GitHub-only tracker layer (#348/#354), effective-spec resolver (#352), triage judgment-to-prompt (#358), and the 2026-08 docs/spec cleanup (#360).\n\n- [ ] Cut **v0.10.0** now for the shipped simplification wave (CHANGELOG Unreleased → 0.10.0)\n- [ ] Reserve **v1.0.0** for the bundled ritual: #350 decision + milestone 19 close + O5 reassess + sprint close — tagging v1.0.0 mid-milestone would put the release cut before the milestone's own evidence gate\n\nSource: 2026-08-15 delivery/progress review, recommended next move #3.\n"
    },
    {
      "number": 371,
      "title": "Run the owed O5 reassess at the current sprint close (3-close threshold) with pending checkpoints",
      "labels": [
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:36Z",
      "updatedAt": "2026-08-16T07:48:54Z",
      "body": "Reassess counter check (charter O5): last dated report is `backlog/triage/2026-07-27-reassess.md`; two sprints closed since (rule-simplification, progress-axis-removal, both 2026-07-29). Closing the current `2026-07-github-native-core-simplification` sprint hits the 3-close threshold exactly.\n\n- [ ] At that sprint close, run `backlog-doctor` (automatic) and follow the close-summary recommendation to run `spec-charter reassess`\n- [ ] Feed the reassess the pending checkpoint items: O3 resolution (separate issue), multi-track adoption checkpoint (separate issue), and the methodology fix below\n- [ ] Methodology fix from the v0.9.0→#348 whiplash: the reassess should ask **\"does the evidence justify this axis existing\"** before \"is it built at the right size\" — the delete-justifying evidence was in the sprint file four days before the delete decision. Record as a reassess-input rule (charter Decision or doctor check).\n\nReport-only per O5; any amend stays human-gated.\n\nSource: 2026-08-15 delivery/progress review (hygiene #3) + direction/strategy review (concern #3, recommendation #5).\n"
    },
    {
      "number": 372,
      "title": "triage-report: warn instead of silently dropping stale candidates with unsupported suggested_action",
      "labels": [
        "bug",
        "enhancement"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:37Z",
      "updatedAt": "2026-08-16T07:49:20Z",
      "body": "`validateStaleResult` in the triage pipeline does not constrain `suggested_action`. Since PR #360 narrowed `staleCandidateToAction` to the one value `triage-stale.js` emits (\"close\"), a stale JSON produced by a pre-#358 version (which could emit `revisit` / `merge-into:#N`) still parses, but its candidates **silently vanish** from the report — the obsolete section shows `(none)` with no hint that input was dropped.\n\nImpact is negligible today (stale JSON is a transient same-run intermediate), but silent drops violate the repo's fail-loud posture.\n\n- [ ] Emit a visible warning (report line or stderr) naming the dropped candidates and their unsupported `suggested_action`\n- [ ] Optionally: reject unknown values in `validateStaleResult` outright, since the producer grammar is now closed\n\nSource: pi (deepseek-v4-flash-0731) round-2 review of PR #360, non-blocking observation #2.\n"
    },
    {
      "number": 373,
      "title": "Spec-surface human-gated residues: remaining local-era Learnings; O1 wording clarification",
      "labels": [
        "documentation",
        "enhancement",
        "epic"
      ],
      "milestone": null,
      "createdAt": "2026-08-16T07:48:39Z",
      "updatedAt": "2026-08-16T07:49:27Z",
      "body": "Two human-gated residues from the 2026-08-15 review + cleanup pass (deliberately excluded from PR #360 to keep it mechanical):\n\n1. **Remaining local-era Learnings in `spec/capabilities.md`** (tracker-task-truth): PR #360 relocated the one entry whose entire subject was deleted (#298 local store). The 2026-07-11/12 entries that mention `local` alongside still-living seams (fail-closed resolution, task-ref tests, provider seam argv, setup pinning, dual-mode matrix/serializer) were kept. Decide whether to trim their dead clauses or leave dated learnings verbatim — either is defensible; record the choice.\n2. **O1 wording clarification**: \"single execution state\" predates multi-track and means *shared state*, not sprint count (compatible per the #294 analysis, noted in `_context.md`). A wording clarification is an open human-gated amend candidate — never amend silently.\n\nSource: 2026-08-15 direction review (ceremony list) + `_context.md` standing note (2026-07, epic #289).\n"
    }
  ]
}
