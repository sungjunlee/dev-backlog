# Mirrorless GitHub Pilot

Issue: [#347](https://github.com/sungjunlee/dev-backlog/issues/347)

This runbook proves that live GitHub Issues plus optional sprint files preserve
task intent and execution continuity without `backlog/tasks/` or
`backlog/completed/`. Run two sprints across two or three consuming
repositories before declaring the pilot complete.

## Invariants and Stop Conditions

- Do not create or update task mirrors during normal work.
- Resolve task intent, AC, lifecycle, source reference, and source revision with
  `effective-task-spec.js`.
- Use Issue to PR directly for simple work. Add a sprint only for multi-issue,
  multi-session, parallel, or handoff-heavy execution.
- Keep existing mirrors byte-for-byte read-only during the pilot.
- Stop immediately if a fresh session cannot recover AC, task intent,
  canonical lifecycle, or an in-flight owner/pointer without a mirror.
- A stopped repository returns to the rollback procedure below before more
  state transitions occur.

## Measurement Protocol

Record one baseline observation using the repository's previous workflow and
one mirrorless observation for the same session type. Start timing from a fresh
session with only repository files and authenticated GitHub access. Stop when
the operator can name the next action, its effective AC, lifecycle, and any
in-flight owner/pointer.

Count tool calls at the user-visible command/API boundary. A blocking incident
is any failure that prevents safe continuation, not a retry that preserves all
authority and execution state.

Use one JSON Lines record per observation:

```json
{
  "schema_version": 1,
  "repository": "OWNER/REPO",
  "sprint": "backlog/sprints/YYYY-MM-topic.md",
  "mode": "baseline|mirrorless",
  "observed_at": "2026-08-01T00:00:00Z",
  "orientation_ms": 0,
  "tool_calls": 0,
  "blocking_incidents": 0,
  "task_refs": ["#42"],
  "effective_sources": [
    {
      "ref": "#42",
      "source_ref": "https://github.com/OWNER/REPO/issues/42",
      "source_revision": "sha256:...",
      "acceptance_criteria_count": 0,
      "lifecycle": "open"
    }
  ],
  "in_flight": [
    {
      "ref": "#42",
      "owner": "agent-or-human",
      "pointer": "PR #99|branch:name|run-id:value"
    }
  ],
  "state_transitions": [
    {
      "ref": "#42",
      "canonical_write": "issue|pull_request",
      "sprint_write": false,
      "mirror_write": false
    }
  ],
  "loss_checks": {
    "acceptance_criteria": "pass|fail",
    "task_spec": "pass|fail",
    "lifecycle": "pass|fail",
    "handoff": "pass|fail"
  },
  "notes": ""
}
```

Store observations in a pilot-specific artifact chosen by the operator; do not
commit credentials, private Issue text, or generated task mirrors. The pilot
summary must include:

| Repository | Sprint | Baseline orientation | Mirrorless orientation | Baseline calls | Mirrorless calls | Blocking incidents | Loss checks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `OWNER/REPO` | `YYYY-MM-topic` | pending | pending | pending | pending | pending | pending |

Completion requires two real sprint execution episodes across two or three
repositories, zero failed loss checks, and no transition where a normal
contributor updates the Issue, mirror, and sprint for the same state. The
observed sprints may remain active; the pilot measures recoverability during
real execution rather than requiring unrelated sprint closure.

## Pilot Observations — 2026-07-31

The two real-repository observations exercised fresh-session orientation inside
active sprints. They satisfy the recovery baseline but do not yet satisfy the
state-transition portion of the pilot.

| Repository | Active sprint / task | Orientation (base/post) | Calls (base/post) | AC / task spec / lifecycle / handoff | Mirror writes | Resolver blockers |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| `sungjunlee/aibris` | `2026-07-agent-state-store-coverage` / `#139` | 0.88 s / 1.94 s | 2 / 2 | pass / pass / pass / pass | 0 | 0 |
| `sungjunlee/dear-scene` | `2026-06-m5-concierge-pilot` / `#267` | 0.50 s / 1.96 s | 2 / 2 | pass / pass / pass / pass | 0 | 0 |

The baseline totals combine `status` plus mirror grep (aibris: 0.87 s +
0.01 s; dear-scene: 0.40 s + 0.10 s). Mirrorless totals combine `status` plus
the live resolver (aibris: 0.87 s + 1.07 s; dear-scene: 0.40 s + 1.56 s).
Mirrorless was slower in both observations, but #347 has no speed gate and the
live read removed stale-authority risk.

- aibris recovered all eight live AC with source revision prefix
  `sha256:97685a`, recovered its in-flight branch pointer, passed doctor, and
  left the worktree clean.
- dear-scene exposed material drift: the legacy mirror contained seven AC with
  four checked, while the live Issue contained eight AC, all unchecked, with
  source digest prefix `267882`. The live Issue correctly won. Doctor also
  reported a pre-existing sprint-shape failure and two unmoored/stale warnings;
  these were recorded as repository health findings, not resolver stop
  conditions. The worktree remained clean.
- A dry run against the real aibris sprint copied to a temporary mirrorless
  fixture (no `tasks/` or `completed/`) exited zero and printed
  `No legacy task mirrors required`.

No resolver-related blocking incident occurred. The dear-scene authority drift
is positive evidence for removing mirrors from orientation, not a reason to
restore mirror fallback. Both observations were read-only orientation episodes,
so they performed no lifecycle state transition and wrote neither a mirror nor
a sprint. The default workflow and CLI gate prevent a normal contributor from
adding a mirror write to later Issue/sprint transitions, but two controlled
real-repository state-transition episodes remain required before declaring
#347 complete.

## Rollback

Rollback restores a diagnostic projection; it never changes task authority.

1. Stop work before the next task or lifecycle transition.
2. Capture the failing command, task ref, live Issue URL, resolver error, and
   current sprint status/Plan/Progress. Do not edit an existing mirror.
3. Verify GitHub still owns task specification and lifecycle.
4. Export a fresh projection explicitly:

   ```bash
   node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js \
     --legacy-export --dry-run
   node /path/to/dev-backlog/skills/dev-backlog/scripts/sync-pull.js \
     --legacy-export
   ```

5. Use the export only to compare bytes and diagnose resolver loss. Never
   execute from it or push its checkbox/status state back to GitHub.
6. Repair and test the resolver, then prove that the live Issue recovers the
   same effective spec, AC, lifecycle, and source revision semantics.
7. Resume mirrorless work only after a fresh-session rehearsal passes. Record
   the incident in the pilot data and retain the old mirrors read-only until
   the pilot decision is made.

If GitHub itself is unavailable, sprint JSON may still recover execution
continuity and in-flight pointers. Task intent, AC, and lifecycle remain
unresolved; wait for live authority rather than treating an export as fallback.
