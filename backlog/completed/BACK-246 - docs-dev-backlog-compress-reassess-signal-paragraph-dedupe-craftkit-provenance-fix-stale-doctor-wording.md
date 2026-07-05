---
id: BACK-246
title: 'docs(dev-backlog): compress reassess-signal paragraph, dedupe craftkit provenance, fix stale doctor wording'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

Conciseness findings from a writing-great-skills review of the skill docs:

1. **Reassess-signal paragraph is a 9-line spec dump.** The paragraph under SKILL.md `### Complete` packs same-day-covered accounting, dry-run counting, and field schema into the execution contract. That detail already lives in `references/integration-contract.md` (Backlog Doctor JSON Surface). Compress the SKILL.md paragraph to 2-3 sentences: when the signal fires, where the accounting spec lives, and the unattended rule (`reassess` allowed, `amend` never).
2. **Craftkit provenance repeated.** "shipped with craftkit / installed spec-charter skill" is explained 3x in `skills/dev-backlog/SKILL.md` and 4x in `skills/backlog-triage/SKILL.md`. State it once per file at first mention; later mentions can just name the skill.
3. **Stale future tense.** `references/integration-contract.md:226` still says "the upcoming `backlog-doctor` consumer will flag them for repair" — backlog-doctor shipped. Reword to present tense.

## Acceptance Criteria

- [ ] SKILL.md reassess-signal paragraph is 2-3 sentences and defers accounting details to integration-contract.md without losing the unattended reassess/amend rule
- [ ] Craftkit provenance stated once per SKILL.md; subsequent mentions shortened; no cross-skill path broken
- [ ] integration-contract.md unmoored-line note refers to backlog-doctor in present tense
- [ ] `skills/dev-backlog/SKILL.md` stays under 250 lines
