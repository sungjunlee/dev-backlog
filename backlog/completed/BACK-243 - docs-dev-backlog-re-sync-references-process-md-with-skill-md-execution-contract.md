---
id: BACK-243
title: 'docs(dev-backlog): re-sync references/process.md with SKILL.md execution contract'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
Re-sync `skills/dev-backlog/references/process.md` with the SKILL.md execution contract: (1) Complete flow must route through `sprint-close.sh` (doctor + reassess signal) before the status flip; (2) Plan step 0 must state the refuse rule instead of an inline `status: completed` flip; (3) Plan must cover `component:` and `sprint-init.js`.

- [x] process.md Complete section instructs running `sprint-close.sh` as the sprint-close gate, matching SKILL.md ordering
- [x] process.md Plan step 0 routes through the Complete flow and states the refuse rule
- [x] process.md Plan covers `component:` resolution and mentions `sprint-init.js` as the standard path
- [x] No new contradiction between process.md, SKILL.md, and workflow-patterns.md

(Body restored 2026-07-05: original GitHub body was lost to a `gh issue create --json` flag error; fixed by 056b087.)
