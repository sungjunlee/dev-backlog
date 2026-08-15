# Compatibility Subtraction Record

Issue #348 removes the measured zero-adopter local tracker without adding a
provider, registry, or framework. GitHub Issues remain the only task
specification and lifecycle authority.

## Measured surface

The 2026-07 adoption review found 0 of 17 consumers selecting a non-default
tracker. The follow-up inventory found GitHub remotes in all 18 known consumer
repositories. No current consumer or measured portability invariant justified
the local task store.

| Whole-file surface | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Local runtime and tests (`local-tracker.js`, unit, integration) | 3 files / 1,413 lines | 0 / 0 | -3 / -1,413 |
| Generic/local adapter design document | 1 / 496 | 0 / 0 | -1 / -496 |
| Total exact whole-file deletion | 4 / 1,909 | 0 / 0 | -4 / -1,909 |

The remaining edits further remove local branches from setup, tracker
resolution, acceptance tests, and public prose. This table deliberately counts
only exact deleted files so the measurement is reproducible with
`git show <base>:<path> | wc -l`.

The setup integration suite is retained and narrowed to GitHub-only safety
invariants: legacy YAML/BOM ambiguity, strict remote evidence, sanitized
failures, atomic rollback and temp cleanup, byte-idempotent repair, selection
precedence, no-effect refusal, dangling symlink safety, and cross-platform
`init.sh` behavior.

## Retained abstraction evidence

| Surface | Current consumers | Portability or compatibility invariant |
| --- | --- | --- |
| `tracker.js` GitHub seam | `effective-task-spec.js`, `sync-pull.js`, `sprint-init.js`, `tracker-status-list.js` | Dependency injection keeps provider argv deterministic and proves GitHub unavailability fails without fallback. It is not a provider registry. |
| `github-tracker.js` | Core Issue list/read/create/update/close paths | Fake-`gh` acceptance tests preserve exact argv and subprocess behavior across POSIX and Git-for-Windows. |
| `task-ref.js` | Sprint-state parsing, effective task reads, legacy export filenames | `#N` is the runtime identity. `{PREFIX}-N[.M]` parsing is retained only for historical Backlog.md import/export bytes and exact filename handling. |
| `.tracker` plus legacy config reader | Setup and runtime resolution | Existing explicit or legacy `github` selection is preserved byte-for-byte; missing selection defaults to GitHub; every other value fails explicitly. |
| GitHub capability gate | Milestone-backed sprint init/close and optional transports | Injected availability/capability tests fail before effects. Core Issue execution does not require optional transports. |

Each retained seam therefore has either a named current consumer or an
executable portability/compatibility invariant. None authorizes a second task
provider.

## One-way Backlog.md boundary

Backlog.md compatibility is legacy format compatibility, not a second
lifecycle:

- import is a human-reviewed Markdown record used to create or amend a GitHub
  Issue;
- export is an explicit `sync-pull.js --legacy-export` diagnostic or rollback
  snapshot;
- runtime work and completion resolve the live Issue and never read task files
  as fallback;
- no Backlog.md CLI, package, daemon, or bidirectional sync is required.

## Optional-integration absence proof

`tracker-cycle.acceptance.test.js` runs the complete mirrorless GitHub
create → Plan → orient/effective read → update → close cycle while these
surfaces are absent:

| Optional surface | Absence invariant |
| --- | --- |
| Relay | No `.relay/` path is required or created. |
| Matt Pocock/craftkit skills | No `.agents/skills/` or `spec/` path is required or created. |
| GitHub Projects | Recorded provider argv contains no Projects command or API. |
| Backlog.md tooling | No `node_modules/`, `tasks/`, or `completed/` path is required or created. |

The same test verifies that live task reads, AC resolution, status/next,
updates, final close, and closed-task reads succeed with only this bundle and a
fake GitHub transport.

## Relocated learnings

Moved here from `spec/capabilities.md` (tracker-task-truth) on 2026-08-15
because #348 removed the surfaces they describe; retained for traceability:

- 2026-07-11 (PR #298): A canonical local Markdown store needs exact-ID
  allocation across active and completed tasks, fail-closed filesystem
  boundaries, metadata-only body preservation, and crash-recoverable archive
  semantics; merely replacing `gh` commands is not sufficient.
