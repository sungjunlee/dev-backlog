const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readConfig } = require("./lib.js");
const { resolveConfiguredTracker } = require("./tracker.js");

const {
  ConfigValidationError,
  collectGithubEvidence,
  inspectConfig,
  isGithubRemote,
  mutateTrackerText,
  parseArgs,
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
  const backlog = path.join(root, "backlog");
  fs.mkdirSync(backlog, { recursive: true });
  fs.writeFileSync(path.join(backlog, "config.yml"), raw);
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

function noProviderCalls() {
  return () => {
    throw new Error("provider command must not be called");
  };
}

function evidenceExec({ remote, gh = "authenticated", secret = "SECRET-TOKEN" } = {}) {
  const calls = [];
  const execFileSync = (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") {
      if (remote === undefined) {
        const error = new Error(`no origin ${secret}`);
        error.status = 1;
        throw error;
      }
      return remote;
    }
    if (gh === "missing") {
      const error = new Error(`spawn gh ENOENT ${secret}`);
      error.code = "ENOENT";
      throw error;
    }
    if (gh === "unauthenticated") {
      const error = new Error(`auth failed ${secret}`);
      error.status = 1;
      throw error;
    }
    return "github.com logged in";
  };
  return { calls, execFileSync, secret };
}

describe("tracker config state machine", () => {
  it("accepts one valid top-level tracker and preserves it without explicit intent", () => {
    const raw = "# owner note\ntracker: local\ntask_prefix: BACK\n";
    const state = inspectConfig(raw, "/repo/backlog/config.yml");
    assert.equal(state.kind, "selected");
    assert.equal(state.tracker, "local");
    assert.equal(mutateTrackerText(raw, state, "local"), raw);
  });

  it("pins a legacy config once while preserving CRLF and no-final-newline shape", () => {
    const crlf = "project_name: old\r\n# retained\r\ntask_prefix: BACK\r\n";
    const crlfState = inspectConfig(crlf, "/repo/backlog/config.yml");
    assert.equal(
      mutateTrackerText(crlf, crlfState, "github"),
      "project_name: old\r\n# retained\r\ntask_prefix: BACK\r\ntracker: github\r\n"
    );

    const noFinal = "project_name: old\n# retained";
    const noFinalState = inspectConfig(noFinal, "/repo/backlog/config.yml");
    assert.equal(
      mutateTrackerText(noFinal, noFinalState, "github"),
      "project_name: old\n# retained\ntracker: github"
    );
  });

  it("changes only the selected scalar and preserves spacing, quoting, and comments", () => {
    const raw = "project_name: x\r\ntracker:  'github'  # keep this\r\nother: yes";
    const state = inspectConfig(raw, "/repo/backlog/config.yml");
    assert.equal(
      mutateTrackerText(raw, state, "local"),
      "project_name: x\r\ntracker:  'local'  # keep this\r\nother: yes"
    );
  });

  it("rejects invalid, missing-value, duplicate, nested, and ambiguous tracker forms", () => {
    const cases = [
      "tracker: gitlab\n",
      "tracker:\n",
      "tracker: github\ntracker: local\n",
      "provider:\n  tracker: local\n",
      "tracker : local\n",
      "\"tracker\": local\n",
    ];
    for (const raw of cases) {
      assert.throws(
        () => inspectConfig(raw, "/repo/backlog/config.yml"),
        (error) => {
          assert.ok(error instanceof ConfigValidationError);
          assert.match(error.message, /\/repo\/backlog\/config\.yml/);
          assert.match(error.message, /github/);
          assert.match(error.message, /local/);
          assert.match(error.message, /--tracker/);
          return true;
        }
      );
    }
  });

  it("ignores tracker-like unknown keys and block scalar text", () => {
    const raw = [
      "project_name: preserved",
      "tracker-options: manual",
      "note: |",
      "  tracker: local",
      "  literal text",
      "tracker: github",
      "",
    ].join("\n");
    const state = inspectConfig(raw, "/repo/backlog/config.yml");
    assert.equal(state.kind, "selected");
    assert.equal(state.tracker, "github");
    assert.equal(mutateTrackerText(raw, state, "local"), raw.replace("tracker: github", "tracker: local"));
  });

  it("preserves tracker text inside quoted-key block scalars and multiline quoted scalars", () => {
    const fixtures = [
      [
        '"note:with:colons": &copy !text |-2',
        "    tracker: local",
        "    literal text",
        "tracker: github",
        "",
      ].join("\n"),
      [
        "note: 'first line",
        "  tracker: local",
        "  still quoted'",
        "tracker: github",
        "",
      ].join("\n"),
      [
        'note: "first line',
        "  tracker: local",
        '  still quoted"',
        "tracker: github",
        "",
      ].join("\n"),
    ];

    for (const raw of fixtures) {
      const state = inspectConfig(raw, "/repo/backlog/config.yml");
      assert.equal(state.tracker, "github");
      assert.equal(mutateTrackerText(raw, state, "local"), raw.replace(/tracker: github/, "tracker: local"));
    }
  });

  it("does not open quote state for apostrophes or embedded quotes in plain scalars", () => {
    const raw = [
      "note: don't hide the authority",
      'message: say "tracker: github" plainly',
      "tracker: local",
      "",
    ].join("\n");
    const state = inspectConfig(raw, "/repo/backlog/config.yml");
    assert.equal(state.kind, "selected");
    assert.equal(state.tracker, "local");
    assert.equal(mutateTrackerText(raw, state, "local"), raw);
  });

  it("fails closed on actual top-level, nested, sequence, and flow tracker declarations", () => {
    for (const declaration of [
      "tracker: github",
      "  tracker: github",
      "- tracker: github",
      "mapping: {tracker: github}",
      "mapping: {'tracker': github}",
      "items: [tracker: github]",
      "&authority tracker: github",
      "!authority tracker: github",
      "? tracker\n: github",
      'mapping: {"track\\x65r": github}',
      "mapping: {emoji: 😀, tracker: github}",
      "mapping: [\n  {emoji: 😀,\n   tracker: github}\n]",
    ]) {
      const raw = `${declaration}\ntracker: local\n`;
      assert.throws(() => inspectConfig(raw, "/repo/backlog/config.yml"), ConfigValidationError);
    }
  });

  it("recognizes a BOM-prefixed top-level tracker without disturbing the BOM", () => {
    const raw = "\uFEFFtracker: github\r\nother: yes";
    const state = inspectConfig(raw, "/repo/backlog/config.yml");
    assert.equal(state.tracker, "github");
    assert.equal(mutateTrackerText(raw, state, "local"), "\uFEFFtracker: local\r\nother: yes");
  });
});

describe("CLI argument boundary", () => {
  it("rejects every duplicate tracker flag spelling, even when values agree", () => {
    for (const argv of [
      ["--tracker", "local", "--tracker", "github"],
      ["--tracker=local", "--tracker=local"],
      ["--tracker", "github", "--tracker=local"],
      ["--tracker=github", "--tracker", "github"],
    ]) {
      assert.throws(() => parseArgs(argv), /only once/);
    }
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
      "http://github.com/owner/repo.git",
      "git://github.com/owner/repo.git",
      "https://user:secret@github.com/owner/repo.git",
      "https://github.com.evil.test/owner/repo.git",
      "git@github.com.evil.test:owner/repo.git",
      "https://github.com/owner",
      "https://github.com/owner/repo/issues",
      "https://github.com/owner/repo.git/extra",
      "https://github.com/owner/repo.git?tab=readme",
      "https://github.com/owner/repo#readme",
      "ftp://github.com/owner/repo.git",
      "github.com/owner/repo",
      "github.com:owner/repo.git",
      "alice@github.com:owner/repo.git",
      "GIT@github.com:owner/repo.git",
      "ssh://alice@github.com/owner/repo.git",
      "ssh://github.com/owner/repo.git",
      "ssh://git@ssh.github.com/owner/repo.git",
      "ssh://alice@ssh.github.com:443/owner/repo.git",
      "git@github.com:owner/repo/issues",
    ]) assert.equal(isGithubRemote(remote), false, remote);
  });

  it("recommends github only for the usable-origin/authenticated matrix cell", () => {
    const matrix = [
      {
        input: { remote: "git@github.com:owner/repo.git", gh: "authenticated" },
        expected: { recommendation: "github", remote: "github", cli: "available", auth: "authenticated" },
      },
      {
        input: { remote: "https://gitlab.com/owner/repo.git", gh: "authenticated" },
        expected: { recommendation: "local", remote: "non-github", cli: "available", auth: "authenticated" },
      },
      {
        input: { remote: "https://github.com/owner/repo.git", gh: "unauthenticated" },
        expected: { recommendation: "local", remote: "github", cli: "available", auth: "unauthenticated" },
      },
      {
        input: { remote: "ssh://git@ssh.github.com:443/owner/repo.git", gh: "missing" },
        expected: { recommendation: "local", remote: "github", cli: "missing", auth: "not-checked" },
      },
      {
        input: { remote: undefined, gh: "authenticated" },
        expected: { recommendation: "local", remote: "missing", cli: "available", auth: "authenticated" },
      },
    ];

    for (const row of matrix) {
      const mock = evidenceExec(row.input);
      const evidence = collectGithubEvidence({ cwd: "/repo", execFileSync: mock.execFileSync });
      assert.deepEqual(evidence, row.expected);
      assert.doesNotMatch(JSON.stringify(evidence), /token|SECRET/i);
    }
  });

  it("uses sanitized evidence only to recommend a fresh interactive choice", async (t) => {
    for (const row of [
      {
        input: { remote: "git@github.com:owner/repo.git", gh: "authenticated" },
        expected: "github",
      },
      {
        input: { remote: "https://example.com/owner/repo.git", gh: "authenticated" },
        expected: "local",
      },
    ]) {
      const root = makeRoot(t, `setup-interactive-${row.expected}-`);
      const mock = evidenceExec(row.input);
      let promptInput;
      const result = await runSetup(
        { cwd: root, projectName: "interactive" },
        {
          isInteractive: true,
          execFileSync: mock.execFileSync,
          prompt: (input) => {
            promptInput = input;
            return "";
          },
        }
      );
      assert.equal(result.selection, row.expected);
      assert.equal(result.selectionSource, "recommended");
      assert.equal(promptInput.recommendation, row.expected);
      assert.doesNotMatch(JSON.stringify(promptInput), /SECRET-TOKEN/);
    }
  });
});

describe("setup filesystem behavior", () => {
  it("creates a fresh explicit local setup without any provider call", async (t) => {
    const root = makeRoot(t);
    const result = await runSetup(
      { cwd: root, tracker: "local", nonInteractive: true, projectName: "demo" },
      { execFileSync: noProviderCalls() }
    );

    assert.equal(result.selection, "local");
    assert.equal(result.selectionSource, "explicit");
    assert.deepEqual(fs.readdirSync(path.join(root, "backlog")).sort(), [
      "completed", "config.yml", "sprints", "tasks",
    ]);
    const raw = fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8");
    assert.deepEqual(raw.match(/^tracker:\s*local\s*$/gm), ["tracker: local"]);
    const resolved = resolveConfiguredTracker(readConfig(path.join(root, "backlog")), {
      backlogDir: path.join(root, "backlog"),
    });
    assert.equal(resolved.tracker, "local");
  });

  it("creates a fresh explicit github setup without probing and emits static repair guidance", async (t) => {
    const root = makeRoot(t);
    const result = await runSetup(
      { cwd: root, tracker: "github", nonInteractive: true, projectName: "demo" },
      { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
    );

    assert.equal(result.selection, "github");
    assert.equal(result.github.checked, false);
    assert.match(result.github.repair, /gh auth login --hostname github\.com/);
    assert.match(fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"), /^tracker: github$/m);
  });

  it("refuses fresh non-interactive setup before mutation and prints a rerun command", async (t) => {
    const root = makeRoot(t);
    await assert.rejects(
      runSetup(
        { cwd: root, nonInteractive: true, projectName: "demo" },
        { execFileSync: noProviderCalls() }
      ),
      (error) => {
        assert.match(error.message, /--tracker local --non-interactive/);
        return true;
      }
    );
    assert.equal(fs.existsSync(path.join(root, "backlog")), false);
  });

  it("pins an existing legacy config to github without consulting live evidence", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: legacy\n# exact comment\ntask_prefix: BACK\n");
    const result = await runSetup(
      { cwd: root, nonInteractive: true },
      { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
    );
    assert.equal(result.selection, "github");
    assert.equal(result.selectionSource, "legacy-pin");
    assert.equal(
      fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"),
      "project_name: legacy\n# exact comment\ntask_prefix: BACK\ntracker: github\n"
    );
  });

  it("fails closed before reinterpreting legacy GitHub mirrors as local", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: legacy\n# exact comment\ntask_prefix: BACK\n");
    fs.mkdirSync(path.join(root, "backlog/tasks"));
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-42.md"), "---\nid: 42\n---\nlegacy mirror\n");
    const before = snapshotTree(root);

    await assert.rejects(
      runSetup(
        { cwd: root, tracker: "local", nonInteractive: true },
        { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
      ),
      (error) => {
        assert.match(error.message, /legacy GitHub authority/);
        assert.match(error.message, /--non-interactive/);
        assert.match(error.message, /--tracker.*local/);
        return true;
      }
    );
    assert.deepEqual(snapshotTree(root), before);
  });

  it("keeps an existing choice immutable across remote/auth changes unless explicit", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: stable\ntracker: local\n# tail\n");
    const configPath = path.join(root, "backlog/config.yml");
    const before = fs.statSync(configPath);
    const result = await runSetup(
      { cwd: root, nonInteractive: true },
      { execFileSync: noProviderCalls() }
    );
    const after = fs.statSync(configPath);
    assert.equal(result.selection, "local");
    assert.equal(result.selectionSource, "preserved");
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeMs, before.mtimeMs);

    await runSetup(
      { cwd: root, tracker: "github", nonInteractive: true },
      { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
    );
    assert.equal(
      fs.readFileSync(configPath, "utf8"),
      "project_name: stable\ntracker: github\n# tail\n"
    );
  });

  it("preserves an existing github selection with zero provider probes and static repair guidance", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: stable\ntracker: github\n# tail\n");
    for (const name of ["tasks", "sprints", "completed"]) {
      fs.mkdirSync(path.join(root, "backlog", name));
    }
    const configPath = path.join(root, "backlog/config.yml");
    const before = fs.statSync(configPath);
    const result = await runSetup(
      { cwd: root, nonInteractive: true },
      { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
    );
    const after = fs.statSync(configPath);
    assert.equal(result.selection, "github");
    assert.equal(result.selectionSource, "preserved");
    assert.equal(result.github.checked, false);
    assert.equal(result.github.fallbackAttempted, false);
    assert.match(result.github.repair, /gh auth login/);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(fs.readFileSync(configPath, "utf8"), "project_name: stable\ntracker: github\n# tail\n");
  });

  it("repairs partial structure while preserving all user files and reruns as a true no-op", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: partial\ntracker: local\n");
    fs.mkdirSync(path.join(root, "backlog/tasks"));
    fs.mkdirSync(path.join(root, "backlog/sprints"));
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-1.md"), "task bytes\r\n");
    fs.writeFileSync(path.join(root, "backlog/sprints/current.md"), "sprint bytes");
    const before = snapshotTree(path.join(root, "backlog"));

    await runSetup(
      { cwd: root, nonInteractive: true },
      { execFileSync: noProviderCalls() }
    );
    const repaired = snapshotTree(path.join(root, "backlog"));
    for (const key of ["config.yml", "tasks", "tasks/BACK-1.md", "sprints", "sprints/current.md"]) {
      assert.deepEqual(repaired[key], before[key]);
    }
    assert.equal(repaired.completed.type, "directory");

    await runSetup(
      { cwd: root, nonInteractive: true },
      { execFileSync: noProviderCalls() }
    );
    assert.deepEqual(snapshotTree(path.join(root, "backlog")), repaired);
  });

  it("adds a missing config without changing task, sprint, or completed names/bytes/metadata", async (t) => {
    const root = makeRoot(t);
    for (const name of ["tasks", "sprints", "completed"]) {
      fs.mkdirSync(path.join(root, "backlog", name), { recursive: true });
    }
    fs.writeFileSync(path.join(root, "backlog/tasks/BACK-7.md"), "task\r\nbytes");
    fs.writeFileSync(path.join(root, "backlog/sprints/sprint.md"), "sprint bytes\n");
    fs.writeFileSync(path.join(root, "backlog/completed/BACK-3.md"), "completed bytes");
    const before = snapshotTree(path.join(root, "backlog"));

    await runSetup(
      { cwd: root, tracker: "local", nonInteractive: true, projectName: "partial" },
      { execFileSync: noProviderCalls() }
    );
    const after = snapshotTree(path.join(root, "backlog"));
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key]);
    assert.equal(after["config.yml"].type, "file");
  });

  it("fails malformed or duplicate tracker config before directories or temp files", async (t) => {
    for (const [index, raw] of ["tracker: gitlab\n", "tracker: local\ntracker: github\n"].entries()) {
      const root = makeRoot(t, `setup-invalid-${index}-`);
      writeConfig(root, raw);
      const before = snapshotTree(root);
      await assert.rejects(
        runSetup({ cwd: root, nonInteractive: true }),
        ConfigValidationError
      );
      assert.deepEqual(snapshotTree(root), before);
      assert.deepEqual(fs.readdirSync(path.join(root, "backlog")), ["config.yml"]);
    }
  });

  it("cleans temp files and preserves the original on injected write/rename failures", async (t) => {
    for (const failure of ["write", "rename"]) {
      const root = makeRoot(t, `setup-atomic-${failure}-`);
      const original = "project_name: atomic\ntracker: local\n# untouched\n";
      writeConfig(root, original);
      const configPath = path.join(root, "backlog/config.yml");
      const realFs = fs;
      const fsApi = {
        ...realFs,
        writeFileSync(file, content, options) {
          if (failure === "write" && path.basename(file).includes(".tmp")) {
            realFs.writeFileSync(file, "partial", options);
            throw new Error("injected write failure");
          }
          return realFs.writeFileSync(file, content, options);
        },
        renameSync(from, to) {
          if (failure === "rename") throw new Error("injected rename failure");
          return realFs.renameSync(from, to);
        },
      };

      await assert.rejects(
        runSetup(
          { cwd: root, tracker: "github", nonInteractive: true },
          { fs: fsApi, checkGithubAvailability: () => ({ available: true }) }
        ),
        /injected/
      );
      assert.equal(realFs.readFileSync(configPath, "utf8"), original);
      assert.deepEqual(realFs.readdirSync(path.dirname(configPath)), ["config.yml"]);
    }
  });

  it("preserves config mode across an atomic tracker replacement", async (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: mode\ntracker: local\n");
    const configPath = path.join(root, "backlog/config.yml");
    fs.chmodSync(configPath, 0o640);
    await runSetup(
      { cwd: root, tracker: "github", nonInteractive: true },
      { execFileSync: noProviderCalls(), checkGithubAvailability: noProviderCalls() }
    );
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o640);
  });

  it("rejects symlinked backlog/config paths before mutation", async (t) => {
    const root = makeRoot(t);
    const outside = makeRoot(t, "setup-outside-");
    fs.symlinkSync(outside, path.join(root, "backlog"));
    await assert.rejects(
      runSetup({ cwd: root, tracker: "local", nonInteractive: true }),
      /unsafe backlog path/
    );
    assert.deepEqual(fs.readdirSync(outside), []);
  });

  it("rolls back directories created before an intermediate mkdir failure", async (t) => {
    const root = makeRoot(t);
    const fsApi = {
      ...fs,
      mkdirSync(directory, options) {
        if (directory === path.join(root, "backlog", "tasks")) {
          throw new Error("injected mkdir failure");
        }
        return fs.mkdirSync(directory, options);
      },
    };
    await assert.rejects(
      runSetup(
        { cwd: root, tracker: "local", nonInteractive: true },
        { fs: fsApi, execFileSync: noProviderCalls() }
      ),
      /injected mkdir failure/
    );
    assert.equal(fs.existsSync(path.join(root, "backlog")), false);
  });
});

describe("CLI and compatibility wrapper", () => {
  it("spawns the Node CLI for fresh explicit setup and structured output", (t) => {
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
    assert.match(fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8"), /^tracker: local$/m);
  });

  it("CLI refusal is actionable and leaves no filesystem mutation", (t) => {
    const root = makeRoot(t);
    const run = spawnSync(process.execPath, [SCRIPT, "--non-interactive"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /--tracker local --non-interactive/);
    assert.equal(fs.existsSync(path.join(root, "backlog")), false);
  });

  it("init.sh preserves the legacy project-name interface and fresh github meaning", (t) => {
    const root = makeRoot(t);
    const run = spawnSync("bash", [INIT, "wrapper-demo"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const raw = fs.readFileSync(path.join(root, "backlog/config.yml"), "utf8");
    assert.match(raw, /^project_name: "wrapper-demo"$/m);
    assert.deepEqual(raw.match(/^tracker:\s*github\s*$/gm), ["tracker: github"]);
  });

  it("init.sh preserves an existing local selection without provider probing", (t) => {
    const root = makeRoot(t);
    writeConfig(root, "project_name: existing\ntracker: local\n# keep\n");
    for (const name of ["tasks", "sprints", "completed"]) {
      fs.mkdirSync(path.join(root, "backlog", name));
    }
    const before = snapshotTree(path.join(root, "backlog"));
    const run = spawnSync("bash", [INIT, "ignored-new-name"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(snapshotTree(path.join(root, "backlog")), before);
  });
});
