const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { spawnBashSync } = require("./bash-runtime.js");

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

function faultPreload(t, source) {
  const root = makeRoot(t, "setup-preload-");
  const preload = path.join(root, "fault.cjs");
  fs.writeFileSync(preload, source);
  return preload;
}

describe("setup-dev-backlog real process integration", () => {
  it("creates fresh explicit selections without config.yml", (t) => {
    for (const tracker of ["local", "github"]) {
      const root = makeRoot(t, `setup-fresh-${tracker}-`);
      const run = runCli(root, [
        "--tracker", tracker, "--non-interactive", "--json", "--project-name", "fresh",
      ]);
      assert.equal(run.status, 0, run.stderr);
      assert.equal(JSON.parse(run.stdout).selection, tracker);
      assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), `${tracker}\n`);
      assert.equal(fs.existsSync(path.join(root, "backlog/config.yml")), false);
    }
  });

  it("migrates both legacy values while preserving exact config bytes", (t) => {
    for (const tracker of ["local", "github"]) {
      const root = makeRoot(t, `setup-legacy-${tracker}-`);
      fs.mkdirSync(path.join(root, "backlog"));
      const configPath = path.join(root, "backlog/config.yml");
      const raw = `\uFEFFproject_name: legacy\r\ntracker: "${tracker}"  # stale after migration\r\nnote: |\r\n  tracker: github`;
      fs.writeFileSync(configPath, raw);
      const run = runCli(root, ["--non-interactive", "--json"]);
      assert.equal(run.status, 0, run.stderr);
      assert.equal(JSON.parse(run.stdout).selectionSource, "legacy-migration");
      assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), `${tracker}\n`);
      assert.equal(fs.readFileSync(configPath, "utf8"), raw);
    }
  });

  it("refuses an ambiguous legacy config without creating anything", (t) => {
    const root = makeRoot(t, "setup-legacy-ambiguous-");
    fs.mkdirSync(path.join(root, "backlog"));
    const configPath = path.join(root, "backlog/config.yml");
    const raw = "project_name: legacy\r\ntracker: local\r\ntracker: github\r\n";
    fs.writeFileSync(configPath, raw);
    const before = snapshot(root);

    const refused = runCli(root, ["--non-interactive", "--json"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /Ambiguous tracker authority/);
    // Fail closed before any effect: no .tracker, no directories, config byte-identical.
    assert.equal(fs.existsSync(path.join(root, "backlog/.tracker")), false);
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
    assert.deepEqual(snapshot(root), before);
  });

  it("pins a tracker-less legacy config before a local switch", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
    const configPath = path.join(root, "backlog/config.yml");
    const raw = "project_name: legacy\r\nnotes: keep";
    fs.writeFileSync(configPath, raw);
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-1.md"), "mirror bytes\r\n");
    const before = snapshot(root);

    const refused = runCli(root, ["--tracker", "local", "--non-interactive"]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /First pin compatibility/);
    assert.deepEqual(snapshot(root), before);

    const pin = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(pin.status, 0, pin.stderr);
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);

    const switched = runCli(root, ["--tracker=local", "--non-interactive"]);
    assert.equal(switched.status, 0, switched.stderr);
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "local\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });

  it("treats .tracker as authoritative and leaves complex YAML untouched", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog"));
    const configPath = path.join(root, "backlog/config.yml");
    const raw = [
      '"note:with:colons": &copy !text |-2',
      "    tracker: text in block",
      "single: 'first line",
      "  tracker: text in single quote",
      "  last line'",
      "tracker: github # stale",
      "tail: preserved",
    ].join("\r\n");
    fs.writeFileSync(configPath, raw);
    fs.writeFileSync(path.join(root, "backlog/.tracker"), "local\n");

    const preserved = runCli(root, ["--non-interactive", "--json"]);
    assert.equal(preserved.status, 0, preserved.stderr);
    assert.equal(JSON.parse(preserved.stdout).selection, "local");
    const switched = runCli(root, ["--tracker", "github", "--non-interactive"]);
    assert.equal(switched.status, 0, switched.stderr);
    assert.equal(fs.readFileSync(path.join(root, "backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });

  it("repairs partial structure and reruns byte-idempotently", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
    fs.writeFileSync(path.join(root, "backlog/.tracker"), "local\n");
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-2.md"), "task bytes");
    const first = runCli(root, ["--non-interactive"]);
    assert.equal(first.status, 0, first.stderr);
    const repaired = snapshot(path.join(root, "backlog"));
    const second = runCli(root, ["--non-interactive"]);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(path.join(root, "backlog")), repaired);
  });

  it("rejects invalid .tracker before any mutation", (t) => {
    const root = makeRoot(t);
    fs.mkdirSync(path.join(root, "backlog"));
    fs.writeFileSync(path.join(root, "backlog/.tracker"), "gitlab\n");
    fs.writeFileSync(path.join(root, "backlog/config.yml"), "tracker: local\n");
    const before = snapshot(root);
    const run = runCli(root, ["--non-interactive"]);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /expected github or local/);
    assert.deepEqual(snapshot(root), before);
  });

  it("rolls back fresh directories and temp bytes on .tracker publication failures", (t) => {
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
      const run = runCli(root, ["--tracker", "local", "--non-interactive"], {
        ...process.env,
        NODE_OPTIONS: `--require=${preload}`,
      });
      assert.notEqual(run.status, 0, failure);
      assert.match(run.stderr, new RegExp(`injected ${failure} failure`));
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
    const run = runCli(root, ["--tracker", "local", "--non-interactive"]);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /unsafe tracker path/);
    assert.deepEqual(snapshot(root), before);
  });

  it("keeps init.sh fresh github compatibility and legacy migration", (t) => {
    const fresh = makeRoot(t, "setup-init-fresh-");
    const freshRun = spawnBashSync([INIT, "wrapper-demo"], {
      cwd: fresh,
      encoding: "utf8",
    });
    assert.equal(freshRun.status, 0, freshRun.stderr);
    assert.equal(fs.readFileSync(path.join(fresh, "backlog/.tracker"), "utf8"), "github\n");

    const legacy = makeRoot(t, "setup-init-legacy-");
    fs.mkdirSync(path.join(legacy, "backlog"));
    const configPath = path.join(legacy, "backlog/config.yml");
    const raw = "project_name: stable\ntracker: local\n";
    fs.writeFileSync(configPath, raw);
    const legacyRun = spawnBashSync([INIT, "ignored"], {
      cwd: legacy,
      encoding: "utf8",
    });
    assert.equal(legacyRun.status, 0, legacyRun.stderr);
    assert.equal(fs.readFileSync(path.join(legacy, "backlog/.tracker"), "utf8"), "local\n");
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  });
});
