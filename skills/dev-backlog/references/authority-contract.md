# GitHub-native authority and routing contract

This is the product contract for the 2026-08 GitHub-native core simplification
milestone. The zero-adopter local tracker has been removed. Task files remain
only as an explicit one-way legacy import/export boundary.

The contract is based on the 2026-07-27 adoption review: all 17 observed
consumer repositories used the default GitHub path, and 0 of 17 selected a
non-default tracker. A follow-up check on 2026-07-28 found that all 18 then
known consumer repositories had a GitHub remote. The evidence supports a
GitHub-native core; it does not support another generic tracker or mirror
abstraction.

## Authority and routing table

Each state class has one authority system. A projection may make that state
easier to view or retrieve, but it never accepts an independent write.

| State class | Sole authority | Write and read route | Non-authoritative surfaces |
| --- | --- | --- | --- |
| Task specification | GitHub Issue body and acceptance criteria; a posted `## Agent Brief` comment is the contract when present | Create or amend the Issue (or post the brief as a comment), then read the live Issue and its comments | Legacy `backlog/tasks/` files, sprint Plan text, GitHub Projects |
| Task lifecycle | GitHub Issue state and native metadata | Update the Issue state, labels, milestone, assignees, and native relationships | Sprint checkboxes, legacy task files, project-board fields |
| Planning fields | GitHub Issue native metadata | Use labels, milestone, assignees, and Issue relationships; read them live | GitHub Projects views/fields, triage reports, sprint ordering |
| Complex execution state | One active sprint file for the admitted track | Update its Plan, Running Context, and Progress at explicit boundaries | Relay run artifacts, PR tabs, chat history, status projections |
| Durable decisions | The bounded `spec/*` contract axis | Amend through the human-gated spec process; route project, system, and capability decisions to the matching spec file | Issues, sprint Running Context, `_context.md`, generated memory |
| Historical evidence | GitHub repository history | Read closed Issues/PRs, commits, and committed completed sprint files at their original locations | Copied summaries, search indexes, compiled memory |
| Derived retrieval output | Its named upstream authority | Recompute from live authorities and identify the source record in every result | Search caches, embeddings, generated summaries, benchmark output |

`Derived retrieval output` is a view, not a new state owner: the sole owner of
each returned fact remains the upstream authority named by that result.
Retrieval output must be disposable and must not be written back automatically
to Issues, sprints, `_context.md`, or `spec/*`.

## Sprint admission

The default path is a sprint-free **Issue → implementation → PR → Issue
closure**. Time is not an admission criterion: one difficult Issue may take
days and still need no sprint if its Issue and PR preserve enough continuity.

Create a sprint only when execution complexity requires a shared continuity
record beyond one Issue and its PR. A sprint is admitted when at least one of
these conditions is true:

- multiple Issues have ordered dependencies or must be executed in explicit
  batches;
- work is delegated or parallelized and in-flight ownership/handoff must
  survive outside one PR;
- decisions or discovered constraints must carry across Issues, actors, or
  sessions before they are ready for durable specs;
- concurrent tracks need an explicit non-overlap scope and independent
  completion boundary.

A sprint is not justified solely by elapsed time, estimate size, milestone
membership, or the presence of Relay. When admitted, it owns only execution
continuity; it does not restate or supersede Issue acceptance criteria or
lifecycle.

## Explicit exclusions and freezes

The core product excludes:

- dual-write or bidirectional task state;
- automatic writes from search, retrieval, summaries, or memory compilers;
- required Relay, Matt Pocock skill, GitHub Projects, or Backlog.md runtime
  dependencies;
- a second task-spec or lifecycle authority outside GitHub Issues.

Do not add tracker providers, bidirectional compatibility machinery,
task-mirror lifecycle features, or a committed memory/compiler layer without
new measured adoption evidence and an explicit authority-contract amendment.

## Optional boundaries

| Surface | Allowed role | Boundary |
| --- | --- | --- |
| Relay | Optional implementation/review delegation | May update an admitted sprint through its integration contract; never required for task resolution or sprint execution |
| Matt Pocock skills | Optional shaping and execution techniques | May help an actor plan or implement; no persisted dev-backlog state or hard dependency |
| GitHub Projects | Optional planning projection | May visualize Issue metadata; project-only fields cannot become task or lifecycle authority and the core flow must work without Projects |
| Backlog.md | Optional one-way legacy format compatibility | Human-reviewed Markdown may be imported into a GitHub Issue; `--legacy-export` may emit diagnostic/rollback snapshots; task files are never read as runtime authority and Backlog.md tooling is not required |
| Spec axis | Optional durable project contract | Human-gated when present; absence must not block task work or the complete sprint cycle |
| Retrieval/memory experiments | Optional, report-only evidence tools | #350 closed **no-go** (2026-08-17): Arm B (live sources) suffices. No compiler, no committed memory artifact, no project-memory skill |

## Cold-adopter invariant

A repository with GitHub Issues but no `backlog/`, no `spec/`, and no Relay
installation must be able to:

1. complete a simple Issue → PR path without creating a sprint; and
2. when complexity triggers a sprint, create, resume, and close it using only
   this bundle, with `objectives:` and `component:` omitted.

No path may require a cross-repository spec reference, Relay artifact, Projects
board, task mirror, generated memory, or Backlog.md installation.
