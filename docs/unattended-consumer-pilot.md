# Unattended Consumer Session Contract (Pilot)

Status: pilot (issue #238)
Date: 2026-07-04

This document is the session contract an external trigger (cron, CI, a scheduled agent, a goal/loop harness) hands to an unattended agent session running in a dev-backlog-managed repo. dev-backlog deliberately does not own the trigger (charter Non-Goals: no daemon, no silent sync); it owns this contract and the machine surfaces the session consumes.

Authority chain: this contract summarizes rules that live in `skills/dev-backlog/references/integration-contract.md` (consumption contract, trace grammar, JSON schema), `spec/charter.md` (O5 wording, Non-Goals), and `spec/capabilities.md` (backlog-sync Hard Constraints). Where this file and those disagree, those win.

## Session prompt

Give the unattended session this task, verbatim or adapted:

> You are an unattended maintenance session for this repository. Using repo files and the commands below — no conversation history, no humans available — produce an **orientation and health report** as a single markdown document. Do not modify specs, issues, code, or sprint files. The only permitted GitHub write is `sprint-mirror.js` (machine-managed marker bodies only), and only when an active sprint exists.

## What the session MAY do

| Action | Command | Notes |
| --- | --- | --- |
| Orient | `bash skills/dev-backlog/scripts/status.sh --json`, `bash skills/dev-backlog/scripts/next.sh --json` | Single source: `sprint-state.js` JSON (`schema_version: 1`). Do not parse sprint markdown directly. |
| Health check | `node skills/dev-backlog/scripts/backlog-doctor.js --json` | Hard failures exit non-zero; soft signals warn. Zero active sprints is a warn (normal between sprints), not an error. The reassess signal is a top-level field: `reassess_signal: { fired, reason, sprints_since_last_report, latest_report }` — no separate computation needed. |
| Publish mirror | `node skills/dev-backlog/scripts/sprint-mirror.js backlog --json` | Only when an active sprint exists; idempotent marker-body upsert. Skip cleanly when the doctor reports no active sprint. |
| Spec drift review | `spec-charter reassess` (report-only) | Only when the doctor or close-signal state recommends it; output is a dated report under `backlog/triage/`, never a spec edit. |

## What the session MUST NOT do

- Run `spec-charter amend`, `spec-grill`, or edit anything under `spec/` — spec mutation is human-gated (charter O5; system-map invariant "automation is report-only toward spec/*").
- Dispatch, review, or merge work (relay or otherwise), close issues, or edit sprint/task files — state transitions belong to attended sessions or explicitly delegated executors with their own contracts.
- Write to GitHub beyond `sprint-mirror`'s own marker-identified bodies (backlog-sync Hard Constraint: human-authored content is untouchable).
- Install dependencies, change git state (commit/push), or leave any working-tree modification behind.

## Required report shape

```md
# Unattended report — YYYY-MM-DD HH:MM
## Orientation
- Active sprint: <path + goal, or "none — between sprints">
- Next actionable batch: <heading + items, or "n/a">
- In-flight: <each [~] item with its PR/branch/run pointer and age, or "none">
## Health
- Doctor verdict: <pass|warn|fail> — <one line per non-pass check>
- Reassess signal: <`reassess_signal.fired` -> fired/quiet, plus `reassess_signal.reason`, from the doctor JSON — do not recompute>
## Actions taken
- <mirror synced #N / skipped (no active sprint) / reassess report written>
## Anomalies for a human
- <anything the contract did not cover, or "none">
```

## Escalation rule

When the session encounters state this contract does not cover — a hard doctor failure, an unparseable file, a command exiting unexpectedly — it stops taking actions, records the observation under "Anomalies for a human", and finishes the report. It never improvises a fix.

## Pilot verification (issue #238)

The pilot run hands this contract to a fresh-context agent and an orchestrator verifies the report against ground truth: active-sprint identity, doctor verdict, in-flight pointers, and reassess-signal state must all match. Findings feed future trigger-ownership and O6 decisions; they do not change this contract mid-run.
