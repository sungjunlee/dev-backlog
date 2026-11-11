const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");

const SCRIPT = path.join(SKILL_SCRIPTS, "setup-dev-backlog.js");

function makeRoot(t, prefix = "setup-integration-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(root, args, env = process.env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function snapshot(root) {
  const files = {};
  function walk(directory, relative = "") {
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const key = path.join(relative, name);
      const stat = fs.lstatSync(full);
      files[key] = {
        type: stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file",
        bytes: stat.isFile() ? fs.readFileSync(full).toString("base64") : null,
      };
      if (stat.isDirectory()) walk(full, key);
    }
  }
  walk(root);
  return files;
}

describe("bounded legacy migration real process integration", () => {
  it("refuses to run without explicit migration authorization", (t) => {
    const root = makeRoot(t);
    const before = snapshot(root);
    const result = runCli(root, []);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing migration without --migrate-legacy/);
    assert.deepEqual(snapshot(root), before);
  });

  it("rejects removed flags before touching the tree", (t) => {
    const root = makeRoot(t);
    for (const args of [["--tracker", "files"], ["--tracker=files"], ["--non-interactive"]]) {
      const before = snapshot(root);
      const result = runCli(root, args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Removed argument: --(?:tracker|non-interactive)/);
      assert.deepEqual(snapshot(root), before);
    }
  });

  it("does not create an execution root when no legacy layout exists", (t) => {
    const root = makeRoot(t);
    const result = runCli(root, ["--migrate-legacy", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      action: "migrate-legacy-layout",
      migrated: false,
      reason: "no-legacy-skill-files",
    });
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("migrates only declared paths and does not read the parked tracker", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog", "sprints"), { recursive: true });
    fs.mkdirSync(path.join(root, "backlog", "tasks"));
    fs.writeFileSync(path.join(root, "backlog", "sprints", "keep.md"), "keep\r\n");
    fs.writeFileSync(path.join(root, "backlog", "tasks", "one.md"), "operator\n");
    fs.writeFileSync(path.join(root, "backlog", ".tracker"), "unknown-on-purpose\n");
    const result = runCli(root, ["--migrate-legacy", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).migrated, true);
    assert.equal(fs.readFileSync(path.join(root, ".dev-backlog", "sprints", "keep.md"), "utf8"), "keep\r\n");
    assert.equal(fs.readFileSync(path.join(root, "backlog", "tasks", "one.md"), "utf8"), "operator\n");
    assert.equal(fs.readFileSync(path.join(root, "backlog", ".tracker"), "utf8"), "unknown-on-purpose\n");
  });

  it("leaves legacy content byte-identical when .dev-backlog already exists", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, ".dev-backlog"));
    fs.mkdirSync(path.join(root, "backlog", "sprints"), { recursive: true });
    fs.writeFileSync(path.join(root, "backlog", "sprints", "keep.md"), "leftover\n");
    const before = snapshot(root);
    const result = runCli(root, ["--migrate-legacy", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).reason, "destination-exists");
    assert.deepEqual(snapshot(root), before);
  });

  it("rejects an unknown flag without touching the tree", (t) => {
    const root = makeRoot(t);
    const before = snapshot(root);
    const result = runCli(root, ["--probe-provider"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown argument: --probe-provider/);
    assert.deepEqual(snapshot(root), before);
  });
});
