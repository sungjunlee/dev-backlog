---
id: BACK-244
title: 'chore(release): align VERSION and CHANGELOG link definitions with v0.7.0'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

Git tags and CHANGELOG entries go up to 0.7.0 (2026-07-04), but release metadata lags:

- `VERSION` still reads `0.5.0`.
- CHANGELOG bottom link definitions stop at `[0.5.0]`; `[0.6.0]` and `[0.7.0]` links are missing.
- `[Unreleased]` compare link still points at `v0.5.0...HEAD`.

## Acceptance Criteria

- [ ] `VERSION` reads `0.7.0`
- [ ] CHANGELOG has link definitions for `[0.7.0]` and `[0.6.0]` following the existing compare-URL pattern
- [ ] `[Unreleased]` compares `v0.7.0...HEAD`
