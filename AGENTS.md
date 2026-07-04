# dev-backlog

GitHub Issues + local sprint execution files for Claude Code / Codex.

## Project Structure

```
skills/
  backlog-triage/
    SKILL.md               ← Open-issue grooming contract
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node)
  dev-backlog/
    SKILL.md               ← Core process (~194 lines)
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node + bash)
```

The `spec-charter`, `spec-system-map`, and `spec-grill` skills moved to [craftkit](https://github.com/sungjunlee/craftkit); this repo consumes their output files (`spec/charter.md`, `spec/system-map.md`, `spec/capabilities.md`) but no longer ships the skills themselves.

## Key Design Decisions

- **GitHub Issues = source of truth** for task definitions (what to do)
- **Sprint files = execution hub** (how to do it, context, notes, progress)
- **Task files = thin GitHub mirror** (sync cache, AC checkboxes only)
- **Backlog.md compatible** — task file format follows Backlog.md; sprints/ is a custom addition
- **Cross-platform** — works on Claude Code and Codex (both have `gh` CLI)
- **Explicit sync** — pull/push is manual; no silent background sync

## Two-Layer Architecture

```
GitHub (what)  ↔  gh CLI  ↔  backlog/sprints/ (how + context)
                              backlog/tasks/   (thin mirror)
```

## Project Spec Home

Durable project specs live under `spec/`: `charter.md`, `system-map.md`, and `capabilities.md`. Root `CHARTER.md` is legacy fallback only.

## Working on This Project

- All content in English (Korean in trigger keywords only)
- Keep SKILL.md under 250 lines
- Test changes by simulating real task management scenarios against GitHub repos
- Match prompt-builder quality: practical, not ceremonial
