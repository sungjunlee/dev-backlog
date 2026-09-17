# #433 real-execution A/B — 2026-09-17

Fixture: 15 open issues (`fixture-issues.json`) covering inactive-no-milestone, inactive-with-milestone, fresh, `wontfix`, `invalid`, merged closing PR, plain `#N` mention, mention inside a code fence, mention inside a URL fragment, "Blocks #N" / "Depends on #N" phrases, a comment mention, a duplicate-looking pair, a self-mention, an issue on the active sprint Plan that is stale by date, and an issue named in the sprint Running Context that is stale by date. `stale_days: 60`, a two-objective charter, one active sprint (`fixture-sprint.md`).

- **A** = `triage-report.js` over a `buildSnapshot`-normalized snapshot with `--active-sprint` (`report-A-scripts.md`).
- **B** = variant-B SKILL.md (33 lines, no collect/relate/stale/report scripts) given the same data as the `gh` outputs it names; one fresh session per model wrote the whole report (`report-B-fable.md`, `report-B-astra.md`; prompt `prompt-B.md`).
- Checker: `compare.py` (sections/order, close set, protection, edge presence, anchor validity via `triage-apply.js --json`). Output: `compare-output.txt`.

| Criterion | A (scripts) | B fable | B astra |
| --- | --- | --- | --- |
| Eight sections in order | yes | yes | yes |
| Close set from deterministic signals | 604, 606, 607, 608 | 604, 606, 607, 608 (+ close-duplicate 613, a judgment A cannot make) | 606, 607, 608; 604 detected as stale but proposed as `revisit` (judgment call the skill allows) |
| Protected 603 / 612 never closed | yes | yes | yes (both proposed as `revisit`, protection stated) |
| Code-fence mention (609→601), URL fragment (602→PR 77), self-mention (614) ignored | yes | yes, listed as "Excluded evidence" | yes, listed as "Excluded" |
| Edge direction (601 blocks 602; 602 depends-on 601; merged PR 88 → 608; comment 610→608) | yes | yes | yes |
| Anchors parse in `triage-apply.js --json` (unknown verbs) | 4 / 0 | 32 / 0 (16 after dedupe) | 26 / 0 (13 after dedupe) |
| Alignment / Decision Review present | not produced by A (prompt-driven in both variants) | yes | yes |

Decision: **delete** `triage-collect.js`, `triage-relate.js`, `triage-stale.js`, `triage-report.js`, `triage-github.js` and their references; keep `triage-apply.js` (+ anchor helper). The one difference (Astra's `revisit` for a merely inactive issue) is a more conservative verb, not a missed signal, and the human gate decides either way.
