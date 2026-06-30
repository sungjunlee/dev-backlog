---
name: backlog-triage
argument-hint: "[collect|relate|stale|report|apply] [options]"
description: Triage open GitHub Issues into an advisory report. Use for issue grooming, stale or obsolete detection, relationship mapping, priority and milestone proposals, accepted-action apply, 백로그 정리, 이슈 검토, 트리아지.
compatibility: Requires gh CLI and git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, dev-backlog, relay, relay-plan"
---

# Backlog Triage

Real job: inspect open GitHub Issues, produce an advisory triage report, and apply only human-accepted issue mutations through stable anchor comments.

Sibling skill to `dev-backlog`, not a replacement. `dev-backlog` owns sprint execution, progress, milestones, and AC mirrors. `backlog-triage` owns open-issue classification, relationships, stale signals, priority/milestone proposals, and optional accepted GitHub mutations.

## Phase Model

```
Phase 1 — Report (default, read-only)     Phase 2 — Apply (explicit mutation)
  collect -> analyze -> render              review report -> --apply
       |                                          |
  one snapshot + markdown report             gh mutations + JSONL audit log
```

| Phase | Step | Completion boundary |
| --- | --- | --- |
| Report | Collect | One `gh` fetch writes a snapshot JSON; downstream steps use `--snapshot PATH` and do not re-fetch. |
| Report | Analyze | Classification, relationships, stale/obsolete signals, Alignment, and Decision Review are computed from the same snapshot/spec evidence. |
| Report | Render | One markdown report is written with anchored proposals and a consolidated Apply Checklist. |
| Apply | Review | A human accepts proposals by flipping paired checkboxes from `[ ]` to `[x]`; unchecked anchors remain inert. |
| Apply | Dry-run | `triage-apply.js <report.md>` prints intended `gh` mutations without writing. |
| Apply | Mutate | `triage-apply.js <report.md> --apply` executes only accepted actions; `--yes` is required for non-interactive apply. |
| Apply | Re-run | Re-running apply is idempotent and logs `already-applied` for completed actions. |

Report mode is always safe to rerun. Apply mode is opt-in and must preserve an audit log beside the report.

## Report Evidence

- Snapshot JSON is the canonical input artifact for a triage run.
- Alignment is prompt-driven: read `spec/charter.md`, fall back to legacy root `CHARTER.md`, then use `../spec-charter/references/alignment.md`. When both charter files are absent, skip the mapping work and render `## Alignment` as skipped because no charter evidence exists.
- Decision Review is prompt-driven and report-only: read the resolved charter, optional `spec/capabilities.md`, optional `spec/system-map.md`, active sprint context, and triage signals; use `references/decision-review.md`.
- Spec-axis boundaries live in `../spec-charter/references/spec-axis.md`; triage may propose charter/capability/system-map follow-ups but must not mutate those specs.

## Anchor-Comment Apply Contract

Every actionable proposal pairs a stable machine anchor with a visible checkbox:

```markdown
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists
```

Rules:

- The anchor comment is the machine contract.
- The paired checkbox is the human confirmation surface.
- An action is accepted only when the anchor exists and its paired checkbox is `[x]`.
- Unknown verbs parse without crashing and are skipped by consumers that do not implement them.
- Duplicate proposal surfaces are deduped by `(verb, issueNumber, normalizedArgs)`.

See `references/apply.md` for anchor grammar, parse rules, dedupe behavior, idempotency, and audit-log schema.

## Report Shape

The report is a derived artifact under `backlog/triage/`. GitHub Issues remain the source of truth.

Required sections:

- `## Classification` — issue buckets by theme, label, age, activity, and milestone state.
- `## Relationships` — mentions, blocks, depends-on, duplicate candidates, and merged closing PR links.
- `## Obsolete Candidates` — anchored close/revisit proposals with evidence.
- `## Priority Proposals` — anchored priority proposals with rationale.
- `## Milestone Suggestions` — anchored milestone proposals grouped into candidate sprint clusters.
- `## Alignment` — objective coverage, orphan work, neglected objectives, contradictions, and proposed charter changes; when no charter exists, record that alignment was skipped.
- `## Decision Review` — `Do Now`, `Shape First`, `Defer`, and `Drop / Close`.
- `## Apply Checklist` — consolidated review surface for every anchored action.

Full section examples and rubric details live in `references/classification.md`, `references/relationships.md`, `references/stale.md`, `references/decision-review.md`, and `references/apply.md`.

## Relationship To dev-backlog

| Concern | Owner |
| --- | --- |
| Sprint files, execution plan, Running Context | `dev-backlog` |
| Milestone lifecycle and monthly progress issue | `dev-backlog` |
| AC checkboxes inside issue bodies (`AC:BEGIN` / `AC:END`) | `dev-backlog` |
| Open-issue classification, relationships, stale flags | `backlog-triage` |
| Charter alignment of open issues | `backlog-triage` report; mutations route to `spec-charter` |
| Capability/system-map concerns | `backlog-triage` report; mutations route to `spec-grill` or `spec-system-map` |
| Priority/milestone proposals and accepted mutations | `backlog-triage` |
| Post-triage sprint planning | `dev-backlog` |

Recommended cadence: run `backlog-triage` weekly or bi-weekly, then feed accepted Milestone Suggestions into the next `dev-backlog` sprint.

## Script Resolution

Resolve scripts from the installed `backlog-triage` skill directory, not from the target project. In a source checkout, that is the local `scripts/` directory beside this `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root. Operational scripts support `--json` for composition.

Concrete pattern:

```bash
skill_dir="skills/backlog-triage" # source checkout; replace with the resolved installed skill dir
node "$skill_dir/scripts/triage-collect.js" --dry-run --json
node "$skill_dir/scripts/triage-apply.js" backlog/triage/YYYY-MM-DD-report.md
```

Useful scripts:

- `scripts/triage-collect.js [--repo OWNER/REPO] [--limit N] [--json] [--dry-run]` — fetch open issues and write `backlog/triage/.cache/<ISO-timestamp>.json`.
- `scripts/triage-relate.js --snapshot PATH [--json]` — detect mentions, blocks, depends-on, duplicates, and merged PR links.
- `scripts/triage-stale.js --snapshot PATH [--since N] [--json]` — flag stale/obsolete candidates with evidence.
- `scripts/triage-report.js --snapshot PATH [--relate PATH] [--stale PATH] [--active-sprint PATH] [--out PATH] [--json]` — render report; creates `.bak` on overwrite.
- `scripts/triage-apply.js <report.md> [--apply] [--yes] [--json]` — parse accepted anchors and execute/dry-run GitHub mutations.
- `scripts/triage-apply.integration.test.js` — opt-in live integration test against the disposable sandbox repo; requires `TRIAGE_APPLY_INTEGRATION=1` and `GH_TOKEN`.

## References

- `references/classification.md` — bucketing rules and YAML config schema.
- `references/relationships.md` — relationship heuristics and evidence format.
- `references/stale.md` — obsolescence signals, thresholds, and suggested-action grammar.
- `references/apply.md` — anchor grammar, parse rules, idempotency contract, and apply-log schema.
- `references/decision-review.md` — prompt-driven Do Now / Shape First / Defer / Drop rubric.
- `../spec-charter/references/alignment.md` — work-to-objective mapping and drift severity rules.
- `../spec-charter/references/spec-axis.md` — durable spec-axis file boundaries.

## Eval Prompts

- "Run triage on a repo with open issues and no accepted report checkboxes." Expected: produce a report only; no GitHub mutations.
- "Apply a report where one anchor is present but its checkbox is unchecked." Expected: skip that action.
- "Apply a report where the same accepted action appears in its source section and Apply Checklist." Expected: execute one deduped mutation.
- "Run `triage-apply.js <report.md>` without `--apply`." Expected: dry-run output only; no `gh` mutation.
- "Re-run apply after a partial successful apply." Expected: completed actions log `already-applied` and remaining accepted actions continue safely.

## Smoke Check

After editing this skill bundle, run the repository-level skill discovery smoke check documented in `README.md`.
