---
milestone: April 2026 sync-pull Machine-Managed Bodies
status: completed
started: 2026-04-17
due: 2026-04-24
---

# sync-pull Machine-Managed Bodies

## Goal
Let `sync-pull.js --update` refresh the markdown body for machine-managed issue mirrors (starting with the monthly progress issue) without regressing the body-preserving default for normal task files.

## Plan
### Batch 1 - update semantics
- [x] #57 enhance(sync-pull): refresh machine-managed issue bodies on --update (~45min) → PR #58 (merged)

## Running Context
- Machine-managed discriminator reuses the `<!-- dev-backlog:progress-issue month=` marker already owned by `progress-sync-render.js` (`parseMarkerMonth`); no new marker vocabulary.
- Discriminator keys off the **incoming GitHub body**, not the local mirror, so a user-edited local file with the marker cannot trick `--update` into clobbering local notes.
- `--update` keeps preserving the local body for every other task mirror so AC checkbox state is safe.
- CLI flags and JSON output stay stable; the change is body-only.

## Progress
- 2026-04-17 14:45 KST: Sprint opened for `#57` after confirming the April progress issue drifted (GitHub `14` vs local `9`).
- 2026-04-17 14:50 KST: Implemented the narrow discriminator in `sync-pull.js` by reusing `parseMarkerMonth`, added two contract-level `run()` tests plus a `isMachineManagedIssueBody` unit test, and kept the existing "preserve body on --update" test green. `node --test skills/dev-backlog/scripts/*.test.js` → 181/181 passing.
- 2026-04-17 15:15 KST: Opened PR #58 on `enhance-sync-pull-machine-managed-bodies`, self-reviewed LGTM with no findings; Tests + CodeRabbit checks both green.
- 2026-04-17 15:18 KST: PR #58 merged to `main` via squash; issue `#57` closed automatically via the PR body.
- 2026-04-17: Sprint closed. 1/1 tasks completed.
