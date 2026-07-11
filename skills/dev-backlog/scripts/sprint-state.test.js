const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  readSprintState,
  parseSprintContent,
} = require("./sprint-state.js");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("readSprintState", () => {
  let tmpDir;
  let backlogDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-backlog-state-"));
    backlogDir = path.join(tmpDir, "backlog");
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

    assert.equal(state.schema_version, 1);
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

  it("throws on ambiguous active sprint state", () => {
    writeFile(path.join(backlogDir, "sprints", "a.md"), "---\nstatus: active\n---\n");
    writeFile(path.join(backlogDir, "sprints", "b.md"), "---\nstatus: active\n---\n");

    assert.throws(
      () => readSprintState({ backlogDir }),
      /Multiple active sprint files found/
    );
  });

  it("uses the configured prefix for mixed GitHub and local Plan identities", () => {
    writeFile(path.join(backlogDir, "config.yml"), "task_prefix: TASK\n");
    writeFile(path.join(backlogDir, "sprints", "mixed.md"), `---
status: active
started: 2026-07-01
---

## Plan
- [~] #1 Legacy task → PR #11 (reviewing)
- [ ] TASK-11.2 Local subtask

## Progress
- 2026-07-02: #11 is a different GitHub task.
- 2026-07-03: #1 dispatched → PR #11
`);

    const state = readSprintState({
      backlogDir,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.equal(state.schema_version, 1);
    assert.deepEqual(state.plan_items.map(({ tracker, id, ref, issue_number }) => ({
      tracker, id, ref, issue_number,
    })), [
      { tracker: "github", id: "1", ref: "#1", issue_number: 1 },
      { tracker: "local", id: "11.2", ref: "TASK-11.2", issue_number: null },
    ]);
    assert.equal(state.plan_items[0].pr.number, 11);
    assert.equal(state.in_flight[0].age_basis_date, "2026-07-03");
    assert.deepEqual(state.next_batch.items.map((item) => item.ref), ["TASK-11.2"]);
  });
});

describe("parseSprintContent", () => {
  it("marks unmoored in-flight items without trace pointers", () => {
    const state = parseSprintContent({
      sprintPath: "backlog/sprints/unmoored.md",
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
      sprintPath: "backlog/sprints/sparse.md",
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
      sprintPath: "backlog/sprints/age.md",
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
      sprintPath: "backlog/sprints/no-age.md",
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

  it("matches local Progress refs exactly across parents and decimal subtasks", () => {
    const state = parseSprintContent({
      sprintPath: "backlog/sprints/local-age.md",
      taskPrefix: "BACK",
      content: `---
status: active
started: 2026-06-30
---

## Plan
- [~] BACK-1 Parent
- [~] BACK-1.1 Subtask

## Progress
- 2026-07-01: BACK-11 is unrelated.
- 2026-07-02: BACK-1.1 started.
- 2026-07-03: BACK-1 started.
`,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.deepEqual(state.in_flight.map((item) => [item.ref, item.age_basis_date]), [
      ["BACK-1", "2026-07-03"],
      ["BACK-1.1", "2026-07-02"],
    ]);
  });
});
