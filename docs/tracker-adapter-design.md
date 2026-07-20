# Tracker Adapter Design Contract

Status: implemented foundation with dual-mode acceptance proof on issue #278's
implementation branch. Runtime evidence was originally inventoried at commit
`019a6ec`; merged issues #273-#277 provide selection, identity, GitHub wiring,
local persistence, and setup. GitHub remains the compatibility baseline. The
proof branch merged as PR #303 (2026-07-12); O8/O9 are validated.

This document froze the smallest tracker boundary that can support another
canonical task store without weakening existing GitHub behavior. The #272
freeze itself did not configure a tracker or implement an adapter; the current
foundation state is recorded separately below. These changes do not persist
local tasks, alter setup, or rewrite command, Markdown, JSON, sprint, or
task-mirror compatibility surfaces.

## Runtime Adapter State (#273-#278)

`backlog/config.yml` selects one `tracker`, initially `github` or `local`.
Repositories without that key use `github` as a deterministic compatibility
default. Selection reads only the supplied configuration value: it performs no
CLI, authentication, remote, adapter, or filesystem detection.

`skills/dev-backlog/scripts/tracker.js` owns selection, exact adapter-shape and
identity validation, configured-only availability probing, and optional
capability gates. An unavailable or throwing configured adapter fails with no
probe or fallback to the other slot. The GitHub slot now delegates its required
task lifecycle to `github-tracker.js`; generic sync and orientation callers use
configured-only resolution. Milestone, mirror, progress/PR/comment, and triage
GitHub transports live in explicitly named provider modules and are reached only
after their declared capability gates. Legacy helper exports remain compatibility
shims over those owners, including their injected execution seams. The local slot
is now implemented by `local-tracker.js` (#276): it owns the seven required
operations over `backlog/tasks/` and `backlog/completed/` as the canonical local
task store, allocates collision-safe parent IDs under an exclusive lock with
atomic same-filesystem publication, preserves human body/AC bytes on
metadata-only updates, archives on close without overwrite, reports no optional
capabilities, and never invokes `gh` or falls back. In local mode these task
files are canonical; GitHub mode continues to treat them as mirrors.
`setup-dev-backlog.js` (#277) persists a deliberate choice without reserializing
user YAML or migrating tasks. Issue #278 adds the offline dual-mode executable
proof and aligns the public documentation with this runtime.

### Shared unsupported-capability boundary

`tracker.js` owns `UnsupportedTrackerCapabilityError` and its serializer. The
stable code is `TRACKER_CAPABILITY_UNSUPPORTED`; serialized errors contain
exactly `code`, `tracker`, `capability`, `message`, and `remediation`. A public
JSON command wraps that shape once as `{ "error": ... }`, writes it to stdout,
and exits non-zero. Human commands write the same message and remediation to
stderr. Capability gates run before provider/filesystem effects and never
change `backlog/config.yml` or resolve another tracker.

### Dual-mode executable proof (#278)

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` is the release
proof. Its table-driven `github` and `local` rows cross real temporary-file and
CLI/subprocess boundaries without network access. The GitHub row starts with a
tracker-less legacy config, records fake-`gh` argv, and freezes `#N`, numeric
`issue_number`, task mirror bytes/body preservation, milestone, sprint mirror,
progress/PR/comment, close, and final read/list behavior without rewriting the
config. The local row performs explicit setup, canonical create, normalized
Plan orientation, read/update/body preservation, Done archive, sprint close,
and final read/list with an execution-trap `gh` that records zero calls. A
capability table covers all six optional features plus representative JSON and
human public boundaries.

## Pre-Seam Baseline Inventory

Everything in this historical inventory describes the runtime at `019a6ec`, before the
tracker seam existed. That baseline had no configured tracker resolver:
GitHub Issues were task truth, production callers either executed `gh` directly
or call GitHub-specific helpers, sprint Plan items use numeric `#N` references,
and task mirrors encode the same number in `BACK-N`-style names and IDs.

The inventory was derived from live source, not filenames. The direct-call
set is reproducible with:

```bash
rg -l --glob '!*.test.js' --glob '!smoke-test.sh' \
  '(execFile(?:Sync)?\("gh"|^[[:space:]]*(?:MS="\$MILESTONE" )?gh (?:api|issue|pr)\b|^[[:space:]]*"gh",)' \
  skills/dev-backlog/scripts skills/backlog-triage/scripts
```

### Direct `gh` invocation inventory

These are all nine production files that directly invoke `gh`. Test and smoke
fixtures are evidence for compatibility, but are not production callers.

| Production file | Direct current behavior | Current owner | Target seam or capability | Later issue |
| --- | --- | --- | --- | --- |
| `skills/dev-backlog/scripts/lib.js` | `getOpenIssueCount` runs a GraphQL issue count; `fetchOpenIssues` runs `gh issue list` and parses GitHub fields. | Shared dev-backlog GitHub query helper | Required `list` plus configured-adapter availability; GitHub argv stays inside the GitHub adapter. | #273 seam, #275 move |
| `skills/dev-backlog/scripts/sync-pull.js` | Its exported `fetchOpenIssues` runs `gh issue list`; omitted limits call the shared GraphQL count helper. | Backlog materialization | Required `list`; writing/updating mirrors remains `backlog-sync`. | #275 |
| `skills/dev-backlog/scripts/sprint-init.js` | `getMilestoneDue` runs `gh api .../milestones`; `getMilestoneIssues` runs `gh issue list --milestone`. | Sprint planning | Optional `milestones`; issue results still enter the required task identity seam. | #275 |
| `skills/dev-backlog/scripts/status.sh` | Human mode runs `gh issue list` for the “GitHub Issues” table. JSON mode does not call GitHub; it delegates to `sprint-state.js`. | Sprint orientation | Required `list` for the configured tracker; current GitHub table/output is the baseline. | #275 |
| `skills/dev-backlog/scripts/sprint-close.sh` | `--close-milestone` lists GitHub milestones and PATCHes the matching milestone closed. | Sprint closeout | Optional `milestones`; local sprint completion remains owned by `sprint-execution`. | #275 |
| `skills/dev-backlog/scripts/sprint-mirror.js` | `findMirrorIssue`, `createMirrorIssue`, and `updateMirrorIssue` list/create/edit marker-owned GitHub issues. | Explicit sprint publication | Optional `mirrors`; never part of required task lifecycle. | #275 |
| `skills/dev-backlog/scripts/progress-sync-github.js` | Searches, creates, edits, and closes Progress issues; lists open/merged PRs and closing issue relationships; GETs/POSTs/PATCHes/DELETEs managed comments. | Monthly progress GitHub transport | Optional `progress issues`, `pull-request relationships`, and `comments`; closing the managed Progress issue is provider-specific. | #275 |
| `skills/backlog-triage/scripts/triage-collect.js` | GraphQL-fetches open issues and optional recent closed issues; optionally REST-fetches comments per issue. | Triage evidence collection | Required `list`/`read` for core task evidence; optional `pull-request relationships` and `comments` for enrichment. | #275 |
| `skills/backlog-triage/scripts/triage-apply.js` | `runGh` executes generated issue view/comment/edit/close commands for accepted anchors. | Explicit triage mutation | Required `update`/`close` for neutral task changes; optional `comments` and `milestones` for GitHub-only actions. | #275 |

### GitHub-specific helpers and injection seams

The following helpers are already public or dependency-injected test seams.
They are compatibility surfaces; moving behavior must not make existing tests
or consumers spawn a real `gh` process unexpectedly.

| Current helper surface | Current coupling and injectable boundary | Target ownership | Preservation owner |
| --- | --- | --- | --- |
| `lib.js`: `GH_EXEC_DEFAULTS`, `OPEN_ISSUE_COUNT_QUERY`, `OPEN_ISSUE_JSON_FIELDS`, `getOpenIssueCount({ repo, execFile })`, `fetchOpenIssues({ repo, limit, defaultLimit, execFile })` | GitHub query shapes and injected `execFile` are exported. | GitHub adapter internals, with compatibility exports or shims at the old module boundary. | #273 declares the shim rule; #275 preserves argv/results. |
| `sync-pull.js`: `getOpenIssueCount(execFile)`, `fetchOpenIssues(limit, execFile)`, `loadOpenIssues({ limit, execFile })`, `run({ issues, ... })` | CLI transport and filesystem materialization are separable today. | Adapter supplies required `list`; sync-pull retains its materializer and existing exports. | #275 |
| `sprint-init.js`: `createSprintFile({ getDue, getIssues, ... })` | Tests inject milestone due and issue collection even though the default functions call `gh`. | Optional milestone capability supplies those values; file construction remains sprint-owned. | #275 |
| `sprint-mirror.js`: exported `findMirrorIssue`, `createMirrorIssue`, `updateMirrorIssue`, and `sync({ execFile, sprintStatePath, ... })` | GitHub transport and sprint-state dependency are injectable. | Optional mirror capability or an explicitly GitHub-scoped module; old exports stay callable. | #275 |
| `progress-sync-github.js`: all exported issue, PR, close, and comment helpers | The module is GitHub-only and every transport function accepts `execFile`. | Explicit GitHub implementations of optional progress/PR/comment capabilities. | #275 |
| `progress-sync.js`: exported `readTaskFiles`, `readActiveSprintSummary`, re-exported GitHub helpers, and `sync({ execFile, readFs, fetchComments, ... })` | The orchestrator exposes transport and local-reader injection seams; `sync` defaults `readFs.readActiveSprintSummary` to the exported independent sprint Markdown reader. | Capability-gated orchestration; keep the current exports/signatures, default readers, or compatibility shims. | #273 shim policy, #274 reader grammar, #275 behavior. |
| `triage-collect.js`: exported `fetchOpenIssuesGraphql`, `fetchIssueComments`, `fetchClosedIssues`, `collectSnapshot`, and repo parsers | Collection accepts injected execution and stores GitHub-shaped snapshot v2 data. | Core list/read plus optional relationship/comment enrichment; GitHub remote parsing remains provider-scoped. | #275 |
| `triage-apply.js`: exported `toGhCommands`, `runGh`, `parseGhLabels`, and `execute(..., deps)` | Command generation, execution, and `deps.runGh`/`deps.execFile` are observable seams. | Neutral mutations call required lifecycle methods; provider actions remain capability-gated; compatibility helpers remain. | #275 |

### Numeric reference, renderer, and storage inventory

This table inventories every production parser, renderer, or persisted/public
surface under `skills/dev-backlog` and `skills/backlog-triage` that assumes a
numeric GitHub issue, `#N`, `BACK-N`-style filename/ID, or `issue_number`.
Rows group symbols only when they share one owner and one migration boundary.

| Production surface | Current evidence and contract | Current owner | Target seam or capability | Later issue |
| --- | --- | --- | --- | --- |
| `init.sh`; `lib.js` config defaults | Bootstrap writes `task_prefix: "BACK"`; `CONFIG_DEFAULTS.task_prefix` stores the default mirror prefix. | Backlog configuration | Prefix participates in display `ref`, not canonical `id`; tracker selection is a separate single value. | #273 config, #274 identity |
| `sync-pull.js` task materialization | `findExistingTaskFile` matches `{PREFIX}-{issue.number} - `; filenames are `{PREFIX}-{N} - {slug}.md`; frontmatter stores `id: {PREFIX}-{N}`. | `backlog-sync` task mirror | Materialize from normalized identity while preserving GitHub filenames, frontmatter, body preservation, and byte shape. | #274 identity, #275 transport |
| `sprint-init.js` Plan renderer | `buildIssueLines` emits exactly `- [ ] #${issue.number} ...`; milestone collection returns numeric GitHub issues. | Sprint planning | Render the identity `ref`; GitHub continues to render `#N` byte-for-byte. Milestone lookup is optional. | #274 renderer, #275 milestone |
| `lib.sh`, `next.sh`, and human `status.sh` | `RE_CB_*`, checkbox counting, next-item selection, and displayed Plan lines require `#` immediately after the checkbox. | Shell sprint consumption | One normalized Plan-ref parser must back behavior while preserving all existing GitHub human output. | #274 |
| `sprint-state.js` | `CHECKBOX_RE` accepts only `#(\d+)`; `PR_RE` parses `PR #N`; `parsePlanItem` stores `issue_number`; `computeAge` matches exact `#N` in Progress. | Single machine sprint parser | Parse normalized task `ref`, add normalized identity fields, preserve GitHub `issue_number`, PR annotation, age matching, batches, and schema compatibility. PR data remains optional provider metadata. | #274 |
| `backlog-doctor.js` | Consumes `sprint-state.js` and republishes `issue_number` in `publicPlanItem` for in-flight checks. | Sprint health reporting | Consume normalized identity additively while retaining the current public GitHub field. | #274 |
| `sprint-close.sh` | Extracts digits from checked `#N` lines, then finds exactly `/[A-Z]+-{N} - ` before moving the task mirror. | Sprint closeout | Use the single normalized ref/identity implementation; preserve exact-match protection (`1` must not select `11`) and GitHub move behavior. | #274 |
| `sprint-mirror.js` | Consumes `item.issue_number`, renders Plan items as `#N`, parses created issue URLs, and emits mirror result `issue_number`. | `backlog-sync` mirror publication | Render task identity `ref` while preserving GitHub mirror Markdown/JSON; mirror issue identity is optional-provider output. | #274 renderer, #275 mirror capability |
| `progress-sync-render.js` | `parseTaskIssueNumber` parses leading alphabetic `{PREFIX}-N`; body/comment renderers emit task `#N`, PR `#N`, previous/next issue `#N`; entry keys use numeric PR/issue identity. | Progress rendering | Use normalized task identities for task matching; retain GitHub Progress body, comment markers, PR refs, aliases, and keys. | #274 task refs, #275 provider features |
| `progress-sync-relay.js` | Reads numeric `data.issue.number` and `data.git.pr_number` from relay manifests into `issueNumber`/`prNumber`. | Relay metadata bridge | Accept additive normalized task identity without removing numeric GitHub manifest compatibility. PR metadata stays optional. | #274 |
| `progress-sync.js` | `readTaskFiles` reads task filenames into `issueNumber`; exported `readActiveSprintSummary` independently reads active sprint Markdown without `sprint-state.js` and counts only `- [x] #`, `- [~] #`, and `- [ ] #`; `sync` uses both as default `readFs` readers, matches relay tasks numerically, stores Progress issue `issueNumber`, and renders GitHub `#N` output. | `task-progress-reporting` orchestration | Use normalized task identity/ref parsing for local task matching and the independent sprint reader while preserving its export/injection seam and exact GitHub checkbox counts; optional Progress issue/comment/PR capabilities own publication. | #274 parsers/matching, #275 publication |
| `progress-sync-github.js` | Parses numeric issue-create URLs; all issue/comment endpoints take numbers; merged PR records contain numeric `number` and `closingIssuesReferences`. | GitHub progress transport | GitHub-only optional capability implementation; normalized core identities must not erase GitHub numbers from legacy results. | #275 |
| `triage-collect.js` snapshot v2 | Stores numeric `issues[].number`, `closing_prs[].number`, optional `closed_issues[].number`, and comments; repo detection accepts GitHub remotes only. | `triage-grooming` evidence store | Core list/read identities at collection boundary; GitHub snapshot schema remains compatible, with optional PR/comment enrichment. | #275 |
| `triage-relate.js` | `extractIssueRefs`, body/comment phrase scanners, `blocks`/`closes`/`depends on` regexes, numeric edge endpoints, and renderers use `#N`; merged PR evidence uses PR numbers. | Triage relationship analysis | Core task identities for relationships; GitHub `#N` snapshot/report compatibility remains, and PR links are optional. | #275 |
| `triage-stale.js` | Validates numeric snapshot issues; emits `#N`, `merge-into:#N`, merged closing PR labels, and numeric duplicate targets. | Triage stale analysis | Core task identities for candidates; closing-PR evidence and provider closing action stay optional. | #275 |
| `triage-report.js` | `ANCHOR_PATTERN`, `parseAnchor`, active-sprint protection, relationship rendering, action models, and `merge-into:#N` all store/render numeric `issueNumber`/`#N`. | Triage report and confirmation surface | GitHub report/anchor grammar is frozen; neutral core identity may be additive, never a rewrite of existing reports. | #275 |
| `triage-apply.js` | Parses numeric anchors, dedupes on `issueNumber`, stores numeric `issue` in the JSONL apply log, emits `issueNumber` in JSON, and generates numeric GitHub commands. | Explicit triage mutation and audit | Required update/close for neutral actions; comments/milestones are optional. Existing anchors, logs, JSON, and command helpers remain readable/callable. | #275 |

Current user-facing documentation also promises `Fixes #N` close linking and
GitHub issue comments/labels during work. Those are compatibility evidence,
not core tracker semantics: closing-keyword linkage and comments are optional
capabilities, while a provider's mapping of neutral task fields to labels is an
adapter concern.

## Accepted Target Design

This section is the accepted target from issue #270 and merged PR #271. It is
intentionally separate from the runtime inventory above.

Exactly one explicitly configured tracker owns canonical task truth for a
repository. Initial configured values are `github` and `local`; an absent new
key may retain GitHub through the compatibility default frozen for #273, but
runtime availability never chooses a value. Sprint files remain the canonical
execution hub, and task files are either canonical local tasks or derived
GitHub mirrors according to the selected adapter. They are never two canonical
task stores.

The seam is deep rather than a command wrapper: callers ask for task lifecycle
operations and stable identity. The GitHub adapter owns GitHub transport and
translation. Provider publication and relationship features are discovered as
optional capabilities and never enlarge the required interface.

```text
one persisted tracker selection
        |
        v
configured adapter -- availability + capabilities
        |
        +-- required task lifecycle and normalized identity
        |
        `-- explicitly supported optional provider capabilities

backlog/sprints/ remains the execution hub
```

## Required Tracker Interface

The operation set below is normative; method/class names and internal control
flow are not. This is the entire required interface:

| Required operation | Contract |
| --- | --- |
| Availability | Probe only the configured adapter and return usable/unusable with an actionable reason. It reports state; it never selects another adapter. |
| Capability reporting | Report which optional capabilities the configured adapter actually supports. Absence is explicit. |
| List tasks | Return normalized tasks and identities from the one canonical task store. |
| Read task | Read one task by normalized identity (or an unambiguously parsed ref at a compatibility boundary). |
| Create task | Create one task in the configured canonical store and return its normalized identity. |
| Update task | Update provider-neutral task content/state in the configured canonical store and return the resulting task/identity. |
| Close task | Close one task in the configured canonical store and return the resulting task/identity. This does not promise provider closing keywords or PR linkage. |

Every lifecycle operation carries or returns this normalized identity:

```text
{ tracker, id, ref, url? }
```

| Identity field | Meaning |
| --- | --- |
| `tracker` | Configured adapter key that owns the identity, initially `github` or `local`. |
| `id` | Stable adapter-owned identifier. Treat it as opaque; it is not required to be numeric or equal to `ref`. |
| `ref` | Stable display/reference string used at human and compatibility boundaries, such as GitHub `#42` or local `BACK-42`. |
| `url?` | Optional provider link. Absence is valid and must not be fabricated. |

No milestone, PR, mirror, progress, comment, or closing-keyword method belongs
in this required set. Callers may translate their existing payloads to the
provider-neutral task content/state needed by these operations, but this design
does not freeze internal classes, transport objects, or call order.

## Optional Capabilities

Optional behavior is invoked only after capability reporting says it is
supported. A provider may expose none, some, or all of these without weakening
the required task lifecycle.

| Optional capability | Existing GitHub behavior it contains | Current owner |
| --- | --- | --- |
| Milestones | Milestone due/issue selection in `sprint-init`, accepted triage assignment, and `sprint-close --close-milestone`. | Sprint planning/close and triage; GitHub implementation in #275. |
| Pull-request relationships | Open/merged PR queries, `closingIssuesReferences`, merged-closing-PR triage evidence, PR annotations/links. | Progress reporting and triage; GitHub implementation in #275. |
| Mirrors | Marker-identified, explicit sprint mirror issue find/create/body-update. | `backlog-sync`; GitHub implementation in #275. |
| Progress issues | Monthly marker-owned Progress issue find/create/update/finalize/close. | `task-progress-reporting`; GitHub implementation in #275. |
| Comments | Progress managed-comment reconciliation and accepted triage comments. | Progress reporting and triage; GitHub implementation in #275. |
| Closing semantics | `Fixes #N`, provider close keywords/PR auto-linkage, duplicate-close reason, and provider-specific managed-issue finalization. | Workflow guidance, triage, and progress; GitHub implementation in #275. |

Provider labels, assignees, and other metadata are not additional required
operations. The GitHub adapter may map provider-neutral task fields internally
to preserve current behavior; arbitrary provider metadata would require a
separately reported optional capability rather than leaking into this core.

### Failure and authority semantics

The governing failure text is exact:

> runtime never silently switches the configured tracker, transient auth/CLI/remote failure cannot select `local`, unsupported capabilities fail clearly, and two task stores are never co-authoritative.

Consequences:

- An unavailable configured adapter returns an actionable availability error.
  It does not retry against another task store or reinterpret mirrors as truth.
- The absent-key GitHub compatibility default planned for #273 is a stable
  configuration rule, not failure detection and not fallback.
- Optional capability calls fail before mutation with the configured tracker
  and unsupported capability identified. Callers do not fabricate an empty
  milestone, relationship, mirror, comment, or close-link result.
- Canonical writes go only to the selected adapter. Derived mirrors may be
  written explicitly under their existing marker/ownership rules, but never
  become a second authority.
- Partial or transient provider failure remains a failure of that operation;
  it cannot change selection for the next operation.

## Compatibility Matrix

GitHub behavior is the baseline. “Preserve” includes arguments, mutation
safety, Markdown and filenames, JSON aliases, human output where asserted, and
existing dependency-injection seams. Additive normalized fields are allowed;
removing or silently changing an existing field is not.

| Command or data/helper surface | Frozen GitHub compatibility promise | Implementation issue |
| --- | --- | --- |
| `sync-pull` | Same flags/results; all open issues when limit is omitted; same `--update` frontmatter refresh and AC/body preservation, including marker-owned Progress-body exception; idempotent filenames/content; no hidden write. | #275, using #273 seam and #274 identity |
| Task file format and filenames | Preserve `backlog/tasks/{PREFIX}-{N} - {slug}.md`, frontmatter `id: {PREFIX}-{N}`, title/status/labels/priority/milestone/date fields, body structure, and `backlog/completed/` names for GitHub. No historical rename. | #274 |
| `sprint-init` | Preserve CLI/JSON, active-sprint refusal, milestone due/date behavior, milestone issue selection, estimates, and GitHub Plan lines `- [ ] #N ...`. Missing/failed GitHub milestone queries continue their current `TBD`/empty degradation for GitHub; another adapter does not inherit milestone semantics. | #275, with #274 rendering |
| Sprint Plan grammar | Existing `- [ ] #N`, `- [~] #N`, `- [x] #N`, batch headings, `[run:...]`, `[branch:...]`, and `→ PR #N (state)` remain accepted/rendered exactly. Local refs are additive; historical sprints are not rewritten. Exact matching prevents `#1`/`#11` and `BACK-1`/`BACK-11` collisions. | #274 |
| `status.sh --json` | Continue delegating to `sprint-state.js --mode status`; keep schema v1 fields and fail-loud ambiguous-active behavior. Normalized identity fields may be additive only. Human GitHub mode retains its current issue table after transport moves. | #274 JSON, #275 human list |
| `next.sh --json` | Continue delegating to `sprint-state.js --mode next`; preserve the same full JSON document, next-batch wave semantics, field aliases, and ambiguous-active failure. Human Plan output remains compatible. | #274 |
| `sprint-state.js` fields, including `issue_number` | Preserve top-level `schema_version`, `active_sprint`, `plan_items`, `next_batch`, `latest_progress`, and `in_flight`; preserve every current item/age/pointer field. For GitHub entries `issue_number` remains the same integer wherever it currently appears; normalized identity is additive. | #274 |
| `sprint-close` | Preserve doctor-before-close, status/progress mutation, checked-task move, exact numeric filename match, context reminder, dry-run, and current output. GitHub milestone closure remains available only through the declared milestone capability and never runs for unsupported adapters. | #274 task ref; #275 milestone |
| `sprint-mirror` | Preserve exact marker identity, sprint-state-only parsing, ambiguity refusal, body shape, idempotent find/create/update, dry-run safety, CLI text, and JSON `issue_number` for GitHub. This command fails clearly when mirrors are unsupported. | #274 rendering; #275 mirror capability |
| `progress-sync` | Preserve monthly/body/comment markers, issue discovery, body recomputation, previous/next links, PR/task refs, relay aliases, managed-comment create/update/dedup/repair, finalize idempotency, CLI/JSON, and marker-gated ownership. Unsupported Progress/PR/comment capabilities fail clearly rather than approximating behavior. | #274 task matching; #275 optional capabilities |
| `backlog-triage` | Preserve GitHub snapshot v2 fields, `#N` relationship and anchor grammar, advisory-by-default behavior, explicit apply/`--yes`, accepted-action dedupe, argv, JSONL audit logs, JSON fields, and protection of active-sprint issues. Core list/read may use the seam; comments, milestones, PR evidence, and GitHub close reasons remain capability-gated. | #275 |
| Exported helper injection seams | Every helper listed in “GitHub-specific helpers and injection seams” remains exported with compatible inputs/results, or an explicit compatibility shim preserves it. Injected `execFile`, `runGh`, filesystem readers, milestone readers, comment readers, and sprint-state paths must remain effective; tests must not cross the seam into real network/process calls. | #273 shim rule; #275 transport/argv proof |

## Verification Map

This map records the implemented foundation leaves and their proof ownership.

| Later issue | Frozen sections it must satisfy | Required verification evidence |
| --- | --- | --- |
| #273 — configured selection and core seam | “Accepted Target Design”, “Required Tracker Interface”, exact “Failure and authority semantics”, and the exported-helper row of the Compatibility Matrix. | Unit tests for `github`/`local`/invalid/absent selection, unavailable configured adapter, capability report, unsupported capability error, no transient fallback, and compatibility exports. Assert the required operation set contains only availability, capabilities, list/read/create/update/close and identity exactly includes `{ tracker, id, ref, url? }`. Do not implement local storage or setup. |
| #274 — tracker-neutral task references | “Numeric reference, renderer, and storage inventory”, normalized identity in “Required Tracker Interface”, and the task-file/Plan/status/next/sprint-state/close/mirror/progress rows of the Compatibility Matrix. | Parser/renderer golden tests for legacy `#N`, additive local `{PREFIX}-N`, exact-match collisions, invalid/mixed fixtures, byte-compatible GitHub Plan/mirror output, additive JSON identity, and retained GitHub `issue_number`. No historical rewrite and no local persistence. |
| #275 — GitHub behavior behind the seam | “Direct `gh` invocation inventory”, “GitHub-specific helpers and injection seams”, “Optional Capabilities”, failure rules, and every GitHub behavior row of the Compatibility Matrix. | A source scan proving core callers no longer own direct GitHub task lifecycle calls; mocked golden argv/results for every inventoried call family; existing marker/content safety tests; triage/progress/mirror regression tests; full Node and smoke suites. Explicitly GitHub-scoped optional modules may still execute `gh`; capability absence must fail clearly. |
| #276 — local canonical persistence | Required lifecycle, identity, and authority/failure semantics. | Offline lifecycle, exact identity, collision-safe allocation, body preservation, fail-closed storage, recovery, and archive tests with no GitHub calls. |
| #277 — explicit setup | Persisted selection and zero-migration authority rules. | Fresh/legacy setup process tests, byte-idempotent config mutation, provider isolation, atomic publication, and explicit-switch refusal/repair evidence. |
| #278 — dual-mode release proof | Compatibility Matrix, shared unsupported-capability boundary, and documentation/runtime alignment. | `tracker-cycle.acceptance.test.js` table rows, fake/trapped `gh`, exact GitHub argv/bytes/aliases, offline local lifecycle, all-capability typed errors, representative public JSON/human errors, plus repository-wide gates. |

The repository-wide regression gate is:

```bash
git diff --check
node --test skills/*/scripts/*.test.js
node --test skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js
bash skills/dev-backlog/scripts/smoke-test.sh
node skills/dev-backlog/scripts/objectives-check.js --json
node skills/dev-backlog/scripts/component-lint.js --json
node skills/dev-backlog/scripts/capabilities-doctor.js --json
node skills/dev-backlog/scripts/backlog-doctor.js --json
npx --yes skills add . -l
```

The phase boundaries remain historical ownership boundaries; no leaf makes two
task stores co-authoritative or retroactively rewrites GitHub repositories.
