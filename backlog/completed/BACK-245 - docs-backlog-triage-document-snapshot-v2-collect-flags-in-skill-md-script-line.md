---
id: BACK-245
title: 'docs(backlog-triage): document snapshot v2 collect flags in SKILL.md script line'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

`skills/backlog-triage/scripts/triage-collect.js` supports `--with-comments`, `--with-closed-issues`, and `--paginate`, and two report signals depend on them: `duplicate-of-closed` requires `--with-closed-issues`, and `comment-mentions` requires `--with-comments` (see `references/stale.md`, `references/relationships.md`). But the SKILL.md "Useful scripts" line for `triage-collect.js` lists only `[--repo OWNER/REPO] [--limit N] [--json] [--dry-run]`. An agent working from SKILL.md alone cannot produce those signals.

## Acceptance Criteria

- [ ] SKILL.md `triage-collect.js` line includes `--with-comments`, `--with-closed-issues`, and `--paginate`
- [ ] One short clause notes which signals need the opt-in flags (or points to the reference that does)
- [ ] Line stays consistent with `references/classification.md` flag semantics
