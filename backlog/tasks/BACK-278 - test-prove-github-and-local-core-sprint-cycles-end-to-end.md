---
id: BACK-278
title: 'test: prove github and local core sprint cycles end to end'
status: To Do
labels:
  - enhancement
priority: medium
milestone: 2026-07 tracker adapter foundation
created_date: '2026-07-11'
---
## Description
## Context

O8 is not satisfied by adapters merely existing. The release needs executable proof that the same core sprint cycle works in GitHub and local modes, that legacy GitHub users do not migrate, and that unsupported features degrade explicitly.

## Goal

Ship a deterministic dual-mode acceptance harness, upgrade documentation, and final contract alignment for the tracker foundation milestone.

## Acceptance Criteria

- [ ] One acceptance matrix runs the core create → plan → orient/read → work-state → complete cycle in both `github` and `local` fixtures.
- [ ] The GitHub fixture proves legacy config, `#N`, `issue_number`, command argv, task mirrors, milestones, sprint mirror, and progress behavior remain compatible.
- [ ] The local fixture runs offline with `gh` absent and proves canonical task creation, normalized sprint refs, state reads, and archive-on-close.
- [ ] Unsupported local capabilities have deterministic non-zero/error JSON and user-facing remediation text.
- [ ] README, SKILL.md, file-format, process, integration contract, and script inventory consistently document tracker selection and mode-specific behavior without duplicating implementation detail.
- [ ] Upgrade notes state that existing repositories remain GitHub-backed until explicitly changed and that no automatic multi-tracker migration exists.
- [ ] Full Node tests, smoke tests, spec validators, skill discovery, and `git diff --check` pass.
- [ ] O2/O9 and O8 status changes are proposed only with matching merged/runtime proof; no objective is declared validated early.

## Non-Goals

- Tracker-neutral `shape` publication.
- GitLab/Gitea/Forgejo.
- Generic provider parity beyond declared capabilities.

Depends on #275, #276, and #277. Parent: #270.

