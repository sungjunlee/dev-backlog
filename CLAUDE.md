# dev-backlog

GitHub Issues as task truth + local sprint files for execution continuity, for
Claude Code / Codex. Two skills: `dev-backlog` (sprint execution) and
`backlog-triage` (advisory open-issue grooming).

`README.md` is the human quick start. `skills/*/SKILL.md` files are the agent
execution contracts. `AGENTS.md` is a symbolic link to this file, so Codex and
Claude Code read the same guidance.

## Project Structure

```text
skills/
  backlog-triage/
    SKILL.md               ← Open-issue grooming contract
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node)
  dev-backlog/
    SKILL.md               ← Agent execution contract (keep under 250 lines)
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node + bash)
```

The `spec-charter` and `spec-grill` authoring skills live in
[craftkit](https://github.com/sungjunlee/craftkit); this repo consumes
`spec/charter.md`, `spec/system-map.md`, and `spec/capabilities.md` and does
not ship those skills. `spec-charter` owns the charter and the system map.

## Key Design Decisions

- **GitHub Issues = sole task authority** — task definition, AC, and lifecycle
  resolve from the live Issue (`effective-task-spec.js`);
  no task-file directory required
- **Sprint files = execution hub, admitted by complexity** — the default path
  is sprint-free Issue → PR; a sprint exists only when execution needs
  continuity (ordered batches, handoff, cross-session context)
- **Multi-track sprints** — concurrent `status: active` tracks must declare
  provably disjoint scopes (`component:` or `scope:` globs, one shared
  `scopesOverlap` predicate); overlap fails loud
- **Deliberate mutations only** — no hidden sync. GitHub writes are explicit.
  Routing and optional-export boundaries live in
  `skills/dev-backlog/references/authority-contract.md`.
- **Prompt-judged actions ride deterministic rails** — model judgment enters
  through validated wire contracts (`--model-actions` JSON, anchor comments);
  scripts own everything checkable

## Architecture

```
GitHub Issues (what: definition, AC, lifecycle)
      ↕ gh CLI
backlog/sprints/ (how: batches, running context, progress)
```

## Project Spec Home

Durable project specs live under `spec/`: `charter.md`, `system-map.md`, and
`capabilities.md`. Root `CHARTER.md` is legacy fallback only. `spec/*`
amendments are human-gated — propose, apply only on explicit approval.

## Working on This Project

- All content in English (Korean in trigger keywords only)
- **This is a public repo** — never name private consumer repositories in
  committed content or public issue/PR text; use the stable `consumer-A`-style
  aliases (mapping lives outside this repo) and never link to private repos
- Keep README focused on the human quick start; keep `SKILL.md` under 250
  lines as the agent execution contract
- Verify with `node --test --test-concurrency=1 tests/*.test.js tests/*/*.test.js` and
  `bash skills/dev-backlog/scripts/smoke-test.sh`; the test suite includes a
  doc-drift check over script mentions
- `docs/` holds decision/proof records with a Living/Removed index in
  `docs/README.md` — git history is authoritative; do not re-read removed or
  historical docs as live contracts
- Test changes by simulating real task management scenarios against GitHub
  repos; practical, not ceremonial
