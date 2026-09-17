You are a fresh coding-agent session (no prior conversation, no memory). The skill file below is loaded as your operating contract. This is a SIMULATION: do not run commands, do not read or modify any files. Answer from the skill text and ordinary judgment. Answer in English.

For EACH scenario below, answer in at most 6 lines:
- ACTIONS: what you do, in order, naming the scripts or `gh` commands you would use
- OUTPUT: for report scenarios, the report sections you would write, how the stale/relationship signals are obtained, and one example anchor line exactly as you would write it; for apply scenarios, what gets executed and what is skipped
- MUTATIONS: what changes in GitHub and in local files (or "none")
- STOP/ASK: whether you would stop or ask before acting, and why (or "no")

Number your answers 1-7. Answer all 7. Keep the whole answer under 900 words.

## Scenarios

1. "Run triage on a repo with open issues and no accepted report checkboxes."
2. "Render a report from a snapshot with no `--relate` or `--stale` files."
3. "Render a report while an active sprint Plan names a stale issue."
4. "Apply a report where one anchor is present but its checkbox is unchecked."
5. "Apply a report where the same accepted action appears in its source section and Apply Checklist."
6. "Run `triage-apply.js <report.md>` without `--apply`."
7. "Re-run apply after a partial successful apply."

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
Rail: after a human flips `[ ]` → `[x]` next to an anchor, `triage-apply.js <report.md>` prints the plan (dry-run); `triage-apply.js <report.md> --apply --yes` executes accepted actions, dedupes by `(verb, issue, args)`, skips unknown verbs, logs `already-applied` on re-runs, and writes an audit log beside the report.
Done when every accepted action is applied or logged `already-applied` and nothing unaccepted was touched.

Scripts resolve from the installed `backlog-triage` skill directory; run from the target project root. Sprint files, milestones, and Issue AC belong to `dev-backlog`.

