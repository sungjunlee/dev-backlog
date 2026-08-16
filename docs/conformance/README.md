# Conformance Runs

Dated cross-model conformance reports for the prompt-judged surfaces
(triage model-actions since #358; see #367 for scope and cadence).

Cadence: per release tag (before cutting) and at reassess boundaries.

Retention: the dated report (`YYYY-MM-DD-*.md`) is the permanent record. The
matching raw-artifact directory (`YYYY-MM-DD/`) is kept only until the next
run supersedes it — prune the older raw directory in the commit that lands
the new run. Rationale: raw eval prompts duplicate committed snapshots
(~2K lines per run), and the disposable-evidence posture caps that growth.
