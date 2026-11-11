const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  SetupError,
  parseArgs,
  runSetup,
} = require(path.join(SKILL_SCRIPTS, "setup-dev-backlog.js"));
const {
  leftoverSkillFiles,
  migrateLegacyExecutionRoot,
} = require(path.join(SKILL_SCRIPTS, "execution-root.js"));

function root(t, prefix = "setup-github-only-") {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

function snapshot(directory) {
  const result = {};
  function walk(current, relative = "") {
    if (!fs.existsSync(current)) return;
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const key = path.join(relative, name);
      const stat = fs.lstatSync(full);
      result[key] = {
        type: stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file",
        bytes: stat.isFile() ? fs.readFileSync(full, "base64") : null,
      };
      if (stat.isDirectory()) walk(full, key);
    }
  }
  walk(directory);
  return result;
}

describe("bounded legacy migration", () => {
  it("requires explicit migration and rejects both removed flags (#499)", () => {
    assert.deepEqual(parseArgs(["--migrate-legacy", "--json"]), {
      migrateLegacy: true,
      json: true,
      help: false,
    });
    assert.throws(() => parseArgs(["--tracker", "files"]), /Removed argument: --tracker/);
    assert.throws(() => parseArgs(["--tracker=files"]), /Removed argument: --tracker/);
    assert.throws(() => parseArgs(["--non-interactive"]), /Removed argument: --non-interactive/);
  });

  it("refuses an unapproved invocation without any filesystem effect", async (t) => {
    const cwd = root(t);
    fs.mkdirSync(path.join(cwd, ".dev-backlog", "sprints"), { recursive: true });
    fs.mkdirSync(path.join(cwd, "backlog", "sprints"), { recursive: true });
    fs.writeFileSync(path.join(cwd, ".dev-backlog", "sprints", "active.md"), "active\r\n");
    fs.writeFileSync(path.join(cwd, ".dev-backlog", "sprints", "_context.md"), "context\r\n");
    fs.writeFileSync(path.join(cwd, "backlog", "sprints", "leftover.md"), "leftover\r\n");
    const before = snapshot(cwd);
    await assert.rejects(runSetup({ cwd }), SetupError);
    assert.deepEqual(snapshot(cwd), before);
  });

  it("does nothing on a fresh repository; sprint-init owns fresh creation", async (t) => {
    const cwd = root(t);
    const result = await runSetup({ cwd, migrateLegacy: true });
    assert.deepEqual(result, {
      action: "migrate-legacy-layout",
      migrated: false,
      reason: "no-legacy-skill-files",
    });
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("refuses an unsafe destination root before any effect", async (t) => {
    const cwd = root(t);
    const outside = root(t, "setup-outside-");
    try {
      fs.symlinkSync(outside, path.join(cwd, ".dev-backlog"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege unavailable");
        return;
      }
      throw error;
    }
    const before = snapshot(cwd);
    await assert.rejects(runSetup({ cwd, migrateLegacy: true }), SetupError);
    assert.deepEqual(snapshot(cwd), before);
  });

  it("migrates declared files byte-for-byte and leaves unrelated backlog content", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(path.join(source, "sprints"), { recursive: true });
    fs.mkdirSync(path.join(source, "tasks"));
    const configBytes = Buffer.from([0x70, 0x72, 0x6f, 0x6a, 0x0d, 0x0a, 0xff]);
    const sprintBytes = Buffer.from([0x00, 0x23, 0x20, 0x6b, 0x65, 0x65, 0x70, 0x0a]);
    fs.writeFileSync(path.join(source, "config.yml"), configBytes);
    fs.writeFileSync(path.join(source, "sprints", "keep.md"), sprintBytes);
    fs.writeFileSync(path.join(source, "tasks", "one.md"), "export\n");
    fs.writeFileSync(path.join(source, ".tracker"), "not-an-allow-listed-value\n");
    const unrelatedBefore = snapshot(source);

    const result = await runSetup({ cwd, migrateLegacy: true });

    assert.equal(result.migrated, true);
    assert.deepEqual(result.moved, ["sprints", "config.yml"]);
    assert.deepEqual(fs.readFileSync(path.join(cwd, ".dev-backlog/config.yml")), configBytes);
    assert.deepEqual(fs.readFileSync(path.join(cwd, ".dev-backlog/sprints/keep.md")), sprintBytes);
    assert.equal(fs.existsSync(path.join(source, "sprints")), false);
    assert.equal(fs.existsSync(path.join(source, "config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "tasks", "one.md"), "utf8"), "export\n");
    assert.equal(fs.readFileSync(path.join(source, ".tracker"), "utf8"), "not-an-allow-listed-value\n");
    assert.deepEqual(
      Object.fromEntries(Object.entries(snapshot(source)).filter(([name]) => !["sprints", "config.yml"].includes(name))),
      Object.fromEntries(Object.entries(unrelatedBefore).filter(([name]) => !name.startsWith("sprints") && name !== "config.yml")),
    );
  });

  it("leaves a lone backlog/config.yml and parked .tracker in place", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    const raw = "project_name: backlog-md\ndefault_status: To Do\n";
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "config.yml"), raw);
    fs.writeFileSync(path.join(source, ".tracker"), "files\n");

    await runSetup({ cwd, migrateLegacy: true });

    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog/config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "config.yml"), "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(source, ".tracker"), "utf8"), "files\n");
    assert.deepEqual(leftoverSkillFiles(cwd), []);
  });

  it("leaves legacy content byte-identical when the destination already exists", (t) => {
    const cwd = root(t);
    fs.mkdirSync(path.join(cwd, ".dev-backlog"));
    fs.mkdirSync(path.join(cwd, "backlog", "sprints"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "backlog", "sprints", "keep.md"), "# leftover\n");
    const before = snapshot(path.join(cwd, "backlog"));
    const result = migrateLegacyExecutionRoot(cwd);
    assert.equal(result.migrated, false);
    assert.equal(result.reason, "destination-exists");
    assert.equal(fs.readFileSync(path.join(cwd, "backlog", "sprints", "keep.md"), "utf8"), "# leftover\n");
    assert.deepEqual(snapshot(path.join(cwd, "backlog")), before);
    assert.deepEqual(leftoverSkillFiles(cwd), ["sprints"]);
  });

  it("removes staging and leaves every original after a copy failure", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(path.join(source, "sprints"), { recursive: true });
    fs.writeFileSync(path.join(source, "sprints", "one.md"), "one\n");
    fs.writeFileSync(path.join(source, "sprints", "two.md"), "two\n");
    const before = snapshot(source);
    const failingFs = Object.create(fs);
    failingFs.copyFileSync = (from, to) => {
      if (from.endsWith(`${path.sep}two.md`)) throw new Error("injected copy failure");
      return fs.copyFileSync(from, to);
    };

    await assert.rejects(
      runSetup({ cwd, migrateLegacy: true }, { fs: failingFs }),
      /injected copy failure/,
    );
    assert.deepEqual(snapshot(source), before);
    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog")), false);
    assert.deepEqual(fs.readdirSync(cwd).sort(), ["backlog"]);
  });

  it("keeps a complete recovery copy when source removal fails midway", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(path.join(source, "sprints"), { recursive: true });
    fs.writeFileSync(path.join(source, "sprints", "keep.md"), "sprint bytes\n");
    fs.writeFileSync(path.join(source, "config.yml"), "config bytes\n");
    const failingFs = Object.create(fs);
    failingFs.unlinkSync = (target) => {
      if (target === path.join(source, "config.yml")) throw new Error("injected remove failure");
      return fs.unlinkSync(target);
    };

    await assert.rejects(
      runSetup({ cwd, migrateLegacy: true }, { fs: failingFs }),
      /complete recovery copy/,
    );
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/sprints/keep.md"), "utf8"), "sprint bytes\n");
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/config.yml"), "utf8"), "config bytes\n");
    assert.equal(fs.readFileSync(path.join(source, "config.yml"), "utf8"), "config bytes\n");
  });
});
