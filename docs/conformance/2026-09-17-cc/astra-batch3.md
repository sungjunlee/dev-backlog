1. **ACTIONS:** Read `_context.md` and the active sprint; run installed-skill `scripts/status.sh --json` and `scripts/next.sh --json` from the repo root; read the next Issue live with `gh issue view N --json body,comments`. Report Plan state and next actionable batch.
**MUTATIONS:** None.
**STOP/ASK:** No; if GitHub fails, report provisional local status and stop task execution.

2. **ACTIONS:** Read existing context and active scope; determine whether the proposed work belongs in the existing track. Use `scripts/sprint-init.js` only for a genuinely separate, disjoint track; honor its overlap refusal.
**MUTATIONS:** Add authorized work to the existing Plan with a Progress note, or create a disjoint sprint. Never bypass overlap protection or reactivate completed history.
**STOP/ASK:** Ask if combining work or changing scope requires a user decision; stop creation of an overlapping sprint.

3. **ACTIONS:** Read `_context.md` and both sprint files; run `scripts/status.sh --json` and `scripts/next.sh --json` for the portfolio, then use `--track auth` and `--track billing` as needed. Verify next Issues live.
**MUTATIONS:** None.
**STOP/ASK:** No; disjoint active tracks are valid. Report each track’s state and next batch without arbitrarily selecting one.

4. **ACTIONS:** Read the three live Issues and applicable bundled fallback guidance. Their required ordering admits a sprint; run `node <skill>/scripts/setup-dev-backlog.js`, then `node <skill>/scripts/sprint-init.js "topic"`; write a Goal and three sequential batches with estimates and complete `#N` references.
**MUTATIONS:** Create `.dev-backlog/` and the active sprint; leave GitHub unchanged unless an explicit task-definition correction is needed. Do not invent spec files or require craftkit.
**STOP/ASK:** No if the Issues provide sufficient requirements; stop execution on failed live reads, and ask only about material missing requirements.

5. **ACTIONS:** Read `gh issue view N --json body,comments`, resolve specification precedence, implement directly, verify AC, and create a PR. Re-read the live Issue before completion and close with `gh issue close` after verified completion.
**MUTATIONS:** Implementation files, deliberate Issue AC/lifecycle updates, and PR; no sprint or `.dev-backlog/` bootstrap solely for this task.
**STOP/ASK:** No; neither a spec axis nor Relay is required. Failed GitHub reads stop execution.

6. **ACTIONS:** Run `gh issue view 42 --json body,comments`; follow any body `spec_ref:` first, otherwise the newest `## Agent Brief`, otherwise the body. Implement and verify all three AC against the effective specification; re-read before completion.
**MUTATIONS:** Implementation files and explicitly verified Issue checkboxes/lifecycle. If already admitted to a sprint, update its Plan pointer, state, and Progress; create no local task copies.
**STOP/ASK:** No unless requirements are materially ambiguous or a required authoritative read fails.

7. **ACTIONS:** Check for `_context.md` and active sprints; run `scripts/status.sh --json` and `scripts/next.sh --json`. With no sprint, use live GitHub Issues to identify the next actionable Issue; read its effective specification.
**MUTATIONS:** None during orientation; absence of local task files does not require bootstrap or reconstruction.
**STOP/ASK:** No for orientation. Ask if priorities cannot be determined; stop execution if GitHub reads fail.

8. **ACTIONS:** Read available `_context.md`, sprint files, and repo evidence to describe local execution context; diagnose GitHub unavailability. Clearly identify live task status and specification as unverified.
**MUTATIONS:** None.
**STOP/ASK:** Stop task execution and AC/lifecycle changes until a live GitHub read succeeds; request access restoration if needed. Local files cannot substitute for Issue authority.

9. **ACTIONS:** Re-read planned Issues live and verify completion against current specifications; finish any incomplete tasks first. Run `scripts/sprint-close.sh` with `--track` when needed; it runs the doctor and finalizes the sprint. After success, promote reusable project context to `_context.md`.
**MUTATIONS:** Necessary verified Issue/Plan completion updates; sprint becomes completed with final Progress; `_context.md` receives future-relevant context. Preserve the completed sprint as history.
**STOP/ASK:** No if completion checks pass; stop closure for unfinished work or failed required live reads. Local task files are unnecessary.

10. **ACTIONS:** Re-read `gh issue view N --json body,comments`, resolve specification precedence again, compare changes with the implementation, and adjust work and verification to the current AC before completion.
**MUTATIONS:** Necessary implementation changes and deliberate AC updates; record consequential decisions and progress in an admitted sprint. Do not overwrite newer requirements with stale text.
**STOP/ASK:** Ask if the change introduces conflicting requirements or materially changes authorized scope; otherwise continue. Failed live reads stop execution and lifecycle changes.

11. **ACTIONS:** Recognize the legacy active sprint; read its context, Plan, and `backlog/config.yml`, then verify referenced Issues live. Check bundled layout guidance and script usage before relying on `scripts/status.sh` / `scripts/next.sh` against that layout.
**MUTATIONS:** None for orientation; do not treat missing `.dev-backlog/` as missing execution history. When bootstrap is needed, `scripts/setup-dev-backlog.js` migrates sprints/config/triage while leaving legacy tasks/docs/completed in place.
**STOP/ASK:** No for read-only orientation; report any tooling limitation and stop task execution if GitHub is unavailable.