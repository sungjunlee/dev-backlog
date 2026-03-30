const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { statusFromLabels, priorityFromLabels, structureBody, run } = require("./sync-pull.js");

describe("statusFromLabels", () => {
  it("returns In Progress for status:in-progress", () => {
    assert.equal(statusFromLabels(["status:in-progress"]), "In Progress");
  });

  it("returns Blocked for status:blocked", () => {
    assert.equal(statusFromLabels(["status:blocked"]), "Blocked");
  });

  it("returns In Review for status:in-review", () => {
    assert.equal(statusFromLabels(["status:in-review"]), "In Review");
  });

  it("defaults to To Do", () => {
    assert.equal(statusFromLabels([]), "To Do");
    assert.equal(statusFromLabels(["type:feature"]), "To Do");
  });

  it("picks first matching status", () => {
    assert.equal(statusFromLabels(["status:in-progress", "status:blocked"]), "In Progress");
  });
});

describe("priorityFromLabels", () => {
  it("returns critical", () => {
    assert.equal(priorityFromLabels(["priority:critical"]), "critical");
  });

  it("returns high", () => {
    assert.equal(priorityFromLabels(["priority:high"]), "high");
  });

  it("returns low", () => {
    assert.equal(priorityFromLabels(["priority:low"]), "low");
  });

  it("defaults to medium", () => {
    assert.equal(priorityFromLabels([]), "medium");
    assert.equal(priorityFromLabels(["type:bug"]), "medium");
  });

  it("respects priority order (critical > high > low)", () => {
    assert.equal(priorityFromLabels(["priority:low", "priority:critical"]), "critical");
  });
});

describe("structureBody", () => {
  it("returns placeholder for null/empty body", () => {
    assert.equal(structureBody(null), "\n## Description\n(No description provided)\n");
    assert.equal(structureBody(""), "\n## Description\n(No description provided)\n");
  });

  it("passes through body that already has ## Description", () => {
    const body = "## Description\nSome text";
    assert.equal(structureBody(body), "\n## Description\nSome text\n");
  });

  it("prepends ## Description to plain body", () => {
    assert.equal(structureBody("Some text"), "\n## Description\nSome text\n");
  });

  it("detects ## Description anywhere in body", () => {
    const body = "Intro\n## Description\nDetails";
    assert.equal(structureBody(body), "\n" + body + "\n");
  });
});

// --- Integration tests for run() ---

describe("run (integration)", () => {
  let tasksDir;

  beforeEach(() => {
    tasksDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-test-"));
  });

  afterEach(() => {
    fs.rmSync(tasksDir, { recursive: true, force: true });
  });

  const makeIssue = (overrides) => ({
    number: 42,
    title: "OAuth2 flow",
    body: "Implement OAuth2",
    labels: [],
    milestone: null,
    assignees: [],
    ...overrides,
  });

  it("creates task file with correct name and content", () => {
    run({
      issues: [makeIssue()],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    assert.equal(files.length, 1);
    assert.equal(files[0], "TEST-42 - oauth2-flow.md");

    const content = fs.readFileSync(path.join(tasksDir, files[0]), "utf-8");
    assert.match(content, /^---\n/);
    assert.match(content, /id: TEST-42/);
    assert.match(content, /title: OAuth2 flow/);
    assert.match(content, /status: To Do/);
    assert.match(content, /priority: medium/);
    assert.match(content, /## Description\nImplement OAuth2/);
  });

  it("applies labels to frontmatter correctly", () => {
    run({
      issues: [makeIssue({
        labels: [
          { name: "status:in-progress" },
          { name: "priority:high" },
          { name: "backend" },
          { name: "auth" },
        ],
        milestone: { title: "Sprint W13" },
      })],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    const content = fs.readFileSync(path.join(tasksDir, files[0]), "utf-8");
    assert.match(content, /status: In Progress/);
    assert.match(content, /priority: high/);
    assert.match(content, /- backend/);
    assert.match(content, /- auth/);
    assert.match(content, /milestone: Sprint W13/);
    // status: and priority: labels should NOT appear in labels list
    assert.doesNotMatch(content, /- status:in-progress/);
    assert.doesNotMatch(content, /- priority:high/);
  });

  it("creates multiple files for multiple issues", () => {
    run({
      issues: [
        makeIssue({ number: 1, title: "First" }),
        makeIssue({ number: 2, title: "Second" }),
        makeIssue({ number: 3, title: "Third" }),
      ],
      tasksDir,
      prefix: "BACK",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir).sort();
    assert.equal(files.length, 3);
    assert.equal(files[0], "BACK-1 - first.md");
    assert.equal(files[1], "BACK-2 - second.md");
    assert.equal(files[2], "BACK-3 - third.md");
  });

  it("skips existing files without --update", () => {
    // Pre-create a file
    fs.writeFileSync(
      path.join(tasksDir, "TEST-42 - oauth2-flow.md"),
      "---\nid: TEST-42\n---\nOld body"
    );

    run({
      issues: [makeIssue()],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    // File should be unchanged
    const content = fs.readFileSync(path.join(tasksDir, "TEST-42 - oauth2-flow.md"), "utf-8");
    assert.equal(content, "---\nid: TEST-42\n---\nOld body");
  });

  it("--update refreshes frontmatter but preserves existing body", () => {
    // Pre-create file with AC checkboxes in body
    const existingBody = `
## Description
Original description

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] Valid credentials return JWT
- [ ] Test coverage > 90%
<!-- AC:END -->
`;
    fs.writeFileSync(
      path.join(tasksDir, "TEST-42 - oauth2-flow.md"),
      `---\nid: TEST-42\ntitle: Old Title\nstatus: To Do\nlabels: []\npriority: medium\nmilestone: ''\ncreated_date: '2026-01-01'\n---\n${existingBody}`
    );

    run({
      issues: [makeIssue({
        title: "OAuth2 flow v2",
        labels: [{ name: "status:in-progress" }, { name: "priority:high" }],
      })],
      tasksDir,
      prefix: "TEST",
      update: true,
      dryRun: false,
    });

    const content = fs.readFileSync(path.join(tasksDir, "TEST-42 - oauth2-flow.md"), "utf-8");
    // Frontmatter updated
    assert.match(content, /title: OAuth2 flow v2/);
    assert.match(content, /status: In Progress/);
    assert.match(content, /priority: high/);
    // Body preserved (AC checkboxes intact)
    assert.match(content, /\[x\] Valid credentials return JWT/);
    assert.match(content, /\[ \] Test coverage > 90%/);
    assert.match(content, /AC:BEGIN/);
  });

  it("--dry-run does not create files", () => {
    run({
      issues: [makeIssue()],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: true,
    });

    const files = fs.readdirSync(tasksDir);
    assert.equal(files.length, 0);
  });

  it("--dry-run does not update existing files", () => {
    fs.writeFileSync(
      path.join(tasksDir, "TEST-42 - oauth2-flow.md"),
      "---\nid: TEST-42\n---\nOriginal"
    );

    run({
      issues: [makeIssue()],
      tasksDir,
      prefix: "TEST",
      update: true,
      dryRun: true,
    });

    const content = fs.readFileSync(path.join(tasksDir, "TEST-42 - oauth2-flow.md"), "utf-8");
    assert.equal(content, "---\nid: TEST-42\n---\nOriginal");
  });

  it("handles empty body gracefully", () => {
    run({
      issues: [makeIssue({ body: null })],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    const content = fs.readFileSync(path.join(tasksDir, files[0]), "utf-8");
    assert.match(content, /\(No description provided\)/);
  });

  it("handles non-ASCII title (slug fallback to number)", () => {
    run({
      issues: [makeIssue({ number: 99, title: "한글 제목" })],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    assert.equal(files.length, 1);
    // slugify returns empty for non-ASCII, falls back to number
    assert.equal(files[0], "TEST-99 - 99.md");
  });

  it("escapes special characters in title", () => {
    run({
      issues: [makeIssue({ title: "Fix: don't break #42" })],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    const content = fs.readFileSync(path.join(tasksDir, files[0]), "utf-8");
    // Title should be YAML-escaped (has colon and apostrophe)
    assert.match(content, /title: 'Fix: don''t break #42'/);
  });

  it("empty labels produce labels: []", () => {
    run({
      issues: [makeIssue({ labels: [] })],
      tasksDir,
      prefix: "TEST",
      update: false,
      dryRun: false,
    });

    const files = fs.readdirSync(tasksDir);
    const content = fs.readFileSync(path.join(tasksDir, files[0]), "utf-8");
    assert.match(content, /labels: \[\]/);
  });
});
