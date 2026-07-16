---
id: BACK-311
title: 'fix: make Windows checkout and test execution first-class'
status: In Progress
labels:
  - bug
  - enhancement
priority: medium
milestone: v0.8.0 hardening and release
created_date: '2026-07-16'
---
## Description
## Problem

The repository claims cross-platform support, but a normal Windows checkout with Git `core.autocrlf=true` cannot run the shipped test/smoke workflow reliably. Shell scripts become CRLF, public path strings use Windows separators, and Bash subprocesses receive paths they cannot resolve.

Observed on Windows at `9d2aa02`:

- `node --test skills/*/scripts/*.test.js`: 675 tests, 650 pass, 24 fail, 1 skip.
- `bash skills/dev-backlog/scripts/smoke-test.sh`: fails immediately with `pipefail\r`.
- Latest Ubuntu CI is green, so the current workflow does not exercise the advertised Windows surface.

## Acceptance Criteria

- [x] Repository line-ending policy keeps shell scripts LF in a default Windows checkout.
- [x] Machine-readable/public path fields use stable forward-slash repo-relative paths where the contract is platform-neutral.
- [x] Tests that launch Bash convert native Windows paths to Bash-readable paths at the process boundary.
- [x] The full Node test command passes on Windows.
- [x] The Bash smoke command passes from the Windows checkout.
- [x] CI includes a Windows job that locks the supported Windows execution path.
- [ ] Existing Ubuntu CI remains green.
- [x] Documentation states the verified Windows execution contract without weakening cross-platform support.

## Done Criteria

A PR closes this issue with red-to-green Windows evidence and green GitHub Actions on both Ubuntu and Windows.
