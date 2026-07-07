# Spec-axis fallback (consumption-side)

How `dev-backlog` and `backlog-triage` **behave** when the spec axis (`spec/charter.md`, `spec/capabilities.md`, `spec/system-map.md`) is thin or absent — e.g. a cold adopter who has not installed craftkit and has no `spec/` files. Both skills share this one file (it ships in the dev-backlog bundle).

This is a **reference, not a spec**. It does not author spec-axis semantics — those live in craftkit's `spec-charter` (charter Decision 2026-07-04). Keep it to one page; it must never grow into a second spec-axis authority.

## Charter resolution (stated once)

`spec/charter.md` is canonical. If it is absent, fall back to the legacy root `CHARTER.md`. If **both** are absent, no charter axis exists — Objective IDs cannot be claimed, and charter-dependent work degrades per the matrix below. This is the only place the `CHARTER.md` fallback rule is stated.

## Degradation matrix

`objectives:` references charter Objective IDs (`O1`…); `component:` is one capability slug from `spec/capabilities.md`.

| charter | capabilities | `objectives:` | `component:` |
| --- | --- | --- | --- |
| present | present | Objective IDs the sprint advances | one capability slug |
| present | absent  | Objective IDs | omit the field (no slug to route to) |
| absent  | present | omit the field (no IDs to claim) | one capability slug |
| absent  | absent  | omit the field | omit the field |

"Omit the field" is the target behavior (`sprint-init` from #258 on). An empty `objectives: []` / `component: ""` reads identically — it claims nothing — and stays valid; `objectives-check` and `component-lint` pass either way when the spec file is absent.

## Triage degradation (never silent)

`backlog-triage` uses charter, capabilities, and system-map as bounded evidence. When a tier is missing it degrades **visibly** — every skip is a report line, never an omission:

- **Alignment Check** maps open issues to active charter Objectives. No charter (both files absent) → render `## Alignment` as *"skipped because no charter (spec/charter.md and root CHARTER.md both absent)."* Never invent Objective IDs.
- **Decision Review** emits report-only recommendations from whatever evidence exists. For each missing tier, add a line naming it — *"capabilities absent"*, *"system-map absent"* — so the reader knows which evidence backed the call. Recommendations still come from the available tiers (sprint + issues at minimum); the report states the evidence tier it used.

## When craftkit is installed (enhancement, never required)

Authoring semantics and the durable spec-axis boundaries live in craftkit's `spec-charter` skill. When craftkit is installed alongside this skill, its `references/spec-axis.md` (file boundaries) and `references/alignment.md` (work→objective mapping and drift severity) **deepen** the rules above. They are never required: everything a cold adopter needs to reach a first closed sprint is on this page.
