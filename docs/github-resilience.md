# GitHub Resilience — Fail-Loud Contract (#366)

Decision (2026-08): **no automatic retry, no fallback authority.** When a `gh`
call fails — rate limit, expired auth, partial outage — the calling script
exits non-zero with the provider's stderr surfaced. Nothing silently retries
and nothing falls back to another source of truth. The operator fixes GitHub
access and re-runs the command.

## gh call inventory

Counted from `runGithubCycle` argv assertions (`tracker-cycle.acceptance.test.js`)
plus the code paths in `github-tracker.js`, `github-milestones.js`,
`sprint-init.js`, `sprint-close.sh`, and `backlog-triage/scripts/triage-{collect,apply}.js`.

### Read class (allowed to keep working during a partial outage)

| Call | Where | Purpose | gh calls per command run |
| --- | --- | --- | --- |
| `gh issue list … --json …` | github-tracker.js `list` | plan/status/next/sync-pull reads | 1 per list |
| `gh issue view <n> --json …` | github-tracker.js `read`; triage-apply label pre-read | single issue read | 1 per read |
| `gh api repos/{owner}/{repo}/milestones --jq .due_on` | github-milestones.js `getMilestoneDue` | milestone due-date lookup (sprint-init) | sprint-init total: **2** (due lookup + open-issue list) |
| `gh api --paginate repos/{owner}/{repo}/milestones?state=all&per_page=100 --jq '[.number, .state] | @tsv'` | github-milestones.js `closeMilestone` | milestone state lookup (sprint-close) | close-milestone: **1+ pages** for lookup, plus **1 PATCH** or **0** when already closed |
| `gh api graphql … totalCount` | github-tracker.js `getOpenIssueCount` | default list limit | 1 when the default limit is used |
| `gh api graphql` paginated queries | triage-collect.js | snapshot collection (open/closed issues) | ≥1 page each for open/closed |
| `gh api repos/…/issues/<n>/comments` | triage-collect.js `fetchIssueComments` | optional comment hydration | 0–1 per issue |

Per-command totals (healthy run, counted from source):

| Command | gh calls |
| --- | --- |
| `sprint-init` | 2 (milestone due lookup + open-issue list) |
| `sprint-close --close-milestone` | 1+ paginated lookup pages, plus 1 PATCH — or 0 PATCH if already closed |
| tracker create / update / close | 1 mutation each |
| status list (`tracker-status-list.js`) | 1 (open-issue list) |
| `triage-apply --apply` | 1 mutation per action (+1 optional view for label pre-reads) |

### Mutation class (fail loud, exactly once)

| Call | Where | Purpose |
| --- | --- | --- |
| `gh issue create --title --body` | github-tracker.js `create` | task creation |
| `gh issue edit <n> …` | github-tracker.js `update`; triage-apply `set-*` verbs | title/body/labels/milestone edits |
| `gh issue close <n>` | github-tracker.js `close`; triage-apply `close-issue` | closing semantics |
| `gh issue comment <n> --body` | comments capability consumers | progress comments |
| `gh api -X PATCH repos/{owner}/{repo}/milestones/<n> -f state=closed` | sprint-close → `tracker-capability.js close-milestone` → github-milestones.js `closeMilestone` | milestone close (skipped when already closed) |

Every mutation is issued **once**. A non-zero exit propagates as an exception
(`execFileSync`) or shell failure; there is no retry loop anywhere in these
scripts.

## Fail-loud guarantees

1. **Tracker create/update/close** exit non-zero on rate-limit/auth-expired,
   surface the gh stderr, make exactly one failing call, and leave GitHub state
   unchanged. Proven by `github-resilience.acceptance.test.js`.
2. **Partial outage**: read calls succeed; mutations fail once with
   "GitHub unavailable" and no state write.
3. **Sprint init** runs `getMilestoneDue`/`getMilestoneIssues` before any file
   is written. Previously those helpers swallowed gh errors as `TBD`/`[]`,
   which silently produced an empty sprint file on a broken provider. They now
   propagate the error; a failed init leaves no sprint file behind.
4. **Sprint close --close-milestone** closes the GitHub milestone *before* any
   local mutation. If the PATCH fails, the local sprint stays `status: active`
   — never completed-with-open-milestone.

## FAKE_GH_FAIL test harness

`skills/dev-backlog/scripts/fake-gh-fixture.js` + `fake-gh.js` inject failures:

| Mode | Behavior |
| --- | --- |
| `rate-limit` | every call exits 1, stderr `API rate limit exceeded`; no state write |
| `auth-expired` | every call exits 1, stderr `HTTP 401` + `authentication required`; no state write |
| `partial-outage` | reads (issue list/view, `api` without `-X`) succeed; mutations (create/edit/close/comment, `api -X`) exit 1 with `GitHub unavailable`; no state write |
| `http-502` | every call exits 1, stderr `HTTP 502 Bad Gateway`; no state write |

## Operator runbook

When a dev-backlog command fails with a gh error:

1. **Read the surfaced stderr.** It is passed through verbatim — do not guess.
2. Diagnose by class:
   - `API rate limit exceeded` — wait for the limit window to reset
     (`gh api rate_limit`); do not loop the command.
   - `HTTP 401 / Bad credentials` — re-authenticate (`gh auth login` or refresh
     `GH_TOKEN`).
   - `GitHub unavailable` (mutation only) — check
     [githubstatus.com](https://www.githubstatus.com/); read-only work may
     continue meanwhile.
3. Fix access, then **re-run the same command**. Failed mutations that never
   wrote anything are safe to re-run: the fail-loud ordering guarantees no local
   file or GitHub state changed before the failure. **Exception:**
   `gh issue create` is NOT safe to blindly re-run — if the first call may have
   succeeded server-side (e.g. the failure was in reading the response), a
   re-run creates a duplicate issue; check GitHub first. Never wrap these
   commands in retry loops.
4. For sprint close specifically: after fixing access, re-run
   `bash scripts/sprint-close.sh <backlog-dir> --close-milestone`. The local
   sprint was never marked completed, so one clean run finishes both sides.
5. Never wrap these commands in retry scripts or add fallback data sources;
   silent retries are what this contract exists to prevent.
