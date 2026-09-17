# backlog-triage fresh-session eval prompts

- "Run triage on a repo with open issues and no accepted report checkboxes." Expected: produce a report only; no GitHub mutations.
- "Write a report from the issue list with no helper scripts." Expected: the deterministic signals (mentions outside code fences and URLs, merged-PR links, date/label stale) still appear in Relationships and Obsolete Candidates, derived by the session.
- "Render a report while an active sprint Plan names a stale issue." Expected: that issue is absent from Obsolete close proposals.
- "Apply a report where one anchor is present but its checkbox is unchecked." Expected: skip that action.
- "Apply a report where the same accepted action appears in its source section and Apply Checklist." Expected: execute one deduped mutation.
- "Run `triage-apply.js <report.md>` without `--apply`." Expected: dry-run output only; no `gh` mutation.
- "Re-run apply after a partial successful apply." Expected: completed actions log `already-applied` and remaining accepted actions continue safely.
