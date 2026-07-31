# GitHub Projects Planning Projection Pilot

Issue: [#349](https://github.com/sungjunlee/dev-backlog/issues/349)

Observed: 2026-07-31

Pilot: [private user Project #5](https://github.com/users/sungjunlee/projects/5)

## Decision

Retain milestones, labels, and sprint Plan ordering. Do not adopt a GitHub
Projects profile and do not add a Projects adapter, sync loop, config surface,
or core dependency.

Projects v2 successfully represented six real Issues with Priority, Iteration,
and Target Date fields. It did not reduce planning time or calls in either
observed cycle. The second cycle required four explicit field writes plus one
read-back where the existing workflow needed one live Issue query and already
held execution order in the sprint Plan.

The private pilot Project is evidence, not task authority. Issue title, body,
state, labels, milestone, AC, and lifecycle remain canonical in GitHub Issues.

## Guardrails

- Pin the account and Project number before every command.
- Resolve Project, item, field, option, and iteration IDs by discovery; never
  derive or reuse them across Projects.
- Treat Project-only values as optional planning metadata.
- Perform every write through an explicit `gh project` or GraphQL command.
- Do not write a sprint, task file, config, or Issue as a side effect of a
  Project operation.
- A failed Project read or write stops that projection operation only. It
  cannot change Issue authority or block Issue to PR execution.

## Capability Matrix

Environment: `gh 2.85.0`; authenticated user `sungjunlee`; token scope
`project` (plus pre-existing repository scopes).

| Capability | `gh project` CLI | GraphQL | Pilot result |
| --- | --- | --- | --- |
| Authentication and scope | `gh auth status` | — | `project` scope required; read/write passed |
| Project discovery/create | `list`, `view`, `create` | supported | Project #5 created private |
| Item discovery/add | `item-list`, `item-add` | supported | real Issues #345–#350, 6/6 |
| Field discovery | `field-list` | richer typed query | 16 fields discovered |
| Priority create/update | `field-create SINGLE_SELECT`, `item-edit` | supported | 6/6 initial, 2/2 cycle-2 changes |
| Date/roadmap field | `field-create DATE`, `item-edit --date` | supported | Target Date 6/6 initial, 2/2 cycle-2 changes |
| Iteration create | not supported by `field-create` | `createProjectV2Field(dataType: ITERATION)` | three iterations created |
| Iteration discovery | field ID only | full configuration and iteration IDs | 3/3 values discovered |
| Iteration update | `item-edit --iteration-id` | supported | 6/6 |
| Roadmap view create | no CLI command | `createProjectV2View(ROADMAP_LAYOUT)` exists | not needed; date projection was sufficient |
| Multi-field update | one field per invocation | one field per mutation | no batch write |
| Invalid authentication | explicit non-zero | explicit error | HTTP 401, no state change |
| Invalid iteration ID | explicit non-zero | explicit error | rejected before value change |

The important boundary is asymmetrical: the CLI can update an Iteration value
but cannot create the Iteration field. GraphQL can create it with
`iterationConfiguration { startDate, duration, iterations }`.

## Reproduction

After explicit approval, authorize once:

```bash
gh auth refresh -h github.com -s project
gh auth status -h github.com
```

`gh auth refresh` persistently expands the active token. Run it only after the
operator explicitly approves Projects read/write access; verify the resulting
scope before creating anything.

Then start read-only discovery:

```bash
gh project list --owner @me --limit 100 --format json
gh project field-list 5 --owner @me --format json
gh project item-list 5 --owner @me --limit 100 --format json
```

Create simple fields through the CLI:

```bash
gh project field-create 5 --owner @me \
  --name Priority --data-type SINGLE_SELECT \
  --single-select-options "P0 Critical,P1 High,P2 Medium,P3 Low" \
  --format json

gh project field-create 5 --owner @me \
  --name "Target Date" --data-type DATE --format json
```

The Iteration field requires GraphQL with the discovered Project node ID. This
is the complete CLI wrapper used by the pilot:

```bash
gh api graphql \
  -f project=PROJECT_NODE_ID \
  -f query='
mutation($project: ID!) {
  createProjectV2Field(input: {
    projectId: $project
    dataType: ITERATION
    name: "Iteration"
    iterationConfiguration: {
      startDate: "2026-07-27"
      duration: 14
      iterations: [
        { title: "2026-08 A", startDate: "2026-07-27", duration: 14 }
        { title: "2026-08 B", startDate: "2026-08-10", duration: 14 }
        { title: "2026-08 C", startDate: "2026-08-24", duration: 14 }
      ]
    }
  }) {
    projectV2Field {
      ... on ProjectV2IterationField {
        id
        name
        configuration {
          iterations { id title startDate duration }
        }
      }
    }
  }
}
'
```

Add each real Issue explicitly:

```bash
gh project item-add 5 --owner @me \
  --url https://github.com/sungjunlee/dev-backlog/issues/349 \
  --format json
```

Discover IDs again, then update exactly one field per command:

```bash
gh project item-edit \
  --id ITEM_ID \
  --project-id PROJECT_NODE_ID \
  --field-id PRIORITY_FIELD_ID \
  --single-select-option-id PRIORITY_OPTION_ID

gh project item-edit \
  --id ITEM_ID \
  --project-id PROJECT_NODE_ID \
  --field-id ITERATION_FIELD_ID \
  --iteration-id ITERATION_ID

gh project item-edit \
  --id ITEM_ID \
  --project-id PROJECT_NODE_ID \
  --field-id TARGET_DATE_FIELD_ID \
  --date 2026-08-16
```

IDs above are intentionally placeholders. They are opaque and Project-local.

## Read-Back

Cycle 1 produced exact Priority, Iteration, and Target Date values for all six
items: 18/18 field values.

| Issue | Priority | Iteration | Target Date | Native status |
| --- | --- | --- | --- | --- |
| #345 | P0 Critical | 2026-08 A | 2026-08-09 | Done |
| #346 | P0 Critical | 2026-08 A | 2026-08-09 | Done |
| #347 | P0 Critical | 2026-08 A | 2026-08-09 | Done |
| #348 | P1 High | 2026-08 B | 2026-08-23 | Done |
| #349 | P1 High | 2026-08 B | 2026-08-23 | Todo |
| #350 | P2 Medium | 2026-08 C | 2026-09-11 | Todo |

Cycle 2 reflected the actual remaining work after #348 closed. Only changed
values were written:

| Issue | Priority | Iteration | Target Date |
| --- | --- | --- | --- |
| #349 | P0 Critical | 2026-08 B | 2026-08-16 |
| #350 | P1 High | 2026-08 C | 2026-08-28 |

The final read-back again returned six items and 18/18 expected values.

## Cost Comparison

Tool calls are user-visible command/API boundaries. Wall time is the observed
elapsed time in this environment, including GitHub response latency.

| Observation | Writes | Reads | Wall time | Corrections |
| --- | ---: | ---: | ---: | ---: |
| Project bootstrap: add 6 Issues | 6 | 0 | 28.4 s | 0 |
| Project cycle 1: set 18 field values | 18 | 1 | 79.9 s | 0 |
| Project cycle 2: update 4 changed values | 4 | 1 | 45.8 s | 0 |
| Milestone + labels baseline: read same 6 Issues | 0 | 1 | 4.0 s | 0 |

Bootstrap also required separate Project, Priority, Target Date, and GraphQL
Iteration creation. The existing milestone already grouped all six Issues, and
the sprint Plan already represented dependency order and in-flight pointers.

Adoption required both planning cycles to save at least 30% or two minutes
against milestones + labels, keep reconciliation below five minutes, preserve
zero authority divergence, and need at most one correction per cycle. The
pilot met reconciliation, correctness, and correction limits but showed no
time or call reduction. Repeated value was not demonstrated.

## Failure Atomicity

Two deliberate failures were run after capturing local, Issue, and Project
snapshots:

1. A command-local invalid `GH_TOKEN` returned HTTP 401.
2. A valid authenticated write with an invalid iteration ID returned
   `The iteration Id does not belong to the field`.

Both exited non-zero. Before and after:

- `git status --porcelain` was identical;
- the active sprint bytes were identical;
- all six Issue title/state/labels/milestone snapshots were identical;
- all six Project item and 18 field-value snapshots were identical.

The audit hashes were computed immediately before and after both failures:

| Snapshot | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `git status --porcelain` | `b243a57fded48e1d79d8e7553f64ebc7f97273ac450ad059b550be16e6a7e9df` | same |
| active sprint | `90950d077771f60c10fd8ab66f416b9170bf3477c569cafb1173a3bfd0508447` | same |
| six canonical Issues | `1d51fa176251f898a3e89ac8dd3ee2763f10180da550a034780ae0fca6ffe93e` | same |
| six Project items / 18 values | `1955742a29ae64ee621b412d43aae704dce1b1b07705b3602f04f7b20f2419a9` | same |

Reproduce the four digests with:

```bash
git status --porcelain | shasum -a 256
shasum -a 256 backlog/sprints/2026-07-github-native-core-simplification.md

gh issue list --repo sungjunlee/dev-backlog --state all \
  --milestone "2026-08 GitHub-native core simplification" --limit 100 \
  --json number,title,state,labels,milestone \
  --jq 'sort_by(.number) | map({
    number,title,state,
    labels:(.labels|map(.name)|sort),
    milestone:.milestone.title
  })' | shasum -a 256

gh project item-list 5 --owner @me --limit 100 --format json \
  --jq '.items | sort_by(.content.number) | map({
    number:.content.number,
    priority:.priority,
    iteration:.iteration.title,
    target_date:."target Date",
    status:.status
  })' | shasum -a 256
```

Run those commands before and after each deliberately failing write. The
invalid-auth probe sets a fake `GH_TOKEN` for that command only; it never edits
the stored credential.

No dev-backlog command wraps Project writes, so there is no local mutation path
to compensate. The complete mirrorless core acceptance test additionally runs
without any Project command or API call:

```bash
node --test skills/dev-backlog/scripts/tracker-cycle.acceptance.test.js
```

## Product Boundary

The pilot proves technical capability, not product value. Keep Projects
manual and external if an operator chooses to experiment again. Do not add:

- a Project provider or adapter;
- automatic Issue-to-Project synchronization;
- Project fields as task spec, lifecycle, or sprint truth;
- config or setup requirements;
- a Project-backed fallback when GitHub Issue reads fail.

Revisit only after a separate real workflow demonstrates repeated savings that
clear the adoption gate.
