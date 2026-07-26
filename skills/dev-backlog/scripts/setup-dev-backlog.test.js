const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { spawnBashSync } = require("./bash-runtime.js");
const { readConfig } = require("./lib.js");
const { resolveConfiguredTracker } = require("./tracker.js");

const {
  SetupError,
  collectGithubEvidence,
  isGithubRemote,
  parseArgs,
  readLegacyTracker,
  readTrackerFile,
  runSetup,
} = require("./setup-dev-backlog.js");

const SCRIPT = path.join(__dirname, "setup-dev-backlog.js");
const INIT = path.join(__dirname, "init.sh");

function makeRoot(t, prefix = "setup-dev-backlog-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeConfig(root, raw) {
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  const configPath = path.join(backlogDir, "config.yml");
  fs.writeFileSync(configPath, raw);
  return configPath;
}

function writeTracker(root, raw) {
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  const trackerPath = path.join(backlogDir, ".tracker");
  fs.writeFileSync(trackerPath, raw);
  return trackerPath;
}

function noProviderCalls() {
  return () => {
    throw new Error("provider command must not be called");
  };
}

function snapshotTree(root) {
  const output = {};
  function walk(current, relative = "") {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const key = path.join(relative, entry.name);
      const stat = fs.lstatSync(full);
      output[key] = {
        type: entry.isDirectory() ? "directory" : "file",
        ino: stat.ino,
        mtimeMs: stat.mtimeMs,
        bytes: entry.isFile() ? fs.readFileSync(full).toString("base64") : null,
      };
      if (entry.isDirectory()) walk(full, key);
    }
  }
  walk(root);
  return output;
}

function evidenceExec({ remote, gh = "authenticated", secret = "SECRET-TOKEN" } = {}) {
  const calls = [];
  const execFileSync = (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") {
      if (remote === undefined) throw new Error(`no origin ${secret}`);
      return remote;
    }
    if (gh === "missing") {
      const error = new Error(`spawn gh ENOENT ${secret}`);
      error.code = "ENOENT";
      throw error;
    }
    if (gh === "unauthenticated") throw new Error(`auth failed ${secret}`);
    return "github.com logged in";
  };
  return { calls, execFileSync };
}

describe("selection readers", () => {
  it("reads the one-line tracker file with trim semantics", (t) => {
    const root = makeRoot(t);
    const trackerPath = writeTracker(root, " \tlocal\r\n");
    assert.equal(readTrackerFile(trackerPath), "local");
    fs.writeFileSync(trackerPath, "github\nlocal\n");
    assert.throws(() => readTrackerFile(trackerPath), SetupError);
  });

  it("uses parseSimpleYaml for the legacy fallback", (t) => {
    const root = makeRoot(t);
    const configPath = writeConfig(root, [
      "note: |",
      "  tracker: github",
      "tracker: 'local' # legacy authority",
      "",
    ].join("\n"));
    assert.deepEqual(readLegacyTracker(configPath), {
      found: true,
      selection: "local",
    });

    fs.writeFileSync(configPath, "project_name: no-selection\n");
    assert.deepEqual(readLegacyTracker(configPath), {
      found: false,
      selection: undefined,
    });
  });
});

describe("CLI argument boundary", () => {
  it("rejects duplicate and unsupported tracker flags", () => {
    for (const argv of [
      ["--tracker", "local", "--tracker", "github"],
      ["--tracker=local", "--tracker=local"],
    ]) assert.throws(() => parseArgs(argv), /only once/);
    assert.throws(() => parseArgs(["--tracker", "gitlab"]), /github or local/);
  });
});

describe("provider evidence", () => {
  it("accepts only exact github.com remote hosts", () => {
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

  it("uses evidence only for a fresh interactive recommendation", async (t) => {
    const root = makeRoot(t);
    const mock = evidenceExec({
      remote: "git@github.com:owner/repo.git",
      gh: "authenticated",
    });
    let promptInput;
    const result = await runSetup(
      { cwd: root, projectName: "interactive" },
      {
        isInteractive: true,
        execFileSync: mock.execFileSync,
        prompt(input) {
          promptInput = input;
          return "";
        },
      }
    );
    assert.equal(result.selection, "github");
    assert.equal(result.selectionSource, "recommended");
    assert.equal(promptInput.recommendation, "github");
    assert.doesNotMatch(JSON.stringify(promptInput), /SECRET-TOKEN/);
  });

  it("sanitizes the availability matrix", () => {
    const mock = evidenceExec({
      remote: "https://example.com/owner/repo.git",
      gh: "missing",
    });
    assert.deepEqual(collectGithubEvidence({ cwd: "/repo", execFileSync: mock.execFileSync }), {
      recommendation: "local",
      remote: "non-github",
      cli: "missing",
      auth: "not-checked",
    });
  });
});

describe("setup filesystem behavior", () => {
  it("creates only .tracker and the minimum directories for a fresh explicit setup", async (t) => {
    for (const tracker of ["github", "local"]) {
      const root = makeRoot(t, `setup-fresh-${tracker}-`);
      const result = await runSetup(
        { cwd: root, tracker, nonInteractive: true, projectName: "demo" },
        { execFileSync: noProviderCalls() }
      );
      const backlogDir = path.join(root, "backlog");
      assert.equal(result.selection, tracker);
      assert.equal(result.trackerCreated, true);
      assert.equal(fs.readFileSync(path.join(backlogDir, ".tracker"), "utf8"), `${tracker}\n`);
      assert.equal(fs.existsSync(path.join(backlogDir, "config.yml")), false);
      assert.deepEqual(fs.readdirSync(backlogDir).sort(), [
        ".tracker", "completed", "sprints", "tasks",
      ]);
      assert.equal(resolveConfiguredTracker(readConfig(backlogDir), { backlogDir }).tracker, tracker);
    }
  });

  it("refuses fresh non-interactive setup without a deliberate choice", async (t) => {
    const root = makeRoot(t);
    await assert.rejects(
      runSetup({ cwd: root, nonInteractive: true }),
      /--tracker local --non-interactive/
    );
    assert.equal(fs.existsSync(path.join(root, "backlog")), false);
  });

  it("migrates a legacy selection without changing one config.yml byte", async (t) => {
    for (const tracker of ["github", "local"]) {
      const root = makeRoot(t, `setup-legacy-${tracker}-`);
      const raw = `project_name: legacy\r\ntracker: '${tracker}' # keep\r\nnote: |\r\n  tracker: github`;
      const configPath = writeConfig(root, raw);
      const before = fs.statSync(configPath);
      const result = await runSetup(
        { cwd: root, nonInteractive: true },
        { execFileSync: noProviderCalls() }
      );
      const after = fs.statSync(configPath);
      assert.equal(result.selection, tracker);
      assert.equal(result.selectionSource, "legacy-migration");
      assert.equal(fs.readFileSync(configPath, "utf8"), raw);
      assert.equal(after.ino, before.ino);
      assert.equal(after.mtimeMs, before.mtimeMs);
      assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), `${tracker}\n`);
    }
  });

  it("pins a tracker-less legacy config to github before allowing local", async (t) => {
    const root = makeRoot(t);
    const raw = "project_name: legacy\r\nnotes: keep";
    const configPath = writeConfig(root, raw);
    const before = snapshotTree(root);
    await assert.rejects(
      runSetup({ cwd: root, tracker: "local", nonInteractive: true }),
      /First pin compatibility/
    );
    assert.deepEqual(snapshotTree(root), before);

    const pin = await runSetup({ cwd: root, nonInteractive: true });
    assert.equal(pin.selection, "github");
    assert.equal(pin.selectionSource, "legacy-pin");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);

    const switched = await runSetup({
      cwd: root,
      tracker: "local",
      nonInteractive: true,
    });
    assert.equal(switched.selection, "local");
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "local\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });

  it(".tracker overrides stale YAML and explicit changes touch only .tracker", async (t) => {
    const root = makeRoot(t);
    const configPath = writeConfig(root, "project_name: stable\ntracker: github\n# untouched\n");
    const trackerPath = writeTracker(root, "local\n");
    const beforeConfig = snapshotTree(root)["backlog/config.yml"];
    const preserved = await runSetup({ cwd: root, nonInteractive: true });
    assert.equal(preserved.selection, "local");
    assert.equal(preserved.selectionSource, "preserved");

    await runSetup({ cwd: root, tracker: "github", nonInteractive: true });
    assert.equal(fs.readFileSync(trackerPath, "utf8"), "github\n");
    assert.deepEqual(snapshotTree(root)["backlog/config.yml"], beforeConfig);
  });

  it("rewrites a non-terminated selection once and then reruns as a no-op", async (t) => {
    const root = makeRoot(t);
    const trackerPath = writeTracker(root, "local");
    const first = await runSetup({ cwd: root, nonInteractive: true });
    assert.equal(first.trackerChanged, true);
    assert.equal(fs.readFileSync(trackerPath, "utf8"), "local\n");
    const before = snapshotTree(path.join(root, "backlog"));
    const second = await runSetup({ cwd: root, nonInteractive: true });
    assert.equal(second.trackerChanged, false);
    assert.deepEqual(snapshotTree(path.join(root, "backlog")), before);
  });

  it("cleans temp files and preserves config and selection on atomic failures", async (t) => {
    for (const failure of ["write", "rename"]) {
      const root = makeRoot(t, `setup-atomic-${failure}-`);
      const configPath = writeConfig(root, "project_name: atomic\n# exact bytes\n");
      const trackerPath = writeTracker(root, "local\n");
      const before = snapshotTree(root);
      const fsApi = {
        ...fs,
        writeFileSync(file, content, options) {
          if (failure === "write" && path.basename(file).includes(".tracker.") &&
              path.basename(file).endsWith(".tmp")) {
            fs.writeFileSync(file, "partial", options);
            throw new Error("injected write failure");
          }
          return fs.writeFileSync(file, content, options);
        },
        renameSync(from, to) {
          if (failure === "rename" && to === trackerPath) {
            throw new Error("injected rename failure");
          }
          return fs.renameSync(from, to);
        },
      };
      await assert.rejects(
        runSetup(
          { cwd: root, tracker: "github", nonInteractive: true },
          { fs: fsApi }
        ),
        /injected/
      );
      assert.equal(fs.readFileSync(configPath, "utf8"), "project_name: atomic\n# exact bytes\n");
      assert.equal(fs.readFileSync(trackerPath, "utf8"), "local\n");
      const after = snapshotTree(root);
      assert.deepEqual(after["backlog/.tracker"], before["backlog/.tracker"]);
      assert.deepEqual(after["backlog/config.yml"], before["backlog/config.yml"]);
      assert.deepEqual(fs.readdirSync(path.join(root, "backlog")).sort(), [
        ".tracker", "config.yml",
      ]);
    }
  });

  it("rejects an unsafe .tracker symlink before mutation", async (t) => {
    const root = makeRoot(t);
    const outside = makeRoot(t, "setup-outside-");
    fs.mkdirSync(path.join(root, "backlog"));
    try {
      fs.symlinkSync(path.join(outside, "selection"), path.join(root, "backlog/.tracker"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege is unavailable");
        return;
      }
      throw error;
    }
    const before = snapshotTree(root);
    await assert.rejects(
      runSetup({ cwd: root, tracker: "local", nonInteractive: true }),
      /unsafe tracker path/
    );
    assert.deepEqual(snapshotTree(root), before);
    assert.deepEqual(fs.readdirSync(outside), []);
  });
});

describe("CLI and compatibility wrapper", () => {
  it("emits structured output and writes a newline-terminated selection", (t) => {
    const root = makeRoot(t);
    const run = spawnSync(
      process.execPath,
      [SCRIPT, "--tracker", "local", "--non-interactive", "--json", "--project-name", "cli-demo"],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    assert.equal(result.selection, "local");
    assert.equal(result.projectName, "cli-demo");
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "local\n");
    assert.equal(fs.existsSync(path.join(root, "backlog/config.yml")), false);
  });

  it("init.sh preserves fresh github meaning and migrates legacy local", (t) => {
    const fresh = makeRoot(t, "setup-init-fresh-");
    const freshRun = spawnBashSync([INIT, "wrapper-demo"], {
      cwd: fresh,
      encoding: "utf8",
    });
    assert.equal(freshRun.status, 0, freshRun.stderr);
    assert.equal(fs.readFileSync(path.join(fresh, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.existsSync(path.join(fresh, "backlog/config.yml")), false);

    const legacy = makeRoot(t, "setup-init-legacy-");
    const raw = "project_name: existing\ntracker: local\n# keep\n";
    const configPath = writeConfig(legacy, raw);
    const legacyRun = spawnBashSync([INIT, "ignored"], {
      cwd: legacy,
      encoding: "utf8",
    });
    assert.equal(legacyRun.status, 0, legacyRun.stderr);
    assert.equal(fs.readFileSync(path.join(legacy, "backlog/.tracker"), "utf8"), "local\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });
});
