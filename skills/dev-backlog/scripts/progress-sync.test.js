const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  makeMarker,
  parseMarkerMonth,
  makeCommentMarker,
  parseCommentEntryId,
  mergeEntryKey,
  stuckEntryKey,
  relayMergeEntryKey,
  relayStuckEntryKey,
  renderMergeComment,
  renderStuckComment,
  parseManagedComments,
  parseTaskIssueNumber,
  readRelayManifestMetadata,
  readRelayGrade,
  loadRelayMetadata,
  buildDesiredCommentEntries,
  reconcileComments,
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
  fetchMergedPRsThisMonth,
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
    assert.deepEqual(parsed, { dryRun: true, json: true, month: "2026-03", relayManifest: null });
  });

  it("defaults to no flags", () => {
    const parsed = parseArgs([]);
    assert.deepEqual(parsed, { dryRun: false, json: false, month: null, relayManifest: null });
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

  it("parses --relay-manifest in split and equals form", () => {
    assert.equal(parseArgs(["--relay-manifest", "/tmp/run.md"]).relayManifest, "/tmp/run.md");
    assert.equal(parseArgs(["--relay-manifest=/tmp/run.md"]).relayManifest, "/tmp/run.md");
  });

  it("returns error for missing --relay-manifest value", () => {
    assert.ok(parseArgs(["--relay-manifest"]).error);
    assert.ok(parseArgs(["--relay-manifest="]).error);
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
    assert.ok(tasks.some((t) => t.issueNumber === 1));
    assert.ok(tasks.some((t) => t.issueNumber === 2));
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

describe("parseTaskIssueNumber", () => {
  it("extracts numeric issue id from backlog task filenames", () => {
    assert.equal(parseTaskIssueNumber("BACK-35 - progress-sync.md"), 35);
    assert.equal(parseTaskIssueNumber("TASK-7.md"), 7);
  });

  it("returns null when filename does not follow task naming", () => {
    assert.equal(parseTaskIssueNumber("notes.md"), null);
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

// --- fetchMergedPRsThisMonth ---

describe("fetchMergedPRsThisMonth", () => {
  it("uses exclusive upper bound to exclude day-1 of next month", () => {
    let capturedSearch;
    const execFile = (_cmd, args) => {
      const searchIdx = args.indexOf("--search");
      if (searchIdx !== -1) capturedSearch = args[searchIdx + 1];
      return "[]";
    };

    fetchMergedPRsThisMonth("2025-04", execFile);

    // Must use >= start and < end (exclusive), not inclusive range (..)
    assert.ok(capturedSearch, "should have captured --search value");
    assert.ok(capturedSearch.includes("merged:>=2025-04-01"), `expected merged:>=2025-04-01, got: ${capturedSearch}`);
    assert.ok(capturedSearch.includes("merged:<2025-05-01"), `expected merged:<2025-05-01, got: ${capturedSearch}`);
    // Must NOT use inclusive range syntax
    assert.ok(!capturedSearch.includes(".."), `must not use inclusive range (..), got: ${capturedSearch}`);
  });

  it("handles year boundary (December → January)", () => {
    let capturedSearch;
    const execFile = (_cmd, args) => {
      const searchIdx = args.indexOf("--search");
      if (searchIdx !== -1) capturedSearch = args[searchIdx + 1];
      return "[]";
    };

    fetchMergedPRsThisMonth("2025-12", execFile);

    assert.ok(capturedSearch.includes("merged:>=2025-12-01"));
    assert.ok(capturedSearch.includes("merged:<2026-01-01"));
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

// --- Comment marker ---

describe("makeCommentMarker", () => {
  it("produces the expected comment marker string", () => {
    assert.equal(
      makeCommentMarker("2026-04/merge/pr-10"),
      "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->"
    );
  });

  it("uses a distinct prefix from the body marker", () => {
    const bodyMarker = makeMarker("2026-04");
    const commentMarker = makeCommentMarker("2026-04/merge/pr-10");
    // They should not contain each other's prefix
    assert.ok(!bodyMarker.includes("progress-comment"));
    assert.ok(!commentMarker.includes("progress-issue"));
  });
});

describe("parseCommentEntryId", () => {
  it("extracts entry id from comment body", () => {
    const body = "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->\n**Merged:** #10";
    assert.equal(parseCommentEntryId(body), "2026-04/merge/pr-10");
  });

  it("extracts stuck entry id", () => {
    const body = "<!-- dev-backlog:progress-comment id=2026-04/stuck/BACK-5.md -->\n**Stuck**";
    assert.equal(parseCommentEntryId(body), "2026-04/stuck/BACK-5.md");
  });

  it("returns null for missing marker", () => {
    assert.equal(parseCommentEntryId("no marker here"), null);
    assert.equal(parseCommentEntryId(null), null);
    assert.equal(parseCommentEntryId(""), null);
  });

  it("returns null for empty id", () => {
    assert.equal(parseCommentEntryId("<!-- dev-backlog:progress-comment id= -->"), null);
  });

  it("ignores body marker", () => {
    const body = "<!-- dev-backlog:progress-issue month=2026-04 -->\nbody text";
    assert.equal(parseCommentEntryId(body), null);
  });

  it("marker round-trips through make and parse", () => {
    const entryId = "2026-04/merge/pr-42";
    const marker = makeCommentMarker(entryId);
    assert.equal(parseCommentEntryId(marker), entryId);
  });
});

// --- Entry key derivation ---

describe("mergeEntryKey", () => {
  it("derives stable key from month and PR number", () => {
    assert.equal(mergeEntryKey("2026-04", 10), "2026-04/merge/pr-10");
    assert.equal(mergeEntryKey("2026-04", 10), mergeEntryKey("2026-04", 10));
  });

  it("different PRs produce different keys", () => {
    assert.notEqual(mergeEntryKey("2026-04", 10), mergeEntryKey("2026-04", 11));
  });

  it("different months produce different keys", () => {
    assert.notEqual(mergeEntryKey("2026-04", 10), mergeEntryKey("2026-05", 10));
  });
});

describe("stuckEntryKey", () => {
  it("derives stable key from month and task file", () => {
    assert.equal(stuckEntryKey("2026-04", "BACK-5.md"), "2026-04/stuck/BACK-5.md");
  });

  it("different tasks produce different keys", () => {
    assert.notEqual(
      stuckEntryKey("2026-04", "BACK-5.md"),
      stuckEntryKey("2026-04", "BACK-6.md")
    );
  });
});

describe("relay entry keys", () => {
  it("derives stable relay-backed keys from run id", () => {
    assert.equal(relayMergeEntryKey("issue-37-20260407134610713"), "run/issue-37-20260407134610713/merge");
    assert.equal(relayStuckEntryKey("issue-37-20260407134610713"), "run/issue-37-20260407134610713/stuck");
  });
});

// --- Comment rendering ---

describe("renderMergeComment", () => {
  it("includes comment marker and PR info", () => {
    const body = renderMergeComment("2026-04", { number: 10, title: "Add auth" });
    assert.ok(body.includes("<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->"));
    assert.ok(body.includes("**Merged:** #10 — Add auth"));
  });

  it("marker is parseable back to entry id", () => {
    const body = renderMergeComment("2026-04", { number: 10, title: "Add auth" });
    assert.equal(parseCommentEntryId(body), "2026-04/merge/pr-10");
  });

  it("uses relay run id and enrichment details when relay metadata is present", () => {
    const body = renderMergeComment("2026-04", { number: 39, title: "Structured comments" }, {
      runId: "issue-36-20260407133044244",
      grade: "A",
      rounds: 1,
      executor: "claude",
      reviewer: "codex",
      actor: "orchestrator",
    });
    assert.ok(body.includes("<!-- dev-backlog:progress-comment id=run/issue-36-20260407133044244/merge -->"));
    assert.ok(body.includes("**Relay:** run `issue-36-20260407133044244` · grade A · rounds 1 · executor claude · reviewer codex · actor orchestrator"));
  });
});

describe("renderStuckComment", () => {
  it("includes comment marker and task info", () => {
    const body = renderStuckComment("2026-04", { file: "BACK-5.md", status: "In Progress" });
    assert.ok(body.includes("<!-- dev-backlog:progress-comment id=2026-04/stuck/BACK-5.md -->"));
    assert.ok(body.includes("**Stuck candidate:** BACK-5.md"));
  });

  it("marker is parseable back to entry id", () => {
    const body = renderStuckComment("2026-04", { file: "BACK-5.md", status: "In Progress" });
    assert.equal(parseCommentEntryId(body), "2026-04/stuck/BACK-5.md");
  });

  it("includes relay stuck-state signals when relay metadata is present", () => {
    const body = renderStuckComment("2026-04", { file: "BACK-37 - sync.md", status: "In Progress" }, {
      runId: "issue-37-20260407134610713",
      rounds: 2,
      state: "changes_requested",
      nextAction: "redispatch",
      executor: "claude",
    });
    assert.ok(body.includes("<!-- dev-backlog:progress-comment id=run/issue-37-20260407134610713/stuck -->"));
    assert.ok(body.includes("state changes_requested"));
    assert.ok(body.includes("next redispatch"));
  });
});

// --- parseManagedComments ---

describe("parseManagedComments", () => {
  it("filters only comments with managed marker", () => {
    const comments = [
      { id: 1, body: "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->\n**Merged**" },
      { id: 2, body: "This is a human comment" },
      { id: 3, body: "<!-- dev-backlog:progress-comment id=2026-04/stuck/BACK-5.md -->\n**Stuck**" },
      { id: 4, body: "Another human comment with <!-- random html -->" },
    ];
    const managed = parseManagedComments(comments);
    assert.equal(managed.length, 2);
    assert.equal(managed[0].id, 1);
    assert.equal(managed[0].entryId, "2026-04/merge/pr-10");
    assert.equal(managed[1].id, 3);
    assert.equal(managed[1].entryId, "2026-04/stuck/BACK-5.md");
  });

  it("returns empty array when no managed comments", () => {
    const comments = [
      { id: 1, body: "human comment" },
      { id: 2, body: "another human comment" },
    ];
    assert.deepEqual(parseManagedComments(comments), []);
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(parseManagedComments([]), []);
  });

  it("ignores body markers (progress-issue, not progress-comment)", () => {
    const comments = [
      { id: 1, body: "<!-- dev-backlog:progress-issue month=2026-04 -->\nBody" },
    ];
    assert.deepEqual(parseManagedComments(comments), []);
  });
});

describe("relay manifest metadata", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-relay-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeRelayRun(runId) {
    const manifestPath = path.join(tmpDir, `${runId}.md`);
    const eventsDir = path.join(tmpDir, runId);
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(manifestPath, [
      "---",
      "run_id: 'issue-37-20260407134610713'",
      "state: 'changes_requested'",
      "next_action: 'redispatch'",
      "issue:",
      "  number: 37",
      "git:",
      "  pr_number: 40",
      "roles:",
      "  executor: 'claude'",
      "  reviewer: 'codex'",
      "  orchestrator: 'relay'",
      "review:",
      "  rounds: 2",
      "---",
      "# Notes",
    ].join("\n"));
    fs.writeFileSync(path.join(eventsDir, "events.jsonl"), [
      JSON.stringify({ event: "iteration_score", run_id: runId, round: 1 }),
      JSON.stringify({ event: "rubric_quality", run_id: runId, grade: "A" }),
    ].join("\n"));
    return manifestPath;
  }

  it("reads nested relay metadata from manifest frontmatter", () => {
    const manifestPath = writeRelayRun("issue-37-20260407134610713");
    const metadata = readRelayManifestMetadata(manifestPath);
    assert.equal(metadata.runId, "issue-37-20260407134610713");
    assert.equal(metadata.issueNumber, 37);
    assert.equal(metadata.prNumber, 40);
    assert.equal(metadata.executor, "claude");
    assert.equal(metadata.reviewer, "codex");
    assert.equal(metadata.actor, "relay");
    assert.equal(metadata.rounds, 2);
    assert.equal(metadata.state, "changes_requested");
    assert.equal(metadata.nextAction, "redispatch");
  });

  it("reads grade from relay events and returns enriched metadata", () => {
    const manifestPath = writeRelayRun("issue-37-20260407134610713");
    const eventsPath = path.join(tmpDir, "issue-37-20260407134610713", "events.jsonl");
    assert.equal(readRelayGrade(eventsPath), "A");
    const metadata = loadRelayMetadata(manifestPath);
    assert.equal(metadata.grade, "A");
    assert.equal(metadata.eventsPath, eventsPath);
  });
});

describe("buildDesiredCommentEntries", () => {
  it("switches to run_id identities and keeps backlog aliases for matched relay entries", () => {
    const desired = buildDesiredCommentEntries({
      month: "2026-04",
      mergedPRs: [{ number: 40, title: "Relay enrichment" }],
      stuckTasks: [{ file: "BACK-37 - sync.md", issueNumber: 37, status: "In Progress" }],
      relayMetadata: {
        runId: "issue-37-20260407134610713",
        issueNumber: 37,
        prNumber: 40,
        grade: "A",
      },
    });

    assert.equal(desired[0].entryId, "run/issue-37-20260407134610713/merge");
    assert.deepEqual(desired[0].aliasIds, ["2026-04/merge/pr-40"]);
    assert.equal(desired[1].entryId, "run/issue-37-20260407134610713/stuck");
    assert.deepEqual(desired[1].aliasIds, ["2026-04/stuck/BACK-37 - sync.md"]);
  });
});

// --- reconcileComments ---

describe("reconcileComments", () => {
  function makeStubExec() {
    const calls = [];
    const execFile = (cmd, args) => {
      calls.push({ cmd, args });
      return "{}";
    };
    return { execFile, calls };
  }

  it("creates comments for new merge events", () => {
    const { execFile, calls } = makeStubExec();
    const fetchComments = () => []; // no existing comments

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "PR A" }, { number: 11, title: "PR B" }],
      stuckTasks: [],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.created, 2);
    assert.equal(actions.updated, 0);
    assert.equal(actions.skipped, 0);
    // Verify gh api POST calls were made
    const postCalls = calls.filter((c) => c.args.includes("POST"));
    assert.equal(postCalls.length, 2);
  });

  it("creates comments for stuck tasks", () => {
    const { execFile } = makeStubExec();
    const fetchComments = () => [];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [],
      stuckTasks: [{ file: "BACK-5.md", status: "In Progress" }],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.created, 1);
  });

  it("skips when existing comment body matches exactly", () => {
    const { execFile, calls } = makeStubExec();
    const mergeBody = renderMergeComment("2026-04", { number: 10, title: "PR A" });
    const fetchComments = () => [
      { id: 100, body: mergeBody },
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "PR A" }],
      stuckTasks: [],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.skipped, 1);
    assert.equal(actions.created, 0);
    assert.equal(actions.updated, 0);
    // No write calls should have been made
    const writeCalls = calls.filter((c) => c.args.includes("POST") || c.args.includes("PATCH"));
    assert.equal(writeCalls.length, 0);
  });

  it("updates when existing comment body differs", () => {
    const { execFile, calls } = makeStubExec();
    const oldBody = "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->\n**Merged:** #10 — Old Title";
    const fetchComments = () => [
      { id: 100, body: oldBody },
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "New Title" }],
      stuckTasks: [],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.updated, 1);
    assert.equal(actions.created, 0);
    assert.equal(actions.skipped, 0);
    const patchCalls = calls.filter((c) => c.args.includes("PATCH"));
    assert.equal(patchCalls.length, 1);
  });

  it("repairs duplicates: keeps first, deletes rest", () => {
    const { execFile, calls } = makeStubExec();
    const markerBody = "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-10 -->\n**Merged:** #10 — Dup";
    const fetchComments = () => [
      { id: 100, body: markerBody },
      { id: 101, body: markerBody },
      { id: 102, body: markerBody },
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "Dup" }],
      stuckTasks: [],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.repaired, 1);
    assert.equal(actions.created, 0);
    // First comment updated, two deleted
    const patchCalls = calls.filter((c) => c.args.includes("PATCH"));
    assert.equal(patchCalls.length, 1);
    const deleteCalls = calls.filter((c) => c.args.includes("DELETE"));
    assert.equal(deleteCalls.length, 2);
  });

  it("leaves human comments untouched", () => {
    const { execFile, calls } = makeStubExec();
    const fetchComments = () => [
      { id: 200, body: "Great progress this month!" },
      { id: 201, body: "I have a question about the stuck items." },
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "PR A" }],
      stuckTasks: [],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    // Should create 1 new comment, not touch the 2 human ones
    assert.equal(actions.created, 1);
    // No PATCH or DELETE calls for human comments
    const patchCalls = calls.filter((c) => c.args.includes("PATCH"));
    assert.equal(patchCalls.length, 0);
    const deleteCalls = calls.filter((c) => c.args.includes("DELETE"));
    assert.equal(deleteCalls.length, 0);
  });

  it("dry-run does not create, update, or delete", () => {
    const { execFile, calls } = makeStubExec();
    const fetchComments = () => [];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 10, title: "PR A" }],
      stuckTasks: [{ file: "BACK-5.md", status: "In Progress" }],
      month: "2026-04",
      dryRun: true,
      execFile,
      fetchComments,
    });

    assert.equal(actions.created, 2);
    // No API calls
    assert.equal(calls.length, 0);
  });

  it("upgrades a backlog-only merge comment to relay run-id without creating a duplicate", () => {
    const { execFile, calls } = makeStubExec();
    const fetchComments = () => [
      { id: 100, body: renderMergeComment("2026-04", { number: 40, title: "Relay enrichment" }) },
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [{ number: 40, title: "Relay enrichment" }],
      stuckTasks: [],
      month: "2026-04",
      relayMetadata: {
        runId: "issue-37-20260407134610713",
        prNumber: 40,
        grade: "A",
        rounds: 2,
      },
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.updated, 1);
    assert.equal(actions.created, 0);
    const patchCalls = calls.filter((c) => c.args.includes("PATCH"));
    assert.equal(patchCalls.length, 1);
    assert.ok(patchCalls[0].args.some((arg) => arg.includes("run/issue-37-20260407134610713/merge")));
  });

  it("handles mixed: create, skip, update, repair in one pass", () => {
    const { execFile } = makeStubExec();
    const existingMerge10 = renderMergeComment("2026-04", { number: 10, title: "PR A" });
    const oldMerge11 = "<!-- dev-backlog:progress-comment id=2026-04/merge/pr-11 -->\n**Merged:** #11 — Old";
    const dupStuck = "<!-- dev-backlog:progress-comment id=2026-04/stuck/BACK-5.md -->\n**Stuck**";

    const fetchComments = () => [
      { id: 100, body: existingMerge10 },    // will be skipped (exact match)
      { id: 101, body: oldMerge11 },          // will be updated (body differs)
      { id: 102, body: dupStuck },            // duplicate 1
      { id: 103, body: dupStuck },            // duplicate 2 — triggers repair
      { id: 200, body: "Human comment" },     // left untouched
    ];

    const actions = reconcileComments({
      issueNumber: 50,
      mergedPRs: [
        { number: 10, title: "PR A" },
        { number: 11, title: "New Title" },
        { number: 12, title: "Brand New" },   // will be created
      ],
      stuckTasks: [{ file: "BACK-5.md", status: "In Progress" }],
      month: "2026-04",
      dryRun: false,
      execFile,
      fetchComments,
    });

    assert.equal(actions.skipped, 1);    // PR #10
    assert.equal(actions.updated, 1);    // PR #11
    assert.equal(actions.created, 1);    // PR #12
    assert.equal(actions.repaired, 1);   // BACK-5.md duplicates
  });

  it("rerun is idempotent: second pass skips everything", () => {
    const { execFile: exec1 } = makeStubExec();
    const mergedPRs = [{ number: 10, title: "PR A" }];
    const stuckTasks = [{ file: "BACK-5.md", status: "In Progress" }];

    // First run: empty, creates everything
    const actions1 = reconcileComments({
      issueNumber: 50,
      mergedPRs,
      stuckTasks,
      month: "2026-04",
      dryRun: false,
      execFile: exec1,
      fetchComments: () => [],
    });
    assert.equal(actions1.created, 2);

    // Second run: simulate comments now exist with correct bodies
    const { execFile: exec2, calls: calls2 } = makeStubExec();
    const actions2 = reconcileComments({
      issueNumber: 50,
      mergedPRs,
      stuckTasks,
      month: "2026-04",
      dryRun: false,
      execFile: exec2,
      fetchComments: () => [
        { id: 100, body: renderMergeComment("2026-04", { number: 10, title: "PR A" }) },
        { id: 101, body: renderStuckComment("2026-04", { file: "BACK-5.md", status: "In Progress" }) },
      ],
    });
    assert.equal(actions2.skipped, 2);
    assert.equal(actions2.created, 0);
    assert.equal(actions2.updated, 0);
    assert.equal(actions2.repaired, 0);
    // No write calls
    assert.equal(calls2.length, 0);
  });
});

// --- sync with comments ---

describe("sync (comment integration)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-sync-cmt-"));
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
      return "{}";
    };
    return { execFile, calls };
  }

  it("sync result includes comment actions", () => {
    const { execFile } = makeExecFile({
      mergedPRs: [{ number: 10, title: "PR A" }],
      createdIssueNumber: 99,
    });
    fs.writeFileSync(path.join(tmpDir, "tasks", "BACK-5.md"), "---\nstatus: In Progress\n---\n");

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
      fetchComments: () => [],
    });

    assert.ok(result.comments);
    assert.equal(result.comments.created, 2); // 1 merge + 1 stuck
    assert.equal(result.comments.skipped, 0);
  });

  it("sync dry-run includes comment actions without writing", () => {
    const existing = {
      number: 50,
      title: "Progress: April 2026",
      body: "<!-- dev-backlog:progress-issue month=2026-04 -->",
    };
    const { execFile, calls } = makeExecFile({
      issues: [existing],
      mergedPRs: [{ number: 10, title: "PR" }],
    });

    const result = sync({
      month: "2026-04",
      dryRun: true,
      backlogDir: tmpDir,
      execFile,
      fetchComments: () => [],
    });

    assert.ok(result.comments);
    assert.equal(result.comments.created, 1);
    // No API write calls for comments
    const postCalls = calls.filter((c) => c.args && c.args.includes("POST"));
    assert.equal(postCalls.length, 0);
  });

  it("sync with no issue number skips comments", () => {
    const { execFile } = makeExecFile({});

    const result = sync({
      month: "2026-04",
      dryRun: true,
      backlogDir: tmpDir,
      execFile,
      fetchComments: () => { throw new Error("should not be called"); },
    });

    assert.deepEqual(result.comments, { created: 0, updated: 0, skipped: 0, repaired: 0 });
  });

  it("parses paginated gh api comment arrays and avoids duplicate managed comments", () => {
    const existing = {
      number: 50,
      title: "Progress: April 2026",
      body: "<!-- dev-backlog:progress-issue month=2026-04 -->",
    };
    const calls = [];
    let issueListCalls = 0;
    const existingMergeComment = renderMergeComment("2026-04", { number: 10, title: "PR A" });
    const execFile = (_cmd, args) => {
      calls.push(args);
      const joined = args.join(" ");
      if (joined.includes("issue list") && joined.includes("--search")) {
        issueListCalls += 1;
        return issueListCalls === 1 ? JSON.stringify([existing]) : "[]";
      }
      if (joined.includes("pr list") && joined.includes("open")) return "[]";
      if (joined.includes("pr list") && joined.includes("merged")) {
        return JSON.stringify([{ number: 10, title: "PR A" }]);
      }
      if (joined.includes("issues/50/comments")) {
        return [
          JSON.stringify([{ id: 100, body: existingMergeComment }]),
          JSON.stringify([{ id: 101, body: "Human comment" }]),
        ].join("\n");
      }
      if (joined.includes("issue edit")) return "";
      return "{}";
    };

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      execFile,
    });

    assert.equal(result.comments.created, 0);
    assert.equal(result.comments.skipped, 1);
    const postCalls = calls.filter((args) => args.includes("POST"));
    assert.equal(postCalls.length, 0);
  });
  it("sync enriches matching merge comments when relay manifest is provided", () => {
    const relayDir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-sync-relay-"));
    const runId = "issue-37-20260407134610713";
    const manifestPath = path.join(relayDir, `${runId}.md`);
    fs.mkdirSync(path.join(relayDir, runId), { recursive: true });
    fs.writeFileSync(manifestPath, [
      "---",
      `run_id: '${runId}'`,
      "issue:",
      "  number: 37",
      "git:",
      "  pr_number: 40",
      "roles:",
      "  executor: 'claude'",
      "review:",
      "  rounds: 2",
      "---",
    ].join("\n"));
    fs.writeFileSync(path.join(relayDir, runId, "events.jsonl"), JSON.stringify({
      event: "rubric_quality",
      run_id: runId,
      grade: "A",
    }));

    const { execFile, calls } = makeExecFile({
      issues: [{
        number: 50,
        title: "Progress: April 2026",
        body: "<!-- dev-backlog:progress-issue month=2026-04 -->",
      }],
      mergedPRs: [{ number: 40, title: "Relay enrichment" }],
    });

    const result = sync({
      month: "2026-04",
      dryRun: false,
      backlogDir: tmpDir,
      relayManifestPath: manifestPath,
      execFile,
      fetchComments: () => [],
    });

    assert.ok(result.relay);
    assert.equal(result.relay.runId, runId);
    assert.equal(result.comments.created, 1);
    const postCall = calls.find((c) => c.args.includes("POST"));
    assert.ok(postCall);
    assert.ok(postCall.args.some((arg) => arg.includes(`run/${runId}/merge`)));
    assert.ok(postCall.args.some((arg) => arg.includes("grade A")));

    fs.rmSync(relayDir, { recursive: true, force: true });
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
