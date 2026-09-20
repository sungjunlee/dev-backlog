# Authority and routing contract

One declared task authority owns task specification and lifecycle:
`.dev-backlog/.tracker` names it in one line (absent = `github`; `backlog` for
the Backlog.md CLI, `files` accepted as its legacy spelling; `gitlab`). The
session reads that line and uses the authority's CLI verbs from the SKILL.md
Task Authority table; there is no adapter layer in code (charter rev 20) and
the `files` adapter stays parked at tag `v0.11.0`. A sprint file exists only
when execution needs continuity beyond one task and its PR. A failed authority
read is fail-closed: no local-file or second-authority fallback, and the
authority is never inferred from which CLI is installed.

## Authority and routing table

Each state class has one authority system. A projection may make that state
easier to view or retrieve, but it never accepts an independent write.

| State class | Sole authority | Write and read route | Non-authoritative surfaces |
| --- | --- | --- | --- |
| Task specification | The declared authority's task body and acceptance criteria; on GitHub the newest posted `## Agent Brief` comment overrides the body, and in every authority a `spec_ref:` line in the body overrides the body (on GitHub, the Agent Brief as well) | Create or amend the live task with the authority's CLI, then read it back with its Read verb (`gh issue view N --json body,comments` by default); never leftover `tasks/*.md` | Sprint Plan text, GitHub Projects |
| Task lifecycle | The declared authority's task state and native metadata | Update the live task state with the authority's Close verb (`gh issue close` by default) | Sprint checkboxes, project-board fields |
| Planning fields | The declared authority's native metadata (labels, milestone, assignees, and relationships where it has them) | Use the authority's native fields; read them live | GitHub Projects views/fields, triage reports, sprint ordering |
| Complex execution state | One active sprint file for the admitted track | Update its Plan, Running Context, and Progress at explicit boundaries | Delegate run artifacts, PR tabs, chat history, status projections |
| Durable decisions | The bounded `spec/*` contract axis | Amend through the human-gated spec process; route project, system, and capability decisions to the matching spec file | Issues, sprint Running Context, `_context.md`, generated memory |
| Historical evidence | Repository history (git plus the authority's closed tasks and PRs) | Read closed Issues/PRs and commits (completed sprint files are disposable and may already be deleted) | Copied summaries, search indexes, compiled memory |
| Derived retrieval output | Its named upstream authority | Recompute from live authorities and identify the source record in every result | Search caches, embeddings, generated summaries, benchmark output |

`Derived retrieval output` is a view, not a new state owner: the sole owner of
each returned fact remains the upstream authority named by that result.
Retrieval output must be disposable and must not be written back automatically
to Issues, sprints, `_context.md`, or `spec/*`.

## File ownership

| File | Role | Owned by |
| --- | --- | --- |
| `.dev-backlog/sprints/_context.md` | Operational facts and gotchas | `dev-backlog` |
| `.dev-backlog/sprints/*.md` | Admitted-track Plan, Running Context, Progress | `dev-backlog` |
| `backlog/tasks/*.md` | Leftover operator tree; never a product parser API | operator |
| `.dev-backlog/triage/*.md` | Derived advisory reports | `backlog-triage` |
| `.dev-backlog/triage/*-apply.log` | JSONL audit logs for accepted issue mutations | `backlog-triage` |

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

A sprint is not justified solely by elapsed time, estimate size, or milestone
membership. When admitted, it owns only execution
continuity; it does not restate or supersede Issue acceptance criteria or
lifecycle.

## Explicit exclusions and freezes

The core product excludes:

- dual-write or bidirectional task state;
- silent fallback to local files when an authority read fails;
- automatic writes from search, retrieval, summaries, or memory compilers;
- required Matt Pocock skill or GitHub Projects runtime dependencies;
- a second task-spec or lifecycle authority in the same repo;
- retry loops or fallback data sources around the authority CLI: a failed call
  exits non-zero with the CLI's stderr surfaced, exactly once, and the operator
  fixes access and re-runs. The only scripted authority calls are
  `sprint-close.sh --close-milestone` (closes the GitHub milestone before any
  local mutation, so a failure leaves the sprint active) and `triage-apply
  --apply` (a close is comment-then-close, a priority change looks the labels up
  first); nothing retries automatically, and after a lost response verify the
  target's state before re-running any non-idempotent write — create, comment,
  or close.

Do not reintroduce a tracker abstraction or adapter ports: the authority is a
one-line selection the session reads, the `files` adapter is parked at tag
`v0.11.0`, and a new authority is a documented table row plus its entry in the scripts'
allow-list, and needs a measured consumer (the GitLab row is the stated
exception; see the charter Non-Goals). Do not add bidirectional compatibility machinery, task-mirror
lifecycle features, or a committed memory/compiler layer without new measured
adoption evidence and an explicit authority-contract amendment.

## Optional boundaries

| Surface | Allowed role | Boundary |
| --- | --- | --- |
| Matt Pocock skills | Optional shaping and execution techniques | May help an actor plan or implement; no persisted dev-backlog state or hard dependency |
| GitHub Projects | Optional planning projection | May visualize Issue metadata; project-only fields cannot become task or lifecycle authority and the core flow must work without Projects |
| Backlog.md | Task authority when `.tracker` says `backlog`, through its CLI only | `backlog/tasks/*.md` is never a product parser API; the parked `files` adapter (`v0.11.0`) is not revived — the session calls the CLI verbs itself |
| Spec axis | Optional durable project contract | Human-gated when present; absence must not block task work or the complete sprint cycle |
| Retrieval/memory experiments | Optional, report-only evidence tools | #350 closed **no-go** (2026-08-17): Arm B (live sources) suffices. No compiler, no committed memory artifact, no project-memory skill |

## No-spec invariant

A repository with a task authority (GitHub Issues by default) but no `.dev-backlog/` and no `spec/`
must be able to:

1. complete a simple Issue → PR path without creating a sprint; and
2. when complexity triggers a sprint, create, resume, and close it using only
   this bundle, with `objectives:` and `component:` omitted.

No path may require a cross-repository spec reference, delegate artifact, Projects
board, local task copy, generated memory, or a CLI other than the declared
authority's.
