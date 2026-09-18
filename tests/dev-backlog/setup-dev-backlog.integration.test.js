const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { TRACKER_FLAG_NOTICE } = require(path.join(SKILL_SCRIPTS, "setup-dev-backlog.js"));

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

function writeConfig(root, raw) {
  const backlogDir = path.join(root, ".dev-backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  const configPath = path.join(backlogDir, "config.yml");
  fs.writeFileSync(configPath, raw);
  return configPath;
}

describe("GitHub-only setup real process integration", () => {
  it("creates a fresh execution root and nothing else", (t) => {
    const root = makeRoot(t);
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed, {
      action: "setup-dev-backlog",
      createdDirectories: ["sprints"],
    });
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/.tracker")), false);
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/config.yml")), false);
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/sprints")), true);
  });

  it("accepts --tracker, ignores it, and says so on stderr (#445)", (t) => {
    const root = makeRoot(t);
    const result = runCli(root, ["--tracker", "files", "--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr.trim(), TRACKER_FLAG_NOTICE);
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/.tracker")), false);
  });

  it("names the declared task authority on the human result line (#476)", (t) => {
    const root = makeRoot(t);
    const withoutTracker = runCli(root, ["--non-interactive"]);
    assert.equal(withoutTracker.status, 0, withoutTracker.stderr);
    assert.match(
      withoutTracker.stdout,
      /Task authority: github \(default; \.dev-backlog\/\.tracker not present\)/
    );

    fs.writeFileSync(path.join(root, ".dev-backlog/.tracker"), "backlog\n");
    const withTracker = runCli(root, ["--non-interactive"]);
    assert.equal(withTracker.status, 0, withTracker.stderr);
    assert.match(withTracker.stdout, /Task authority: backlog \(\.dev-backlog\/\.tracker\)/);
  });

  it("leaves complex config bytes untouched and never reads a tracker key", (t) => {
    const root = makeRoot(t);
    const raw = [
      '"note:with:colons": &copy !text |-2',
      "    tracker: local",
      "single: 'first line",
      "  tracker: local",
      "  last line'",
      "tracker: local # parked and ignored",
      "tail: preserved",
    ].join("\r\n");
    const configPath = writeConfig(root, raw);
    // A valid declared authority (#476); the embedded "tracker: local" strings
    // above are config.yml content, never parsed as YAML keys either way.
    fs.writeFileSync(path.join(root, ".dev-backlog/.tracker"), "github\n");
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(root, ".dev-backlog/.tracker"), "utf8"), "github\n");
  });

  it("fails loud on an unknown declared .tracker value (#476)", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, ".dev-backlog"), { recursive: true });
    fs.writeFileSync(path.join(root, ".dev-backlog/.tracker"), "local\n");
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown task authority "local"/);
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/sprints")), false);
  });

  it("repairs partial structure and reruns byte-idempotently", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, ".dev-backlog"));
    const first = runCli(root, ["--non-interactive"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(fs.existsSync(path.join(root, ".dev-backlog/sprints")), true);
    const repaired = snapshot(path.join(root, ".dev-backlog"));
    const second = runCli(root, ["--non-interactive"]);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(path.join(root, ".dev-backlog")), repaired);
  });

  it("rejects an unsafe config path before mutation", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, ".dev-backlog"));
    try {
      fs.symlinkSync(path.join(root, "missing"), path.join(root, ".dev-backlog/config.yml"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege is unavailable");
        return;
      }
      throw error;
    }
    const before = snapshot(root);
    const result = runCli(root, ["--non-interactive"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsafe config path/);
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
