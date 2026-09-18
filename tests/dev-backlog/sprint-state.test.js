const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  readSprintState,
  parseSprintContent,
  parseArgs,
  textReport,
} = require(path.join(SKILL_SCRIPTS, "sprint-state.js"));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
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
- [x] #210 Preserve human output → PR #223 (merged) [run:issue-210-20260701090000000]

### Batch 2 - Active
- [~] #211 Add JSON surfaces (~2hr) → PR #224 (reviewing) [run:issue-211-20260701120000000]

### Batch 3 - Next
- [ ] #212 Document schema (~30min)

## Running Context
- Keep checkbox grammar stable.

## Progress
- 2026-06-30: prework without matching issue.
- 2026-07-01 09:00: #210 dispatched → PR #223
- 2026-07-01 12:00: [actor:relay] #211 dispatched → PR #224 [run:issue-211-20260701120000000]
- 2026-07-02 10:00: #211 review pending.
- 2026-07-02 11:00: context updated.
- 2026-07-03 08:00: #210 merged.
`);

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(state.schema_version, 2);
    assert.equal(state.active_sprint.path, sprintPath);
    assert.equal(state.active_sprint.frontmatter.status, "active");
    assert.deepEqual(state.active_sprint.frontmatter.objectives, ["O1", "O2"]);
    assert.equal(state.active_sprint.frontmatter.component, "dev-backlog");
    assert.equal(state.active_sprint.goal, "Expose actor-readable execution state.");

    assert.equal(state.plan_items.length, 3);
    assert.deepEqual(state.plan_items[1], {
      line: "- [~] #211 Add JSON surfaces (~2hr) → PR #224 (reviewing) [run:issue-211-20260701120000000]",
      checkbox_state: "~",
      state: "in_flight",
      tracker: "github",
      id: "211",
      ref: "#211",
      issue_number: 211,
      title: "Add JSON surfaces (~2hr)",
      batch_heading: "### Batch 2 - Active",
      pr: { number: 224, state: "reviewing" },
      run_id: "issue-211-20260701120000000",
      branch: null,
      unmoored: false,
    });

    assert.equal(state.next_batch.heading, "### Batch 3 - Next");
    assert.deepEqual(state.next_batch.items.map((item) => item.issue_number), [212]);
    assert.deepEqual(
      state.latest_progress.map((entry) => entry.line),
      [
        "- 2026-07-03 08:00: #210 merged.",
        "- 2026-07-02 11:00: context updated.",
        "- 2026-07-02 10:00: #211 review pending.",
        "- 2026-07-01 12:00: [actor:relay] #211 dispatched → PR #224 [run:issue-211-20260701120000000]",
        "- 2026-07-01 09:00: #210 dispatched → PR #223",
      ]
    );
    assert.deepEqual(state.in_flight.map((item) => ({
      issue_number: item.issue_number,
      age_days: item.age_days,
      age_source: item.age_source,
      age_basis_date: item.age_basis_date,
    })), [{
      issue_number: 211,
      age_days: 2,
      age_source: "progress",
      age_basis_date: "2026-07-01",
    }]);
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
    assert.equal(state.schema_version, 2);
    assert.equal(state.active_sprint, null);
    assert.equal(state.active_sprints.length, 2);
    assert.deepEqual(
      state.active_sprints.map((s) => s.active_sprint.frontmatter.component),
      ["billing", "auth"]
    );
  });

  it("returns a portfolio for two scopeless active tracks (cannot prove overlap)", () => {
    writeFile(path.join(backlogDir, "sprints", "a.md"), "---\nstatus: active\n---\n");
    writeFile(path.join(backlogDir, "sprints", "b.md"), "---\nstatus: active\n---\n");

    const state = readSprintState({ backlogDir });
    assert.equal(state.active_sprints.length, 2);
    assert.equal(state.active_sprint, null);
  });

  it("throws OVERLAPPING_TRACKS when two active tracks share scope", () => {
    writeFile(path.join(backlogDir, "sprints", "a.md"), "---\nstatus: active\ncomponent: \"auth\"\n---\n");
    writeFile(path.join(backlogDir, "sprints", "b.md"), "---\nstatus: active\ncomponent: \"auth\"\n---\n");

    assert.throws(
      () => readSprintState({ backlogDir }),
      /Active tracks overlap on scope/
    );
  });

  it("resolves a single track by --component or --track slug", () => {
    writeFile(
      path.join(backlogDir, "sprints", "auth.md"),
      "---\nstatus: active\nstarted: 2026-07-02\ncomponent: \"auth\"\n---\n"
    );
    writeFile(
      path.join(backlogDir, "sprints", "billing.md"),
      "---\nstatus: active\nstarted: 2026-07-01\ncomponent: \"billing\"\n---\n"
    );

    const byComponent = readSprintState({ backlogDir, component: "auth" });
    assert.equal(byComponent.active_sprint.frontmatter.component, "auth");
    assert.equal(byComponent.active_sprints.length, 1);

    const byTrackSlug = readSprintState({ backlogDir, track: "billing" });
    assert.equal(byTrackSlug.active_sprint.frontmatter.component, "billing");

    const noMatch = readSprintState({ backlogDir, component: "missing" });
    assert.equal(noMatch.active_sprint, null);
    assert.deepEqual(noMatch.active_sprints, []);
  });

  it("keeps the GitHub wire identity and ignores refs outside the #N grammar", () => {
    writeFile(path.join(backlogDir, "sprints", "mixed.md"), `---
status: active
started: 2026-07-01
---

## Plan
- [~] #1 Legacy task → PR #11 (reviewing)
- [ ] #2 Next task
- [ ] TASK-11.2 Not a plan ref since #445

## Progress
- 2026-07-02: #11 is a different GitHub task.
- 2026-07-03: #1 dispatched → PR #11
`);

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.equal(state.schema_version, 2);
    assert.deepEqual(state.plan_items.map(({ tracker, id, ref, issue_number }) => ({
      tracker, id, ref, issue_number,
    })), [
      { tracker: "github", id: "1", ref: "#1", issue_number: 1 },
      { tracker: "github", id: "2", ref: "#2", issue_number: 2 },
    ]);
    assert.equal(state.plan_items[0].pr.number, 11);
    assert.equal(state.in_flight[0].age_basis_date, "2026-07-03");
    assert.deepEqual(state.next_batch.items.map((item) => item.ref), ["#2"]);
  });

  // --- .dev-backlog/.tracker task authority (#476) ---

  it("sets plan_items[].tracker and in_flight[].tracker from a declared .tracker file", () => {
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

    assert.deepEqual(state.plan_items.map((item) => item.tracker), ["backlog", "backlog"]);
    assert.deepEqual(state.in_flight.map((item) => item.tracker), ["backlog"]);
    assert.equal(state.next_batch.items[0].tracker, "backlog");
  });

  it("keeps tracker as github when .tracker is absent", () => {
    writeFile(path.join(backlogDir, "sprints", "default.md"), `---
status: active
---

## Plan
- [ ] #1 Todo

## Progress
`);

    const state = readSprintState({ backlogDir });
    assert.deepEqual(state.plan_items.map((item) => item.tracker), ["github"]);
  });

  it("fails loud (stderr + exit 1) on an unknown .tracker value via the CLI", () => {
    const { spawnSync } = require("child_process");
    const BIN = path.resolve(__dirname, "../../skills/dev-backlog/scripts/sprint-state.js");
    fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "local\n");

    const res = spawnSync(process.execPath, [BIN, backlogDir], { encoding: "utf8" });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Unknown task authority "local"/);
  });
});

describe("parseSprintContent", () => {
  it("defaults tracker to github and honors an explicit authority override (#476)", () => {
    const content = `---
status: active
---

## Plan
- [~] #1 In flight

## Progress
`;
    const defaulted = parseSprintContent({ sprintPath: ".dev-backlog/sprints/a.md", content });
    assert.equal(defaulted.plan_items[0].tracker, "github");
    assert.equal(defaulted.in_flight[0].tracker, "github");

    const overridden = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/a.md",
      content,
      authority: "gitlab",
    });
    assert.equal(overridden.plan_items[0].tracker, "gitlab");
    assert.equal(overridden.in_flight[0].tracker, "gitlab");
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

    assert.equal(state.in_flight[0].issue_number, 7);
    assert.equal(state.in_flight[0].pr, null);
    assert.equal(state.in_flight[0].run_id, null);
    assert.equal(state.in_flight[0].branch, null);
    assert.equal(state.in_flight[0].unmoored, true);
    assert.equal(state.in_flight[0].age_days, 2);
    assert.equal(state.in_flight[0].age_source, "started");
  });

  it("treats missing sections as empty surfaces", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/sparse.md",
      content: "---\nstatus: active\n---\n",
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(state.active_sprint.goal, "");
    assert.deepEqual(state.plan_items, []);
    assert.equal(state.next_batch, null);
    assert.deepEqual(state.latest_progress, []);
    assert.deepEqual(state.in_flight, []);
  });

  it("uses progress date before started date, then null for in-flight age", () => {
    const withStarted = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/age.md",
      content: `---
status: active
started: 2026-06-30
---

## Plan
- [~] #1 Mentioned in progress
- [~] #2 Falls back to started

## Progress
- 2026-07-01 12:00: #1 dispatched.
- 2026-07-02 12:00: #1 still reviewing.
`,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.deepEqual(withStarted.in_flight.map((item) => ({
      issue_number: item.issue_number,
      age_days: item.age_days,
      age_source: item.age_source,
      age_basis_date: item.age_basis_date,
    })), [
      { issue_number: 1, age_days: 3, age_source: "progress", age_basis_date: "2026-07-01" },
      { issue_number: 2, age_days: 4, age_source: "started", age_basis_date: "2026-06-30" },
    ]);

    const withoutDate = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/no-age.md",
      content: `---
status: active
---

## Plan
- [~] #3 No age basis

## Progress
- no date: #3 has no resolvable date.
`,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.equal(withoutDate.in_flight[0].age_days, null);
    assert.equal(withoutDate.in_flight[0].age_source, null);
    assert.equal(withoutDate.in_flight[0].age_basis_date, null);
  });

  it("matches Progress refs exactly, never on a numeric prefix", () => {
    const state = parseSprintContent({
      sprintPath: ".dev-backlog/sprints/age.md",
      content: `---
status: active
started: 2026-06-30
---

## Plan
- [~] #1 Parent
- [~] #11 Sibling

## Progress
- 2026-07-01: #111 is unrelated.
- 2026-07-02: #11 started.
- 2026-07-03: #1 started.
`,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.deepEqual(state.in_flight.map((item) => [item.ref, item.age_basis_date]), [
      ["#1", "2026-07-03"],
      ["#11", "2026-07-02"],
    ]);
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
        "Next: ### Batch 3 — Remaining",
        "  - [ ] #3 Render text",
        "  - [ ] #4 Delete the bash parser",
        "",
        "Last: - 2026-09-01: Batch 1 done.",
      ],
    });
  });

  it("renders the status stanza with capped in-flight and next-up lists", () => {
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
        "Next up:",
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
        "Use 'next.sh --track <slug>' for a single track.",
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
      lines: [`No ${sprintsDir} directory. Run setup-dev-backlog.js first.`],
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
});

describe("sprint-state.js --format text CLI (stdout + exit code)", () => {
  const { spawnSync } = require("child_process");
  const BIN = path.resolve(__dirname, "../../skills/dev-backlog/scripts/sprint-state.js");
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "ss-cli-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: "utf8" });

  it("next: missing sprints dir prints the setup hint and exits 1", () => {
    const res = run("--mode", "next", "--format", "text", "nope");
    assert.equal(res.status, 1);
    const expected = `No ${path.join("nope", "sprints")} directory. Run setup-dev-backlog.js first.\n`;
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
});
