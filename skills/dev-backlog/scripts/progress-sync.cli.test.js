const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_PATH = path.join(__dirname, "progress-sync.js");
const tempDirs = [];

function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "progress-sync-cli-"));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, "backlog", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(dir, "backlog", "sprints"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "backlog", "tasks", "BACK-5 - sync.md"),
    "---\nstatus: In Progress\n---\n"
  );
  fs.writeFileSync(
    path.join(dir, "backlog", "sprints", "2026-04-maintenance.md"),
    [
      "---",
      "status: active",
      "---",
      "## Plan",
      "- [x] #49 Done",
      "- [~] #50 In-flight",
      "- [ ] #51 Todo",
    ].join("\n")
  );
  return dir;
}

function writeMockGh(binDir, issues = []) {
  const ghPath = path.join(binDir, "gh");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(ghPath, `#!/usr/bin/env node
const args = process.argv.slice(2);
const joined = args.join(" ");
const issues = ${JSON.stringify(issues)};

if (joined.includes("issue list")) {
  process.stdout.write(JSON.stringify(issues));
  process.exit(0);
}

if (joined.includes("pr list") && joined.includes("open")) {
  process.stdout.write(JSON.stringify([{ number: 20, title: "Open PR" }]));
  process.exit(0);
}

if (joined.includes("pr list") && joined.includes("merged")) {
  process.stdout.write(JSON.stringify([{ number: 21, title: "Merged PR" }]));
  process.exit(0);
}

process.stdout.write("{}");
`);
  fs.chmodSync(ghPath, 0o755);
  if (process.platform === "win32") {
    fs.writeFileSync(`${ghPath}.cmd`, `@echo off\r\n"${process.execPath}" "${ghPath}" %*\r\n`);
  }
  const preloadPath = path.join(binDir, "mock-gh-preload.cjs");
  fs.writeFileSync(preloadPath, `
const childProcess = require("node:child_process");
const original = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "gh") return original(process.execPath, [${JSON.stringify(ghPath)}, ...args], options);
  return original(command, args, options);
};
`);
  return preloadPath;
}

describe("progress-sync CLI", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  it("runs the real command with a mocked gh binary", () => {
    const workspaceDir = makeWorkspace();
    const binDir = path.join(workspaceDir, "bin");
    const preloadPath = writeMockGh(binDir);

    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, "--dry-run", "--json", "--month", "2026-04"],
      {
        cwd: workspaceDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
          NODE_OPTIONS: `--require=${preloadPath}`,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.action, "progress-sync");
    assert.equal(payload.dryRun, true);
    assert.equal(payload.month, "2026-04");
    assert.equal(payload.summary.merged, 1);
    assert.equal(payload.summary.inFlight, 1);
    assert.equal(payload.summary.stuckCandidates, 1);
    assert.equal(payload.summary.sprint.file, "2026-04-maintenance.md");
    assert.equal(payload.comments.created, 0);
    assert.ok(payload.body.includes("| Merged PRs (month) | 1 |"));
  });

  it("refuses an exact-title issue without the managed marker in dry-run", () => {
    const workspaceDir = makeWorkspace();
    const binDir = path.join(workspaceDir, "bin");
    const preloadPath = writeMockGh(binDir, [{
      number: 50,
      title: "Progress: April 2026",
      body: "Human-owned issue without a marker",
    }]);

    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, "--dry-run", "--month", "2026-04"],
      {
        cwd: workspaceDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
          NODE_OPTIONS: `--require=${preloadPath}`,
        },
      }
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "Error: Refusing to update GitHub issue #50: missing managed progress marker for 2026-04.\n"
    );
    assert.doesNotMatch(result.stdout, /Would update|#50/);
  });

  it("keeps marker-owned dry-run update output compatible", () => {
    const workspaceDir = makeWorkspace();
    const binDir = path.join(workspaceDir, "bin");
    const preloadPath = writeMockGh(binDir, [{
      number: 50,
      title: "Progress: April 2026",
      body: "<!-- dev-backlog:progress-issue month=2026-04 -->\nOld body",
    }]);

    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, "--dry-run", "--month", "2026-04"],
      {
        cwd: workspaceDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
          NODE_OPTIONS: `--require=${preloadPath}`,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, `[dry-run] Would update #50: Progress: April 2026
  merged PRs (month): 1, in-flight: 1, stuck candidates: 1
  sprint: 2026-04-maintenance.md (1/3 done)
  comments: 2 created, 0 updated, 0 skipped, 0 repaired
Done.
`);
  });
});
