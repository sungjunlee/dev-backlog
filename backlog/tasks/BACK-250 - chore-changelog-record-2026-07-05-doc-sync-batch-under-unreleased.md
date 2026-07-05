---
id: BACK-250
title: 'chore(changelog): record 2026-07-05 doc-sync batch under Unreleased'
status: To Do
labels:
  - documentation
priority: medium
milestone: 
created_date: '2026-07-05'
---
## Description
## Problem

CHANGELOG `[Unreleased]` is empty, but 2026-07-05 landed a batch of notable changes: #243 #244 #245 #246 (writing-great-skills review fixes), the spec-* capability removal (04fd2cb), and the follow-ups #247 #248 #249. Repo convention: every notable change lands with issue + PR links.

## Acceptance Criteria

- [ ] `[Unreleased]` gains Changed/Fixed/Removed entries covering #243-#249 and 04fd2cb with issue/PR links
- [ ] Entry style matches existing sections (headline sentence + grouped bullets)
- [ ] No version cut unless the maintainer decides to ship 0.7.1
