const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "setup-dev-backlog.js");
const INIT = path.join(__dirname, "init.sh");

function makeRoot(t, prefix = "setup-integration-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function providerTrap(t) {
  const bin = makeRoot(t, "setup-provider-trap-");
  const log = path.join(bin, "calls.log");
  for (const command of ["git", "gh"]) {
    const executable = path.join(bin, command);
    fs.writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' ${command} >> "${log}"\nexit 91\n`);
    fs.chmodSync(executable, 0o755);
  }
  return {
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [],
  };
}

function runCli(root, args, env = process.env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, env, encoding: "utf8" });
}

function snapshot(root) {
  const result = {};
  function walk(current, relative = "") {
    let currentStat;
    try {
      currentStat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) {
      result[relative || "."] = {
        type: currentStat.isSymbolicLink() ? "symlink" : "file",
        bytes: currentStat.isFile() ? fs.readFileSync(current).toString("base64") : null,
        target: currentStat.isSymbolicLink() ? fs.readlinkSync(current) : null,
        ino: currentStat.ino,
        mtimeMs: currentStat.mtimeMs,
      };
      return;
    }
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const key = path.join(relative, name);
      const stat = fs.lstatSync(full);
      result[key] = {
        type: stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory" : "file",
        bytes: stat.isFile() ? fs.readFileSync(full).toString("base64") : null,
        target: stat.isSymbolicLink() ? fs.readlinkSync(full) : null,
        ino: stat.ino,
        mtimeMs: stat.mtimeMs,
      };
      if (stat.isDirectory() && !stat.isSymbolicLink()) walk(full, key);
    }
  }
  walk(root);
  return result;
}

function withoutDirectoryTimes(tree) {
  return Object.fromEntries(Object.entries(tree).map(([key, value]) => [
    key,
    value.type === "directory" ? { ...value, mtimeMs: undefined } : value,
  ]));
}

function faultPreload(t, source) {
  const root = makeRoot(t, "setup-preload-");
  const preload = path.join(root, "fault.cjs");
  fs.writeFileSync(preload, source);
  return preload;
}

function providerStubs(t, { remote, ghStatus }) {
  const bin = makeRoot(t, "setup-provider-stubs-");
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\nprintf '%s\\n' '${remote}'\n`);
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nexit ${ghStatus}\n`);
  fs.chmodSync(path.join(bin, "git"), 0o755);
  fs.chmodSync(path.join(bin, "gh"), 0o755);
  const preload = faultPreload(t, [
    'Object.defineProperty(process.stdin, "isTTY", { value: true });',
    'Object.defineProperty(process.stdout, "isTTY", { value: true });',
  ].join("\n"));
  return {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    NODE_OPTIONS: `--require=${preload}`,
  };
}

describe("setup-dev-backlog real process integration", () => {
  it("creates fresh explicit local/github configs without invoking provider commands", (t) => {
    const trap = providerTrap(t);
    for (const tracker of ["local", "github"]) {
      const root = makeRoot(t, `setup-fresh-${tracker}-`);
      const run = runCli(root, [
        "--tracker", tracker,
        "--non-interactive",
        "--json",
        "--project-name", `project:${tracker}\nquoted`,
      ], trap.env);
      assert.equal(run.status, 0, run.stderr);
      const result = JSON.parse(run.stdout);
      assert.equal(result.selection, tracker);
      const config = fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8");
      assert.match(config, new RegExp(`^tracker: ${tracker}$`, "m"));
      assert.match(config, /^project_name: "project:.*\\nquoted"$/m);
      assert.deepEqual(fs.readdirSync(path.join(root, "backlog")).sort(), [
        "completed", "config.yml", "sprints", "tasks",
      ]);
    }
    assert.deepEqual(trap.calls(), []);
  });

  it("refuses no-choice and duplicate tracker arguments before mutation with runnable commands", (t) => {
    for (const args of [
      ["--non-interactive"],
      ["--tracker", "local", "--tracker=github", "--non-interactive"],
    ]) {
      const root = makeRoot(t, "setup-refusal-");
      const run = runCli(root, args);
      assert.notEqual(run.status, 0);
      if (args.length === 1) {
        assert.match(run.stderr, new RegExp(process.execPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(run.stderr, /setup-dev-backlog\.js.*--tracker.*local.*--non-interactive/);
      } else {
        assert.match(run.stderr, /--tracker may be supplied only once/);
      }
      assert.equal(fs.existsSync(path.join(root, "backlog")), false);
    }
  });

  it("pins legacy GitHub authority before allowing an explicit local switch", (t) => {
    const root = makeRoot(t, "setup-legacy-");
    const trap = providerTrap(t);
    fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
    const configPath = path.join(root, "backlog/config.yml");
    fs.writeFileSync(configPath, "project_name: legacy\r\nnotes: keep");
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-1.md"), "legacy mirror bytes\r\n");
    const before = snapshot(root);

    const refused = runCli(root, ["--tracker", "local", "--non-interactive"], trap.env);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /First pin compatibility/);
    assert.deepEqual(snapshot(root), before);

    const pin = runCli(root, ["--non-interactive", "--json"], trap.env);
    assert.equal(pin.status, 0, pin.stderr);
    assert.equal(JSON.parse(pin.stdout).selectionSource, "legacy-pin");
    assert.equal(
      fs.readFileSync(configPath, "utf8"),
      "project_name: legacy\r\nnotes: keep\r\ntracker: github"
    );
    const taskBeforeSwitch = snapshot(path.join(root, "backlog/tasks"));

    const switched = runCli(root, ["--tracker=local", "--non-interactive"], trap.env);
    assert.equal(switched.status, 0, switched.stderr);
    assert.match(fs.readFileSync(configPath, "utf8"), /\r\ntracker: local$/);
    assert.deepEqual(snapshot(path.join(root, "backlog/tasks")), taskBeforeSwitch);
    assert.deepEqual(trap.calls(), []);
  });

  it("repairs partial structure and reruns byte/idempotently without provider probes", (t) => {
    const root = makeRoot(t, "setup-partial-");
    const trap = providerTrap(t);
    fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
    fs.mkdirSync(path.join(root, "backlog/sprints"));
    fs.writeFileSync(path.join(root, "backlog/config.yml"), "\uFEFFproject_name: existing\r\ntracker: local\r\nnote: |\r\n  tracker: github\r\n");
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-2.md"), "task bytes");
    fs.writeFileSync(path.join(root, "backlog/sprints/current.md"), "sprint bytes\n");

    const first = runCli(root, ["--non-interactive"], trap.env);
    assert.equal(first.status, 0, first.stderr);
    const repaired = snapshot(path.join(root, "backlog"));
    assert.equal(repaired.completed.type, "directory");
    const second = runCli(root, ["--non-interactive"], trap.env);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(path.join(root, "backlog")), repaired);
    assert.deepEqual(trap.calls(), []);
  });

  it("rejects malformed state before touching user files", (t) => {
    const root = makeRoot(t, "setup-malformed-");
    fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
    fs.writeFileSync(path.join(root, "backlog/config.yml"), "tracker: local\ntracker: github\n");
    fs.writeFileSync(path.join(root, "backlog/tasks/user.md"), "user content");
    const before = snapshot(root);
    const run = runCli(root, ["--non-interactive"]);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Invalid tracker configuration/);
    assert.match(run.stderr, /setup-dev-backlog\.js/);
    assert.deepEqual(snapshot(root), before);
  });

  it("rejects tracker values with an unseparated hash before real CLI mutation", (t) => {
    for (const tracker of ["local", "github"]) {
      const root = makeRoot(t, `setup-comment-boundary-${tracker}-`);
      fs.mkdirSync(path.join(root, "backlog/tasks"), { recursive: true });
      fs.writeFileSync(path.join(root, "backlog/config.yml"), `tracker: ${tracker}#not-a-comment\n`);
      fs.writeFileSync(path.join(root, "backlog/tasks/user.md"), "user bytes\n");
      const before = snapshot(root);
      const run = runCli(root, ["--non-interactive"]);
      assert.notEqual(run.status, 0, tracker);
      assert.match(run.stderr, /Invalid tracker configuration/);
      assert.deepEqual(snapshot(root), before, tracker);
    }
  });

  it("rejects every dangling canonical symlink before any mutation", (t) => {
    for (const relative of [
      "backlog",
      "backlog/config.yml",
      "backlog/sprints",
      "backlog/tasks",
      "backlog/completed",
    ]) {
      const root = makeRoot(t, "setup-dangling-");
      const link = path.join(root, relative);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(path.join(root, "missing-target"), link);
      const before = snapshot(root);
      const run = runCli(root, ["--tracker", "local", "--non-interactive"]);
      assert.notEqual(run.status, 0, `${relative}: ${run.stderr}`);
      assert.match(run.stderr, /unsafe (?:backlog|config) path/, relative);
      assert.deepEqual(snapshot(root), before, relative);
    }
  });

  it("rolls back real-process setup on mkdir, write, and rename failures", (t) => {
    const failures = {
      mkdir: [
        'const fs = require("node:fs");',
        'const original = fs.mkdirSync;',
        'fs.mkdirSync = function (target, options) {',
        '  if (String(target).endsWith("/backlog/tasks")) throw new Error("injected mkdir failure");',
        '  return original.call(this, target, options);',
        '};',
      ].join("\n"),
      write: [
        'const fs = require("node:fs");',
        'const original = fs.writeFileSync;',
        'fs.writeFileSync = function (target, content, options) {',
        '  if (String(target).includes(".config.yml.") && String(target).endsWith(".tmp")) {',
        '    original.call(this, target, "partial", options);',
        '    throw new Error("injected write failure");',
        '  }',
        '  return original.call(this, target, content, options);',
        '};',
      ].join("\n"),
      rename: [
        'const fs = require("node:fs");',
        'const original = fs.renameSync;',
        'fs.renameSync = function (from, to) {',
        '  if (String(to).endsWith("/backlog/config.yml")) throw new Error("injected rename failure");',
        '  return original.call(this, from, to);',
        '};',
      ].join("\n"),
    };

    for (const [failure, source] of Object.entries(failures)) {
      const root = makeRoot(t, `setup-failure-${failure}-`);
      const preload = faultPreload(t, source);
      if (failure !== "mkdir") {
        fs.mkdirSync(path.join(root, "backlog"));
        for (const name of ["sprints", "tasks", "completed"]) {
          fs.mkdirSync(path.join(root, "backlog", name));
        }
        fs.writeFileSync(
          path.join(root, "backlog/config.yml"),
          "project_name: preserved\r\ntracker: local\r\n# exact bytes"
        );
      }
      const before = snapshot(root);
      const run = runCli(root, ["--tracker", failure === "mkdir" ? "local" : "github", "--non-interactive"], {
        ...process.env,
        NODE_OPTIONS: `--require=${preload}`,
      });
      assert.notEqual(run.status, 0, failure);
      assert.match(run.stderr, new RegExp(`injected ${failure} failure`));
      assert.deepEqual(withoutDirectoryTimes(snapshot(root)), withoutDirectoryTimes(before), failure);
    }
  });

  it("changes only the tracker bytes around complex preserved YAML lexical contexts", (t) => {
    const root = makeRoot(t, "setup-lexical-preservation-");
    fs.mkdirSync(path.join(root, "backlog"));
    const original = [
      '"note:with:colons": &copy !text |-2',
      "    tracker: text in block",
      "single: 'first line",
      "  tracker: text in single quote",
      "  last line'",
      'double: "first line',
      "  tracker: text in double quote",
      '  last line"',
      "tracker: github # selected",
      "tail: preserved",
    ].join("\r\n");
    fs.writeFileSync(path.join(root, "backlog/config.yml"), original);

    const run = runCli(root, ["--tracker", "local", "--non-interactive"]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"),
      original.replace("tracker: github # selected", "tracker: local # selected")
    );
  });

  it("preserves plain apostrophes and rejects advanced tracker keys before mutation", (t) => {
    const preserved = makeRoot(t, "setup-plain-quotes-");
    fs.mkdirSync(path.join(preserved, "backlog"));
    const plainRaw = "note: don't stop\nmessage: say \"go\" now\ntracker: local\n";
    fs.writeFileSync(path.join(preserved, "backlog/config.yml"), plainRaw);
    const preservedRun = runCli(preserved, ["--non-interactive"]);
    assert.equal(preservedRun.status, 0, preservedRun.stderr);
    assert.equal(fs.readFileSync(path.join(preserved, "backlog/config.yml"), "utf8"), plainRaw);

    for (const declaration of [
      "items: [tracker: github]",
      "&authority tracker: github",
      "? tracker\n: github",
      'mapping: {"track\\x65r": github}',
      "mapping: {emoji: 😀, tracker: github}",
      "mapping: [\n  {emoji: 😀,\n   tracker: github}\n]",
    ]) {
      const root = makeRoot(t, "setup-advanced-key-");
      fs.mkdirSync(path.join(root, "backlog"));
      fs.writeFileSync(path.join(root, "backlog/config.yml"), `${declaration}\ntracker: local\n`);
      const before = snapshot(root);
      const run = runCli(root, ["--non-interactive"]);
      assert.notEqual(run.status, 0, declaration);
      assert.match(run.stderr, /Invalid tracker configuration/, declaration);
      assert.deepEqual(snapshot(root), before, declaration);
    }
  });

  it("rejects incomplete EOF and cross-line authority before any real CLI mutation", (t) => {
    for (const raw of [
      'note: "unterminated\ntracker: local\n',
      "mapping: {other: value\ntracker: local\n",
      "tracker: local\n?\n",
      "?\n  tracker\n: github\ntracker: local\n",
      '?\n  "track\\\n    er"\n: github\ntracker: local\n',
      "key_name: &authority tracker\n*authority: github\ntracker: local\n",
      "*unknown: value\ntracker: local\n",
      "<<: *unknown\ntracker: local\n",
      "<<: [*one, *two]\ntracker: local\n",
      "mapping: {<<: *unknown}\ntracker: local\n",
      "tracker: local\n---\n",
      "---\n---\ntracker: local\n",
      "---\ntracker: local\n...\n",
      "mapping: ]\ntracker: local\n",
      "mapping: {items: [one}}\ntracker: local\n",
      "mapping: {items: [one]\ntracker: local\n",
      "note: !<unterminated\ntracker: local\n",
      'note: "bad\\q"\ntracker: local\n',
      "%YAML 1.2\n---\ntracker: local\n",
      "%TAG ! tag:example.com,2026:\ntracker: local\n",
      "%FOO bar\ntracker: local\n",
      "note: &\ntracker: local\n",
      "note: !\ntracker: local\n",
      "note: *\ntracker: local\n",
      "note: !<>\ntracker: local\n",
      'note: "bad\\uD800"\ntracker: local\n',
      "note: \0\ntracker: local\n",
      "note: \x01\ntracker: local\n",
      "note: \ufffe\ntracker: local\n",
    ]) {
      const root = makeRoot(t, "setup-document-state-");
      fs.mkdirSync(path.join(root, "backlog"));
      fs.writeFileSync(path.join(root, "backlog/config.yml"), raw);
      const before = snapshot(root);
      const run = runCli(root, ["--non-interactive"]);
      assert.notEqual(run.status, 0, raw);
      assert.match(run.stderr, /Invalid tracker configuration/, raw);
      assert.deepEqual(snapshot(root), before, raw);
    }
  });

  it("preserves null anchors, alias values, and markers inside scalar content", (t) => {
    const root = makeRoot(t, "setup-narrow-yaml-");
    fs.mkdirSync(path.join(root, "backlog"));
    const raw = [
      "---",
      "note: &empty",
      "note2: *empty",
      "literal: |",
      "  ---",
      "  ...",
      'quoted: "--- and ..."',
      "tracker: local",
      "plain: continued",
      "  ---",
      "  ...",
      "'<<': *empty",
      "flow: {'<<': *empty}",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(root, "backlog/config.yml"), raw);
    const run = runCli(root, ["--non-interactive"]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"), raw);
  });

  it("preserves matching multiline flow state without changing config bytes", (t) => {
    const root = makeRoot(t, "setup-flow-stack-");
    fs.mkdirSync(path.join(root, "backlog"));
    const raw = "mapping: {items: [one,\n  two]}\ntracker: local\n";
    fs.writeFileSync(path.join(root, "backlog/config.yml"), raw);
    const before = snapshot(root);
    const run = runCli(root, ["--non-interactive"]);
    assert.equal(run.status, 0, run.stderr);
    const after = snapshot(root);
    assert.deepEqual(after["backlog/config.yml"], before["backlog/config.yml"]);
    assert.equal(fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"), raw);
  });

  it("rejects a raw surrogate from the real CLI read boundary without mutation", (t) => {
    const root = makeRoot(t, "setup-surrogate-");
    fs.mkdirSync(path.join(root, "backlog"));
    fs.writeFileSync(path.join(root, "backlog/config.yml"), "tracker: local\n");
    const preload = faultPreload(t, [
      'const fs = require("node:fs");',
      'const original = fs.readFileSync;',
      'fs.readFileSync = function (target, options) {',
      '  if (String(target).endsWith("/backlog/config.yml") && options === "utf8") {',
      '    return "note: \\ud800\\ntracker: local\\n";',
      '  }',
      '  return original.call(this, target, options);',
      '};',
    ].join("\n"));
    const before = snapshot(root);
    const run = runCli(root, ["--non-interactive"], {
      ...process.env,
      NODE_OPTIONS: `--require=${preload}`,
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /raw surrogate/);
    assert.deepEqual(snapshot(root), before);
  });

  it("preserves valid Unicode anchors, aliases, tags, and quoted escapes", (t) => {
    const root = makeRoot(t, "setup-valid-unicode-");
    fs.mkdirSync(path.join(root, "backlog"));
    const raw = [
      "note: &한글 값",
      "copy: *한글",
      "tagged: !<tag:example.com,2026:value> 값",
      "local: !foo 값",
      "standard: !!str 값",
      'escaped: "\\N \\u263A \\U0001F600"',
      "raw: 😀",
      "tracker: local",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(root, "backlog/config.yml"), raw);
    const run = runCli(root, ["--non-interactive"]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"), raw);
  });

  it("uses stubbed origin and gh evidence for fresh interactive recommendations", (t) => {
    for (const row of [
      { remote: "https://github.com/owner/repo.git", ghStatus: 0, expected: "github" },
      { remote: "https://github.com/owner/repo/issues", ghStatus: 0, expected: "local" },
      { remote: "https://github.com/owner/repo.git", ghStatus: 1, expected: "local" },
    ]) {
      const root = makeRoot(t, `setup-interactive-${row.expected}-`);
      const run = spawnSync(process.execPath, [SCRIPT, "--json"], {
        cwd: root,
        env: providerStubs(t, row),
        encoding: "utf8",
        input: "\n",
      });
      assert.equal(run.status, 0, run.stderr);
      const jsonStart = run.stdout.indexOf("{");
      const result = JSON.parse(run.stdout.slice(jsonStart));
      assert.equal(result.selection, row.expected);
      assert.equal(result.selectionSource, "recommended");
      assert.equal(result.evidence.remote, row.remote.includes("/issues") ? "non-github" : "github");
    }
  });

  it("keeps init.sh fresh-GitHub compatibility and preserves an existing local choice", (t) => {
    const trap = providerTrap(t);
    const fresh = makeRoot(t, "setup-init-fresh-");
    const freshRun = spawnSync("bash", [INIT, "wrapper-demo"], {
      cwd: fresh, env: trap.env, encoding: "utf8",
    });
    assert.equal(freshRun.status, 0, freshRun.stderr);
    assert.match(fs.readFileSync(path.join(fresh, "backlog/config.yml"), "utf8"), /^tracker: github$/m);

    const existing = makeRoot(t, "setup-init-existing-");
    fs.mkdirSync(path.join(existing, "backlog"));
    fs.writeFileSync(path.join(existing, "backlog/config.yml"), "project_name: stable\ntracker: local\n");
    const first = spawnSync("bash", [INIT, "ignored"], {
      cwd: existing, env: trap.env, encoding: "utf8",
    });
    assert.equal(first.status, 0, first.stderr);
    const stable = snapshot(path.join(existing, "backlog"));
    const second = spawnSync("bash", [INIT, "changed-remote"], {
      cwd: existing, env: trap.env, encoding: "utf8",
    });
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(snapshot(path.join(existing, "backlog")), stable);
    assert.deepEqual(trap.calls(), []);
  });
});
