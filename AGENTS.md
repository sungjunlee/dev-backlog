# dev-backlog

GitHub Issues + local sprint execution files for Claude Code / Codex.

## Project Structure

```
skills/
  dev-backlog/
    SKILL.md               ← Core process (~194 lines)
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

## Working on This Project

- All content in English (Korean in trigger keywords only)
- Keep SKILL.md under 250 lines
- Test changes by simulating real task management scenarios against GitHub repos
- Match prompt-builder quality: practical, not ceremonial
