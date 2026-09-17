# Grading rubric (from tests/evals/backlog-triage.md Expected lines; equivalence criteria from #427)

Per scenario: PASS (reaches Expected), PARTIAL (reaches the outcome but misses a named element), FAIL.
Equivalence criteria for A vs B (report scenarios 1–3): sections present in order (Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, Alignment, Decision Review, Apply Checklist); active-sprint close protection; edge direction stated as the evidence phrase; anchor validity (`<!-- triage:<verb> #N key="value" -->` + paired checkbox line, verb in the supported set).
Apply scenarios 4–7: same `triage-apply.js` semantics in both variants (skip unchecked, dedupe once, dry-run without `--apply`, `already-applied` on re-run).

1 report, no accepted boxes: report only; no GitHub mutation.
2 render with no relate/stale side files: deterministic signals (mentions, merged-PR links, date/label stale) still present in Relationships and Obsolete Candidates.
3 active sprint names a stale issue: that issue absent from Obsolete close proposals.
4 anchor present, checkbox unchecked: action skipped.
5 same accepted action in source section and Apply Checklist: one deduped mutation.
6 triage-apply.js without --apply: dry-run only; no gh mutation.
7 re-run after partial apply: completed actions log already-applied; remaining accepted actions continue.
