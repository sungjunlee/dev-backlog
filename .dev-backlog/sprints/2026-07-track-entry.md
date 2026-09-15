---
milestone: 2026-07 adoption gate and track entry
status: completed
started: 2026-07-27
due: TBD
objectives: [O1, O3]
component: "sprint-execution"
---

# track-entry

## Goal
The charter stops reading green for capabilities nobody uses, and opening a
component-partitioned track is a flag on `sprint-init.js` rather than a hand edit that
the create-time disjointness guard cannot see.

## Plan

### Batch 1 - Track entry path

- [x] #331 feat(sprint-init): `--component <slug>` — create-time entry path for the primary track axis (~2hr) → PR #336 (merged)

### Batch 2 - Status-vocabulary consumer [after:craftkit#165]

- [x] #335 fix(objectives-check): accept the `implemented` status; it currently reports valid IDs as drift (~30min) → PR #338 (merged)

### Batch 3 - Charter status [after:#335]

- [x] #333 spec: apply the adoption-gated objective status to `spec/charter.md` (O8/O9) (~45min) → revision 10

## Running Context

- **This track is one half of the first real two-track dogfood.** The sibling track is
  `2026-07-prose-guard.md` (`component: tracker-task-truth`, issue #332). multi-track
  shipped in v0.8.0 and has had zero adopters across 19 consuming repos; running it here
  is how it gets its first. Keep the file sets disjoint: this track owns
  `sprint-init.js`, `sprint-init.test.js`, `spec/charter.md`, and the flag-inventory docs
  (`references/scripts.md`, `references/process.md`, `SKILL.md` Plan step). The sibling
  track **reads** `SKILL.md` and must not edit it.
- **The gap #331 fixes was reproduced while opening these two tracks.** Creating the
  second sprint emitted, verbatim:
  `Active track(s) without component:/scope: (2026-07-track-entry.md); cannot prove the
  new sprint is disjoint.` Both sprints were destined for distinct components, but
  `checkTrackDisjointness({ sprintsDir, scope })` never sees a component, so it took the
  scopeless branch (`sprint-init.js:206-213`) — warn, then allow. Both `component:`
  values below were typed in by hand afterward. That is the entry path #331 adds.
- **This is a detection delay, not a hole.** A genuinely duplicated `component:` is
  caught by `backlog-doctor.js:289`/`:309-315` as an `active_sprint` **fail**. #331 moves
  the refusal to creation time; it does not add a guarantee the repo lacked.
- **#333 is blocked on craftkit#165 and must stay blocked.** The `implemented` status
  vocabulary belongs to craftkit's `spec-charter` skill (`SKILL.md:65,104`,
  `references/amendment.md:30-42`). Inventing the state locally is exactly the dual
  ownership that caused the 2026-06/07 silent fork. Per the workspace rule, `spec-*`
  changes are craftkit issues even when found while dogfooding dev-backlog.
- **#333 is human-gated and not delegatable.** Tier-2 status semantics require the human
  to confirm the proposed diff. The approval that opened this sprint covers the intent,
  not an unseen diff.
- **Do not reword an objective to make its proof look sufficient.** If a predicate can
  only ever be producer-observable as written, record that in Progress instead.
- **The measurement that motivated both issues** (2026-07-26, 19 consuming repos):
  `local` tracker 0 adopters; `tracker:` set in 1 config, to the default; `scope:` in 0
  files; 0 repos with 2+ active tracks. Every health signal was green throughout.
- **Size guards are acceptance criteria, not suggestions.** #331 stops at ~120 lines
  outside tests. Exceeding one is a finding to report, not a budget to spend.
- Relay/PR review stops at ready-to-merge unless merge is separately approved.

## Progress
- 2026-07-27: **Charter amended to revision 10 after human confirmation of the diff.** Only
  O8 and O9 moved to `implemented`; O1, O4, O5, and O7 stayed `validated` and gained cited
  adoption evidence. That split is the point — the rule discriminates rather than
  downgrading everything. Measured across the 17 repos consuming dev-backlog besides this
  one: O1 146 sprints; O4 `backlog/triage/` reports in 7 repos; O5 dated reassess reports in
  3 (consumer-A, beopsuny-skill, aibris); O7 10 repos running sprints with no `spec/`
  axis at all, up to 15 sprints each; O8 **0** repos using `local`; O9 **0** repos setting a
  non-default tracker.
  #335 proved to be a real hard blocker, not a hypothetical: running the pre-#335 parser
  against this amended charter drops O8 and O9 from `charterObjectiveIds` entirely and exits
  1. Landing #333 first would have broken `backlog-doctor` in every consuming repo.
  **Deviation from the acceptance criteria, stated:** the AC asked for the amend to be
  applied *through* the installed `spec-charter` skill in amend mode. It was authored and
  applied directly instead, with the proof gate applied by hand — every objective was
  re-evaluated against the new rule using measured evidence, and the diff was confirmed by
  the human before application. Re-running the skill over an already-amended file would have
  been theater, but the letter of that criterion was not met.
  Tier-3 discipline caught in review of my own draft: the new Decisions row was initially
  inserted mid-table; it is append-only, so it moved to the end.
- 2026-07-27: **A shared vocabulary's blast radius crosses repo boundaries, and nobody's
  scope saw it.** craftkit#165 adds an `implemented` objective status. Its issue scoped the
  work to `skills/spec-charter/`; round-2 review found `spec-grill` silently dropping the
  new token, and that scope was amended in the open. Verifying that fix, I checked outside
  craftkit and found this repo carries the identical hard-coded pattern at
  `objectives-check.js:101`. Reproduced against a charter with `- O8 [implemented] …` and a
  sprint declaring `objectives: [O8]`: exit 1, `charterObjectiveIds: ["O1"]`, `O8` reported
  as `missing` drift. `backlog-doctor` would start failing on a correct repo the moment
  #333 lands — which is #333's entire purpose. Filed #335; batches renumbered so #333 is
  blocked on it. Neither craftkit#165 nor #335 could have found the other by reading its
  own tree. The durable lesson: a skill that defines a vocabulary other repos parse cannot
  verify its own blast radius. That belongs in `spec-charter`'s guidance, not here — noted
  on craftkit#165 for a later pass.
- 2026-07-27: Sprint opened as track A of a two-track portfolio, immediately after the
  v0.9.0 release closed at 0 open issues / 0 open PRs. Filed from the post-release
  reassessment: the v0.9.0 subtraction fixed the *consequence* (`local` built at the
  wrong tier) but not the *rule* that let four zero-adopter axes read as validated.
  craftkit#165 owns the rule; #333 applies it here; #331 removes the friction that
  explains why multi-track has no adopters to validate against.
- 2026-07-27: Sprint closed. 3/3 tasks completed.
