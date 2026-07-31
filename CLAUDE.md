# dev-backlog

GitHub Issues + local sprint execution files for Claude Code / Codex.

`README.md` is the human quick start. `skills/*/SKILL.md` files are the agent execution contracts.

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

The `spec-charter`, `spec-system-map`, and `spec-grill` skills moved to [craftkit](https://github.com/sungjunlee/craftkit); this repo consumes their output files (`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`) but no longer ships the skills themselves.

## Key Design Decisions

- **GitHub Issues = source of truth** for task definitions (what to do)
- **Sprint files = execution hub** (how to do it, context, notes, progress)
- **No required GitHub task mirror** — resolve task intent and AC from live Issues
- **Legacy task export is explicit** — `sync-pull --legacy-export` is rollback/diagnostic material only
- **Backlog.md compatible** — legacy task exports follow Backlog.md shape; sprints/ is a custom addition
- **Cross-platform** — works on Claude Code and Codex (both have `gh` CLI)
- **No hidden sync** — provider writes and legacy exports are deliberate operations

## Two-Layer Architecture

```
GitHub (what)  ↔  gh CLI  ↔  backlog/sprints/ (how + context)
                              backlog/tasks/   (optional legacy export)
```

## Project Spec Home

Durable project specs live under `spec/`: `charter.md`, `system-map.md`, and `capabilities.md`. Root `CHARTER.md` is legacy fallback only.

## Working on This Project

- All content in English (Korean in trigger keywords only)
- Keep README focused on the human quick start; keep `SKILL.md` under 250 lines as the agent execution contract
- Test changes by simulating real task management scenarios against GitHub repos
- Match prompt-builder quality: practical, not ceremonial
