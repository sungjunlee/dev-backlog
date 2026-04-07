const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  makeMarker,
  parseMarkerMonth,
  monthKey,
  monthTitle,
  prevMonth,
  parseArgs,
  readTaskFiles,
  readCompletedCount,
  readActiveSprintSummary,
  computeSummary,
  renderBody,
  findMonthIssue,
  sync,
  printResult,
} = require("./progress-sync.js");

// --- Machine marker ---

describe("makeMarker", () => {
  it("produces the expected marker string", () => {
    assert.equal(makeMarker("2026-04"), "<!-- dev-backlog:progress-issue month=2026-04 -->");
  });
});

describe("parseMarkerMonth", () => {
  it("extracts month from marker in body", () => {
    const body = "blah\n<!-- dev-backlog:progress-issue month=2026-04 -->\nmore";
    assert.equal(parseMarkerMonth(body), "2026-04");
  });

  it("returns null for missing marker", () => {
    assert.equal(parseMarkerMonth("no marker here"), null);
    assert.equal(parseMarkerMonth(null), null);
    assert.equal(parseMarkerMonth(""), null);
  });
});

// --- Month helpers ---

describe("monthKey", () => {
  it("formats date as YYYY-MM", () => {
    assert.equal(monthKey(new Date("2026-04-07T12:00:00Z")), "2026-04");
    assert.equal(monthKey(new Date("2026-01-01T00:00:00Z")), "2026-01");
    assert.equal(monthKey(new Date("2026-12-15T12:00:00Z")), "2026-12");
  });
});

describe("monthTitle", () => {
  it("returns human-readable title", () => {
    assert.equal(monthTitle("2026-04"), "Progress: April 2026");
    assert.equal(monthTitle("2026-01"), "Progress: January 2026");
    assert.equal(monthTitle("2026-12"), "Progress: December 2026");
  });
});

describe("prevMonth", () => {
  it("returns previous month", () => {
    assert.equal(prevMonth("2026-04"), "2026-03");
    assert.equal(prevMonth("2026-01"), "2025-12");
    assert.equal(prevMonth("2026-12"), "2026-11");
  });
});

// --- parseArgs ---

describe("parseArgs", () => {
  it("parses all flags", () => {
    const parsed = parseArgs(["--dry-run", "--json", "--month", "2026-03"]);
    assert.deepEqual(parsed, { dryRun: true, json: true, month: "2026-03" });
  });

  it("defaults to no flags", () => {
    const parsed = parseArgs([]);
    assert.deepEqual(parsed, { dryRun: false, json: false, month: null });
  });

  it("parses --month=YYYY-MM form", () => {
    const parsed = parseArgs(["--month=2026-05"]);
    assert.equal(parsed.month, "2026-05");
  });

  it("returns error for invalid --month", () => {
    assert.ok(parseArgs(["--month", "bad"]).error);
    assert.ok(parseArgs(["--month"]).error);
    assert.ok(parseArgs(["--month=bad"]).error);
  });
});

// --- Local data readers ---

describe("readTaskFiles", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-tasks-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("reads task status from frontmatter", () => {
    fs.writeFileSync(path.join(tmpDir, "BACK-1 - foo.md"), "---\nstatus: In Progress\n---\nbody");
    fs.writeFileSync(path.join(tmpDir, "BACK-2 - bar.md"), "---\nstatus: To Do\n---\nbody");
    const tasks = readTaskFiles(tmpDir);
    assert.equal(tasks.length, 2);
    assert.ok(tasks.some((t) => t.status === "In Progress"));
    assert.ok(tasks.some((t) => t.status === "To Do"));
  });

  it("returns empty array for missing dir", () => {
    assert.deepEqual(readTaskFiles("/nonexistent/path"), []);
  });

  it("handles files without frontmatter", () => {
    fs.writeFileSync(path.join(tmpDir, "BACK-3 - bare.md"), "no frontmatter");
    const tasks = readTaskFiles(tmpDir);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].status, "unknown");
  });
});

describe("readCompletedCount", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-comp-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("counts .md files", () => {
    fs.writeFileSync(path.join(tmpDir, "BACK-1.md"), "done");
    fs.writeFileSync(path.join(tmpDir, "BACK-2.md"), "done");
    assert.equal(readCompletedCount(tmpDir), 2);
  });

  it("returns 0 for missing dir", () => {
    assert.equal(readCompletedCount("/nonexistent/path"), 0);
  });
});

describe("readActiveSprintSummary", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-sprints-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("reads active sprint checkbox counts", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-auth.md"), [
      "---", "status: active", "---",
      "## Plan",
      "- [x] #1 Done task",
      "- [~] #2 In-flight task",
      "- [ ] #3 Todo task",
      "- [ ] #4 Another todo",
    ].join("\n"));
    const s = readActiveSprintSummary(tmpDir);
    assert.equal(s.done, 1);
    assert.equal(s.inflight, 1);
    assert.equal(s.todo, 2);
    assert.equal(s.total, 4);
    assert.equal(s.file, "2026-04-auth.md");
  });

  it("returns null when no active sprint", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-03-old.md"), "---\nstatus: completed\n---\n");
    assert.equal(readActiveSprintSummary(tmpDir), null);
  });

  it("returns null for missing dir", () => {
    assert.equal(readActiveSprintSummary("/nonexistent/path"), null);
  });

  it("skips _context.md files", () => {
    fs.writeFileSync(path.join(tmpDir, "_context.md"), "status: active\n");
    assert.equal(readActiveSprintSummary(tmpDir), null);
  });
});

// --- Summary computation ---

describe("computeSummary", () => {
  it("derives merged count from month-scoped mergedPRs only", () => {
    const result = computeSummary({
      tasks: [
        { file: "a.md", status: "In Progress" },
        { file: "b.md", status: "In Progress" },
        { file: "c.md", status: "To Do" },
      ],
      sprint: { file: "sprint.md", done: 3, inflight: 1, todo: 2, total: 6 },
      openPRs: [{ number: 10, title: "PR A" }],
      mergedPRs: [{ number: 11, title: "PR B" }, { number: 12, title: "PR C" }],
    });
    assert.equal(result.merged, 2); // only month-scoped merged PRs
    assert.equal(result.inFlight, 1);
    assert.equal(result.stuckCandidates, 2);
    assert.deepEqual(result.sprint, { file: "sprint.md", done: 3, inflight: 1, todo: 2, total: 6 });
  });

  it("handles empty inputs", () => {
    const result = computeSummary({
      tasks: [],
      sprint: null,
      openPRs: [],
      mergedPRs: [],
    });
    assert.equal(result.merged, 0);
    assert.equal(result.inFlight, 0);
    assert.equal(result.stuckCandidates, 0);
    assert.equal(result.sprint, null);
  });
});

// --- Body rendering ---

describe("renderBody", () => {
  it("renders body with marker, summary, and sprint", () => {
    const body = renderBody({
      month: "2026-04",
      summary: {
        merged: 5,
        inFlight: 2,
        stuckCandidates: 1,
        sprint: { file: "2026-04-auth.md", done: 3, inflight: 1, todo: 2, total: 6 },
      },
      prevIssueNumber: 42,
    });

    assert.ok(body.includes("<!-- dev-backlog:progress-issue month=2026-04 -->"));
    assert.ok(body.includes("# Progress: April 2026"));
    assert.ok(body.includes("| Merged / completed | 5 |"));
    assert.ok(body.includes("| In-flight (open PRs) | 2 |"));
    assert.ok(body.includes("| Stuck candidates | 1 |"));
    assert.ok(body.includes("2026-04-auth.md"));
    assert.ok(body.includes("3/6 done"));
    assert.ok(body.includes("#42"));
  });

  it("renders no-sprint and no-prev gracefully", () => {
    const body = renderBody({
      month: "2026-04",
      summary: { merged: 0, inFlight: 0, stuckCandidates: 0, sprint: null },
      prevIssueNumber: null,
    });

    assert.ok(body.includes("_No active sprint._"));
    assert.ok(!body.includes("## Previous"));
  });

  it("marker is stable across renders", () => {
    const args = {
      month: "2026-04",
      summary: { merged: 1, inFlight: 0, stuckCandidates: 0, sprint: null },
      prevIssueNumber: null,
    };
    const body1 = renderBody(args);
    const body2 = renderBody(args);
    assert.equal(body1, body2);
  });

  it("marker is parseable back to month", () => {
    const body = renderBody({
      month: "2026-04",
      summary: { merged: 0, inFlight: 0, stuckCandidates: 0, sprint: null },
      prevIssueNumber: null,
    });
    assert.equal(parseMarkerMonth(body), "2026-04");
  });
});

// --- findMonthIssue ---

describe("findMonthIssue", () => {
  it("prefers marker match over title match", () => {
    const execFile = () => JSON.stringify([
      { number: 1, title: "Progress: April 2026", body: "no marker" },
      { number: 2, title: "Other", body: "<!-- dev-backlog:progress-issue month=2026-04 -->" },
    ]);
    const issue = findMonthIssue("2026-04", execFile);
    assert.equal(issue.number, 2);
  });

  it("falls back to exact title match", () => {
    const execFile = () => JSON.stringify([
      { number: 1, title: "Progress: April 2026", body: "old body" },
    ]);
    const issue = findMonthIssue("2026-04", execFile);
    assert.equal(issue.number, 1);
  });

  it("returns null when no match", () => {
    const execFile = () => JSON.stringify([]);
    assert.equal(findMonthIssue("2026-04", execFile), null);
  });
});

// --- sync (integration) ---

describe("sync", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-sync-"));
    fs.mkdirSync(path.join(tmpDir, "tasks"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "completed"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "sprints"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeExecFile({ issues = [], openPRs = [], mergedPRs = [], createdIssueNumber = 99 }) {
    const calls = [];
    const execFile = (cmd, args) => {
      calls.push({ cmd, args });
      const joined = args.join(" ");
      if (joined.includes("issue list")) return JSON.stringify(issues);
      if (joined.includes("pr list") && joined.includes("open")) return JSON.stringify(openPRs);
      if (joined.includes("pr list") && joined.includes("merged")) return JSON.stringify(mergedPRs);
      if (joined.includes("issue create")) return `https://github.com/owner/repo/issues/${createdIssueNumber}\n`;
      if (joined.includes("issue edit")) return "";
      return "[]";
    };
    return { execFile, calls };
  }

  it("creates a new issue when none exists", () => {
    const { execFile, calls } = makeExecFile({
      createdIssueNumber: 99,
    });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.created, true);
    assert.equal(result.issueNumber, 99);
    assert.equal(result.month, "2026-04");
    assert.ok(result.body.includes("<!-- dev-backlog:progress-issue month=2026-04 -->"));
    // Should have called issue create
    assert.ok(calls.some((c) => c.args.includes("issue") && c.args.includes("create")));
    // Verify create call does NOT include --json flag (gh issue create doesn't support it)
    const createCall = calls.find((c) => c.args.includes("create"));
    assert.ok(!createCall.args.includes("--json"), "gh issue create must not use --json flag");
  });

  it("parses issue number from gh issue create URL output", () => {
    const { execFile } = makeExecFile({ createdIssueNumber: 42 });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.issueNumber, 42);
  });

  it("updates existing issue instead of creating duplicate", () => {
    const existing = {
      number: 50,
      title: "Progress: April 2026",
      body: "<!-- dev-backlog:progress-issue month=2026-04 -->\nold body",
    };
    const { execFile, calls } = makeExecFile({ issues: [existing] });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.created, false);
    assert.equal(result.updated, true);
    assert.equal(result.issueNumber, 50);
    // Should NOT have called issue create
    assert.ok(!calls.some((c) => c.args.includes("create")));
    // Should have called issue edit
    assert.ok(calls.some((c) => c.args.includes("edit")));
  });

  it("dry-run does not create or update", () => {
    const { execFile, calls } = makeExecFile({});

    const result = sync({
      month: "2026-04",
      dryRun: true,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.created, false);
    assert.equal(result.updated, false);
    assert.equal(result.issueNumber, null);
    assert.ok(!calls.some((c) => c.args.includes("create")));
    assert.ok(!calls.some((c) => c.args.includes("edit")));
    // Body is still computed
    assert.ok(result.body.includes("<!-- dev-backlog:progress-issue month=2026-04 -->"));
  });

  it("links previous month issue when present", () => {
    // First search (current month) returns empty, second search (prev month) returns issue
    let searchCount = 0;
    const execFile = (cmd, args) => {
      const joined = args.join(" ");
      if (joined.includes("issue list") && joined.includes("--search")) {
        searchCount++;
        if (searchCount === 1) return "[]"; // current month not found
        // prev month found
        return JSON.stringify([{
          number: 30,
          title: "Progress: March 2026",
          body: "<!-- dev-backlog:progress-issue month=2026-03 -->",
        }]);
      }
      if (joined.includes("pr list") && joined.includes("open")) return "[]";
      if (joined.includes("pr list") && joined.includes("merged")) return "[]";
      if (joined.includes("issue create")) return "https://github.com/owner/repo/issues/99\n";
      return "[]";
    };

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.prevIssueNumber, 30);
    assert.ok(result.body.includes("#30"));
  });

  it("reads local backlog data into summary", () => {
    // Write task files
    fs.writeFileSync(path.join(tmpDir, "tasks", "BACK-1 - foo.md"), "---\nstatus: In Progress\n---\n");
    fs.writeFileSync(path.join(tmpDir, "tasks", "BACK-2 - bar.md"), "---\nstatus: To Do\n---\n");
    // Write completed
    fs.writeFileSync(path.join(tmpDir, "completed", "BACK-0.md"), "done");
    // Write active sprint
    fs.writeFileSync(path.join(tmpDir, "sprints", "2026-04-auth.md"), [
      "---", "status: active", "---",
      "## Plan",
      "- [x] #1 Done",
      "- [~] #2 In-flight",
      "- [ ] #3 Todo",
    ].join("\n"));

    const { execFile } = makeExecFile({
      openPRs: [{ number: 10, title: "PR" }],
      mergedPRs: [{ number: 11, title: "PR" }],
      createdIssueNumber: 99,
    });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.summary.merged, 1); // only month-scoped merged PRs
    assert.equal(result.summary.inFlight, 1);
    assert.equal(result.summary.stuckCandidates, 1);
    assert.ok(result.summary.sprint);
    assert.equal(result.summary.sprint.done, 1);
  });

  it("handles sparse data gracefully", () => {
    // Empty backlog dir — no tasks, no completed, no sprints
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-empty-"));
    const { execFile } = makeExecFile({
      createdIssueNumber: 99,
    });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: emptyDir,
      execFile,
    });

    assert.equal(result.summary.merged, 0);
    assert.equal(result.summary.inFlight, 0);
    assert.equal(result.summary.stuckCandidates, 0);
    assert.equal(result.summary.sprint, null);
    assert.ok(result.body.includes("_No active sprint._"));

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it("body is recomputed from source data, not existing issue text", () => {
    const staleBody = "<!-- dev-backlog:progress-issue month=2026-04 -->\nold stale content";
    const existing = { number: 50, title: "Progress: April 2026", body: staleBody };

    // Write fresh local data
    fs.writeFileSync(path.join(tmpDir, "completed", "BACK-1.md"), "done");
    fs.writeFileSync(path.join(tmpDir, "completed", "BACK-2.md"), "done");
    fs.writeFileSync(path.join(tmpDir, "completed", "BACK-3.md"), "done");

    const { execFile } = makeExecFile({ issues: [existing] });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    // Body must not contain stale text
    assert.ok(!result.body.includes("old stale content"));
    // Body is freshly rendered — merged count is from month-scoped PRs only (0 here)
    assert.ok(result.body.includes("| Merged / completed | 0 |"));
  });

  it("idempotent: same output for same inputs", () => {
    fs.writeFileSync(path.join(tmpDir, "completed", "BACK-1.md"), "done");

    const existing = {
      number: 50,
      title: "Progress: April 2026",
      body: "<!-- dev-backlog:progress-issue month=2026-04 -->",
    };
    const makeExec = () => makeExecFile({ issues: [existing] }).execFile;

    const r1 = sync({ month: "2026-04", dryRun: true, backlogDir: tmpDir, execFile: makeExec() });
    const r2 = sync({ month: "2026-04", dryRun: true, backlogDir: tmpDir, execFile: makeExec() });

    assert.equal(r1.body, r2.body);
  });
});

// --- printResult ---

describe("printResult", () => {
  it("does not throw for created result", () => {
    assert.doesNotThrow(() => {
      // Suppress console output during test
      const log = console.log;
      console.log = () => {};
      printResult({
        action: "progress-sync",
        month: "2026-04",
        dryRun: false,
        created: true,
        updated: false,
        issueNumber: 99,
        summary: { merged: 1, inFlight: 0, stuckCandidates: 0, sprint: null },
        prevIssueNumber: null,
      });
      console.log = log;
    });
  });

  it("does not throw for dry-run result", () => {
    assert.doesNotThrow(() => {
      const log = console.log;
      console.log = () => {};
      printResult({
        action: "progress-sync",
        month: "2026-04",
        dryRun: true,
        created: false,
        updated: false,
        issueNumber: null,
        summary: { merged: 0, inFlight: 0, stuckCandidates: 0, sprint: null },
        prevIssueNumber: null,
      });
      console.log = log;
    });
  });
});
