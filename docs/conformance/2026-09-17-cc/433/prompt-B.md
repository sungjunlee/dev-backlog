You are a fresh coding-agent session (no prior conversation, no memory). The skill file below is your operating contract. This is a SIMULATION of the Report mode: you cannot run commands, so the outputs of the commands the skill names are supplied here verbatim as data. Today is 2026-09-17. Write the COMPLETE triage report as the skill specifies (every section, in order, with anchor + checkbox pairs) and nothing else — no preamble, no commentary. Output only the report markdown. Answer in English.

## Skill file (SKILL.md)

---
name: backlog-triage
argument-hint: "[report|apply]"
description: Triage open GitHub Issues into an advisory report. Use for issue grooming, stale or obsolete detection, relationship mapping, priority and milestone proposals, accepted-action apply, 백로그 정리, 이슈 검토, 트리아지.
compatibility: Requires gh CLI and git. Works on Claude Code and Codex.
---

# Backlog Triage

Real job: read open GitHub Issues, write one advisory report, and apply only human-accepted mutations through anchor comments. GitHub Issues stay the source of truth; the report is a derived file under `.dev-backlog/triage/`; nothing mutates GitHub until Apply.

## Report

Goal: `.dev-backlog/triage/YYYY-MM-DD-report.md` that a human can accept line by line.
Rail: `gh issue list --state open --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url` (add `gh issue view N --comments` when a judgment needs comment history; `gh pr list --search "closes #N" --state merged` for merged closing PRs). Read `spec/charter.md` (else root `CHARTER.md`), optional `spec/capabilities.md` / `spec/system-map.md`, and any `status: active` sprint under `.dev-backlog/sprints/`. Write the report with these sections in this order: `## Classification` (by theme, label, age), `## Relationships` (one edge per fact, direction as the evidence phrase states: `A blocks B` = B waits for A; `A depends-on B` = A waits for B; plain `#N` mentions and merged closing PRs count as evidence), `## Obsolete Candidates` (inactive past the stale threshold in `.dev-backlog/triage-config.yml`, default 60 days, with no milestone; `wontfix` / `invalid` labels; merged closing PR; duplicates of open or recently closed issues), `## Priority Proposals`, `## Milestone Suggestions` (never into an active or wait-gated milestone), `## Alignment` (every open issue → ≥1 charter Objective or named as an orphan; when no charter exists, write "skipped because no charter"), `## Decision Review` (every open issue in Do Now / Shape First / Defer / Drop-Close; name any absent spec tier), `## Apply Checklist` (every anchored action repeated once).
Every proposal is an anchor comment followed by a checkbox line:

```markdown
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists
```

Verbs: `close`, `revisit`, `close-duplicate` (`target=#N`), `set-priority` (`value=high|medium|low`), `assign-milestone` (`milestone="Name"`). Args are `key="value"` or `key=value`; the first `#N` after the verb is the target.
Boundary: never propose closing an issue named in an active sprint's Plan or Running Context. Never mutate GitHub or `spec/*` in this mode.
Done when the report exists with every section present, every proposal anchored, and no close targets an in-flight issue.

## Apply

Goal: only accepted actions reach GitHub.
Rail: after a human flips `[ ]` → `[x]` next to an anchor, `node <installed skill dir>/scripts/triage-apply.js <report.md>` prints the plan (dry-run); the same with `--apply --yes` executes accepted actions, dedupes by `(verb, issueNumber, normalizedArgs)`, skips unknown verbs, logs `already-applied` on re-runs, and writes an audit log beside the report.
Done when every accepted action is applied or logged `already-applied` and nothing unaccepted was touched.

Scripts resolve from the installed `backlog-triage` skill directory; run from the target project root. Sprint files, milestones, and Issue AC belong to `dev-backlog`.


## Supplied data

### `.dev-backlog/triage-config.yml`
stale_days: 60

### `spec/charter.md`
---
revision: 1
---
# fixture Charter
## Objectives
- O1 — authentication flows are reliable and observable.
- O2 — billing reconciliation is exact and auditable.


### Active sprint `.dev-backlog/sprints/2026-09-fixture.md`
---
milestone: 2026-09 fixture
status: active
started: 2026-09-01
due: TBD
scope: ["src/auth/**"]
---
# fixture
## Goal
Ship the auth rework.
## Plan
### Batch 1
- [~] #603 Old auth issue kept alive by the sprint (~2h) → PR #90 (open)
- [ ] #611 Session refresh (~1h)
## Running Context
- #612 is parked here on purpose; do not close it.
## Progress
- 2026-09-01: opened


### Output of `gh issue list --state open --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url` (15 issues)
[
 {
  "number": 601,
  "title": "Login page times out under load",
  "body": "Users see 504s after 30s. Blocks #602.",
  "labels": [
   "bug",
   "auth"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-10T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/601"
 },
 {
  "number": 602,
  "title": "Add retry to auth client",
  "body": "Depends on #601 landing first. See also https://github.com/sungjunlee/fixture/pull/77#issuecomment-1 for context.",
  "labels": [
   "auth"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-12T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/602"
 },
 {
  "number": 603,
  "title": "Old auth issue kept alive by the sprint",
  "body": "Untouched for months but on the active Plan.",
  "labels": [
   "auth"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-02-01T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/603"
 },
 {
  "number": 604,
  "title": "Cold issue nobody owns",
  "body": "No activity since winter. Mentions #605 in passing.",
  "labels": [],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-01-15T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/604"
 },
 {
  "number": 605,
  "title": "Cold but milestoned",
  "body": "Planned for later.",
  "labels": [],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-01-20T00:00:00.000Z",
  "milestone": "Later",
  "url": "https://github.com/sungjunlee/fixture/issues/605"
 },
 {
  "number": 606,
  "title": "Marked wontfix",
  "body": "We will not do this.",
  "labels": [
   "wontfix"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-08-01T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/606"
 },
 {
  "number": 607,
  "title": "Marked invalid",
  "body": "Not a real bug.",
  "labels": [
   "invalid"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-08-15T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/607"
 },
 {
  "number": 608,
  "title": "Already fixed by a merged PR",
  "body": "Fixed in the linked PR.",
  "labels": [
   "billing"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-08-20T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/608"
 },
 {
  "number": 609,
  "title": "Code-fence mention must not count",
  "body": "Example log:\n```\nerror: see #601 in stack\n```\nNo real relation.",
  "labels": [
   "billing"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-11T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/609"
 },
 {
  "number": 610,
  "title": "Reconciliation drift on refunds",
  "body": "Refund rows off by one cent. Duplicate-looking of #613? Comment thread says more.",
  "labels": [
   "billing",
   "bug"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-13T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/610"
 },
 {
  "number": 611,
  "title": "Session refresh",
  "body": "Refresh tokens rotate weekly.",
  "labels": [
   "auth"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-05T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/611"
 },
 {
  "number": 612,
  "title": "Parked billing spike",
  "body": "Parked in the sprint Running Context; stale by date.",
  "labels": [
   "billing"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/612"
 },
 {
  "number": 613,
  "title": "Refund reconciliation off by one cent",
  "body": "Same symptom as the drift report.",
  "labels": [
   "billing",
   "bug"
  ],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-09T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/613"
 },
 {
  "number": 614,
  "title": "Self mention should be ignored",
  "body": "This is #614 itself. Real mention: #611.",
  "labels": [],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/614"
 },
 {
  "number": 615,
  "title": "Orphan with no objective",
  "body": "Rename the repo mascot.",
  "labels": [],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-09-15T00:00:00.000Z",
  "milestone": null,
  "url": "https://github.com/sungjunlee/fixture/issues/615"
 }
]

### Output of `gh issue view N --comments` for every issue that has comments (all others have none)
{
 "610": [
  {
   "author": "alice",
   "createdAt": "2026-09-14T00:00:00.000Z",
   "body": "Also related to #608 which was already merged."
  }
 ]
}

### Output of `gh pr list --state merged` filtered to PRs whose description closes an open issue (all others: none)
[
 {
  "number": 88,
  "state": "MERGED",
  "mergedAt": "2026-08-21T10:00:00.000Z",
  "closesIssue": 608
 }
]
