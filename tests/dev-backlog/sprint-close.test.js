const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPTS_DIR = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const STATE_BIN = path.join(SCRIPTS_DIR, "sprint-state.js");
const { parseFrontmatter, readSprintState } = require(STATE_BIN);
const { runDoctor } = require(path.join(SCRIPTS_DIR, "backlog-doctor.js"));

const ACTIVE_SPRINT = [
  "---",
  "status: active",
  "started: 2026-11-01",
  "---",
  "",
  "# Close fixture",
  "",
  "## Goal",
  "Finish without rewriting body content.",
  "status: active",
  "",
  "## Plan",
  "- [x] #20 Done",
  "",
  "## Running Context",
  "",
  "## Progress",
  "- 2026-11-01: opened.",
  "",
].join("\n");

describe("deliberate session sprint close (#498)", () => {
  it("validates a frontmatter-only status edit and one Progress line through Node", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-close-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const backlogDir = path.join(root, ".dev-backlog");
    const sprintPath = path.join(backlogDir, "sprints", "2026-11-close.md");
    const operatorPath = path.join(root, "operator-owned.txt");
    fs.mkdirSync(path.dirname(sprintPath), { recursive: true });
    fs.writeFileSync(sprintPath, ACTIVE_SPRINT);
    fs.writeFileSync(operatorPath, "keep\n");

    assert.equal(readSprintState({ backlogDir }).active_sprints.length, 1);

    // Simulate the two deliberate edits made by a session. This is test setup,
    // not a product close helper or lifecycle engine.
    const completed = ACTIVE_SPRINT
      .replace(/^status: active$/m, "status: completed")
      .replace(
        "## Progress\n- 2026-11-01: opened.\n",
        "## Progress\n- 2026-11-01: opened.\n- 2026-11-12: Sprint closed. 1/1 tasks completed.\n",
      );
    fs.writeFileSync(sprintPath, completed);

    const after = fs.readFileSync(sprintPath, "utf8");
    assert.equal(parseFrontmatter(after).status, "completed");
    assert.deepEqual(after.match(/^status: active$/gm), ["status: active"]);
    assert.equal((after.match(/Sprint closed\. 1\/1 tasks completed\./g) || []).length, 1);
    assert.equal(fs.readFileSync(operatorPath, "utf8"), "keep\n");
    assert.deepEqual(fs.readdirSync(root).sort(), [".dev-backlog", "operator-owned.txt"]);

    const state = readSprintState({ backlogDir });
    assert.deepEqual(state.active_sprints, []);
    assert.equal(state.active_sprint, null);

    const status = spawnSync(process.execPath, [
      STATE_BIN, "--mode", "status", "--format", "text", backlogDir,
    ], { cwd: root, encoding: "utf8" });
    assert.equal(status.status, 0, status.stderr);
    assert.equal(status.stdout, "=== Active Sprint ===\n(no active sprint)\n");

    const doctor = runDoctor({ repoRoot: root });
    const activeCheck = doctor.checks.find((check) => check.name === "active_sprint");
    assert.equal(activeCheck.status, "warn");
    assert.deepEqual(activeCheck.detail.active_files, []);
    assert.match(activeCheck.detail.summary, /No active sprint found/);
  });
});
