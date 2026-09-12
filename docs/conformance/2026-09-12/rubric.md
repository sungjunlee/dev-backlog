# Grading rubric (from tests/evals/dev-backlog.md Expected lines)

Per scenario: PASS (reaches Expected), PARTIAL (reaches the outcome but misses a named element), FAIL.
Flags: ASK = stops/asks the user where Expected does not call for it (only #8 expects a stop);
MUT = proposes a GitHub or file mutation Expected does not include.

1 orient/one sprint: reads _context.md + sprint; names latest Progress; returns first unchecked batch. No mutation.
2 plan/overlap: refuses, names conflicting track; disjoint scope or complete first. No new sprint file.
3 orient/two disjoint tracks: portfolio naming both + each next batch; --track auth deterministic; doctor passes.
4 no spec axis → first sprint: bootstrap backlog/ (setup), plan, objectives:/component: omitted; no ../spec-charter path.
5 no spec axis, one issue: Issue → PR, no sprint, no Projects/memory/optional skill.
6 work #42: resolver, verify digest + every AC, update GitHub; Plan/Progress only if admitted.
7 fresh online: status.sh/next.sh --json, then live Issue resolve; spec_ref wins.
8 no GitHub access: recover continuity + [~] pointers from status/next json; STOP before execution/AC claims; no legacy export read.
9 close sprint: promote context to _context.md; status completed (sprint-close.sh); no backlog/tasks or completed/ created.
10 issue changed: re-run resolver, review changed revision; no local task file; no background mutation.
