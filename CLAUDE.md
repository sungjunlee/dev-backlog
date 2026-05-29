# dev-backlog

GitHub Issues + local sprint execution files for Claude Code / Codex.

`README.md` is the human quick start. `skills/*/SKILL.md` files are the agent execution contracts.

## Project Structure

```text
skills/
  spec-charter/
    SKILL.md               ← spec/charter.md create/amend + reassess contract
    references/            ← Amendment, alignment, objective, reassess specs
    templates/             ← Runtime charter template
  spec-system-map/
    SKILL.md               ← spec/system-map.md high-level system map contract
    templates/             ← Runtime system-map template
  spec-grill/
    SKILL.md               ← spec/capabilities.md grill contract
    references/            ← Capability heuristics + spec-system research
    scripts/               ← Brownfield signal extraction helper
    templates/             ← Runtime capabilities template
  backlog-triage/
    SKILL.md               ← Open-issue grooming contract
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node)
  dev-backlog/
    SKILL.md               ← Agent execution contract (keep under 250 lines)
    references/            ← Detailed specs (on-demand)
    scripts/               ← Deterministic helpers (node + bash)
```

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
- Keep README focused on the human quick start; keep `SKILL.md` under 250 lines as the agent execution contract
- Test changes by simulating real task management scenarios against GitHub repos
- Match prompt-builder quality: practical, not ceremonial
