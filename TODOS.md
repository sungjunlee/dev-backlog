# TODOS

## Surface sprint file format constraints in README

**What:** Add a callout or section noting that sprint file section names (`## Plan`, `## Running Context`, `## Progress`) and checkbox patterns (`[ ]`, `[~]`, `[x]`) are load-bearing for dev-relay automation. Users should not treat the sprint file as fully freeform markdown.

**Why:** Users who edit sprint files without knowing the format constraints will silently break dev-relay interop. The integration contract doc covers this but it's not discoverable from the README.

**Effort:** S | **Priority:** P2 | **Depends on:** README repositioning shipped

## Add Codex-specific usage example

**What:** Add a Codex usage example alongside the Claude Code hook example, showing how Codex users can use dev-backlog scripts and sprint files in their workflow.

**Why:** The README currently demonstrates Claude Code more strongly than Codex. If the target reader is "AI agent users broadly," cross-platform examples strengthen the positioning.

**Effort:** S | **Priority:** P3 | **Depends on:** nothing
