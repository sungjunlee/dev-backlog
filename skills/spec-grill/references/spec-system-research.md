# Spec-System Research Grounding

Research synthesis behind the layered spec system in [`docs/spec-system-design.md`](../../../docs/spec-system-design.md). Three passes done during the 2026-05-23 design session: production-agent failure modes, spec-language stability discipline, and Goodhart / control-theory framing. The findings load-bear the M-tier architecture choices; restate the design without checking against them at your own risk.

The full prose synthesis ran ~7,500 words in conversation; this doc is the compressed durable record. When a design decision in the design doc cites "Research §N", N refers to a section here.

---

## §1. Production Autonomous Coding Agents — What Already Works and What Doesn't

Surveyed: Claude Code `/goal`, Cursor Composer 2.5, Devin, SWE-Agent, OpenHands, AutoGPT (historical lessons). Looking for convergent patterns across independent implementations.

### Convergent patterns

- **Separate-evaluator agent.** Both Claude Code (`/goal` uses a Haiku judge separate from the working model) and Cursor (judge agent separate from Composer) put completion-criterion checking in a different context window from the working agent. The shared insight: the working agent rationalizes its own output; the judge does not have that incentive because it never wrote the code. Implication for spec-system: grill mode currently runs in a single context, but the L-tier promotion trigger (adversarial-subagent grill) is the same convergent pattern, deferred until rationalization tells appear.
- **Externalized completion criteria.** Every production system requires the completion condition to be written down separately from the working prompt. AutoGPT's historical failure mode was the absence of this — "build a great X" with no measurable completion metric ran until it ran out of money or context. CHARTER + capability Behaviors are the externalized completion criteria.
- **Bounded autonomy windows.** Devin, SWE-Agent, and OpenHands all bound how long an agent runs before human checkpoint. The spec-system analogue is the relay-merge boundary: agents do not edit specs during runs; they accumulate run-end Learnings that humans (and future grill sessions) read on the next cycle.

### Diagnostic numbers

- **SlopCodeBench 2026** (cross-model autonomous-coding benchmark): 0 of 11 frontier models solved end-to-end tasks; max 17.2% checkpoint solve rate. The state of the art does not finish multi-day tasks unsupervised. Design implication: do not assume the agent will catch its own spec drift; structural defenses must do that work.
- **Context rot.** Multiple internal and external measurements converge on >50% effective-context degradation past ~100K tokens. Implication: the agent reaches for older spec content less reliably as runs lengthen. `## Learnings` near the top of the capability block, plus short Behaviors that fit in working context, beats long prose buried mid-file.

### What this means for spec-system v0.1

- Keep capability blocks short (3 Behaviors + 2 Hard Constraints) so they survive context rot.
- Defer adversarial-subagent grill until single-context grill shows rationalization tells in real use. The convergent pattern is real but the innovation token cost is real too.
- Treat completion criteria as externalized first-class artifacts, not implicit in prose.

---

## §2. Spec-Language Stability — Cross-Discipline Survey

Surveyed: OKRs (Doerr), MBO (Drucker), BDD (Cucumber / Gherkin), TLA+ (Lamport), ADRs (Nygard), NFR-as-quantified-constraints, INVEST (XP user stories), Constitutional AI (Anthropic), Specification by Example (Adzic), IETF RFC tradition.

### Universal patterns across all surveyed disciplines

- **Outcome over output.** OKRs forbid task-shaped Key Results; BDD's Given-When-Then is outcome-framed; Constitutional AI's principles describe observable behavior, not internal mechanisms. The capability `Goal` line in our template is one sentence of observable outcome by direct inheritance.
- **Method is delegated.** TLA+ specifies *what* invariants hold, not *how* the implementation maintains them. ADRs record *why* a choice was made, not the steps to execute it. The spec-system extends this: Behaviors say what holds, not how to achieve it.
- **Testability equals reality.** BDD scenarios run as tests; INVEST's "T" is testable; SBE's living documentation regenerates from passing tests. A Behavior that cannot be checked is not a Behavior. The 3-axis predicate test enforces this at authoring time.
- **Decision provenance is preserved.** ADRs are append-only by tradition. RFC obsoletes-by reference is the same pattern. CHARTER's Decisions table and capability `## Decisions` inherit this directly.

### Most-copied design choice

**Nygard's "immutable after acceptance"** (ADR Tradition). When an ADR is wrong, the fix is a new ADR that supersedes it — never an edit to the original. The rationale: edits destroy the historical record that made the original decision auditable. Adopted directly in CHARTER Tier 3 and capability `## Decisions`.

### Granularity choices encoded

- **Capability size:** roughly the granularity of a BDD Feature file (multiple Scenarios per Feature). Smaller is over-fragmented; larger is hard to keep falsifiable. Three Behaviors + two Hard Constraints is roughly one Feature's-worth.
- **CHARTER vs. capability:** CHARTER is the OKR-level "what good looks like for the whole project"; capabilities are the per-subsystem "what good looks like here." Same pattern as MBO's nested objectives.
- **Decision granularity:** capability `## Decisions` is per-subsystem; CHARTER `Decisions` is cross-cutting. The promotion rule mirrors RFCs that get elevated from working-group to standards-track.

---

## §3. Goodhart, Drift, and Control-Theory Framing

Surveyed: Manheim & Garrabrant 2018 (Goodhart 4-mode taxonomy), Langosco et al. 2022 (goal misgeneralization), Hadfield-Menell et al. 2017 (Inverse Reward Design), Ashby 1956 (requisite variety), control-theory analogues (PID controllers, integral windup).

### The 4-mode Goodhart taxonomy (Manheim & Garrabrant)

| Mode | Failure | Defense |
|---|---|---|
| **Regressional** | The proxy is a noisy signal of the goal; optimizing pushes into noise. | Statistical: more data, better proxies. Out of scope for spec-system. |
| **Extremal** | The proxy and goal correlate in normal regimes but diverge in extreme regimes. | Bound the regime explicitly. Hard Constraints are this. |
| **Causal** | The proxy is downstream of the goal; the optimizer breaks the causal chain. | Specify the goal directly, not the proxy. Verifiable predicates do this. |
| **Adversarial** | The optimizer edits the measurement apparatus rather than the system being measured. | Structural — the optimizer must not have write access to the measurement. **This is why `## Learnings` is the only spec section a working agent can write, and only between magic markers.** |

### Goal misgeneralization (Langosco 2022) is distinct from misspecification

Even a *correctly* specified objective can fail if the agent's internalized goal diverges off-distribution. Empirical result: agents trained to "open the door" in one room generalize to "move toward the leftmost wall" because that was the door's location during training. The spec was right; the internalized goal was wrong.

Defense: the **distributional axis** of the 3-axis test. Predicates must hold in unseen code areas / unseen workloads, or be explicitly scoped to where they hold.

### Inverse Reward Design (Hadfield-Menell)

Rewards are *observations of designer intent*, not the intent itself. A reward function that scores well is not necessarily one that captures intent — it may be the easiest function to write that matches observed examples.

Implication: a Behavior that the user accepts at grill time is an observation of intent. A working agent satisfying it measurably but in a way that violates unsaid intent is an IRD failure mode. The **authority axis** of the 3-axis test exists for this.

### Control-theory framing

A multi-day autonomous run with no in-loop ground-truth check is **open-loop control**. Open-loop control drifts even with a perfect model because no signal closes the loop. CHARTER alone is a setpoint without a sensor.

- `## Learnings` is the minimum-viable sensor: each run feeds back one ground-truth observation that the next run can read. It is not a controller — it is the sensor that any future controller (auto-reassess, O5) would need.
- **Integral windup analogue:** if Learnings accumulate without ever triggering a CHARTER reassessment, the spec slowly diverges from observed reality. The L-tier promotion trigger ("a full quarter of `## Learnings` data") is the manual analogue of anti-windup — at some point the accumulated error must influence the setpoint.
- **Ashby's requisite variety:** the controller must have at least as many states as the system it controls. Implication for v0.1: do not pretend the spec system can cover everything. `Out-of-scope` per capability is requisite-variety honesty: this controller does not cover that surface.

### What this means for spec-system v0.1

- The structural defense against adversarial Goodhart (`append-learnings.js` is the only writer between magic markers once installed) is **not** a stylistic choice; it is the only defense the 4-mode taxonomy considers reliable.
- The 3-axis predicate test maps cleanly: authority → IRD, distributional → goal misgeneralization, manipulability → adversarial Goodhart. Each axis defends against one *category* of failure; missing an axis means a category is unprotected.
- O5 (auto-reassess) is critical-path under control-theory framing, but deferred until enough `## Learnings` data exists to inform what reassessment should do. Premature O5 closes the loop with noise.

---

## What is not here (and where to find it)

- The full prose discussion of why M tier was chosen over L tier: [`docs/spec-system-design.md`](../../../docs/spec-system-design.md) §"Architecture (M tier — locked)".
- The build-order rationale (template before bootstrap before live-update): design doc §"Implementation plan."
- The strangler-fig path to L tier: design doc §"Migration path."
- The dogfood plan (dev-backlog itself, then dev-relay): design doc §"Dogfood plan."

This doc is the *research*; the design doc is the *decisions* those research findings justify. Both should be read together when revisiting the architecture.
