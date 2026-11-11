# backlog-triage outcome scenarios

The prompt is run in its own fresh workspace. Outcome checks live in the
harness and are not appended to the prompt.

1. `triage-human-gate` — Use backlog-triage to process these reports in order
   with the real apply mode and non-interactive confirmation: `accepted.md`,
   `unchecked.md`, then `invalid.md`. Record the observed stop on invalid input.
