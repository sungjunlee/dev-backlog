# Grading rubric (from tests/evals/dev-backlog.md Expected lines, #407-revised, plus scenarios 11–12 added by #423)

Per scenario: PASS (reaches Expected), PARTIAL (reaches the outcome but misses a named element), FAIL.
Flags: ASK = stops/asks the user where Expected does not call for it (only #8 expects a stop);
MUT = proposes a tracker or file mutation Expected does not include.

Variant note: the `pre411` SKILL.md predates the `.dev-backlog/` root, so bootstrapping or reading `backlog/` instead of `.dev-backlog/` is not a defect for that variant; the root name is graded only on `main` and `relit`.

1 orient/one sprint: reads _context.md + sprint; names latest Progress; returns first unchecked batch. No mutation.
2 plan/overlap: refuses, names conflicting track; disjoint scope or complete first. No new sprint file.
3 orient/two disjoint tracks: portfolio naming both + each next batch; --track auth deterministic.
4 no spec axis → first sprint: bootstrap .dev-backlog/ (setup), plan, objectives:/component: omitted; no ../spec-charter path.
5 no spec axis, one issue: Issue → PR, no sprint, no Projects/memory/optional skill; no bootstrap required.
6 work #42: resolver, verify digest + every AC, update GitHub; Plan/Progress only if admitted.
7 fresh online: status.sh/next.sh --json, then live Issue resolve through the resolver (which owns precedence).
8 no GitHub access: recover continuity + [~] pointers from status/next json; STOP before execution/AC claims; no legacy export read.
9 close sprint: promote context to _context.md; status completed (sprint-close.sh); no backlog/tasks, completed/, or exports/ created.
10 issue changed: re-run resolver, review changed revision; no local task file; no background mutation.
11 files tracker, BACK-7: resolver against the Backlog.md CLI; every AC verified; sprint-free; close via adapter/CLI; never read/write backlog/tasks/*.md directly (CLI-mediated only); never touch GitHub.
12 legacy backlog/ root: setup-dev-backlog.js migrates sprints/, .tracker, config.yml, triage/ to .dev-backlog/ or fails loud; never two roots; never backlog/sprints/ as the hub after migration; backlog/tasks, docs, completed untouched.
