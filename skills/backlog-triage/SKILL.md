---
name: backlog-triage
argument-hint: "[collect|report|apply] [options]"
description: Triage open GitHub Issues into an advisory report. Use for issue grooming, stale or obsolete detection, relationship mapping, priority and milestone proposals, accepted-action apply, 백로그 정리, 이슈 검토, 트리아지.
compatibility: Requires gh CLI and git. Works on Claude Code and Codex.
metadata:
  related-skills: "spec-charter, dev-backlog, relay, relay-plan"
---

# Backlog Triage

Real job: inspect open GitHub Issues, produce an advisory triage report, and apply only human-accepted issue mutations through stable anchor comments.

Sibling skill to `dev-backlog`, not a replacement. `dev-backlog` owns sprint execution. `backlog-triage` owns open-issue classification, relationships, stale signals, priority/milestone proposals, and optional accepted GitHub mutations.

GitHub Issues remain the source of truth. The report is a derived artifact under `backlog/triage/`. Report mode is always safe to rerun. Apply is opt-in.

## Report

Default invocation. Read-only toward GitHub.

1. **Collect.** Run `triage-collect.js` from the target project root. Done when one snapshot JSON exists under `backlog/triage/.cache/` and later steps use `--snapshot PATH` without re-fetching.
2. **Judge.** Read the snapshot, the resolved charter (`spec/charter.md`, else legacy root `CHARTER.md`), optional `spec/capabilities.md` and `spec/system-map.md`, and any active sprint. Write a `--model-actions` JSON file. Done when every judged proposal is a valid action object in that file. Issues that declare mutual exclusivity stay unscheduled; never `assign-milestone` into an active or wait-gated milestone; emit one relationship edge per fact, in the direction the evidence phrase states (`references/relationships.md`).
3. **Render.** Resolve any `status: active` sprint file under `backlog/sprints/`. Run `triage-report.js --snapshot PATH --model-actions PATH`, and pass `--active-sprint PATH` whenever an active sprint exists — stale close candidates now come from the snapshot by default, so omitting that flag proposes closes against in-flight Plan/Running Context issues. Pass `--relate` / `--stale` only to override those signals. Done when the markdown report exists under `backlog/triage/` with Classification, Relationships, Obsolete Candidates, Priority Proposals, Milestone Suggestions, and Apply Checklist; every proposal is an anchor+checkbox pair; and no Obsolete close targets an issue named in an active sprint Plan or Running Context.
4. **Align.** Insert `## Alignment` after the renderer sections and before Apply Checklist. Spec-axis degradation lives in `../dev-backlog/references/spec-fallback.md`. When both charter files are absent, render Alignment as skipped. When craftkit is installed, `spec-charter` `references/alignment.md` deepens the mapping — an enhancement, never required. Done when every open issue maps to ≥1 Objective or is named as an orphan, and the evidence tier is named.
5. **Review.** Insert `## Decision Review` using `references/decision-review.md`. Place it after Alignment and before Apply Checklist. Done when every open issue is in Do Now, Shape First, Defer, or Drop / Close, and absent spec tiers are named rather than dropped silently.

Stop. Do not apply.

Scripts own deterministic signals (issue refs, merged-PR links, dates, labels). The model owns semantic judgment (blocks, depends-on, duplicates, priority and milestone proposals). Triage may propose charter/capability/system-map follow-ups but must not mutate those specs.

## Apply

Separate later invocation, after a human flips paired checkboxes from `[ ]` to `[x]`.

1. **Dry-run.** `triage-apply.js <report.md>` prints intended `gh` mutations. Done when the printed plan matches the checked anchors and nothing has been written.
2. **Mutate.** `triage-apply.js <report.md> --apply --yes` executes only accepted actions. An action is accepted only when its anchor exists and its paired checkbox is `[x]`. Re-runs are idempotent and log `already-applied`. Done when accepted actions are applied or logged `already-applied`, and an audit log exists beside the report.

Unknown verbs parse without crashing and are skipped. Duplicate proposal surfaces dedupe by `(verb, issueNumber, normalizedArgs)`. Grammar: `references/apply.md`.

## Anchor contract

```markdown
<!-- triage:close #42 reason="merged PR #87 already exists" -->
- [ ] close #42 - merged PR #87 already exists
```

The anchor comment is the machine contract. The paired checkbox is the human confirmation surface.

## Model-actions wire

A JSON array. Sections `priority` / `milestone` / `obsolete` carry a positive `issueNumber`, `verb`, `summary`, and `args`. Section `relationship` carries `args.from` / `args.to` / `args.kind`. `triage-report.js` validates every entry before rendering.

```json
[
  {
    "section": "priority",
    "verb": "set-priority",
    "issueNumber": 42,
    "args": { "value": "high", "reason": "customer-reported outage blocks the auth theme" },
    "summary": "Set priority:high on #42 — customer-reported outage blocks the auth theme"
  },
  {
    "section": "relationship",
    "verb": "edge",
    "args": { "from": 45, "to": 46, "kind": "blocks", "evidence": { "phrase": "Blocks #46" } },
    "summary": "Blocks edge 45 -> 46"
  }
]
```

Full verb map: `references/apply.md`. Edge direction: `A blocks B` = B cannot proceed until A resolves; `A depends-on B` = A cannot proceed until B resolves.

## Ownership

| Concern | Owner |
| --- | --- |
| Sprint files, execution plan, Running Context | `dev-backlog` |
| Milestone lifecycle | `dev-backlog` |
| AC checkboxes inside issue bodies | `dev-backlog` |
| Open-issue classification, relationships, stale flags | `backlog-triage` |
| Charter alignment of open issues | `backlog-triage` report; mutations route to `spec-charter` |
| Capability/system-map concerns | `backlog-triage` report; mutations route to `spec-grill` or `spec-charter` (`map`) |
| Priority/milestone proposals and accepted mutations | `backlog-triage` |
| Post-triage sprint planning | `dev-backlog` |

Recommended cadence: weekly or bi-weekly, then feed accepted Milestone Suggestions into the next `dev-backlog` sprint.

## Script resolution

Resolve scripts from the installed `backlog-triage` skill directory, not from the target project. In a source checkout, that is the local `scripts/` directory beside this `SKILL.md`; in an installed skill, locate the active skill directory and run the same script from there. Run scripts from the target project root. Operational scripts support `--json`. These scripts `require` shared modules from the sibling `dev-backlog` skill (`../dev-backlog/scripts/`), so both skills must be installed from the same bundle.

```bash
skill_dir="skills/backlog-triage" # source checkout; replace with the resolved installed skill dir
node "$skill_dir/scripts/triage-collect.js" --dry-run --json
node "$skill_dir/scripts/triage-report.js" --snapshot PATH --model-actions PATH [--active-sprint PATH]
node "$skill_dir/scripts/triage-apply.js" backlog/triage/YYYY-MM-DD-report.md
```

Core scripts (full flags in each script's usage string):

- `scripts/triage-collect.js` — fetch open issues to `backlog/triage/.cache/<ISO-timestamp>.json`. `--with-comments` hydrates comment bodies; `--with-closed-issues` enriches recent closed issues for duplicate judgment (`references/classification.md`).
- `scripts/triage-report.js` — render the report from `--snapshot` and `--model-actions`. Relate/stale run in-process; `--relate` / `--stale` override. Creates `.bak` on overwrite.
- `scripts/triage-apply.js` — parse accepted anchors; default dry-run; `--apply --yes` mutates.

## References

- `references/classification.md` — bucketing rules and YAML config schema.
- `references/relationships.md` — deterministic edge rules and the model-judged blocks/depends-on/duplicate rubric.
- `references/stale.md` — obsolescence signals, thresholds, and suggested-action grammar.
- `references/apply.md` — anchor grammar, parse rules, idempotency contract, and apply-log schema.
- `references/decision-review.md` — prompt-driven Do Now / Shape First / Defer / Drop rubric.
- `../dev-backlog/references/backlog-boundaries.md` — backlog-side file boundaries and ownership.
- `../dev-backlog/references/spec-fallback.md` — spec-axis degradation contract (intra-bundle; always resolvable).
- When installed, craftkit's `spec-charter` skill deepens Alignment: `references/alignment.md` and `references/spec-axis.md`. Enhancements only — never required to run triage.

## Eval Prompts

- "Run triage on a repo with open issues and no accepted report checkboxes." Expected: produce a report only; no GitHub mutations.
- "Render a report from a snapshot with no `--relate` or `--stale` files." Expected: Relationships and Obsolete Candidates still include deterministic snapshot signals (mentions, merged-PR links, date/label stale).
- "Render a report while an active sprint Plan names a stale issue." Expected: that issue is absent from Obsolete close proposals.
- "Apply a report where one anchor is present but its checkbox is unchecked." Expected: skip that action.
- "Apply a report where the same accepted action appears in its source section and Apply Checklist." Expected: execute one deduped mutation.
- "Run `triage-apply.js <report.md>` without `--apply`." Expected: dry-run output only; no `gh` mutation.
- "Re-run apply after a partial successful apply." Expected: completed actions log `already-applied` and remaining accepted actions continue safely.
