# Tracker Adapter Design Contract

Status: implemented foundation with dual-mode acceptance proof on issue #278's
implementation branch. Runtime evidence was originally inventoried at commit
`019a6ec`; merged issues #273-#277 provide selection, identity, GitHub wiring,
local persistence, and setup. GitHub remains the compatibility baseline. The
proof branch merged as PR #303 (2026-07-12); O8/O9 are validated.

Amended 2026-07-26 by "Adapter Tiers (v0.9.0)" below, which re-tiers how
adapters are built. The required interface, identity shape, capability model,
failure/authority semantics, and every GitHub compatibility row in the frozen
sections are unchanged by that amendment.

This document froze the smallest tracker boundary that can support another
canonical task store without weakening existing GitHub behavior. The #272
freeze itself did not configure a tracker or implement an adapter; the current
foundation state is recorded separately below. These changes do not persist
local tasks, alter setup, or rewrite command, Markdown, JSON, sprint, or
task-mirror compatibility surfaces.

## Adapter Tiers (v0.9.0)

Accepted 2026-07-26 as milestone 16 / issue #320. This section governs how a new
adapter is built and how large it is allowed to be. It changes no frozen
contract below.

### The asymmetry this fixes

The seam works. The two adapters behind it are not the same kind of thing:

| Adapter | Lines | What it actually is |
| --- | --- | --- |
| `github-tracker.js` | 172 | a translator — build `gh` argv, parse JSON, normalize |
| `local-tracker.js` | 1,391 | a transactional file database plus a YAML round-trip serializer |

Only a minority of `local-tracker.js` is task lifecycle. The bulk is substrate
machinery that exists because markdown was chosen as the canonical store:
roughly 200 lines of frontmatter YAML parse/serialize with verbatim
human-byte and CRLF preservation, 200 lines of allocation lock
(`.local-tracker.lock`, `pid:token` stamps, retry loop, live-versus-dead holder
distinction, deliberate no-reclamation), 150 lines of filesystem-boundary
guards, and 120 lines of close compensation and split-store detection.

Every tracker that would come next — `gitlab`, `gitea`, `jira`, `linear` — is
the *first* kind. `local` is the only adapter that must implement storage at
all. Placing it in the same tier as `github` put a database behind the seam,
and that, not the seam, is the whole weight of the local axis.

### Three tiers

| Tier | Responsibility | Budget | Members |
| --- | --- | --- | --- |
| Seam | Selection, adapter-shape and identity validation, configured-only availability probing, capability gates, typed errors | ~350 lines | `tracker.js` — exactly one, permanent |
| Remote translator | Build provider CLI/API arguments, parse responses, normalize to `{ tracker, id, ref, url? }`. Holds no durable state of its own | **≤200 lines** | `github` (172); future `gitlab`, `gitea`, `jira`, `linear` |
| Storage substrate | Implement a task store where no provider exists behind the adapter | ≤600 lines | `local`, and only `local` |

### The adapter size budget

> **A new adapter over 200 lines is not an adapter — it is a substrate. Stop and re-tier.**

Crossing 200 lines means the module has stopped translating and started owning
state, ordering, or durability. Those belong in the substrate tier, where there
is exactly one implementation to review, harden, and verify on both platforms.
The budget is what keeps "support more trackers" a linear cost instead of a
compounding one.

This is a design-review gate, not a lint rule. It measures the adapter's own
module, excluding tests and shared helpers.

### Local canonical shape

`local` owns a JSON store under `backlog/`. `backlog/tasks/*.md` and
`backlog/completed/*.md` become **derived mirrors** — exactly the role they
already hold in `github` mode. Put differently: `local` becomes a tracker whose
"provider" is a local JSON file, so it looks like every other adapter from the
seam's point of view.

That single decision is what lets the substrate shrink:

- markdown is no longer canonical, so the frontmatter YAML parse/serialize path
  and CRLF byte preservation are deleted;
- a single store file keeps write-temp plus atomic rename for complete,
  non-torn replacement.

The deleted allocation lock had two jobs: atomic rename prevents partial or
interleaved store bytes, but it does not serialize ID allocation or any other
read-modify-write. `local` handles that second job with revision-based
compare-and-swap: a complete fsynced candidate claims its next revision through
no-overwrite `link`, then renames into place; a collision re-reads and retries
within a bounded budget. A crash leaves only inert revision-identified debris,
never a lock that another writer must interpret or reclaim.

**Co-authoritative rule (binding).** The derived mirror is never parsed back as
truth. Every read resolves from the JSON store; a hand-edit to a mirror file is
not an input and is overwritten on the next write. This is *stricter* than
today's arrangement, in which markdown is canonical, hand-editable, and
arbitrated by a lock — three routes to the same bytes. It satisfies the
`tracker-task-truth` hard constraint ("never treats two task stores as
co-authoritative") more cleanly than the shape it replaces.

### Selection source

Tracker selection moves out of `backlog/config.yml` into `backlog/.tracker`, a
single-line file containing `github` or `local`.

The motivation is the same over-build in a different place:
`setup-dev-backlog.js` carries ~395 lines of hand-written YAML tokenizer
(`consumeQuotedToken`, `decodeDoubleQuotedScalar`, `validAnchorOrAliasName`,
`isBlockScalarHeader`, `tokenizeYamlLine`, `mutateTrackerText`, …) whose entire
job is writing one key into a user-owned YAML file safely — detecting anchors,
aliases, block scalars, and quoted keys that could hide a second `tracker:`
declaration. The repository has no `package.json` by design, since skills must
run without `npm install`, so a YAML dependency was never an option and the
parser was written by hand. The correct fix is to stop writing to `config.yml`
at all, not to write a better parser.

Consequences: reading a selection becomes `readFileSync().trim()`; the PR #301
Learning "preserve user YAML bytes" is satisfied permanently and trivially,
because the file is never touched; and `config.yml` continues to be *read* for
its other fields through the existing `lib.js:parseSimpleYaml` (~80 lines),
which is unchanged and stays.

Compatibility is preserved exactly: a `tracker:` key already present in
`config.yml` with no `.tracker` file resolves to the same tracker as before and
is migrated to `.tracker` on the next setup run without editing `config.yml`; a
repository with neither still defaults to `github` with zero migration; and
runtime still never infers a tracker from availability or switches after a
failure.

Note this repository currently carries **three** YAML implementations. After
this amendment only the first survives: `lib.js:parseSimpleYaml` (reads
`config.yml`, used everywhere — keep), the `setup-dev-backlog.js` tokenizer
(writes the tracker key — deleted), and the `local-tracker.js` frontmatter
round-trip (task files — deleted).

#### The legacy read guarantee is narrower than the deleted tokenizer, on purpose

The tokenizer existed to *write* one key into a user-owned YAML file safely: it
had to be certain no second declaration was hiding anywhere, because clobbering
one would corrupt the user's config. Nothing writes `config.yml` any more, so
that job is gone. What remains is a read that must either resolve the value the
old code resolved, or refuse.

`legacy-tracker.js` therefore **refuses without decoding**. It counts `tracker`
keys wherever the old lexer counted them — nested, sequence, and flow contexts
included — and excludes what the old lexer excluded: block-scalar bodies,
comments, and quoted spans. Beyond that it refuses two shapes the old lexer
decoded, rather than reimplementing the decoder: a quoted key containing escape
sequences (`"track\x65r": github`) and an explicit mapping key (`? tracker`).

Two accepted consequences, recorded so they are decisions rather than gaps:

- A config using those shapes is **refused with an actionable message** where the
  old setup would have decoded and then refused it as a duplicate. The outcome —
  no migration, an error naming the problem — is the same; only the reason text
  differs.
- A `tracker:` sequence appearing inside a **multi-line** quoted scalar can be
  over-counted, producing a refusal where the old lexer accepted the file. This
  errs toward refusal, never toward a silent selection.

The residual risk is a pre-existing repository whose `config.yml` uses YAML
escapes or explicit keys around its tracker declaration. Measured 2026-07-26,
one repository in the world carries a `tracker:` key at all, and this change
migrates it. Rebuilding the decoder to close that gap would restore the ~395
lines this issue exists to delete.

### Windows consequence

Replacing an open allocation-lock pathname during reclamation was the sole
cause of the local tracker's Windows divergence. Three tests carried:

```
t.skip("Windows prevents replacing an open lock pathname; Ubuntu covers this POSIX race")
```

Compare-and-swap has no lock pathname to reclaim. A writer claims its revision
through no-overwrite `link` and renames its own complete candidate into place;
nothing is ever replaced while another process holds it open. The redesign
therefore **deletes** those skips rather than re-documenting them, and the
concurrent-writer coverage runs everywhere. Windows-specific code stays at 68
lines (`bash-runtime.js` 44 plus `portable-path.js` 24) and the
`windows-latest` CI job.

### What survives unchanged

The PR #298 Learnings are durable and survive the format change: exact-ID
allocation across active and completed tasks, fail-closed control-character and
injection validation, and crash-recoverable close/archive semantics. Dropping
any of them is a regression, not a simplification.

Also unchanged: the required interface, the `{ tracker, id, ref, url? }`
identity, capability reporting, the failure and authority semantics, and every
GitHub compatibility row in the frozen sections below.

### Migration posture

`local` has zero adopters. Measured 2026-07-26 across the 19 repositories that
consume dev-backlog: no local store exists in any of them, and exactly one
`backlog/config.yml` carries a `tracker:` key — this repository's own, set to
the compatibility default `github`. `scope:` appears in zero sprint files and no
repository runs two or more active tracks.

Therefore **no migration path for existing local stores ships**. That is a
deliberate, dated decision taken while the window is open, not an oversight. A
later adopter starts on the JSON shape.

### Spec impact

The canonical-shape change is an implementation choice; it does not alter an
Expected Behavior or a Hard Constraint of the `tracker-task-truth` capability.
A `Decisions` row in `spec/capabilities.md` therefore records it. If review
finds otherwise, it escalates to a human-gated `spec-grill` pass before the
implementation merges — an invariant is never amended unattended (the #294
precedent).

## Runtime Adapter State (#273-#278)

This section records the runtime as of #278. Selection source and the local
canonical shape are superseded by "Adapter Tiers (v0.9.0)" above once milestone
16 lands; everything else here stands.

`backlog/config.yml` selects one `tracker`, initially `github` or `local`.
Repositories without that key use `github` as a deterministic compatibility
default. Selection reads only the supplied configuration value: it performs no
CLI, authentication, remote, adapter, or filesystem detection.

`skills/dev-backlog/scripts/tracker.js` owns selection, exact adapter-shape and
identity validation, configured-only availability probing, and optional
capability gates. An unavailable or throwing configured adapter fails with no
probe or fallback to the other slot. The GitHub slot now delegates its required
task lifecycle to `github-tracker.js`; generic sync and orientation callers use
configured-only resolution. Milestone and triage GitHub transports live in
explicitly named provider modules and are reached only
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
change `backlog/.tracker` or resolve another tracker.

### Dual-mode executable proof (#278)

`skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js` is the release
proof. Its table-driven `github` and `local` rows cross real temporary-file and
CLI/subprocess boundaries without network access. The GitHub row starts with a
tracker-less legacy config, records fake-`gh` argv, and freezes `#N`, numeric
`issue_number`, task mirror bytes/body preservation, milestone, close, and
final read/list behavior without rewriting the
config. The local row performs explicit setup, canonical create, normalized
Plan orientation, read/update/body preservation, Done archive, sprint close,
and final read/list with an execution-trap `gh` that records zero calls. A
capability table covers all four optional features plus representative JSON and
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

These were the seven remaining production files in the frozen inventory. Test and smoke
fixtures are evidence for compatibility, but are not production callers.

| Production file | Direct current behavior | Current owner | Target seam or capability | Later issue |
| --- | --- | --- | --- | --- |
| `skills/dev-backlog/scripts/lib.js` | `getOpenIssueCount` runs a GraphQL issue count; `fetchOpenIssues` runs `gh issue list` and parses GitHub fields. | Shared dev-backlog GitHub query helper | Required `list` plus configured-adapter availability; GitHub argv stays inside the GitHub adapter. | #273 seam, #275 move |
| `skills/dev-backlog/scripts/sync-pull.js` | Its exported `fetchOpenIssues` runs `gh issue list`; omitted limits call the shared GraphQL count helper. | Backlog materialization | Required `list`; writing/updating mirrors remains `backlog-sync`. | #275 |
| `skills/dev-backlog/scripts/sprint-init.js` | `getMilestoneDue` runs `gh api .../milestones`; `getMilestoneIssues` runs `gh issue list --milestone`. | Sprint planning | Optional `milestones`; issue results still enter the required task identity seam. | #275 |
| `skills/dev-backlog/scripts/status.sh` | Human mode runs `gh issue list` for the “GitHub Issues” table. JSON mode does not call GitHub; it delegates to `sprint-state.js`. | Sprint orientation | Required `list` for the configured tracker; current GitHub table/output is the baseline. | #275 |
| `skills/dev-backlog/scripts/sprint-close.sh` | `--close-milestone` lists GitHub milestones and PATCHes the matching milestone closed. | Sprint closeout | Optional `milestones`; local sprint completion remains owned by `sprint-execution`. | #275 |
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
execution hub. Task files are derived mirrors in both modes; local task truth
lives only in `backlog/local-tracker.json`, while GitHub task truth remains in
GitHub Issues. They are never two canonical task stores.

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

No milestone, PR-relationship, comment, or closing-keyword method belongs
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
| Pull-request relationships | Merged-closing-PR triage evidence and PR annotations/links. | Triage; GitHub implementation in #275. |
| Comments | Accepted triage comments. | Triage; GitHub implementation in #275. |
| Closing semantics | `Fixes #N`, provider close keywords/PR auto-linkage, and duplicate-close reason. | Workflow guidance and triage; GitHub implementation in #275. |

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
  milestone, relationship, comment, or close-link result.
- Canonical writes go only to the selected adapter. Derived mirrors may be
  written from canonical task state, but never become a second authority.
- Partial or transient provider failure remains a failure of that operation;
  it cannot change selection for the next operation.

## Compatibility Matrix

GitHub behavior is the baseline except where a later product-boundary decision
is explicitly recorded. “Preserve” includes arguments, mutation
safety, Markdown and filenames, JSON aliases, human output where asserted, and
existing dependency-injection seams. Additive normalized fields are allowed;
removing or silently changing an existing field is not.

| Command or data/helper surface | Frozen GitHub compatibility promise | Implementation issue |
| --- | --- | --- |
| `sync-pull` | #347 deliberately replaces no-flag compatibility with a required `--legacy-export` gate (no flag exits 2 before materialization). Behind that gate, preserve all open issues when limit is omitted, `--update` frontmatter refresh and AC/body preservation including the marker-owned Progress-body exception, idempotent filenames/content, and no hidden write. | #275 foundation; #347 boundary change |
| Task file format and filenames | Preserve `backlog/tasks/{PREFIX}-{N} - {slug}.md`, frontmatter `id: {PREFIX}-{N}`, title/status/labels/priority/milestone/date fields, body structure, and `backlog/completed/` names for GitHub. No historical rename. | #274 |
| `sprint-init` | Preserve CLI/JSON, active-sprint refusal, milestone due/date behavior, milestone issue selection, estimates, and GitHub Plan lines `- [ ] #N ...`. Missing/failed GitHub milestone queries continue their current `TBD`/empty degradation for GitHub; another adapter does not inherit milestone semantics. | #275, with #274 rendering |
| Sprint Plan grammar | Existing `- [ ] #N`, `- [~] #N`, `- [x] #N`, batch headings, `[run:...]`, `[branch:...]`, and `→ PR #N (state)` remain accepted/rendered exactly. Local refs are additive; historical sprints are not rewritten. Exact matching prevents `#1`/`#11` and `BACK-1`/`BACK-11` collisions. | #274 |
| `status.sh --json` | Continue delegating to `sprint-state.js --mode status`; keep schema v1 fields and fail-loud ambiguous-active behavior. Normalized identity fields may be additive only. Human GitHub mode retains its current issue table after transport moves. | #274 JSON, #275 human list |
| `next.sh --json` | Continue delegating to `sprint-state.js --mode next`; preserve the same full JSON document, next-batch wave semantics, field aliases, and ambiguous-active failure. Human Plan output remains compatible. | #274 |
| `sprint-state.js` fields, including `issue_number` | Preserve top-level `schema_version`, `active_sprint`, `plan_items`, `next_batch`, `latest_progress`, and `in_flight`; preserve every current item/age/pointer field. For GitHub entries `issue_number` remains the same integer wherever it currently appears; normalized identity is additive. | #274 |
| `sprint-close` | Preserve doctor-before-close, status/progress mutation, checked-task move, exact numeric filename match, context reminder, dry-run, and current output. GitHub milestone closure remains available only through the declared milestone capability and never runs for unsupported adapters. | #274 task ref; #275 milestone |
| `backlog-triage` | Preserve GitHub snapshot v2 fields, `#N` relationship and anchor grammar, advisory-by-default behavior, explicit apply/`--yes`, accepted-action dedupe, argv, JSONL audit logs, JSON fields, and protection of active-sprint issues. Core list/read may use the seam; comments, milestones, PR evidence, and GitHub close reasons remain capability-gated. | #275 |
| Exported helper injection seams | Every helper listed in “GitHub-specific helpers and injection seams” remains exported with compatible inputs/results, or an explicit compatibility shim preserves it. Injected `execFile`, `runGh`, filesystem readers, milestone readers, comment readers, and sprint-state paths must remain effective; tests must not cross the seam into real network/process calls. | #273 shim rule; #275 transport/argv proof |

## Verification Map

This map records the implemented foundation leaves and their proof ownership.

| Later issue | Frozen sections it must satisfy | Required verification evidence |
| --- | --- | --- |
| #273 — configured selection and core seam | “Accepted Target Design”, “Required Tracker Interface”, exact “Failure and authority semantics”, and the exported-helper row of the Compatibility Matrix. | Unit tests for `github`/`local`/invalid/absent selection, unavailable configured adapter, capability report, unsupported capability error, no transient fallback, and compatibility exports. Assert the required operation set contains only availability, capabilities, list/read/create/update/close and identity exactly includes `{ tracker, id, ref, url? }`. Do not implement local storage or setup. |
| #274 — tracker-neutral task references | “Numeric reference, renderer, and storage inventory”, normalized identity in “Required Tracker Interface”, and the task-file/Plan/status/next/sprint-state/close rows of the Compatibility Matrix. | Parser/renderer golden tests for legacy `#N`, additive local `{PREFIX}-N`, exact-match collisions, invalid/mixed fixtures, byte-compatible GitHub Plan output, additive JSON identity, and retained GitHub `issue_number`. No historical rewrite and no local persistence. |
| #275 — GitHub behavior behind the seam | “Direct `gh` invocation inventory”, “GitHub-specific helpers and injection seams”, “Optional Capabilities”, failure rules, and every GitHub behavior row of the Compatibility Matrix. | A source scan proving core callers no longer own direct GitHub task lifecycle calls; mocked golden argv/results for every inventoried call family; existing marker/content safety tests; triage regression tests; full Node and smoke suites. Explicitly GitHub-scoped optional modules may still execute `gh`; capability absence must fail clearly. |
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
