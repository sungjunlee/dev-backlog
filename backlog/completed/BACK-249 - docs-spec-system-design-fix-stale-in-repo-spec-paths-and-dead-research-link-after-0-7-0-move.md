---
id: BACK-249
title: 'docs(spec-system-design): fix stale in-repo spec-* paths and dead research link after 0.7.0 move'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

`docs/spec-system-design.md` is load-bearing (`spec/capabilities.md:5` and `spec/system-map.md:82` cite it) but predates the 0.7.0 spec-* move:

- Component-doc table (lines ~121-124) and prose (~133-134, 162-164, 234) still reference in-repo paths like `skills/spec-charter/SKILL.md` that no longer exist here — they ship with craftkit.
- Line ~186 links `../skills/spec-grill/references/spec-system-research.md`, which exists nowhere live: it moved to craftkit (62a0f9a) and was then deleted in PR review (1c78851). The only surviving copy is in dev-backlog git history (pre-cd31a2b).

## Acceptance Criteria

- [ ] A dated note near the top records that the spec-* skills moved to craftkit in 0.7.0 and that in-repo `skills/spec-*` paths below are historical
- [ ] Component-doc table paths either point at the craftkit-installed skills or are explicitly marked historical
- [ ] The research-survey link no longer 404s: cite the dev-backlog git history location (pre-cd31a2b) until craftkit decides whether to restore the doc (tracked in a craftkit issue)
- [ ] The three load-bearing research findings summarized in the doc remain intact (do not delete content, only fix provenance/links)
- [ ] Citing files (`spec/capabilities.md`, `spec/system-map.md`) need no changes
