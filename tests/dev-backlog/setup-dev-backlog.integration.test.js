const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  TRACKER_FLAG_NOTICE,
  collectGithubEvidence,
  isGithubRemote,
} = require(path.join(SKILL_SCRIPTS, "setup-dev-backlog.js"));

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

describe("GitHub evidence safety", () => {
  it("accepts only strict github.com repository remotes", () => {
    for (const remote of [
      "https://github.com/owner/repo.git",
      "ssh://git@github.com/owner/repo.git",
      "git@github.com:owner/repo.git",
      "ssh://git@ssh.github.com:443/owner/repo.git",
    ]) assert.equal(isGithubRemote(remote), true, remote);

    for (const remote of [
      "https://github.com.evil.test/owner/repo.git",
      "https://github.com/owner/repo/issues",
      "ssh://alice@github.com/owner/repo.git",
      "git@github.com:owner/../repo.git",
    ]) assert.equal(isGithubRemote(remote), false, remote);
  });

  it("sanitizes provider failures and never recommends fallback", () => {
    const secret = "SECRET-TOKEN";
    const execFileSync = (command) => {
      const error = new Error(`${command} failed ${secret}`);
      if (command === "gh") error.code = "ENOENT";
      throw error;
    };
    const evidence = collectGithubEvidence({ cwd: "/repo", execFileSync });
    assert.deepEqual(evidence, {
      recommendation: "github",
      remote: "missing",
      cli: "missing",
      auth: "not-checked",
    });
    assert.doesNotMatch(JSON.stringify(evidence), new RegExp(secret));
  });
});

describe("GitHub-only setup real process integration", () => {
  it("creates a fresh execution root with no tracker selection", (t) => {
    const root = makeRoot(t);
    const result = runCli(root, ["--non-interactive", "--json", "--project-name", "fresh"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.projectName, "fresh");
    assert.deepEqual(parsed.createdDirectories, ["sprints"]);
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
    fs.writeFileSync(path.join(root, ".dev-backlog/.tracker"), "local\n");
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(root, ".dev-backlog/.tracker"), "utf8"), "local\n");
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
});
