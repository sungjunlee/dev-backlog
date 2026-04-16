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

function writeMockGh(binDir) {
  const ghPath = path.join(binDir, "gh");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(ghPath, `#!/usr/bin/env node
const args = process.argv.slice(2);
const joined = args.join(" ");

if (joined.includes("issue list")) {
  process.stdout.write("[]");
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
    writeMockGh(binDir);

    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, "--dry-run", "--json", "--month", "2026-04"],
      {
        cwd: workspaceDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH || ""}`,
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
});
