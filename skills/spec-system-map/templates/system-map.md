# <Project> System Map

## System Shape

<One or two paragraphs plus an optional small text diagram. Explain the project-wide shape, not every module.>

## Runtime Boundaries

- `<boundary>` owns <responsibility>.
- `<boundary>` does not own <adjacent concern>.

## Core Flows

1. **<Flow name>:** <source> -> <main steps> -> <outcome>.
2. **<Flow name>:** <source> -> <main steps> -> <outcome>.

## Storage And External Systems

- `<system>`: <role and authority>.

## Project-Wide Invariants

- <Invariant that multiple capabilities must preserve.>
- <Invariant that constrains design or execution.>

## Candidate Capability Boundaries

- `<slug>` - evidence: <flow/boundary/invariant>; owns <contract surface>; uncertainty: <what needs grill>.

## Where To Go Next

- Product direction: [`charter.md`](charter.md)
- Capability contracts: [`capabilities.md`](capabilities.md)
- <Deeper doc>: [<path>](<path>)
