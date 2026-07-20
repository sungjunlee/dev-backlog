---
id: BACK-313
title: 'release: prepare and cut v0.8.0'
status: To Do
labels:
  - documentation
  - enhancement
priority: medium
milestone: v0.8.0 hardening and release
created_date: '2026-07-16'
---
## Description
## Problem

The repository is still versioned at 0.7.0, while HEAD contains 57 commits and large product changes including configured tracker adapters, a canonical offline local tracker, and multi-track sprints. The Unreleased changelog currently emphasizes multi-track work and does not fully represent the tracker/local-adapter release surface.

## Acceptance Criteria

- [ ] Complete the Windows portability blocker before cutting the release.
- [ ] Expand Unreleased notes to cover tracker selection, local adapter behavior, setup/migration contract, acceptance proof, and multi-track sprints.
- [ ] Choose and record the semver decision; default recommendation is 0.8.0.
- [ ] Update VERSION and changelog compare links consistently.
- [ ] Run maintainer verification and the full supported-platform CI matrix.
- [ ] Create and push the annotated tag and GitHub release only after the release PR is merged.
