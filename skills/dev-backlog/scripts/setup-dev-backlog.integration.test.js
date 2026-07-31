const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { spawnBashSync } = require("./bash-runtime.js");
const {
  collectGithubEvidence,
  isGithubRemote,
  readLegacyTracker,
} = require("./setup-dev-backlog.js");

const SCRIPT = path.join(__dirname, "setup-dev-backlog.js");
const INIT = path.join(__dirname, "init.sh");

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
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  const configPath = path.join(backlogDir, "config.yml");
  fs.writeFileSync(configPath, raw);
  return configPath;
}

function faultPreload(t, source) {
  const root = makeRoot(t, "setup-preload-");
  const preload = path.join(root, "fault.cjs");
  fs.writeFileSync(preload, source);
  return preload;
}

describe("legacy tracker read safety", () => {
  it("reads BOM-prefixed github and ignores block, comment, and quoted-value decoys", (t) => {
    const root = makeRoot(t);
    const accepted = [
      `${String.fromCharCode(0xfeff)}tracker: github\r\nproject_name: legacy\r\n`,
      "note: |\n  tracker: local\ntracker: github\n",
      "# tracker: local\ntracker: github\n",
      'note: "see tracker: local"\ntracker: "github"\n',
    ];
    for (const raw of accepted) {
      const configPath = writeConfig(root, raw);
      assert.deepEqual(readLegacyTracker(configPath), {
        found: true,
        selection: "github",
      });
    }
  });

  it("fails closed on ambiguous or authority-obscuring YAML keys", (t) => {
    const root = makeRoot(t);
    const refused = [
      "tracker: github\ntracker: local\n",
      '"tracker": github\n',
      "provider:\n  tracker: github\n",
      "- tracker: github\n",
      "? tracker\n: github\n",
    ];
    for (const raw of refused) {
      const configPath = writeConfig(root, raw);
      assert.throws(
        () => readLegacyTracker(configPath),
        /Ambiguous tracker authority|Unsupported tracker authority shape/
      );
    }
  });
});

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
  it("creates a fresh GitHub selection without config.yml", (t) => {
    const root = makeRoot(t);
    const result = runCli(root, [
      "--tracker", "github", "--non-interactive", "--json", "--project-name", "fresh",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).selection, "github");
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.existsSync(path.join(root, "backlog/config.yml")), false);
    assert.equal(fs.existsSync(path.join(root, "backlog/sprints")), true);
    assert.equal(fs.existsSync(path.join(root, "backlog/tasks")), false);
  });

  it("pins legacy github while preserving exact complex config bytes", (t) => {
    const root = makeRoot(t);
    const raw = [
      `${String.fromCharCode(0xfeff)}project_name: legacy`,
      'note: "tracker: local"',
      "body: |",
      "  tracker: local",
      "tracker: github # preserved",
      "tail: preserved",
      "",
    ].join("\r\n");
    const configPath = writeConfig(root, raw);
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).selectionSource, "legacy-migration");
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });

  it("gives .tracker precedence and leaves complex config bytes untouched", (t) => {
    const root = makeRoot(t);
    const raw = [
      '"note:with:colons": &copy !text |-2',
      "    tracker: local",
      "single: 'first line",
      "  tracker: local",
      "  last line'",
      "tracker: local # stale and ignored",
      "tail: preserved",
    ].join("\r\n");
    const configPath = writeConfig(root, raw);
    fs.writeFileSync(path.join(root, "backlog/.tracker"), "github\n");
    const result = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).selection, "github");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });

  it("repairs partial structure and reruns byte-idempotently", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog"));
    fs.writeFileSync(path.join(root, "backlog/.tracker"), "github\n");
    const first = runCli(root, ["--non-interactive"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(fs.existsSync(path.join(root, "backlog/sprints")), true);
    const repaired = snapshot(path.join(root, "backlog"));
    const second = runCli(root, ["--non-interactive"]);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(path.join(root, "backlog")), repaired);
  });

  it("rejects invalid and retired local selections before effects", (t) => {
    for (const selection of ["gitlab", "local"]) {
      const root = makeRoot(t, `setup-invalid-${selection}-`);
      fs.mkdirSync(path.join(root, "backlog"));
      fs.writeFileSync(path.join(root, "backlog/.tracker"), `${selection}\n`);
      const before = snapshot(root);
      const result = runCli(root, ["--non-interactive"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /expected github/);
      assert.deepEqual(snapshot(root), before);
    }

    const root = makeRoot(t, "setup-invalid-config-local-");
    writeConfig(root, "tracker: local\n");
    const before = snapshot(root);
    const result = runCli(root, ["--non-interactive"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected github/);
    assert.deepEqual(snapshot(root), before);
  });

  it("rolls back fresh directories and temp bytes on atomic publication failures", (t) => {
    for (const failure of ["write", "rename"]) {
      const root = makeRoot(t, `setup-failure-${failure}-`);
      const source = failure === "write"
        ? [
            'const fs = require("node:fs");',
            'const original = fs.writeFileSync;',
            'fs.writeFileSync = function (target, content, options) {',
            '  if (String(target).includes(".tracker.") && String(target).endsWith(".tmp")) {',
            '    original.call(this, target, "partial", options);',
            '    throw new Error("injected write failure");',
            '  }',
            '  return original.call(this, target, content, options);',
            '};',
          ].join("\n")
        : [
            'const fs = require("node:fs");',
            'const original = fs.renameSync;',
            'fs.renameSync = function (from, to) {',
            '  if (String(to).replace(/\\\\/g, "/").endsWith("/backlog/.tracker")) {',
            '    throw new Error("injected rename failure");',
            '  }',
            '  return original.call(this, from, to);',
            '};',
          ].join("\n");
      const preload = faultPreload(t, source);
      const result = runCli(root, ["--tracker", "github", "--non-interactive"], {
        ...process.env,
        NODE_OPTIONS: `--require=${preload}`,
      });
      assert.notEqual(result.status, 0, failure);
      assert.match(result.stderr, new RegExp(`injected ${failure} failure`));
      assert.equal(fs.existsSync(path.join(root, "backlog")), false);
    }
  });

  it("rejects a dangling .tracker symlink before mutation", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog"));
    try {
      fs.symlinkSync(path.join(root, "missing"), path.join(root, "backlog/.tracker"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege is unavailable");
        return;
      }
      throw error;
    }
    const before = snapshot(root);
    const result = runCli(root, ["--tracker", "github", "--non-interactive"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsafe tracker path/);
    assert.deepEqual(snapshot(root), before);
  });

  it("keeps init.sh fresh and legacy GitHub behavior through cross-platform Bash", (t) => {
    const fresh = makeRoot(t, "setup-init-fresh-");
    const freshRun = spawnBashSync([INIT, "wrapper-demo"], {
      cwd: fresh,
      encoding: "utf8",
    });
    assert.equal(freshRun.status, 0, freshRun.stderr);
    assert.equal(fs.readFileSync(path.join(fresh, "backlog/.tracker"), "utf8"), "github\n");

    const legacy = makeRoot(t, "setup-init-legacy-");
    const configPath = writeConfig(legacy, "project_name: stable\ntracker: github\n");
    const raw = fs.readFileSync(configPath, "utf8");
    const legacyRun = spawnBashSync([INIT, "ignored"], {
      cwd: legacy,
      encoding: "utf8",
    });
    assert.equal(legacyRun.status, 0, legacyRun.stderr);
    assert.equal(fs.readFileSync(path.join(legacy, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });
});
