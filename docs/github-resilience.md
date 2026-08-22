# GitHub resilience

Living operator contract for fail-loud `gh` paths. This is not a retry
policy: GitHub remains the only authority, and a failed call must not
write partial tracker or triage state.

## Call inventory

Counts below are the `gh` argv sequences already locked by the fake-`gh`
acceptance harness, plus the collect/apply transports in
`skills/backlog-triage/scripts/`.

| Class | Typical `gh` calls | Source |
| --- | --- | --- |
| work (create / read / update / close / list) | 7 in a full cycle: `issue create`, `issue list` (open), `issue view`, `issue edit`, `issue list` (open, after update), `issue close`, `issue list` (closed) + a final `issue view` | `runGithubCycle` in `tracker-cycle.acceptance.test.js` |
| orient (`status --json` / `next --json`) | 0 extra `gh` calls when the active sprint file already names `#N`; live reads happen in the work class | `status.sh` / `next.sh` read sprint files |
| sprint init | 2: `api repos/{owner}/{repo}/milestones` (due_on) + `issue list --milestone` | `sprint-init.js` + `github-milestones.js` |
| sprint close (`--close-milestone`) | 2: `api` milestone number + `api -X PATCH` close | `sprint-close.sh` |
| triage collect | 1 GraphQL `api graphql` for open issues (plus `--paginate` when the limit exceeds one page). Optional: 1 `api repos/.../issues/N/comments --paginate` per issue when `--with-comments`. Optional: 1 GraphQL search for closed issues | `triage-collect.js` |
| triage apply | 1 `issue view --json labels` when priority labels must be read, then 1 mutation per action (`issue edit` / `issue comment` / `issue close`). No automatic retry | `triage-apply.js` |

A happy-path GitHub tracker cycle therefore makes **12** `gh` calls
(7 work + 2 sprint init + 2 sprint close + 1 extra work list/view pair
already counted in the cycle assertion).

## Failure-mode matrix

The fake-`gh` fixture (`fake-gh.js`) accepts `FAKE_GH_FAIL`:

| Mode | `gh` behavior | Required outcome |
| --- | --- | --- |
| `rate-limit` | exit 1, stderr `API rate limit exceeded` | Fail loud. No issue/milestone write. Exactly one attempt. |
| `auth-expired` | exit 1, stderr `HTTP 401` + `authentication required` | Fail loud. No write. Exactly one attempt. |
| `partial-outage` | reads (`issue list` / `issue view` / GET `api`) succeed; mutations (`issue create\|edit\|close\|comment`, `api -X`) exit 1 with `GitHub unavailable` | Mutations fail loud and write nothing. Reads stay effect-free. |

No path gets automatic retry or backoff. The default remains: no silent
retry, no fallback authority.

## Operator runbook

What you see is the `gh` stderr plus a non-zero process exit. Scripts do
not rewrite GitHub after that failure.

| Class | What to do | When to stop |
| --- | --- | --- |
| Rate limited | Wait until the reset window printed by `gh` / `X-RateLimit-Reset`. Re-run the **same** command once. Do not loop. | Still 403 after one manual retry, or the reset is hours away. Pause the session. |
| Auth expired | `gh auth status`, then `gh auth login` or `gh auth refresh`. Re-run the same command once. | `gh auth status` still fails. Stop and fix credentials offline. |
| Partial outage | Reads may still work. Do not apply triage or close issues until mutations succeed. Retry the failed mutation once after GitHub status recovers. | Mutations still fail after one retry. Leave the sprint/issue untouched. |

Do not switch tracker, invent a local fallback, or re-enter a prompt that
would create a second GitHub write for the same action.
