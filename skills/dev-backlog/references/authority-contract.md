# GitHub-native authority and routing contract

GitHub Issues own task specification and lifecycle when `.tracker=github`
(the default, and this repository's pin). When `.tracker=files`, the Backlog.md
CLI is the sole task-spec and lifecycle authority. When `.tracker=gitlab`,
GitLab Issues via `glab` own that role. A sprint file exists only
when execution needs continuity beyond one task and its PR. Exactly one
configured tracker (`.tracker` is setup-only); runtime never switches adapters.
Diagnostic export files (`exports/github-issues/` via `--legacy-export`) are an
explicit one-way snapshot, never runtime authority. Adapter failure is
fail-closed: no local-file, other-adapter, or export fallback.

## Authority and routing table

Each state class has one authority system. A projection may make that state
easier to view or retrieve, but it never accepts an independent write.

| State class | Sole authority | Write and read route | Non-authoritative surfaces |
| --- | --- | --- | --- |
| Task specification | Configured tracker (GitHub Issue body and acceptance criteria when `.tracker=github`; Backlog.md CLI when `.tracker=files`; GitLab Issue via `glab` when `.tracker=gitlab`); a posted `## Agent Brief` comment is the contract when present | Create or amend the live task through that tracker (or post the brief as a comment), then read it back; never leftover `tasks/*.md` | Diagnostic `exports/github-issues/` snapshots, sprint Plan text, GitHub Projects |
| Task lifecycle | Configured tracker state and native metadata (GitHub Issue when `.tracker=github`; Backlog.md CLI when `.tracker=files`; GitLab Issue when `.tracker=gitlab`) | Update the live task state through the configured adapter (`adapter.close` / files `backlog task edit` Done / gitlab `glab issue close`); never both trackers | Sprint checkboxes, diagnostic export files, project-board fields |
| Planning fields | Configured tracker native metadata (GitHub labels, milestone, assignees, and relationships when github; Backlog.md CLI fields when files; GitLab labels and assignees when gitlab) | Use that tracker's native fields; read them live | GitHub Projects views/fields, triage reports, sprint ordering |
| Complex execution state | One active sprint file for the admitted track | Update its Plan, Running Context, and Progress at explicit boundaries | Relay run artifacts, PR tabs, chat history, status projections |
| Durable decisions | The bounded `spec/*` contract axis | Amend through the human-gated spec process; route project, system, and capability decisions to the matching spec file | Issues, sprint Running Context, `_context.md`, generated memory |
| Historical evidence | GitHub repository history | Read closed Issues/PRs, commits, and committed completed sprint files at their original locations | Copied summaries, search indexes, compiled memory |
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
| `exports/github-issues/*.md` | Opt-in diagnostic/rollback snapshot | operator |
| `backlog/tasks/*.md` | Leftover operator / Backlog.md tree; never a product parser API | Backlog.md / operator |
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

A sprint is not justified solely by elapsed time, estimate size, milestone
membership, or the presence of Relay. When admitted, it owns only execution
continuity; it does not restate or supersede tracker acceptance criteria or
lifecycle.

## Explicit exclusions and freezes

The core product excludes:

- dual-write or bidirectional task state;
- silent adapter fallback to local files or diagnostic export;
- automatic writes from search, retrieval, summaries, or memory compilers;
- required Relay, Matt Pocock skill, GitHub Projects, or Backlog.md runtime
  dependencies when `.tracker=github`;
- a second task-spec or lifecycle authority in the same repo (GitHub, files,
  and GitLab are never co-authority).

Do not add tracker providers beyond the frozen `TRACKER_KEYS` (`github`,
`files`, `gitlab`). Forgejo/Gitea share forge field shapes and are follow-up
issues, not implemented here. Do not add bidirectional compatibility
machinery, task-mirror lifecycle features, or a committed memory/compiler
layer without new measured adoption evidence and an explicit
authority-contract amendment.
Measured adoption: 0 of 17 selected a non-default tracker; all 18 then-known
consumers had a GitHub remote. That evidence froze the GitHub-native default.

## Optional boundaries

| Surface | Allowed role | Boundary |
| --- | --- | --- |
| Relay | Optional implementation/review delegation | May update an admitted sprint through its integration contract; never required for task resolution or sprint execution |
| Matt Pocock skills | Optional shaping and execution techniques | May help an actor plan or implement; no persisted dev-backlog state or hard dependency |
| GitHub Projects | Optional planning projection | May visualize Issue metadata; project-only fields cannot become task or lifecycle authority and the core flow must work without Projects |
| Backlog.md | Chosen task authority when `.tracker=files`; otherwise leftover operator tree under `backlog/` | When `files` is chosen, read/write tasks only through the `backlog` CLI (`--json` where available). Leftover `backlog/tasks/*.md` is never a product parser API. Missing CLI is fail-closed. Never co-authority with GitHub or GitLab |
| GitLab (`glab`) | Chosen task authority when `.tracker=gitlab` | Read/write issues only through `glab`. Missing or unauthenticated CLI is fail-closed. Never co-authority with GitHub or files. Forgejo/Gitea are follow-up adapters. |
| Spec axis | Optional durable project contract | Human-gated when present; absence must not block task work or the complete sprint cycle |
| Retrieval/memory experiments | Optional, report-only evidence tools | #350 closed **no-go** (2026-08-17): Arm B (live sources) suffices. No compiler, no committed memory artifact, no project-memory skill |

## No-spec / no-Relay invariant

A repository with GitHub Issues but no `.dev-backlog/`, no `spec/`, and no Relay
installation must be able to:

1. complete a simple Issue → PR path without creating a sprint; and
2. when complexity triggers a sprint, create, resume, and close it using only
   this bundle, with `objectives:` and `component:` omitted.

No path may require a cross-repository spec reference, Relay artifact, Projects
board, task mirror, generated memory, or (when `.tracker=github`) a Backlog.md
installation. When `.tracker=files`, the Backlog.md CLI is required and GitHub
is not co-authority.
