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
Rail: `gh issue list --state open --limit 500 --json number,title,body,labels,milestone,assignees,updatedAt,createdAt,url` (raise `--limit` until the count stops growing; add `gh issue view N --json comments,closedByPullRequestsReferences` only when a judgment needs comment history or a merged closing PR). Read `spec/charter.md` (else root `CHARTER.md`), optional `spec/capabilities.md` / `spec/system-map.md`, and any `status: active` sprint under `.dev-backlog/sprints/`. Write concise prose evidence for recommendations: classifications, evidence-based relationships (`A blocks B` means B waits for A; `A depends-on B` means A waits for B), obsolete candidates (`stale_days` from `.dev-backlog/triage-config.yml`, default 60), priority or milestone suggestions, and decision recommendations as relevant. Headings are optional except `## Apply Checklist`; omit empty sections.

When a charter exists, summarize relevant alignment and material gaps such as orphan work, neglected Objectives, or contradictions, citing evidence without inventing Objective IDs or adding a redundant per-issue mapping table. Without a charter, state that Alignment was skipped because no charter is present.

Write each proposed mutation exactly once, only under `## Apply Checklist`, as an anchor followed by its approval checkbox:

```markdown
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists
```

Verbs: `close` (`reason="..."`), `revisit` (`reason="..."`), `close-duplicate` (`target=#N`), `set-priority` (`value=high|medium|low`), `assign-milestone` (`milestone="Name"`; legacy `name=` is accepted on Apply). Args are `key="value"` or `key=value`; the first `#N` after the verb is the target.
Boundary: never propose closing an issue named in an active sprint's Plan or Running Context. Never mutate GitHub or `spec/*` in this mode.
Done when the report contains evidence for every recommendation, exactly one checklist anchor per proposed mutation, honest charter alignment or the no-charter skip, and no close targets an in-flight issue.

## Apply

Goal: only accepted actions reach GitHub.
Rail: after a human flips `[ ]` → `[x]` next to an anchor, `node <installed skill dir>/scripts/triage-apply.js <report.md>` prints the plan (dry-run); the same with `--apply --yes` rejects missing or repeated checklist headings and any anchor outside the checklist, validates every accepted known action and the GitHub authority, checks that the audit log can be appended, then executes accepted actions. It skips unknown verbs, logs each durable command, and records `already-applied` on re-runs so a normal partial failure resumes with only remaining work. If GitHub reports success but the following log append fails, stop and verify remote state before manual recovery; the unlogged effect makes a blind re-run unsafe.
Done when every accepted action is applied or logged `already-applied` and nothing unaccepted was touched.

Scripts resolve from the installed `backlog-triage` skill directory; run from the target project root.

## Ownership

Sprint files, milestones, and Issue AC belong to `dev-backlog`; open-issue classification, relationships, stale flags, priority/milestone proposals and their accepted mutations belong to this skill.

## References

- `references/apply.md` (anchor grammar, verb map, idempotency, apply-log schema)
- `tests/evals/backlog-triage.md` (eval prompts; source checkout)
