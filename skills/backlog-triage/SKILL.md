---
name: backlog-triage
argument-hint: "[report|apply]"
description: Triage open GitHub Issues into an advisory report. Use for issue grooming, stale or obsolete detection, relationship mapping, priority and milestone proposals, accepted-action apply, 백로그 정리, 이슈 검토, 트리아지.
compatibility: Requires gh CLI and git. Works on Claude Code and Codex.
metadata:
  related-skills: "dev-backlog, spec-charter"
---

# Backlog Triage

Real job: read open GitHub Issues, write one advisory report, and apply only human-accepted mutations through anchor comments. GitHub-only: the resolved task authority must be exactly `github` (no `.dev-backlog/.tracker`, or one that says `github`); otherwise — another authority, or an empty, unknown, or unreadable file — stop, this skill does not apply. GitHub Issues stay the source of truth; the report is a derived file under `.dev-backlog/triage/`; nothing mutates GitHub until Apply.

## Report

Goal: `.dev-backlog/triage/YYYY-MM-DD-report.md` that a human can accept line by line.
Rail: `gh issue list --state open --limit 500 --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url` (raise `--limit` until the count stops growing; add `gh issue view N --json comments,closedByPullRequestsReferences` when a judgment needs comment history or a merged closing PR). Read `spec/charter.md` (else root `CHARTER.md`), optional `spec/capabilities.md` / `spec/system-map.md`, and any `status: active` sprint under `.dev-backlog/sprints/`. Write the report with these sections in this order: `## Classification` (by theme, label, age), `## Relationships` (one edge per fact, direction as the evidence phrase states: `A blocks B` = B waits for A; `A depends-on B` = A waits for B; plain `#N` mentions outside code fences and URLs, never self-mentions, and merged closing PRs count as evidence), `## Obsolete Candidates` (inactive past `stale_days` in `.dev-backlog/triage-config.yml`, default 60, with no milestone; `wontfix` / `invalid` labels; merged closing PR; duplicates of open or recently closed issues), `## Priority Proposals`, `## Milestone Suggestions` (never into an active or wait-gated milestone), `## Alignment` (every open issue → ≥1 charter Objective or named as an orphan; when no charter exists, write "skipped because no charter"), `## Decision Review` (every open issue in Do Now / Shape First / Defer / Drop-Close; name any absent spec tier), `## Apply Checklist` (every anchored action repeated once).
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

## Ownership

Sprint files, milestones, and Issue AC belong to `dev-backlog`; open-issue classification, relationships, stale flags, priority/milestone proposals and their accepted mutations belong to this skill.

## References

- `references/apply.md` (anchor grammar, verb map, idempotency, apply-log schema)
- `tests/evals/backlog-triage.md` (eval prompts; source checkout)
