---
id: BACK-256
title: 'docs(readme): reorder Quick Start to the no-spec minimum path (B1)'
status: Done
labels:
  - documentation
  - enhancement
priority: medium
milestone: 2026-07 adoption hardening
created_date: '2026-07-06'
---
## Description
## Problem

A new adopter's first screen mixes the five-command minimum cycle with spec-axis, relay interop, mirror, and triage material. The heaviest parts of the contract are optional but are not priced as optional.

Source: docs/prd-2026-07-adoption-hardening.md §6 (B1).

## Acceptance Criteria

- [x] README Quick Start shows the minimum cycle (init -> sync-pull -> sprint-init -> next -> close) and the `/dev-backlog` session loop with zero spec/relay/triage mentions
- [x] Spec axis, relay integration, and triage keep their sections but sit behind an explicit "Optional extensions" boundary, each with one-line pricing ("adds X, requires Y")
- [x] Existing section anchors stay stable where possible; moved anchors are checked for inbound links from skills/ and docs/

