const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  statusFromLabels,
  priorityFromLabels,
  structureBody,
  parseArgs,
  loadOpenIssues,
  isMachineManagedIssueBody,
  run,
} = require(path.join(SKILL_SCRIPTS, "sync-pull.js"));

function materializationCliFixture(
  t,
  { failMkdir = false, failWrite = false, unsafeTasks = false, fresh = false } = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-materialize-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const backlogDir = path.join(root, "backlog");
  if (!fresh) {
    fs.mkdirSync(backlogDir);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");
  }
  const tasksPath = path.join(backlogDir, "tasks");
  if (unsafeTasks) fs.writeFileSync(tasksPath, "sentinel\n");

  const preload = path.join(root, "preload.cjs");
  fs.writeFileSync(preload, `
const childProcess = require("node:child_process");
const originalExecFileSync = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "gh") {
    return JSON.stringify([{
      number: 42,
      title: "Export me",
      body: "Live body",
      labels: [],
      milestone: null,
      assignees: []
    }]);
  }
  return originalExecFileSync(command, args, options);
};
${failWrite ? `
const fs = require("node:fs");
const path = require("node:path");
const originalWriteFileSync = fs.writeFileSync;
fs.writeFileSync = function (file, ...args) {
  const normalized = String(file);
  if (normalized.includes(path.join("backlog", "tasks")) && normalized.endsWith(".md")) {
    const error = new Error("injected task write failure");
    error.code = "EACCES";
    throw error;
  }
  return originalWriteFileSync.call(this, file, ...args);
};
` : ""}
${failMkdir ? `
const fsForMkdir = require("node:fs");
const pathForMkdir = require("node:path");
const originalMkdirSync = fsForMkdir.mkdirSync;
fsForMkdir.mkdirSync = function (directory, ...args) {
  if (String(directory).endsWith(pathForMkdir.join("backlog", "tasks"))) {
    const error = new Error("injected tasks mkdir failure");
    error.code = "EACCES";
    throw error;
  }
  return originalMkdirSync.call(this, directory, ...args);
};
` : ""}
`);

  return {
    root,
    backlogDir,
    tasksPath,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require=${preload}`.trim(),
    },
  };
}

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

describe("parseArgs", () => {
  it("parses prefix and flags", () => {
    const parsed = parseArgs(["TEST", "--update", "--dry-run", "--json"], "BACK");
    assert.deepEqual(parsed, {
      prefix: "TEST",
      update: true,
      dryRun: true,
      json: true,
      limit: undefined,
      legacyExport: false,
    });
  });

  it("falls back to config prefix", () => {
    const parsed = parseArgs(["--json"], "BACK");
    assert.equal(parsed.prefix, "BACK");
    assert.equal(parsed.json, true);
  });

  it("parses --limit without treating the value as prefix", () => {
    const parsed = parseArgs(["--limit", "250", "TEST"], "BACK");
    assert.deepEqual(parsed, {
      prefix: "TEST",
      update: false,
      dryRun: false,
      json: false,
      limit: 250,
      legacyExport: false,
    });
  });

  it("parses --limit=N form", () => {
    const parsed = parseArgs(["TEST", "--limit=25"], "BACK");
    assert.equal(parsed.prefix, "TEST");
    assert.equal(parsed.limit, 25);
  });

  it("returns an error for invalid --limit values", () => {
    const missingValue = parseArgs(["--limit"], "BACK");
    assert.equal(missingValue.error, "Missing value for --limit. Expected a positive integer.");

    const invalidValue = parseArgs(["--limit", "0"], "BACK");
    assert.equal(invalidValue.error, "Invalid --limit value: 0. Expected a positive integer.");
  });

  it("recognizes the deliberate legacy export opt-in", () => {
    const parsed = parseArgs(["--legacy-export", "--json"], "BACK");
    assert.equal(parsed.legacyExport, true);
  });
});

describe("legacy export CLI boundary", () => {
  it("refuses to materialize mirrors without explicit --legacy-export", () => {
    const result = spawnSync(process.execPath, [path.join(SKILL_SCRIPTS, "sync-pull.js")], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /legacy\/export-only/);
    assert.match(result.stderr, /--legacy-export/);
  });

  it("emits one JSON opt-in error and performs no filesystem effects", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-gate-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--json"],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      error: {
        code: "LEGACY_EXPORT_OPT_IN_REQUIRED",
        message: "sync-pull is legacy/export-only and is not part of the GitHub core path.",
        remediation: "Use live Issues through effective-task-spec.js, or rerun with --legacy-export for a deliberate diagnostic export.",
      },
    });
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("reports parse errors before the missing opt-in gate with no effects", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-parse-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--json", "--limit"],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "INVALID_ARGUMENT");
    assert.match(document.error.message, /Missing value for --limit/);
    assert.doesNotMatch(result.stdout, /LEGACY_EXPORT_OPT_IN_REQUIRED/);
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("keeps JSON error output position-independent when parsing fails first", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-json-order-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--limit", "--json"],
      { cwd: root, encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "INVALID_ARGUMENT");
    assert.match(document.error.message, /Invalid --limit value/);
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("wraps provider read failure in one JSON document without materializing files", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-provider-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json"],
      { cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" } },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "TASK_EXPORT_SOURCE_UNAVAILABLE");
    assert.match(document.error.message, /^gh error:/);
    assert.match(document.error.remediation, /provider authentication/);
    assert.deepEqual(fs.readdirSync(root), ["backlog"]);
    assert.deepEqual(fs.readdirSync(backlogDir), [".tracker"]);
  });

  it("keeps provider failure actionable in human mode", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-provider-human-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export"],
      { cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" } },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^gh error:/);
    assert.match(result.stderr, /provider authentication/);
    assert.deepEqual(fs.readdirSync(backlogDir), [".tracker"]);
  });

  it("wraps unsafe task-path materialization failure as JSON without changing the path", (t) => {
    const fixture = materializationCliFixture(t, { unsafeTasks: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "TASK_EXPORT_MATERIALIZATION_FAILED");
    assert.match(document.error.message, /Unsafe task export path/);
    assert.equal(fs.readFileSync(fixture.tasksPath, "utf8"), "sentinel\n");
    assert.deepEqual(fs.readdirSync(fixture.backlogDir).sort(), [".tracker", "tasks"]);
  });

  it("wraps task write failure as JSON and removes an empty directory it created", (t) => {
    const fixture = materializationCliFixture(t, { failWrite: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "TASK_EXPORT_MATERIALIZATION_FAILED");
    assert.match(document.error.message, /injected task write failure/);
    assert.equal(fs.existsSync(fixture.tasksPath), false);
    assert.deepEqual(fs.readdirSync(fixture.backlogDir), [".tracker"]);
  });

  it("keeps materialization failure actionable in human mode", (t) => {
    const fixture = materializationCliFixture(t, { unsafeTasks: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^task export materialization failed:/);
    assert.match(result.stderr, /path safety and write permissions/);
    assert.equal(fs.readFileSync(fixture.tasksPath, "utf8"), "sentinel\n");
  });

  it("exports successfully from a fresh repository with no backlog directory", (t) => {
    const fixture = materializationCliFixture(t, { fresh: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.mode, "legacy-export");
    assert.deepEqual(document.createdFiles, ["BACK-42 - export-me.md"]);
    assert.deepEqual(fs.readdirSync(fixture.backlogDir), ["tasks"]);
    assert.deepEqual(fs.readdirSync(fixture.tasksPath), ["BACK-42 - export-me.md"]);
  });

  it("keeps a fresh dry-run filesystem empty", (t) => {
    const fixture = materializationCliFixture(t, { fresh: true });

    const result = spawnSync(
      process.execPath,
      [
        path.join(SKILL_SCRIPTS, "sync-pull.js"),
        "--legacy-export", "--json", "--dry-run", "--limit", "1",
      ],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).counts.created, 1);
    assert.equal(fs.existsSync(fixture.backlogDir), false);
  });

  it("cleans fresh empty parent and tasks directories after an injected write failure", (t) => {
    const fixture = materializationCliFixture(t, { fresh: true, failWrite: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "TASK_EXPORT_MATERIALIZATION_FAILED");
    assert.equal(fs.existsSync(fixture.tasksPath), false);
    assert.equal(fs.existsSync(fixture.backlogDir), false);
  });

  it("cleans a fresh empty parent after an injected tasks mkdir failure", (t) => {
    const fixture = materializationCliFixture(t, { fresh: true, failMkdir: true });

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: fixture.root, encoding: "utf8", env: fixture.env },
    );

    assert.equal(result.status, 1);
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "TASK_EXPORT_MATERIALIZATION_FAILED");
    assert.match(document.error.message, /injected tasks mkdir failure/);
    assert.equal(fs.existsSync(fixture.tasksPath), false);
    assert.equal(fs.existsSync(fixture.backlogDir), false);
  });

  it("refuses a symlink or junction backlog parent without writing outside", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-parent-link-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sync-pull-parent-outside-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    fs.writeFileSync(path.join(outside, ".tracker"), "github\n");
    fs.writeFileSync(path.join(outside, "sentinel"), "unchanged\n");

    try {
      fs.symlinkSync(
        outside,
        path.join(root, "backlog"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (
        process.platform === "win32" &&
        ["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)
      ) {
        t.skip(`Windows junction creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    const preload = path.join(root, "preload.cjs");
    fs.writeFileSync(preload, `
const childProcess = require("node:child_process");
const originalExecFileSync = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "gh") {
    return JSON.stringify([{
      number: 42, title: "Export me", body: "Live body",
      labels: [], milestone: null, assignees: []
    }]);
  }
  return originalExecFileSync(command, args, options);
};
`);
    const env = {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require=${preload}`.trim(),
    };

    const result = spawnSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "sync-pull.js"), "--legacy-export", "--json", "--limit", "1"],
      { cwd: root, encoding: "utf8", env },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "TASK_EXPORT_MATERIALIZATION_FAILED");
    assert.match(document.error.message, /Unsafe task export parent/);
    assert.deepEqual(fs.readdirSync(outside).sort(), [".tracker", "sentinel"]);
    assert.equal(fs.readFileSync(path.join(outside, "sentinel"), "utf8"), "unchanged\n");
    assert.equal(fs.existsSync(path.join(outside, "tasks")), false);
  });
});

describe("isMachineManagedIssueBody", () => {
  it("returns true for the monthly progress marker", () => {
    assert.equal(
      isMachineManagedIssueBody("<!-- dev-backlog:progress-issue month=2026-04 -->\n\n# Progress"),
      true
    );
  });

  it("returns false for normal issue bodies", () => {
    assert.equal(isMachineManagedIssueBody("Plain body"), false);
    assert.equal(isMachineManagedIssueBody(""), false);
    assert.equal(isMachineManagedIssueBody(null), false);
    assert.equal(
      isMachineManagedIssueBody("<!-- dev-backlog:progress-comment id=abc -->"),
      false
    );
  });
});

describe("loadOpenIssues", () => {
  it("uses the explicit limit when provided", () => {
    const calls = [];
    const execFile = (command, args, options) => {
      calls.push({ command, args, options });
      return JSON.stringify([{ number: 1, title: "One" }]);
    };

    const issues = loadOpenIssues({ limit: 12, execFile });

    assert.deepEqual(issues, [{ number: 1, title: "One" }]);
    assert.deepEqual(calls, [{
      command: "gh",
      args: [
        "issue", "list", "--state", "open", "--limit", "12",
        "--json", "number,title,body,labels,milestone,assignees",
      ],
      options: {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      },
    }]);
  });

  it("fetches all open issues by first reading totalCount", () => {
    const calls = [];
    const execFile = (command, args, options) => {
      calls.push({ command, args, options });

      if (args[0] === "api") return "125\n";
      if (args[0] === "issue") return JSON.stringify([{ number: 1 }, { number: 2 }]);

      throw new Error(`Unexpected gh args: ${args.join(" ")}`);
    };

    const issues = loadOpenIssues({ execFile });

    assert.deepEqual(issues, [{ number: 1 }, { number: 2 }]);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], {
      command: "gh",
      args: [
        "api", "graphql",
        "-F", "owner={owner}",
        "-F", "name={repo}",
        "-f", "query=query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { issues(states: OPEN) { totalCount } } }",
        "--jq", ".data.repository.issues.totalCount",
      ],
      options: {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      },
    });
    assert.deepEqual(calls[1], {
      command: "gh",
      args: [
        "issue", "list", "--state", "open", "--limit", "125",
        "--json", "number,title,body,labels,milestone,assignees",
      ],
      options: {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      },
    });
  });

  it("skips issue listing when the repo has no open issues", () => {
    const calls = [];
    const execFile = (command, args, options) => {
      calls.push({ command, args, options });
      return "0\n";
    };

    const issues = loadOpenIssues({ execFile });

    assert.deepEqual(issues, []);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args[0], "api");
    assert.deepEqual(calls[0].options, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
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
    const result = run({
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

    assert.deepEqual(result.counts, { created: 1, updated: 0, skipped: 0 });
    assert.deepEqual(result.createdFiles, ["TEST-42 - oauth2-flow.md"]);
    assert.deepEqual(result.operations, [
      { type: "created", file: "TEST-42 - oauth2-flow.md" },
    ]);
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

  it("uses normalized identity for exact #1/#11 task-file lookup", () => {
    const longerTask = "---\nid: BACK-11\n---\nLonger task body";
    fs.writeFileSync(path.join(tasksDir, "BACK-11 - longer.md"), longerTask);

    const result = run({
      issues: [makeIssue({ number: 1, title: "Short" })],
      tasksDir,
      prefix: "BACK",
      update: false,
      dryRun: false,
    });

    assert.deepEqual(fs.readdirSync(tasksDir).sort(), [
      "BACK-1 - short.md",
      "BACK-11 - longer.md",
    ]);
    assert.equal(
      fs.readFileSync(path.join(tasksDir, "BACK-11 - longer.md"), "utf-8"),
      longerTask,
    );
    assert.deepEqual(result.createdFiles, ["BACK-1 - short.md"]);
    assert.deepEqual(result.skippedFiles, []);
  });

  it("preserves the existing GitHub task filename and frontmatter id byte shape", () => {
    run({
      issues: [makeIssue({ number: 11, title: "Existing GitHub Shape" })],
      tasksDir,
      prefix: "TASK",
      update: false,
      dryRun: false,
    });

    const file = "TASK-11 - existing-github-shape.md";
    assert.deepEqual(fs.readdirSync(tasksDir), [file]);
    const content = fs.readFileSync(path.join(tasksDir, file), "utf-8");
    assert.match(content, /^---\nid: TASK-11\ntitle: Existing GitHub Shape\n/);
    assert.match(content, /\n---\n## Description\nImplement OAuth2\n$/);
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

  it("--update refreshes the body when the GitHub issue body carries the progress marker", () => {
    // Pre-create a stale local mirror for a machine-managed progress issue.
    const staleBody = `
## Description
<!-- dev-backlog:progress-issue month=2026-04 -->

# Progress: April 2026

## Summary

| Metric | Count |
| --- | --- |
| Merged PRs (month) | 9 |
`;
    fs.writeFileSync(
      path.join(tasksDir, "TEST-46 - progress-april-2026.md"),
      `---\nid: TEST-46\ntitle: 'Progress: April 2026'\nstatus: To Do\nlabels: []\npriority: medium\nmilestone: ''\ncreated_date: '2026-04-01'\n---\n${staleBody}`
    );

    const freshIssueBody = `<!-- dev-backlog:progress-issue month=2026-04 -->

# Progress: April 2026

## Summary

| Metric | Count |
| --- | --- |
| Merged PRs (month) | 14 |
`;

    run({
      issues: [makeIssue({
        number: 46,
        title: "Progress: April 2026",
        body: freshIssueBody,
      })],
      tasksDir,
      prefix: "TEST",
      update: true,
      dryRun: false,
    });

    const content = fs.readFileSync(
      path.join(tasksDir, "TEST-46 - progress-april-2026.md"),
      "utf-8"
    );
    // Frontmatter still refreshed.
    assert.match(content, /title: 'Progress: April 2026'/);
    // Body refreshed to the fresh GitHub value.
    assert.match(content, /Merged PRs \(month\) \| 14/);
    // Stale count gone.
    assert.doesNotMatch(content, /Merged PRs \(month\) \| 9/);
    // Marker preserved so future pulls still recognise the mirror.
    assert.match(content, /<!-- dev-backlog:progress-issue month=2026-04 -->/);
  });

  it("--update leaves the body alone when only the local mirror carries the progress marker", () => {
    // Local file has the marker, but the incoming GitHub body does not — we must not
    // treat that as machine-managed and must keep respecting the local body.
    const localBody = `
## Description
<!-- dev-backlog:progress-issue month=2026-04 -->

Local notes the user edited by hand.
`;
    fs.writeFileSync(
      path.join(tasksDir, "TEST-46 - progress-april-2026.md"),
      `---\nid: TEST-46\ntitle: 'Progress: April 2026'\nstatus: To Do\nlabels: []\npriority: medium\nmilestone: ''\ncreated_date: '2026-04-01'\n---\n${localBody}`
    );

    run({
      issues: [makeIssue({
        number: 46,
        title: "Progress: April 2026",
        body: "Plain unstructured body without the marker",
      })],
      tasksDir,
      prefix: "TEST",
      update: true,
      dryRun: false,
    });

    const content = fs.readFileSync(
      path.join(tasksDir, "TEST-46 - progress-april-2026.md"),
      "utf-8"
    );
    // Local body retained verbatim.
    assert.match(content, /Local notes the user edited by hand\./);
    // New GitHub body did NOT replace it.
    assert.doesNotMatch(content, /Plain unstructured body without the marker/);
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

  it("returns structured summary for mixed operations", () => {
    fs.writeFileSync(
      path.join(tasksDir, "TEST-2 - existing.md"),
      "---\nid: TEST-2\n---\nExisting"
    );
    fs.writeFileSync(
      path.join(tasksDir, "TEST-3 - keep.md"),
      "---\nid: TEST-3\n---\nKeep"
    );

    const result = run({
      issues: [
        makeIssue({ number: 1, title: "Create me" }),
        makeIssue({ number: 2, title: "Existing", body: "Refresh me" }),
        makeIssue({ number: 3, title: "Keep", body: "Skip me" }),
      ],
      tasksDir,
      prefix: "TEST",
      update: true,
      dryRun: true,
    });

    assert.deepEqual(result.counts, { created: 1, updated: 2, skipped: 0 });
    assert.deepEqual(result.createdFiles, ["TEST-1 - create-me.md"]);
    assert.deepEqual(result.updatedFiles, ["TEST-2 - existing.md", "TEST-3 - keep.md"]);
    assert.deepEqual(result.skippedFiles, []);
    assert.deepEqual(result.operations, [
      { type: "created", file: "TEST-1 - create-me.md" },
      { type: "updated", file: "TEST-2 - existing.md" },
      { type: "updated", file: "TEST-3 - keep.md" },
    ]);
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

  it("--dry-run works when tasksDir does not exist", () => {
    const existingParent = path.join(tasksDir, "nonexistent");
    fs.mkdirSync(existingParent);
    const missingDir = path.join(existingParent, "tasks");
    assert.doesNotThrow(() => {
      run({
        issues: [makeIssue()],
        tasksDir: missingDir,
        prefix: "TEST",
        update: false,
        dryRun: true,
      });
    });
    assert.equal(fs.existsSync(missingDir), false);
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
