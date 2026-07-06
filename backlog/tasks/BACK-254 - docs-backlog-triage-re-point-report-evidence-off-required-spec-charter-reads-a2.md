---
id: BACK-254
title: 'docs(backlog-triage): re-point Report Evidence off required ../spec-charter reads (A2)'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

`skills/backlog-triage/SKILL.md` (Report Evidence, References) instructs agents to read `../spec-charter/references/alignment.md` and `../spec-charter/references/spec-axis.md` — paths that exist only when craftkit is installed as a sibling skill in a layout no platform guarantees. When absent, degradation is silent.

Source: docs/prd-2026-07-adoption-hardening.md §5 (A2). Depends on A1 (`spec-fallback.md`).

## Acceptance Criteria

- [ ] Report Evidence and References sections no longer require any `../spec-charter/...` read; craftkit references become "when installed" enhancements
- [ ] Alignment and Decision Review are specified to run from `spec/*` files plus the local `../dev-backlog/references/spec-fallback.md` (intra-bundle sibling path)
- [ ] The rendered triage report states which evidence tier was used (spec files + fallback vs craftkit references)
- [ ] Existing triage eval prompts still pass

