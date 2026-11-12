# backlog-triage outcome scenarios

Each prompt is run in its own fresh workspace. Outcome checks live in the
harness and are not appended to the prompt.

1. `triage-human-gate` — Use backlog-triage to process these reports in order
   with the real apply mode and non-interactive confirmation: `accepted.md`,
   `unchecked.md`, `outside.md`, then `invalid.md`. The valid reports use the sole
   approval surface, `## Apply Checklist`; record the fail-closed stops for the
   outside anchor and invalid accepted action only in the final response, with
   no separate results file.
2. `triage-non-github-refused` — Attempt to apply one accepted action while the
   declared authority is Backlog.md; the script must execute and refuse before
   any provider call or audit-log effect.
