const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  readSprintState,
  parsePlanItem,
  parseSprintContent,
  parseArgs,
  extractSectionLines,
  textReport,
} = require(path.join(SKILL_SCRIPTS, "sprint-state.js"));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

describe("readSprintState", () => {
  let tmpDir;
  let backlogDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-backlog-state-"));
    backlogDir = path.join(tmpDir, ".dev-backlog");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits structured state for a full active sprint fixture", () => {
    const sprintPath = path.join(backlogDir, "sprints", "2026-07-json.md");
    writeFile(sprintPath, `---
milestone: JSON Sprint
status: active
started: 2026-07-01
due: 2026-07-10
objectives: [O1, O2]
component: "dev-backlog"
---

# JSON Sprint

## Goal
Expose actor-readable execution state.

## Plan
### Batch 1 - Done
- [x] #210 Preserve human output → PR #223 (merged)

### Batch 2 - Active
- [~] #211 Add JSON surfaces (~2hr) → PR #224 (reviewing)

### Batch 3 - Next
- [ ] #212 Document schema (~30min)

## Running Context
- Keep checkbox grammar stable.

## Progress
- 2026-06-30: prework without matching issue.
- 2026-07-01 09:00: #210 dispatched → PR #223
- 2026-07-01 12:00: [actor:delegate] #211 dispatched → PR #224
- 2026-07-02 10:00: #211 review pending.
- 2026-07-02 11:00: context updated.
- 2026-07-03 08:00: #210 merged.
`);

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(state.schema_version, 3);
    assert.deepEqual(Object.keys(state), ["schema_version", "active_sprints"]);
    const track = state.active_sprints[0];
    assert.equal(track.path, sprintPath);
    assert.equal(track.frontmatter.status, "active");
    assert.deepEqual(track.frontmatter.objectives, ["O1", "O2"]);
    assert.equal(track.frontmatter.component, "dev-backlog");
    assert.equal(track.goal, "Expose actor-readable execution state.");

    assert.equal(track.plan_items.length, 3);
    assert.deepEqual(track.plan_items[1], {
      ref: "#211",
      state: "in_flight",
      title: "Add JSON surfaces (~2hr)",
      pointer: {
        pr: { number: 224, state: "reviewing" },
        branch: null,
      },
    });

    assert.equal(track.next_batch.heading, "### Batch 3 - Next");
    assert.deepEqual(track.next_batch.items.map((item) => item.ref), ["#212"]);
    assert.deepEqual(
      track.latest_progress.map((entry) => entry.line),
      [
        "- 2026-07-03 08:00: #210 merged.",
        "- 2026-07-02 11:00: context updated.",
        "- 2026-07-02 10:00: #211 review pending.",
        "- 2026-07-01 12:00: [actor:delegate] #211 dispatched → PR #224",
        "- 2026-07-01 09:00: #210 dispatched → PR #223",
      ]
    );
    assert.deepEqual(track.in_flight, [track.plan_items[1]]);
    for (const removed of ["tracker", "age_days", "age_source", "age_basis_date"]) {
      assert.equal(removed in track.in_flight[0], false, `${removed} is removed`);
    }
  });

  it("returns a portfolio for multiple disjoint active tracks, ordered by started", () => {
    writeFile(
      path.join(backlogDir, "sprints", "auth.md"),
      "---\nstatus: active\nstarted: 2026-07-02\ncomponent: \"auth\"\n---\n"
    );
    writeFile(
      path.join(backlogDir, "sprints", "billing.md"),
      "---\nstatus: active\nstarted: 2026-07-01\ncomponent: \"billing\"\n---\n"
    );

    const state = readSprintState({ backlogDir });
    assert.equal(state.schema_version, 3);
    assert.equal(state.active_sprints.length, 2);
    assert.deepEqual(
      state.active_sprints.map((s) => s.frontmatter.component),
      ["billing", "auth"]
    );
  });

  it("returns a portfolio for two scopeless active tracks (cannot prove overlap)", () => {
    writeFile(path.join(backlogDir, "sprints", "a.md"), "---\nstatus: active\n---\n");
    writeFile(path.join(backlogDir, "sprints", "b.md"), "---\nstatus: active\n---\n");

    const state = readSprintState({ backlogDir });
    assert.equal(state.active_sprints.length, 2);
    assert.equal("active_sprint" in state, false);
  });

  it("skips a directory named *.md while finding active sprint files (#496, #498)", () => {
    writeFile(path.join(backlogDir, "sprints", "active.md"), "---\nstatus: active\n---\n");
    fs.mkdirSync(path.join(backlogDir, "sprints", "not-a-sprint.md"));

    const state = readSprintState({ backlogDir });
    assert.equal(path.basename(state.active_sprints[0].path), "active.md");
    assert.equal(state.active_sprints.length, 1);
  });

  it("throws OVERLAPPING_TRACKS when two active tracks share scope", () => {
    writeFile(path.join(backlogDir, "sprints", "a.md"), "---\nstatus: active\ncomponent: \"auth\"\n---\n");
    writeFile(path.join(backlogDir, "sprints", "b.md"), "---\nstatus: active\ncomponent: \"auth\"\n---\n");

    assert.throws(
      () => readSprintState({ backlogDir }),
      /Active tracks overlap on scope/
    );
  });

  it("resolves a single track by --track component handle or slug", () => {
    writeFile(
      path.join(backlogDir, "sprints", "auth.md"),
      "---\nstatus: active\nstarted: 2026-07-02\ncomponent: \"auth\"\n---\n"
    );
    writeFile(
      path.join(backlogDir, "sprints", "billing.md"),
      "---\nstatus: active\nstarted: 2026-07-01\ncomponent: \"billing\"\n---\n"
    );

    const byComponent = readSprintState({ backlogDir, track: "auth" });
    assert.equal(byComponent.active_sprints[0].frontmatter.component, "auth");
    assert.equal(byComponent.active_sprints.length, 1);

    const byTrackSlug = readSprintState({ backlogDir, track: "billing" });
    assert.equal(byTrackSlug.active_sprints[0].frontmatter.component, "billing");

    const noMatch = readSprintState({ backlogDir, track: "missing" });
    assert.equal("active_sprint" in noMatch, false);
    assert.deepEqual(noMatch.active_sprints, []);
  });

  it("fails on a selector shared by a slug and another active component (#496)", () => {
    const slugMatch = path.join(backlogDir, "sprints", "auth.md");
    const componentMatch = path.join(backlogDir, "sprints", "other.md");
    writeFile(slugMatch, '---\nstatus: active\ncomponent: billing\n---\n');
    writeFile(componentMatch, '---\nstatus: active\ncomponent: auth\n---\n');
    assert.throws(
      () => readSprintState({ backlogDir, track: "auth" }),
      (error) => error.message.includes(slugMatch) && error.message.includes(componentMatch),
    );
  });

  it("keeps the GitHub wire identity and ignores refs outside the #N grammar", () => {
    writeFile(path.join(backlogDir, "sprints", "mixed.md"), `---
status: active
started: 2026-07-01
---

## Plan
- [~] #1 Legacy task → PR #11 (reviewing)
- [ ] #2 Next task

## Progress
- 2026-07-02: #11 is a different GitHub task.
- 2026-07-03: #1 dispatched → PR #11
`);

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.equal(state.schema_version, 3);
    const track = state.active_sprints[0];
    assert.deepEqual(track.plan_items.map((item) => item.ref), ["#1", "#2"]);
    assert.deepEqual(track.plan_items[0].pointer, {
      pr: { number: 11, state: "reviewing" },
      branch: null,
    });
    assert.deepEqual(track.next_batch.items.map((item) => item.ref), ["#2"]);
  });

  it("does not read .tracker or publish a tracker field", () => {
    writeFile(path.join(backlogDir, "sprints", "authority.md"), `---
status: active
started: 2026-07-01
---

## Plan
- [~] #1 In flight
- [ ] #2 Todo

## Progress
`);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "backlog\n");

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-02T00:00:00Z"),
    });

    const track = state.active_sprints[0];
    assert.deepEqual(track.plan_items.map((item) => item.ref), ["#1", "#2"]);
    assert.ok(track.plan_items.every((item) => !("tracker" in item)));
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "unknown-on-purpose\n");
    assert.deepEqual(readSprintState({ backlogDir }), state);
  });

  it("fails closed on an invalid active Plan with source file and line", () => {
    const sprintPath = path.join(backlogDir, "sprints", "invalid.md");
    writeFile(sprintPath, [
      "---", "status: active", "---", "", "## Plan",
      "- [~] #1 Visible [branch:one]",
      "  - [~] #2 Indented and invalid [branch:two]",
      "", "### Batch 2", "- [ ] #3 Must not become actionable", "",
    ].join("\n"));

    assert.throws(
      () => readSprintState({ backlogDir }),
      (error) => error.code === "INVALID_ACTIVE_PLAN"
        && error.message.includes(`${sprintPath}:7`)
        && /correct the source Plan/i.test(error.message),
    );

    const result = spawnSync(process.execPath, [
      path.join(SKILL_SCRIPTS, "sprint-state.js"), backlogDir,
    ], { encoding: "utf8", env: childEnv() });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(`${sprintPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:7`));
    assert.match(result.stderr, /correct the source Plan/i);
  });
});

describe("parseSprintContent", () => {
  it("extracts first, empty, missing, trailing-space, and final sections (#498 smoke port)", () => {
    const content = [
      "## Goal  ",
      "Test the parsing.",
      "",
      "## Plan",
      "- [ ] #1 Item A",
      "",
      "## Running Context",
      "- Decision A",
      "",
      "## Empty",
      "",
      "## Progress",
      "- 2026-03-30: Done.",
    ].join("\n");

    assert.deepEqual(extractSectionLines(content, "Goal"), ["Test the parsing."]);
    assert.deepEqual(extractSectionLines(content, "Plan"), ["- [ ] #1 Item A"]);
    assert.deepEqual(extractSectionLines(content, "Running Context"), ["- Decision A"]);
    assert.deepEqual(extractSectionLines(content, "Empty"), []);
    assert.deepEqual(extractSectionLines(content, "Missing"), []);
    assert.deepEqual(extractSectionLines(content, "Progress"), ["- 2026-03-30: Done."]);
  });

  it("emits only the schema 3 plan-item fields", () => {
    const content = `---
status: active
---

## Plan
- [~] #1 In flight

## Progress
`;
    const state = parseSprintContent({ sprintPath: ".dev-backlog/sprints/a.md", content });
    assert.deepEqual(state.plan_items[0], {
      ref: "#1",
      state: "in_flight",
      title: "In flight",
      pointer: null,
    });
    assert.deepEqual(Object.keys(state.plan_items[0]), ["ref", "state", "title", "pointer"]);
  });

  it("marks unmoored in-flight items without trace pointers", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/unmoored.md",
      content: `---
status: active
started: 2026-07-01
---

## Plan
- [~] #7 Historical in-flight task

## Progress
`,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(state.in_flight[0].ref, "#7");
    assert.equal(state.in_flight[0].pointer, null);
  });

  it("does not strip or recognize legacy trailing [run:…] text", () => {
    const item = parsePlanItem("- [~] #211 Work → PR #224 (reviewing) [run:old-relay-id]");
    assert.equal(item.pointer, null);
    assert.equal(item.title, "Work → PR #224 (reviewing) [run:old-relay-id]");
    const bare = parsePlanItem("- [~] #212 Only a run pointer [run:old-relay-id]");
    assert.equal(bare.pointer, null);
    assert.equal(bare.title, "Only a run pointer [run:old-relay-id]");
  });

  it("treats missing sections as empty surfaces", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/sparse.md",
      content: "---\nstatus: active\n---\n",
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(state.goal, "");
    assert.deepEqual(state.plan_items, []);
    assert.equal(state.next_batch, null);
    assert.deepEqual(state.latest_progress, []);
    assert.deepEqual(state.in_flight, []);
  });

  it("accepts flat, empty, and currently headed Plans", () => {
    for (const plan of [
      "- [ ] #1 Flat",
      "",
      "### Batch 1 — Current\n- [~] #2 Running [branch:work]",
      "### Notes\n- [x] #3 Done",
    ]) {
      assert.doesNotThrow(() => parseSprintContent({
        sprintPath: ".dev-backlog/sprints/valid.md",
        content: `## Plan\n${plan}\n\n## Progress\n`,
      }), plan);
    }
  });
});

describe("Orient recovery rail (scenarios 1 and 8, #490)", () => {
  it("marks a later todo batch waiting on earlier in-flight refs in JSON and next text (#496)", () => {
    const content = `---
status: active
---

## Plan
### Batch 1
- [~] #1 Running [branch:work]

### Batch 2
- [ ] #2 Later
`;
    const state = parseSprintContent({ sprintPath: "waiting.md", content });
    assert.equal(state.next_batch.actionable, false);
    assert.deepEqual(state.next_batch.waiting_on, ["#1"]);
    assert.deepEqual(state.next_batch.items.map((item) => item.ref), ["#2"]);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-backlog-waiting-"));
    try {
      const backlogDir = path.join(tmpDir, ".dev-backlog");
      writeFile(path.join(backlogDir, "sprints", "waiting.md"), content);
      const report = textReport({ mode: "next", backlogDir });
      assert.equal(report.code, 0);
      assert.ok(report.lines.some((line) => line.includes("### Batch 2") && line.includes("#1")));
      assert.ok(!report.lines.some((line) => line.startsWith("Next: ### Batch 2")));
      writeFile(path.join(backlogDir, "sprints", "waiting.md"), `${content}\n### Batch 3\n- [ ] #3 Later still\n`);
      const status = textReport({ mode: "status", backlogDir });
      assert.ok(!status.lines.includes("Next up:"));
      assert.ok(!status.lines.some((line) => line.includes("#3")));
      assert.ok(status.lines.some((line) => line.includes("#1") && !line.includes("[~]")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const sameBatch = parseSprintContent({ sprintPath: "same.md", content: content
      .replace("### Batch 2\n", "") });
    assert.equal(sameBatch.next_batch.actionable, true);
    assert.deepEqual(sameBatch.next_batch.waiting_on, []);

    // Batches are positional: a repeated heading is still a later batch.
    const repeated = parseSprintContent({ sprintPath: "repeated.md", content: content
      .replace("### Batch 2", "### Batch 1") });
    assert.equal(repeated.next_batch.actionable, false);
    assert.deepEqual(repeated.next_batch.waiting_on, ["#1"]);
    assert.deepEqual(repeated.next_batch.items.map((item) => item.ref), ["#2"]);
  });

  it("selects the first [ ] batch as next_batch, distinct from [~] work, and reports latest Progress or its absence", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/scenario-1.md",
      content: `---
status: active
started: 2026-07-01
---

## Plan
### Batch 1 — Done
- [x] #1 Landed

### Batch 2 — In flight
- [~] #2 Running → PR #20 (reviewing)

### Batch 3 — Next
- [ ] #3 Selected only
- [ ] #4 Also selected

## Progress
- 2026-07-02: #2 dispatched → PR #20
`,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    // next_batch is the first [ ] batch, never the earlier [~]-only batch.
    assert.equal(state.next_batch.heading, "### Batch 3 — Next");
    assert.deepEqual(state.next_batch.items.map((item) => item.ref), ["#3", "#4"]);
    assert.deepEqual(state.next_batch.items.map((item) => item.state), ["todo", "todo"]);
    // [ ] selection is distinct from [~] work.
    assert.deepEqual(state.in_flight.map((item) => item.ref), ["#2"]);
    assert.equal(state.in_flight[0].state, "in_flight");
    assert.deepEqual(state.latest_progress.map((entry) => entry.line), [
      "- 2026-07-02: #2 dispatched → PR #20",
    ]);

    // Absence is explicit: an empty latest_progress, not a missing field.
    const noProgress = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/scenario-1-empty.md",
      content: "---\nstatus: active\n---\n\n## Plan\n- [ ] #5 Todo\n\n## Progress\n",
      today: new Date("2026-07-03T00:00:00Z"),
    });
    assert.deepEqual(noProgress.latest_progress, []);
    assert.equal(noProgress.next_batch.heading, null);
    assert.deepEqual(noProgress.next_batch.items.map((item) => item.ref), ["#5"]);
  });

  it("recovers every in-flight PR/branch pointer, or unmoored, from the JSON rail", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/scenario-8.md",
      content: `---
status: active
started: 2026-07-01
---

## Plan
- [~] #1 With a PR → PR #11 (open)
- [~] #2 With a branch [branch:feat/two]
- [~] #3 With no pointer

## Progress
`,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.deepEqual(
      state.in_flight.map((item) => [item.ref, item.pointer]),
      [
        ["#1", { pr: { number: 11, state: "open" }, branch: null }],
        ["#2", { pr: null, branch: "feat/two" }],
        ["#3", null],
      ]
    );
  });
});

const BATCHED_SPRINT = `---
milestone: Text Sprint
status: active
started: 2026-09-01
---

# Text Sprint

## Goal
Render text through one parser.

## Plan
### Batch 1 — Done
- [x] #1 Setup

### Batch 2 — In flight
- [~] #2 Dispatch (~2hr) → PR #87 (reviewing)

### Batch 3 — Remaining
- [ ] #3 Render text
- [ ] #4 Delete the bash parser

## Running Context

## Progress
- 2026-09-01: Batch 1 done.
`;

function track(name, started, plan) {
  return `---
status: active
started: ${started}
component: "${name}"
---

## Goal
${name} goal.

## Plan
${plan}

## Progress
`;
}

describe("textReport", () => {
  let tmpDir;
  let backlogDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-backlog-text-"));
    backlogDir = path.join(tmpDir, ".dev-backlog");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });


  it("gives an in-flight-only sprint no next batch and does not announce close readiness (#498 smoke port)", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/in-flight-only.md",
      content: `---
status: active
started: 2026-07-01
---

## Goal
Keep going.

## Plan
- [~] #1 With a PR → PR #11 (open)
- [~] #2 With a branch [branch:feat/two]

## Progress
- 2026-07-02: both dispatched.
`,
      today: new Date("2026-07-03T00:00:00Z"),
    });
    assert.equal(state.in_flight.length, 2);
    assert.equal(state.next_batch, null);
    assert.equal(state.plan_items.filter((item) => item.state === "todo").length, 0);
    assert.equal(state.plan_items.filter((item) => item.state === "in_flight").length, 2);
  });


  it("renders the next stanza for a single track with batches and in-flight items", () => {
    writeFile(path.join(backlogDir, "sprints", "2026-09-text.md"), BATCHED_SPRINT);

    assert.deepEqual(textReport({ mode: "next", backlogDir }), {
      code: 0,
      lines: [
        "=== Sprint: 2026-09-text ===",
        "",
        "Goal: Render text through one parser.",
        "",
        "Progress: 1/4 done (1 in-flight, 2 remaining)",
        "",
        "In flight:",
        "  - [~] #2 Dispatch (~2hr) → PR #87 (reviewing)",
        "",
        "Waiting: ### Batch 3 — Remaining (on #2)",
        "  - [ ] #3 Render text",
        "  - [ ] #4 Delete the bash parser",
        "",
        "Last: - 2026-09-01: Batch 1 done.",
      ],
    });
  });

  it("renders the status stanza with capped in-flight and waiting lists", () => {
    writeFile(path.join(backlogDir, "sprints", "2026-09-text.md"), BATCHED_SPRINT);

    assert.deepEqual(textReport({ mode: "status", backlogDir }), {
      code: 0,
      lines: [
        "=== Active Sprint ===",
        "2026-09-text: 1/4 tasks (25%) — 1 in-flight",
        "",
        "In flight:",
        "  - [~] #2 Dispatch (~2hr) → PR #87 (reviewing)",
        "",
        "Waiting on #2:",
        "  - [ ] #3 Render text",
        "  - [ ] #4 Delete the bash parser",
      ],
    });
  });

  it("announces a closeable sprint on both surfaces", () => {
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-done.md"),
      track("done", "2026-09-01", "- [x] #1 One\n- [x] #2 Two")
    );

    assert.ok(textReport({ mode: "next", backlogDir }).lines
      .includes("All items checked! Ready to close sprint."));
    assert.ok(textReport({ mode: "status", backlogDir }).lines
      .includes(">> All items done — ready to close sprint"));
  });


  it("reports two in-flight items, zero remaining, and no close-ready line for an in-flight-only sprint (#498 smoke port)", () => {
    writeFile(path.join(backlogDir, "sprints", "2026-09-inflight.md"), `---
status: active
started: 2026-09-01
---

## Goal
Still flying.

## Plan
- [~] #1 First → PR #11 (open)
- [~] #2 Second [branch:feat/two]

## Progress
- 2026-09-01: both dispatched.
`);
    const next = textReport({ mode: "next", backlogDir });
    const status = textReport({ mode: "status", backlogDir });
    const nextText = next.lines.join("\n");
    const statusText = status.lines.join("\n");
    assert.equal(next.code, 0);
    assert.match(nextText, /2 in-flight/);
    assert.match(nextText, /0 remaining/);
    assert.doesNotMatch(nextText, /All items checked/);
    assert.doesNotMatch(statusText, /All items done — ready to close sprint/);
    assert.doesNotMatch(nextText, /Next:/);
  });


  it("renders a portfolio stanza for N disjoint tracks", () => {
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-auth.md"),
      track("auth", "2026-09-01", "- [~] #1 Auth work → PR #5 (reviewing)\n- [ ] #2 Auth next")
    );
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-billing.md"),
      track("billing", "2026-09-02", "- [x] #3 Billing work")
    );

    assert.deepEqual(textReport({ mode: "next", backlogDir }), {
      code: 0,
      lines: [
        "=== 2 active tracks (portfolio) ===",
        "",
        "2026-09-auth: 0/2 done, 1 in-flight",
        "  Next: #2 Auth next",
        "2026-09-billing: 1/1 done",
        "",
        "Use 'node scripts/sprint-state.js --mode next --format text --track <slug>' for a single track.",
      ],
    });
    assert.deepEqual(textReport({ mode: "status", backlogDir }).lines, [
      "=== Active Sprint ===",
      "2 active tracks (portfolio):",
      "  2026-09-auth: 0/2 (0%) — 1 in-flight",
      "  2026-09-billing: 1/1 (100%)",
    ]);
  });

  it("renders only the selected track for --track", () => {
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-auth.md"),
      track("auth", "2026-09-01", "- [ ] #1 Auth next")
    );
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-billing.md"),
      track("billing", "2026-09-02", "- [ ] #2 Billing next")
    );

    const report = textReport({ mode: "next", backlogDir, track: "2026-09-auth" });
    assert.equal(report.code, 0);
    assert.ok(report.lines.includes("=== Sprint: 2026-09-auth ==="));
    assert.ok(!report.lines.some((line) => line.includes("Billing next")));
  });

  it("fails loud and lists the active tracks when --track matches nothing", () => {
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-auth.md"),
      track("auth", "2026-09-01", "- [ ] #1 Auth next")
    );
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-billing.md"),
      track("billing", "2026-09-02", "- [ ] #2 Billing next")
    );

    assert.deepEqual(textReport({ mode: "next", backlogDir, track: "bogus" }), {
      code: 1,
      lines: [
        "No active track matches 'bogus'. Active tracks:",
        "  - 2026-09-auth",
        "  - 2026-09-billing",
      ],
    });
    assert.deepEqual(textReport({ mode: "status", backlogDir, track: "bogus" }), {
      code: 0,
      lines: ["=== Active Sprint ===", "(no active track matches 'bogus')"],
    });
  });

  it("reports no active sprint without naming a tracker command", () => {
    writeFile(
      path.join(backlogDir, "sprints", "2026-08-past.md"),
      "---\nstatus: completed\n---\n"
    );

    const report = textReport({ mode: "next", backlogDir });
    assert.equal(report.code, 0);
    assert.equal(report.lines[0], "No active sprint found.");
    assert.ok(!report.lines.join("\n").includes("gh issue"));
    assert.deepEqual(textReport({ mode: "status", backlogDir }).lines, [
      "=== Active Sprint ===",
      "(no active sprint)",
    ]);
  });

  it("stops next and degrades status when the sprints directory is missing", () => {
    const sprintsDir = path.join(backlogDir, "sprints");

    assert.deepEqual(textReport({ mode: "next", backlogDir }), {
      code: 1,
      lines: [`No ${sprintsDir} directory. Create a sprint with sprint-init.js first.`],
    });
    assert.deepEqual(textReport({ mode: "status", backlogDir }), {
      code: 0,
      lines: ["=== Active Sprint ===", `(no ${sprintsDir}/ directory)`],
    });
  });

  it("lists every unchecked item when the plan has no batch headings", () => {
    const todos = ["#2 Todo one", "#3 Todo two", "#4 Todo three", "#5 Todo four"];
    writeFile(
      path.join(backlogDir, "sprints", "2026-09-flat.md"),
      track("flat", "2026-09-01", ["- [x] #1 Done", ...todos.map((t) => `- [ ] ${t}`)].join("\n"))
    );

    const lines = textReport({ mode: "next", backlogDir }).lines;
    assert.ok(lines.includes("Next items:"));
    assert.deepEqual(
      // the trailing blank (the Last: separator) is trimmed when printed
      lines.slice(lines.indexOf("Next items:") + 1).filter((line) => line !== ""),
      todos.map((todo) => `  - [ ] ${todo}`)
    );

    // status caps both lists at 3 entries; next shows the whole batch.
    const statusLines = textReport({ mode: "status", backlogDir }).lines;
    assert.deepEqual(
      statusLines.slice(statusLines.indexOf("Next up:") + 1),
      todos.slice(0, 3).map((todo) => `  - [ ] ${todo}`)
    );
  });
});

describe("parseArgs --format", () => {
  it("defaults to json and accepts text in both spellings", () => {
    assert.equal(parseArgs([]).format, "json");
    assert.equal(parseArgs(["--format", "text"]).format, "text");
    assert.equal(parseArgs(["--format=text"]).format, "text");
    assert.equal(parseArgs(["--json"]).format, "json");
  });

  it("rejects an unknown --format value with the usage string", () => {
    const parsed = parseArgs(["--format", "yaml"]);
    assert.match(parsed.error, /^Invalid --format: yaml\./);
    assert.match(parsed.error, /Usage: sprint-state\.js .*--format json\|text/);
  });

  it("accepts mode, format, and track flags before or after a backlog path (#498)", () => {
    const expected = {
      mode: "next",
      format: "text",
      backlogDir: "backlog with spaces",
      track: "auth",
    };
    assert.deepEqual(parseArgs([
      "--mode", "next", "--format", "text", "--track", "auth", "backlog with spaces",
    ]), expected);
    assert.deepEqual(parseArgs([
      "backlog with spaces", "--track=auth", "--format=text", "--mode=next",
    ]), expected);
  });

  it("rejects the removed --component selector", () => {
    assert.match(parseArgs(["--component", "auth"]).error, /Unknown argument: --component/);
    assert.match(parseArgs(["--component=auth"]).error, /Unknown argument: --component=auth/);
  });
});

describe("sprint-state.js --format text CLI (stdout + exit code)", () => {
  const { spawnSync } = require("child_process");
  const BIN = path.resolve(__dirname, "../../skills/dev-backlog/scripts/sprint-state.js");
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "ss-cli-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  const run = (...args) => spawnSync(process.execPath, [BIN, ...args], {
    cwd: root,
    encoding: "utf8",
    env: childEnv(),
  });

  it("next: missing sprints dir prints the sprint-init hint and exits 1", () => {
    const res = run("--mode", "next", "--format", "text", "nope");
    assert.equal(res.status, 1);
    const expected = `No ${path.join("nope", "sprints")} directory. Create a sprint with sprint-init.js first.\n`;
    assert.equal(res.stdout, expected);
  });

  it("next/status: no active sprint exits 0 with the neutral hint", () => {
    fs.mkdirSync(path.join(root, ".dev-backlog", "sprints"), { recursive: true });
    const next = run("--mode", "next", "--format", "text");
    assert.equal(next.status, 0);
    assert.equal(next.stdout, "No active sprint found.\nList open tasks in the task authority.\n");
    const status = run("--mode", "status", "--format", "text");
    assert.equal(status.status, 0);
    assert.equal(status.stdout, "=== Active Sprint ===\n(no active sprint)\n");
  });

  it("rejects an unknown --format on the CLI with exit 1", () => {
    const res = run("--mode", "next", "--format", "yaml");
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Invalid --format: yaml/);
  });

  it("reads a backlog path containing spaces with flags after the path (#498)", () => {
    const backlogDir = path.join(root, "backlog with spaces");
    writeFile(path.join(backlogDir, "sprints", "active.md"), [
      "---", "status: active", "---", "", "## Goal", "Path-safe reader.", "",
      "## Plan", "- [ ] #1 Next", "", "## Running Context", "", "## Progress", "",
    ].join("\n"));
    const res = run(backlogDir, "--mode", "next", "--format", "text");
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Path-safe reader/);
    assert.match(res.stdout, /#1 Next/);
  });
});
