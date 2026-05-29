# Charter Alignment Mapping

Use this reference when mapping backlog work to charter Objectives. Read `spec/charter.md` first; if absent, fall back to legacy root `CHARTER.md`; if both are absent, skip Alignment. The mapping is semantic, prompt-driven analysis: compare issue or epic title/body against objective predicates and Non-Goals.

## Issue To Objective Mapping

For every open issue or epic:

1. Read the objective predicates, especially `active` objectives.
2. Infer whether the issue advances zero, one, or many objective IDs.
3. Use issue title, body, acceptance criteria, linked PRs, and epic context as evidence.
4. Treat explicit objective IDs in an issue body as hints, not commands.

Mapping is not driven by mandatory tags. Issue labels, body tags, or `O<n>` mentions are optional hints only; the final mapping comes from the semantic relationship between the work and the objective predicate.

## Drift Findings

Report these findings when present:

| Finding | Severity | Rule |
|---------|----------|------|
| `orphan work` | medium | An open issue maps to no objective. Ask whether to add an objective, defer the issue, or drop it. |
| `neglected objective` | medium | An `active` objective has no open issue advancing it. Ask whether to plan work, defer the objective, or amend it. |
| `contradiction` | high | An open issue violates a Non-Goal. Resolution requires dropping the issue or amending the Non-Goal through `spec-charter` amend. |

Contradictions are highest severity because they mean execution is crossing an explicit boundary.

## Coverage Line

Start the Alignment report with a compact coverage line:

```text
7/9 open issues → objectives ✓ · O3 has no work ⚠
```

Use the first count for open issues that map to at least one objective. Mention neglected objectives or contradictions after the separator.

## Proposed Charter Changes

When findings suggest the charter may need to evolve, format proposals as a seed for `spec-charter` amend. The triage or planning report proposes only; `spec-charter` owns gated mutation of `spec/charter.md`.
